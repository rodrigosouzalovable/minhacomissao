// Envia mídia (imagem, documento, áudio) pela API oficial Meta dentro da janela 24h.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatTel(tel: string): string {
  const d = (tel || '').replace(/\D/g, '');
  if (!d) return '';
  return d.startsWith('55') ? d : `55${d}`;
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
    const payload: any = { link: media_url };
    if (metaType === 'document') {
      if (file_name) payload.filename = file_name;
      if (caption) payload.caption = caption;
    }
    if (metaType === 'image' && caption) payload.caption = caption;

    const body: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: useBsuid ? bsuid : to,
      type: metaType,
      [metaType]: payload,
    };
    if (reply_to_wa_id) body.context = { message_id: reply_to_wa_id };

    const res = await fetch(`https://graph.facebook.com/v21.0/${inst.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${inst.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
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
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
