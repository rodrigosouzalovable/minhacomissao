import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // GET → Meta verify challenge
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expected = Deno.env.get('WHATSAPP_META_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === expected && challenge) {
      return new Response(challenge, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }
    return new Response('forbidden', { status: 403, headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const payload = await req.json();
    console.log('[MetaWebhook] payload:', JSON.stringify(payload).slice(0, 1000));

    const entries = payload.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const { data: inst } = await supabase
          .from('meta_whatsapp_instances').select('id, user_id')
          .eq('phone_number_id', phoneNumberId).maybeSingle();
        if (!inst) continue;

        // Incoming messages → write to whatsapp_mensagens with provedor='meta'
        const messages = value.messages || [];
        for (const m of messages) {
          const from = m.from; // already in international format without '+'
          const text = m.text?.body || m.button?.text || m.interactive?.button_reply?.title || `[${m.type}]`;
          const ts = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString();

          // We don't yet have a whatsapp_contatos row tied to a Meta instance; only store the message
          // tagged as provedor='meta' so Inbox queries can opt-in later.
          await supabase.from('whatsapp_mensagens').insert({
            instancia_id: null,
            telefone_remoto: from,
            conteudo: text,
            direcao: 'entrada',
            timestamp_msg: ts,
            lida: false,
            whatsapp_msg_id: m.id,
            provedor: 'meta',
          } as any);

          // Mark last log entry for this phone as 'replied'
          await supabase.from('meta_whatsapp_envios_log')
            .update({ status: 'replied' })
            .eq('instancia_id', inst.id)
            .eq('telefone', from)
            .neq('status', 'replied');
        }

        // Status updates (delivered, read, failed)
        const statuses = value.statuses || [];
        for (const s of statuses) {
          const waId = s.id;
          const status = s.status; // sent | delivered | read | failed
          if (!waId) continue;
          await supabase.from('meta_whatsapp_envios_log')
            .update({ status })
            .eq('wa_message_id', waId);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[MetaWebhook] erro:', err);
    return new Response(JSON.stringify({ ok: false }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
