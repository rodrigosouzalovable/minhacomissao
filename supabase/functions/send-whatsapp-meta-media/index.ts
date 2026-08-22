// Envia mídia (imagem, documento, áudio, vídeo) pela API oficial Meta dentro da janela 24h.
// Áudio é enviado via Meta Media API (upload multipart) para evitar rejeição de container webm.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { rotuloInstancia } from '../_shared/rotulo-instancia.ts';
import { ehNumeroInacessivel, MSG_NUMERO_INACESSIVEL, tratarNumeroInacessivel } from '../_shared/meta-numero-inacessivel.ts';
import { ehContaBloqueada, MSG_CONTA_BLOQUEADA, tratarContaBloqueada } from '../_shared/meta-conta-bloqueada.ts';


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
  console.log('[send-whatsapp-meta-media] audio storage download started');
  const res = await fetch(mediaUrl);
  if (!res.ok) {
    console.log('[send-whatsapp-meta-media] audio storage download failed', { status: res.status });
    return { error: `Falha ao baixar o áudio armazenado (HTTP ${res.status})`, status: res.status };
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength < 128) {
    console.log('[send-whatsapp-meta-media] invalid audio binary', { bytes: buf.byteLength });
    return { error: 'O arquivo de áudio está vazio ou inválido. Grave novamente.' };
  }
  const guessed = guessAudioMime(mediaUrl);

  // O frontend já re-encoda tudo para OGG/OPUS 16 kHz mono via ffmpeg.wasm.
  // Forçamos audio/ogg sempre que o path indicar .ogg — evita que sujeira no
  // nome do arquivo (ex.: ".ogg; codecs=opus") caia em octet-stream.
  const url = (mediaUrl || '').toLowerCase();
  const mime = url.includes('.ogg') ? 'audio/ogg' : guessed;

  if (mime === 'audio/webm' || mime === 'application/octet-stream') {
    return { error: 'Formato de áudio não suportado pela Meta (WhatsApp aceita OGG/OPUS, AAC, MP3, M4A ou AMR). Grave novamente em um navegador atualizado (Chrome/Edge).' };
  }

  const ext = mime === 'audio/ogg' ? 'ogg' : mime === 'audio/mpeg' ? 'mp3' : mime === 'audio/mp4' ? 'm4a' : mime === 'audio/aac' ? 'aac' : 'amr';
  console.log('[send-whatsapp-meta-media] uploading audio to Meta', { bytes: buf.byteLength, mime, ext, phone_number_id: inst.phone_number_id });

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
    console.log('[send-whatsapp-meta-media] Meta upload error', { status: up.status, body: upJson });
    return { error: upJson?.error?.message || `HTTP ${up.status} no upload de mídia`, status: up.status };
  }
  console.log('[send-whatsapp-meta-media] Meta upload ok', { media_id: upJson?.id });
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
      console.log('[send-whatsapp-meta-media] invalid request', {
        has_instancia: !!instancia_id,
        has_destinatario: !!telefone || !!bsuid,
        has_media_url: !!media_url,
        type: type || null,
      });
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
    let to = telefone ? formatTel(telefone) : '';
    const useBsuid = !to && !!bsuid;
    console.log('[send-whatsapp-meta-media] request accepted', {
      type,
      provider: (inst as any).provider || 'meta',
      destination_type: useBsuid ? 'bsuid' : 'phone',
    });

    // Canonicaliza telefone pelos últimos 8 dígitos para reaproveitar o formato
    // já cadastrado no contato (evita duplicar a conversa com/sem o "9").
    if (to && to.length >= 8) {
      const sufixo = to.slice(-8);
      const { data: canon } = await supabase
        .from('meta_whatsapp_contatos')
        .select('telefone')
        .eq('instancia_id', instancia_id)
        .ilike('telefone', `%${sufixo}`)
        .neq('telefone', to)
        .order('atualizado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (canon?.telefone) to = canon.telefone;
    }

    // ===== Instâncias NÃO OFICIAIS (espelho UAZAPI / aba Acionamento) =====
    if ((inst as any).provider === 'uazapi') {
      const { data: uz } = await supabase
        .from('user_whatsapp_instances')
        .select('id, server_url, instance_token')
        .eq('id', (inst as any).uazapi_instance_id)
        .maybeSingle();
      if (!uz?.server_url || !uz?.instance_token) {
        return new Response(JSON.stringify({ success: false, error: 'Instância UAZAPI sem credenciais' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const cleanUrl = String(uz.server_url).replace(/\/+$/, '');
      const tipoUaz = type === 'audio' ? 'ptt' : type === 'image' ? 'image' : type === 'video' ? 'video' : 'document';
      let waId: string | null = null;
      let erroEnvio = '';
      try {
        const r = await fetch(`${cleanUrl}/send/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: uz.instance_token },
          body: JSON.stringify({
            number: to,
            type: tipoUaz,
            file: media_url,
            text: caption || '',
            docName: file_name || undefined,
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) erroEnvio = j?.message || j?.error || `HTTP ${r.status}`;
        else waId = String(j?.id || j?.messageid || j?.key?.id || '').split(':').pop() || null;
      } catch (e) {
        erroEnvio = e instanceof Error ? e.message : 'falha de rede UAZAPI';
      }

      if (erroEnvio) {
        return new Response(JSON.stringify({ success: false, error: erroEnvio }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const nowIso = new Date().toISOString();
      const tipoConteudo = type === 'audio' ? 'audio' : type === 'image' ? 'imagem' : type === 'video' ? 'video' : 'documento';

      const { data: msgRow } = await supabase.from('meta_whatsapp_mensagens').insert({
        user_id: uid,
        instancia_id,
        telefone: to,
        direcao: 'saida',
        conteudo: caption || `[${tipoConteudo}]`,
        tipo_conteudo: tipoConteudo,
        media_url,
        timestamp_msg: nowIso,
        status_envio: 'enviada',
        wa_message_id: waId,
      } as any).select('id').maybeSingle();

      await supabase.from('whatsapp_mensagens').insert({
        instancia_id: uz.id,
        telefone_remoto: to,
        conteudo: caption || `[${tipoConteudo}]`,
        direcao: 'saida',
        timestamp_msg: nowIso,
        lida: true,
        tipo_conteudo: tipoConteudo,
        media_url,
        whatsapp_msg_id: waId,
      } as any);

      const { data: ctUz } = await supabase
        .from('meta_whatsapp_contatos')
        .select('id')
        .eq('instancia_id', instancia_id)
        .eq('telefone', to)
        .maybeSingle();
      if ((ctUz as any)?.id) {
        await supabase.from('meta_whatsapp_contatos')
          .update({ ultima_mensagem: caption || `[${tipoConteudo}]`, ultima_mensagem_em: nowIso, atualizado_em: nowIso })
          .eq('id', (ctUz as any).id);
      }

      return new Response(JSON.stringify({ success: true, waId, mensagem_id: (msgRow as any)?.id || null, provider: 'uazapi' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }



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
      try {
        const { notificarAdmin } = await import('../_shared/notificar-admin.ts');
        const chave = `janela_bloqueio_midia_${uid}_${new Date().toISOString().slice(0, 10)}`;
        await notificarAdmin(supabase, {
          tipo: 'janela_24h_bloqueio',
          mensagem:
            `🔒 Tentativa de envio de mídia fora da janela 24h (BLOQUEADA)\n\n` +
            `Usuário: ${uid}\n` +
            `Instância: ${rotuloInstancia(inst)}\n` +
            `Destino: ${to || bsuid}\n` +
            `Tipo: ${type}\n\n` +
            `Enviar agora reclassificaria como MARKETING. Oriente a usar template UTILITY.`,
          chaveIdempotencia: chave,
        });
      } catch (_) { /* ignore */ }
      return new Response(JSON.stringify({ success: false, janela_expirada: true, error: 'Janela de 24h fechada. Envie um template UTILITY aprovado para reabrir a conversa.' }), {
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
        console.log('[send-whatsapp-meta-media] audio upload aborted', { error: up.error, status: up.status });
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
      const erroMsg = data?.error?.message || `HTTP ${res.status}`;
      if (ehNumeroInacessivel(erroMsg, data?.error?.code)) {
        await tratarNumeroInacessivel(supabase, inst, erroMsg);
        return new Response(JSON.stringify({
          success: false, instance_restricted: true, numero_inacessivel: true,
          error: MSG_NUMERO_INACESSIVEL, detalhe: erroMsg, instancia_id,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (ehContaBloqueada(erroMsg, data?.error?.code)) {
        await tratarContaBloqueada(supabase, inst, erroMsg);
        return new Response(JSON.stringify({
          success: false, instance_restricted: true, conta_bloqueada: true,
          error: MSG_CONTA_BLOQUEADA, detalhe: erroMsg, instancia_id,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: false, error: erroMsg, raw: data }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    const waId = data?.messages?.[0]?.id || null;
    console.log('[send-whatsapp-meta-media] message sent', { metaType, has_message_id: !!waId });
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
