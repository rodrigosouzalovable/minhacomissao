import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeia status da Meta -> status interno do app
function mapStatusMeta(s: string): string {
  switch (s) {
    case 'sent': return 'enviada';
    case 'delivered': return 'entregue';
    case 'read': return 'lida';
    case 'failed': return 'erro';
    default: return 'enviada';
  }
}

function extractTextoFromMessage(m: any): { texto: string; tipo: string; media_url: string | null } {
  const tipo = m.type || 'texto';
  if (m.text?.body) return { texto: m.text.body, tipo: 'texto', media_url: null };
  if (m.button?.text) return { texto: m.button.text, tipo: 'texto', media_url: null };
  if (m.interactive?.button_reply?.title) return { texto: m.interactive.button_reply.title, tipo: 'texto', media_url: null };
  if (m.interactive?.list_reply?.title) return { texto: m.interactive.list_reply.title, tipo: 'texto', media_url: null };
  if (tipo === 'image') return { texto: m.image?.caption || '[Imagem]', tipo: 'imagem', media_url: null };
  if (tipo === 'audio') return { texto: '[Áudio]', tipo: 'audio', media_url: null };
  if (tipo === 'document') return { texto: m.document?.filename || '[Documento]', tipo: 'documento', media_url: null };
  if (tipo === 'video') return { texto: m.video?.caption || '[Vídeo]', tipo: 'video', media_url: null };
  return { texto: `[${tipo}]`, tipo: 'texto', media_url: null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // GET → Meta verify challenge
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const { data: config } = await supabase
      .from('meta_whatsapp_config')
      .select('valor')
      .eq('chave', 'webhook_verify_token')
      .maybeSingle();

    const expected = config?.valor;

    if (mode === 'subscribe' && token === expected && challenge) {
      return new Response(challenge, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }
    return new Response('forbidden', { status: 403, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const firstEntry = payload?.entry?.[0]?.changes?.[0];
    console.log('[MetaWebhook] POST recebido', {
      object: payload?.object,
      field: firstEntry?.field,
      phone_number_id: firstEntry?.value?.metadata?.phone_number_id,
      messages: firstEntry?.value?.messages?.length || 0,
      statuses: firstEntry?.value?.statuses?.length || 0,
    });

    const entries = payload.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const { data: inst } = await supabase
          .from('meta_whatsapp_instances').select('id, user_id, display_phone')
          .eq('phone_number_id', phoneNumberId).maybeSingle();
        if (!inst) continue;

        const businessDigits = String(inst.display_phone || '').replace(/\D/g, '');
        const isEchoField = String(change.field || '').toLowerCase() === 'message_echoes';

        // ===== Mensagens recebidas =====
        const messages = value.messages || [];
        const contacts = value.contacts || [];
        const nomePorWaId: Record<string, string> = {};
        for (const c of contacts) {
          if (c?.wa_id && c?.profile?.name) nomePorWaId[c.wa_id] = c.profile.name;
        }

        for (const m of messages) {
          const from = m.from;
          if (!from) continue;
          const { texto, tipo } = extractTextoFromMessage(m);
          const tsMsg = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString();
          const nomeContato = nomePorWaId[from] || null;

          // Insere mensagem (dedup via UNIQUE instancia_id + wa_message_id)
          await supabase.from('meta_whatsapp_mensagens').insert({
            user_id: inst.user_id,
            instancia_id: inst.id,
            telefone: from,
            direcao: 'entrada',
            conteudo: texto,
            tipo_conteudo: tipo,
            timestamp_msg: tsMsg,
            status_envio: 'entregue',
            wa_message_id: m.id,
          } as any);

          // Upsert contato — incrementa não-lido e atualiza preview
          const { data: existente } = await supabase
            .from('meta_whatsapp_contatos')
            .select('id, nao_lido, nome')
            .eq('instancia_id', inst.id)
            .eq('telefone', from)
            .maybeSingle();

          if (existente) {
            await supabase.from('meta_whatsapp_contatos')
              .update({
                ultima_mensagem: texto,
                ultima_mensagem_em: tsMsg,
                ultima_msg_entrada_em: tsMsg,
                nao_lido: (existente.nao_lido || 0) + 1,
                nome: existente.nome || nomeContato,
                atualizado_em: new Date().toISOString(),
              })
              .eq('id', existente.id);
          } else {
            await supabase.from('meta_whatsapp_contatos').insert({
              user_id: inst.user_id,
              instancia_id: inst.id,
              telefone: from,
              nome: nomeContato,
              ultima_mensagem: texto,
              ultima_mensagem_em: tsMsg,
              ultima_msg_entrada_em: tsMsg,
              nao_lido: 1,
            } as any);
          }

          // Compatibilidade com o log de envios em massa
          await supabase.from('meta_whatsapp_envios_log')
            .update({ status: 'replied' })
            .eq('instancia_id', inst.id)
            .eq('telefone', from)
            .neq('status', 'replied');
        }

        // ===== Atualizações de status =====
        const statuses = value.statuses || [];
        for (const s of statuses) {
          const waId = s.id;
          const status = s.status; // sent | delivered | read | failed
          if (!waId) continue;

          const novoStatus = mapStatusMeta(status);

          // Atualiza mensagem do inbox
          await supabase.from('meta_whatsapp_mensagens')
            .update({
              status_envio: novoStatus,
              erro: status === 'failed' ? (s.errors?.[0]?.title || s.errors?.[0]?.message || 'falha') : null,
            })
            .eq('wa_message_id', waId);

          // Compatibilidade com log de massa
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
