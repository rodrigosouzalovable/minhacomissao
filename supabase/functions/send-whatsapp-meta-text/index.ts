// Envia mensagem de texto livre (free-form) pela API oficial Meta.
// Só funciona dentro da janela de 24h da última mensagem recebida do cliente.
// Para janelas expiradas, use send-whatsapp-meta com um template HSM.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aplicarEtiquetaAtendente } from '../_shared/etiqueta-atendente.ts';

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
    const { instancia_id, telefone, bsuid, texto, user_id, reply_to_wa_id, conteudo_citado, origem } = await req.json();
    if (!instancia_id || (!telefone && !bsuid) || !texto) {
      return new Response(JSON.stringify({ success: false, error: 'instancia_id, (telefone ou bsuid) e texto são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: inst } = await supabase
      .from('meta_whatsapp_instances')
      .select('*')
      .eq('id', instancia_id)
      .eq('ativo', true)
      .maybeSingle();

    if (!inst) {
      return new Response(JSON.stringify({ success: false, error: 'Instância Meta não encontrada/ativa' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uid = user_id || inst.user_id;
    let to = telefone ? formatTel(telefone) : '';
    // Modo BSUID (Meta 2026) — usado quando o cliente é username-only e não temos telefone
    const useBsuid = !to && !!bsuid;
    if (!to && !useBsuid) {
      return new Response(JSON.stringify({ success: false, error: 'Telefone ou BSUID inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Canonicaliza telefone pelos últimos 8 dígitos para reaproveitar o formato
    // já existente no contato (evita duplicar conversa com/sem o "9" do celular).
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

    // Bloqueia se janela 24h estiver expirada — checa por telefone OU bsuid
    let contatoQuery = supabase
      .from('meta_whatsapp_contatos')
      .select('id, ultima_msg_entrada_em, telefone, bsuid')
      .eq('instancia_id', instancia_id);
    if (useBsuid) contatoQuery = contatoQuery.eq('bsuid', bsuid);
    else contatoQuery = contatoQuery.eq('telefone', to);
    const { data: contato } = await contatoQuery.maybeSingle();

    const ultimaEntrada = contato?.ultima_msg_entrada_em ? new Date(contato.ultima_msg_entrada_em).getTime() : 0;
    const agora = Date.now();
    const janelaAberta = ultimaEntrada > 0 && (agora - ultimaEntrada) < 24 * 60 * 60 * 1000;

    if (!janelaAberta) {
      // Notifica admin (idempotente user+dia) para acompanhar tentativas de burlar a barreira
      try {
        const { notificarAdmin } = await import('../_shared/notificar-admin.ts');
        const chave = `janela_bloqueio_texto_${uid}_${new Date().toISOString().slice(0, 10)}`;
        await notificarAdmin(supabase, {
          tipo: 'janela_24h_bloqueio',
          mensagem:
            `🔒 Tentativa de envio livre fora da janela 24h (BLOQUEADA)\n\n` +
            `Usuário: ${uid}\n` +
            `Instância: ${rotuloInstancia(inst)}\n` +
            `Destino: ${to || bsuid}\n` +
            `Tipo: texto\n\n` +
            `Enviar agora reclassificaria como MARKETING. Oriente a usar template UTILITY.`,
          chaveIdempotencia: chave,
        });
      } catch (_) { /* não bloqueia resposta */ }

      return new Response(JSON.stringify({
        success: false,
        janela_expirada: true,
        error: 'Janela de 24h fechada. Envie um template UTILITY aprovado para reabrir a conversa.',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: useBsuid ? bsuid : to,
      type: 'text',
      text: { preview_url: false, body: String(texto).slice(0, 4096) },
    };
    if (reply_to_wa_id) body.context = { message_id: reply_to_wa_id };

    const res = await fetch(`https://graph.facebook.com/v21.0/${inst.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${inst.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const erro = data?.error?.message || `HTTP ${res.status}`;
      return new Response(JSON.stringify({ success: false, error: erro }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const waId: string | null = data?.messages?.[0]?.id || null;
    const nowIso = new Date().toISOString();

    // Persiste mensagem enviada
    const { data: msgRow } = await supabase.from('meta_whatsapp_mensagens').insert({
      user_id: uid,
      instancia_id,
      telefone: to || null,
      bsuid: useBsuid ? bsuid : (contato?.bsuid || null),
      direcao: 'saida',
      conteudo: texto,
      tipo_conteudo: 'texto',
      timestamp_msg: nowIso,
      status_envio: 'enviada',
      wa_message_id: waId,
      wa_message_id_reply: reply_to_wa_id || null,
      conteudo_citado: conteudo_citado || null,
    } as any).select('id').maybeSingle();

    // Atualiza preview do contato (cria se não existir)
    if (contato?.id) {
      await supabase.from('meta_whatsapp_contatos')
        .update({
          ultima_mensagem: texto,
          ultima_mensagem_em: nowIso,
          atualizado_em: nowIso,
        })
        .eq('id', contato.id);

      // Atendente humano respondeu => desliga a IA nessa conversa (envios da própria IA não contam)
      if (user_id && origem !== 'ia') {
        await supabase.from('meta_ia_conversas_estado')
          .update({ aguardando_humano: true })
          .eq('contato_id', contato.id);
        await supabase.from('iago_conversa_estado')
          .update({ aguardando_humano: true, followup_em: null })
          .eq('contato_id', contato.id);

        // Etiqueta a conversa com o atendente que enviou (se ainda não houver etiqueta de atendente)
        const mAt = String(texto || '').match(/^\*Atendente\s+(.+?):\*/i);
        let nomeAtendente = mAt?.[1]?.trim() || '';
        if (!nomeAtendente) {
          const { data: prof } = await supabase
            .from('profiles').select('nome').eq('id', user_id).maybeSingle();
          nomeAtendente = String((prof as any)?.nome || '').trim();
        }
        if (nomeAtendente) {
          await aplicarEtiquetaAtendente(supabase, {
            contatoId: contato.id,
            atendenteNome: nomeAtendente,
            ownerUserId: inst.user_id,
            somenteSeSemEtiqueta: true,
            logPrefix: '[send-whatsapp-meta-text]',
          });
        }
      }
    } else {

      await supabase.from('meta_whatsapp_contatos').insert({
        user_id: uid,
        instancia_id,
        telefone: to || null,
        telefone_visivel: !!to,
        bsuid: useBsuid ? bsuid : null,
        ultima_mensagem: texto,
        ultima_mensagem_em: nowIso,
      } as any);
    }

    return new Response(JSON.stringify({ success: true, waId, mensagem_id: (msgRow as any)?.id || null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
