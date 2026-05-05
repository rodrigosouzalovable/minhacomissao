// UAZAPI webhook receiver — atualiza status_envio das mensagens enviadas
// (entregue/lida) e recebe novas mensagens em tempo real.
// Público (verify_jwt = false). A instância é resolvida pelo query param ?instancia_id=
// ou pelo token presente no payload.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function pickStatus(raw: any): 'entregue' | 'lida' | null {
  const s = String(raw ?? '').toUpperCase();
  if (!s) return null;
  // UAZAPI / Baileys variants
  if (s.includes('READ') || s === 'PLAYED' || s === '4' || s === '5') return 'lida';
  if (s.includes('DELIVER') || s === 'SERVER_ACK' || s === 'DELIVERY_ACK' || s === '3' || s === '2') return 'entregue';
  return null;
}

function extractMsgId(raw: any): string | null {
  if (!raw) return null;
  const id = raw.id || raw.messageId || raw.key?.id || raw.message?.id || raw.msgId || null;
  if (!id) return null;
  const s = String(id);
  return s.includes(':') ? s.split(':').pop() || s : s;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const instanciaIdParam = url.searchParams.get('instancia_id');

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    // ⚠ COST CONTROL: drop group/broadcast/status events imediatamente.
    const _bodyStr = JSON.stringify(body).substring(0, 4096);
    if (
      /"(chatid|chatId|remoteJid|from|wa_chatid)"\s*:\s*"[^"]*@g\.us"/i.test(_bodyStr) ||
      /"(chatid|chatId|remoteJid|from|wa_chatid)"\s*:\s*"status@broadcast"/i.test(_bodyStr) ||
      /"(isGroup|wa_isGroup)"\s*:\s*true/i.test(_bodyStr)
    ) {
      return new Response(JSON.stringify({ ok: true, ignored: 'group_or_broadcast' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // UAZAPI envia eventos de tipos diversos — tentamos extrair de forma tolerante.
    const eventType = String(body?.event || body?.type || body?.EventType || body?.action || '').toLowerCase();

    // ----- 1) Eventos de status (ACK) -----
    // formatos comuns: { event: 'messages.update', data: { id, status, ... } }
    //                  { event: 'message.ack', ack: 3, id: '...' }
    //                  { type: 'status', status: 'READ', messageId: '...' }
    const isStatusEvent =
      eventType.includes('ack') ||
      eventType.includes('status') ||
      eventType.includes('update') ||
      'ack' in (body || {});

    if (isStatusEvent) {
      const data = body?.data ?? body?.message ?? body;
      const msgId = extractMsgId(data) || extractMsgId(body);
      const statusRaw = data?.status ?? body?.status ?? body?.ack ?? data?.ack;
      const novoStatus = pickStatus(statusRaw);

      if (msgId && novoStatus) {
        // Só "promovemos" o status (não regredimos lida → entregue)
        const { data: existing } = await supabase
          .from('whatsapp_mensagens')
          .select('id, status_envio')
          .eq('whatsapp_msg_id', msgId)
          .limit(1)
          .maybeSingle();

        const ordem: Record<string, number> = {
          enviando: 0, enviada: 1, entregue: 2, lida: 3, erro: -1,
        };
        const atual = ordem[existing?.status_envio || 'enviada'] ?? 1;
        const novo = ordem[novoStatus];

        if (existing && novo > atual) {
          await supabase
            .from('whatsapp_mensagens')
            .update({ status_envio: novoStatus, lida: novoStatus === 'lida' ? true : undefined })
            .eq('id', existing.id);
        }

        return new Response(JSON.stringify({ ok: true, updated: !!existing && novo > atual }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ----- 2) Outros eventos (mensagens recebidas etc.) — apenas confirmamos recebimento -----
    // O fluxo de gravação de mensagens recebidas continua sendo via import/polling existente.
    // Aqui só confirmamos 200 para a UAZAPI não desabilitar o webhook.
    void instanciaIdParam; // reservado para uso futuro
    return new Response(JSON.stringify({ ok: true, ignored: true, event: eventType || null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[uazapi-webhook] erro:', err);
    // Sempre 200 para não causar retry agressivo da UAZAPI
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
