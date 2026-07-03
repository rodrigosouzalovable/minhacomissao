// Envia mídia (imagem, documento, áudio, vídeo) pela API oficial Meta dentro da janela 24h.
// Áudio é enviado via Meta Media API (upload multipart) para evitar rejeição de container webm.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH = 'https://graph.facebook.com/v21.0';

function formatTel(tel: string): string {
  const d = (tel || '').replace(/\D/g, '');
  if (!d) return '';
  return d.startsWith('55') ? d : `55${d}`;
}

function guessAudioMime(url: string): string {
  const u = url.toLowerCase();
  if (u.endsWith('.ogg') || u.includes('.ogg?')) return 'audio/ogg';
  if (u.endsWith('.mp3') || u.includes('.mp3?')) return 'audio/mpeg';
  if (u.endsWith('.m4a') || u.endsWith('.mp4') || u.includes('.m4a?') || u.includes('.mp4?')) return 'audio/mp4';
  if (u.endsWith('.aac') || u.includes('.aac?')) return 'audio/aac';
  if (u.endsWith('.amr') || u.includes('.amr?')) return 'audio/amr';
  if (u.endsWith('.webm') || u.includes('.webm?')) return 'audio/webm';
  return 'application/octet-stream';
}

// Sobe o binário para Meta /PHONE_ID/media e devolve o media id.
async function uploadAudioToMeta(inst: any, mediaUrl: string): Promise<{ id?: string; error?: string; status?: number }> {
  const res = await fetch(mediaUrl);
  if (!res.ok) return { error: `Falha ao baixar áudio do storage (HTTP ${res.status})` };
  const buf = new Uint8Array(await res.arrayBuffer());
  const mime = guessAudioMime(mediaUrl);

  // Meta aceita: audio/aac, audio/mp4, audio/mpeg, audio/amr, audio/ogg (OPUS).
  if (mime === 'audio/webm' || mime === 'application/octet-stream') {
    return { error: 'Formato de áudio não suportado pela Meta (WhatsApp aceita OGG/OPUS, AAC, MP3, M4A ou AMR). Grave novamente em um navegador atualizado (Chrome/Edge).' };
  }

  const ext = mime === 'audio/ogg' ? 'ogg' : mime === 'audio/mpeg' ? 'mp3' : mime === 'audio/mp4' ? 'm4a' : mime === 'audio/aac' ? 'aac' : 'amr';
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mime);
  form.append('file', new Blob([buf], { type: mime }), `audio.${ext}`);

  const up = await fetch(`${GRAPH}/${inst.phone_number_id}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${inst.access_token}` },
    body: form,
  });
  const upJson: any = await up.json().catch(() => ({}));
  if (!up.ok) {
    console.log('[send-whatsapp-meta-media] Meta upload error', upJson);
    return { error: upJson?.error?.message || `HTTP ${up.status} no upload de mídia`, status: up.status };
  }
  return { id: upJson?.id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const {
      instancia_id, telefone, bsuid, media_url, type, file_name, caption, user_id,
      reply_to_wa_id, conteudo_citado,
    } = await req.json();

    if (!instancia_id || (!telefone && !bsuid) || !media_url || !type) {
      return new Response(JSON.stringify({ success: false, error: 'instancia_id, (telefone ou bsuid), media_url, type obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: inst } = await supabase
      .from('meta_whatsapp_instances')
      .select('*')
      .eq('id', instancia_id).eq('ativo', true).maybeSingle();
    if (!inst) {
      return new Response(JSON.stringify({ success: false, error: 'Instância Meta inativa/não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uid = user_id || inst.user_id;
    const to = telefone ? formatTel(telefone) : '';
    const useBsuid = !to && !!bsuid;

    // Verifica janela 24h — busca contato por telefone ou BSUID
    let contatoQuery = supabase
      .from('meta_whatsapp_contatos')
      .select('id, ultima_msg_entrada_em, telefone, bsuid')
      .eq('instancia_id', instancia_id);
    if (useBsuid) contatoQuery = contatoQuery.eq('bsuid', bsuid);
    else contatoQuery = contatoQuery.eq('telefone', to);
    const { data: contato } = await contatoQuery.maybeSingle();
    const ultimaEntrada = contato?.ultima_msg_entrada_em ? new Date(contato.ultima_msg_entrada_em).getTime() : 0;
    if (!ultimaEntrada || (Date.now() - ultimaEntrada) >= 24 * 60 * 60 * 1000) {
      return new Response(JSON.stringify({ success: false, janela_expirada: true, error: 'Janela 24h expirada' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Constrói body Meta
    const metaType = type === 'image' ? 'image' : type === 'audio' ? 'audio' : type === 'video' ? 'video' : 'document';

    // Para áudio: fazer upload direto ao Meta e usar `id` — Meta rejeita audio/webm por link.
    let payload: any;
    if (metaType === 'audio') {
      const up = await uploadAudioToMeta(inst, media_url);
      if (!up.id) {
        return new Response(JSON.stringify({ success: false, error: up.error || 'Falha ao subir áudio para a Meta' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      payload = { id: up.id };
    } else {
      payload = { link: media_url };
      if (metaType === 'document') {
        if (file_name) payload.filename = file_name;
        if (caption) payload.caption = caption;
      }
      if (metaType === 'image' && caption) payload.caption = caption;
      if (metaType === 'video' && caption) payload.caption = caption;
    }

    const body: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: useBsuid ? bsuid : to,
      type: metaType,
      [metaType]: payload,
    };
    if (reply_to_wa_id) body.context = { message_id: reply_to_wa_id };

    const res = await fetch(`${GRAPH}/${inst.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${inst.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.log('[send-whatsapp-meta-media] Meta send error', { metaType, err: data });
      return new Response(JSON.stringify({ success: false, error: data?.error?.message || `HTTP ${res.status}`, raw: data }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const waId = data?.messages?.[0]?.id || null;
    const nowIso = new Date().toISOString();
    const tipoConteudoLocal = metaType === 'image' ? 'imagem' : metaType === 'audio' ? 'audio' : metaType === 'video' ? 'video' : 'documento';
    const preview = metaType === 'image' ? '📷 Imagem' : metaType === 'audio' ? '🎵 Áudio' : metaType === 'video' ? '🎥 Vídeo' : `📄 ${file_name || 'Documento'}`;

    await supabase.from('meta_whatsapp_mensagens').insert({
      user_id: uid,
      instancia_id,
      telefone: to || null,
      bsuid: useBsuid ? bsuid : (contato?.bsuid || null),
      direcao: 'saida',
      conteudo: caption || preview,
      tipo_conteudo: tipoConteudoLocal,
      media_url,
      timestamp_msg: nowIso,
      status_envio: 'enviada',
      wa_message_id: waId,
      wa_message_id_reply: reply_to_wa_id || null,
      conteudo_citado: conteudo_citado || null,
    } as any);

    if (contato?.id) {
      await supabase.from('meta_whatsapp_contatos')
        .update({ ultima_mensagem: preview, ultima_mensagem_em: nowIso, atualizado_em: nowIso })
        .eq('id', contato.id);
    } else {
      await supabase.from('meta_whatsapp_contatos').insert({
        user_id: uid, instancia_id,
        telefone: to || null,
        telefone_visivel: !!to,
        bsuid: useBsuid ? bsuid : null,
        ultima_mensagem: preview, ultima_mensagem_em: nowIso,
      } as any);
    }

    return new Response(JSON.stringify({ success: true, waId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.log('[send-whatsapp-meta-media] exception', err);
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
