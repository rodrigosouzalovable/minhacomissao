// Envia mensagem de texto livre (free-form) pela API oficial Meta.
// Só funciona dentro da janela de 24h da última mensagem recebida do cliente.
// Para janelas expiradas, use send-whatsapp-meta com um template HSM.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aplicarEtiquetaAtendente } from '../_shared/etiqueta-atendente.ts';
import { rotuloInstancia } from '../_shared/rotulo-instancia.ts';
import { ehNumeroInacessivel, MSG_NUMERO_INACESSIVEL, tratarNumeroInacessivel } from '../_shared/meta-numero-inacessivel.ts';


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

    // ===== Instâncias NÃO OFICIAIS (espelho UAZAPI / aba Acionamento) =====
    // Não há janela de 24h nem template HSM: envia direto pela UAZAPI.
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
      let waId: string | null = null;
      let erroEnvio = '';
      try {
        const r = await fetch(`${cleanUrl}/send/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: uz.instance_token },
          body: JSON.stringify({ number: to, text: String(texto).slice(0, 4096) }),
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

      const { data: msgRow } = await supabase.from('meta_whatsapp_mensagens').insert({
        user_id: uid,
        instancia_id,
        telefone: to,
        direcao: 'saida',
        conteudo: texto,
        tipo_conteudo: 'texto',
        timestamp_msg: nowIso,
        status_envio: 'enviada',
        wa_message_id: waId,
      } as any).select('id').maybeSingle();

      // Mantém a aba Acionamento coerente com o histórico
      await supabase.from('whatsapp_mensagens').insert({
        instancia_id: uz.id,
        telefone_remoto: to,
        conteudo: texto,
        direcao: 'saida',
        timestamp_msg: nowIso,
        lida: true,
        tipo_conteudo: 'texto',
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
          .update({ ultima_mensagem: texto, ultima_mensagem_em: nowIso, atualizado_em: nowIso })
          .eq('id', (ctUz as any).id);

        if (user_id && origem !== 'ia') {
          await supabase.from('iago_conversa_estado')
            .update({ aguardando_humano: true, followup_em: null })
            .eq('contato_id', (ctUz as any).id);

          const mAt = String(texto || '').match(/^\*Atendente\s+(.+?):\*/i);
          let nomeAtendente = mAt?.[1]?.trim() || '';
          if (!nomeAtendente) {
            const { data: prof } = await supabase.from('profiles').select('nome').eq('id', user_id).maybeSingle();
            nomeAtendente = String((prof as any)?.nome || '').trim();
          }
          if (nomeAtendente) {
            await aplicarEtiquetaAtendente(supabase, {
              contatoId: (ctUz as any).id,
              atendenteNome: nomeAtendente,
              ownerUserId: (inst as any).user_id,
              somenteSeSemEtiqueta: true,
              logPrefix: '[send-whatsapp-meta-text/uazapi]',
            });
          }
        }
      } else {
        await supabase.from('meta_whatsapp_contatos').insert({
          user_id: uid,
          instancia_id,
          folder_id: (inst as any).folder_padrao_id || null,
          telefone: to,
          telefone_visivel: true,
          ultima_mensagem: texto,
          ultima_mensagem_em: nowIso,
        } as any);
      }

      return new Response(JSON.stringify({ success: true, waId, mensagem_id: (msgRow as any)?.id || null, provider: 'uazapi' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    // Sempre texto puro: a API Oficial não tem botão que copia texto, e qualquer
    // botão interativo impede o WhatsApp de reconhecer o código Pix e exibir o
    // botão nativo "Copiar código Pix".
    const montarBody = () => {
      const b: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: useBsuid ? bsuid : to,
        type: 'text',
        text: { preview_url: false, body: String(texto).slice(0, 4096) },
      };
      if (reply_to_wa_id) b.context = { message_id: reply_to_wa_id };
      return b;
    };

    const enviarGraph = async (payload: any) => {
      const r = await fetch(`https://graph.facebook.com/v21.0/${inst.phone_number_id}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${inst.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, json: j };
    };

    const res = await enviarGraph(montarBody());
    const data = res.json;

    if (!res.ok) {
      const erro = data?.error?.message || `HTTP ${res.status}`;
      if (ehNumeroInacessivel(erro, data?.error?.code)) {
        await tratarNumeroInacessivel(supabase, inst, erro);
        return new Response(JSON.stringify({
          success: false, instance_restricted: true, numero_inacessivel: true,
          error: MSG_NUMERO_INACESSIVEL, detalhe: erro, instancia_id,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (ehContaBloqueada(erro, data?.error?.code)) {
        await tratarContaBloqueada(supabase, inst, erro);
        return new Response(JSON.stringify({
          success: false, instance_restricted: true, conta_bloqueada: true,
          error: MSG_CONTA_BLOQUEADA, detalhe: erro, instancia_id,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
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
