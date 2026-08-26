// IAGO — atendente de IA que atua como um atendente humano nas caixas do Inbox Meta Oficial
// onde estiver marcado como responsável. Atende 24h/7 dias, faz um único follow-up e
// escala para humano (etiqueta "Aguardando Humano") sempre que não souber responder.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders, json, fmtBRL, soDigitos, primeiroNome, cpfFormatado, agoraSP, sleep,
  ehOptOut, ehNumeroErrado, ehFalecido, MSG_FALECIDO, suprimirDestinatario, extrairDoc, carregarConfig, perfilIago, iagoAtendeCaixa, etiquetasAtendente, temAtendenteHumanoNoTelefone,
  avisarEmergencia, etiquetarAguardandoHumano, etiquetarAcordoFechado, enviarTexto, resolverTelefone, calcularProposta, chamarIA, extrairJson,
  classificarDataPagamento, detectarEscolha, respostaPagamentoHoje, contextoDataHoje,
  carregarQualificacoesDisponiveis, qualificarConversa, type QualificacaoIA,
  nomePerfilConfiavel, extrairNomeInformado, nomeDeSaudacaoEnviada, ehConfirmacaoIdentidade, resolverCredorConversa,

} from '../_shared/iago.ts';
import { consultarUme, propostaDaUme } from '../_shared/ume-desconto.ts';

const MSG_NUMERO_ERRADO = 'Entendi, obrigado pela atenção e desculpe o incômodo. Tenha um ótimo dia! 🙏';

const hojeSP = () => agoraSP().toISOString().slice(0, 10);

function blocoConhecimento(itens: any[], tipo: string) {
  return itens
    .filter((i) => i.tipo === tipo && i.ativo !== false)
    .map((i) => `- ${i.gatilho ? `[${i.gatilho}] ` : ''}${i.conteudo}`)
    .join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Trava adquirida nesta execução — liberada mesmo se algo falhar no meio (ver catch final).
  let travaContatoId: string | null = null;
  let travaEntradaId: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const { contato_id, texto, entrada_id, simular } = body || {};


    const cfg = await carregarConfig(supabase);
    if (!cfg) return json({ success: false, skipped: 'sem configuração' });

    const { data: conhecimento } = await supabase
      .from('iago_conhecimento').select('tipo, gatilho, conteudo, ativo').eq('ativo', true);
    const itens = (conhecimento || []) as any[];

    // ===== Modo simulação (botão "Testar" no painel) — não envia nada =====
    if (simular) {
      const resposta = await gerarResposta({
        cfg, itens, historico: [], texto: String(simular), proposta: null, temAcordo: false,
        nomeCliente: '', primeiroToque: true,
      });
      return json({ success: true, simulacao: resposta });
    }

    if (!contato_id) return json({ success: false, error: 'contato_id é obrigatório' }, 400);
    if (!entrada_id) return json({ success: false, error: 'entrada_id é obrigatório' }, 400);
    if (!cfg.ativo) return json({ success: false, skipped: 'IAGO desligado' });

    const iago = await perfilIago(supabase, cfg);
    if (!iago?.id) return json({ success: false, skipped: 'usuário do IAGO não encontrado' });

    // ===== Contato / caixa =====
    const { data: contato } = await supabase
      .from('meta_whatsapp_contatos')
      .select('id, instancia_id, telefone, bsuid, nome, cpf, folder_id, credor, meta_whatsapp_instances(provider)')
      .eq('id', contato_id)
      .maybeSingle();
    if (!contato) return json({ success: false, error: 'contato não encontrado' }, 404);

    const atende = await iagoAtendeCaixa(supabase, iago.id, (contato as any).folder_id ?? null);
    if (!atende) return json({ success: false, skipped: 'IAGO não atende esta caixa' });

    // ===== Credor da conversa: cabeçalho da conversa > credor único ativo da caixa =====
    const credorResolvido = await resolverCredorConversa(
      supabase,
      (contato as any).folder_id ?? null,
      (contato as any).credor ?? null,
    );
    const credorCaixa = credorResolvido.nome;
    const credorAmbiguo = credorResolvido.ambiguo;


    // ===== A conversa é do IAGO? (etiqueta de atendente) =====
    const tags = await etiquetasAtendente(supabase, contato_id);
    const nomeIago = String(iago.nome || '').trim().toLowerCase();
    const ehDoIago = tags.some((t) => t.replace(/^atendente:\s*/i, '').trim().toLowerCase() === nomeIago);
    if (!ehDoIago) {
      return json({ success: false, skipped: tags.length ? 'conversa de outro atendente' : 'conversa sem atendente' });
    }

    // ===== Atendente humano já vinculado a este telefone (qualquer caixa) => IAGO calado =====
    const humanoVinculado = await temAtendenteHumanoNoTelefone(supabase, contato_id, iago.nome || '', {
      folderId: (contato as any).folder_id ?? null,
      provider: (contato as any).meta_whatsapp_instances?.provider ?? null,
    });
    if (humanoVinculado) {
      await supabase.from('iago_conversa_estado')
        .update({ followup_em: null, followup_feito: true })
        .eq('contato_id', contato_id);
      console.log('[IAGO] atendente humano vinculado — IAGO não responde', { contato_id, atendente: humanoVinculado });
      return json({ success: true, skipped: `atendente humano vinculado (${humanoVinculado})` });
    }

    // ===== Estado =====
    let { data: estado } = await supabase
      .from('iago_conversa_estado').select('*').eq('contato_id', contato_id).maybeSingle();
    if (!estado) {
      const { data: novo } = await supabase.from('iago_conversa_estado')
        .insert({ contato_id, telefone: (contato as any).telefone || '' })
        .select('*').maybeSingle();
      estado = novo;
    }
    if (!estado) return json({ success: false, error: 'falha ao criar estado' }, 500);

    // ===== Plantão: conversa recém-assumida de um atendente humano =====
    // Libera o "aguardando humano", mas NÃO apaga o corte: mensagens humanas
    // recentes continuam valendo (regra dos 10 minutos mais abaixo).
    try {
      const { data: transf } = await supabase
        .from('iago_plantao_transferencia')
        .select('assumido_em')
        .eq('contato_id', contato_id)
        .is('devolvido_em', null)
        .maybeSingle();
      const assumidoEm = String((transf as any)?.assumido_em || '');
      if (assumidoEm && String((estado as any).contexto?.plantao_assumido_em || '') !== assumidoEm) {
        const novoContexto = {
          ...((estado as any).contexto || {}),
          plantao_assumido_em: assumidoEm,
        };

        const { data: atualizado } = await supabase
          .from('iago_conversa_estado')
          .update({ aguardando_humano: false, contexto: novoContexto })
          .eq('id', (estado as any).id)
          .select('*')
          .maybeSingle();
        if (atualizado) estado = atualizado;
        console.log('[IAGO] conversa assumida no plantão — estado liberado', { contato_id });
      }
    } catch (e: any) {
      console.error('[IAGO] falha ao verificar transferência de plantão', e?.message || e);
    }

    // ===== "BLOQUEAR CONTATO" => silêncio definitivo =====
    if (ehOptOut(texto || '')) {
      await supabase.from('iago_conversa_estado')
        .update({ optout: true, followup_feito: true, followup_em: null, etapa: 'optout' })
        .eq('id', estado.id);
      console.log('[IAGO] opt-out registrado', { contato_id });
      return json({ success: true, etapa: 'optout' });
    }
    if (estado.optout) return json({ success: true, skipped: 'contato bloqueado' });
    if (estado.aguardando_humano) return json({ success: true, skipped: 'aguardando humano' });

    // ===== Limite diário anti-loop =====
    const dia = hojeSP();
    const msgsHoje = estado.msgs_dia === dia ? Number(estado.msgs_hoje || 0) : 0;
    if (msgsHoje >= Number(cfg.limite_msgs_dia ?? 20)) {
      return json({ success: true, skipped: 'limite diário atingido' });
    }

    // ===== Rajada: o mesmo número escrevendo para vários chips ao mesmo tempo =====
    // Espaça as execuções para não estourar o limite momentâneo da IA (sem cron, sem polling).
    const telefoneContato = String((contato as any).telefone || '');
    if (telefoneContato) {
      const { count: emProcesso } = await supabase
        .from('iago_conversa_estado')
        .select('id', { count: 'exact', head: true })
        .eq('telefone', telefoneContato)
        .neq('contato_id', contato_id)
        .gte('updated_at', new Date(Date.now() - 90_000).toISOString());
      const simultaneas = Number(emProcesso || 0);
      if (simultaneas > 0) {
        const espera = Math.min(20_000, simultaneas * (1200 + Math.floor(Math.random() * 1800)));
        console.log('[IAGO] rajada detectada — espaçando execução', { contato_id, simultaneas, espera });
        await sleep(espera);
      }
    }

    // Uma única execução por conversa. Também deduplica reentregas do mesmo webhook.
    const { data: claimed, error: claimError } = await supabase.rpc('iago_claim_message', {
      p_contato_id: contato_id,
      p_entrada_id: String(entrada_id),
    });
    if (claimError) throw new Error(`falha ao reservar mensagem: ${claimError.message}`);
    if (!claimed) return json({ success: true, skipped: 'mensagem duplicada ou conversa em processamento' });
    travaContatoId = String(contato_id);
    travaEntradaId = String(entrada_id);


    // Pequena janela para incorporar ao histórico mensagens enviadas em sequência pelo cliente.
    await sleep(1000);

    // ===== Histórico da conversa =====
    const { data: msgs } = await supabase
      .from('meta_whatsapp_mensagens')
      .select('id, wa_message_id, direcao, conteudo, criado_em, tipo_conteudo, transcricao')
      .eq('instancia_id', (contato as any).instancia_id)
      .eq('telefone', (contato as any).telefone || '')
      .order('criado_em', { ascending: false })
      .limit(16);
    // Áudio: usa a transcrição como se o cliente tivesse digitado.
    const conteudoLegivel = (m: any) => String(m?.transcricao || m?.conteudo || '').trim();
    let historico = ((msgs || []) as any[]).slice().reverse()
      .map((m) => ({ ...m, conteudo: conteudoLegivel(m) }));
    let ultimaEntrada = [...historico].reverse().find((m) => m.direcao === 'entrada');
    // Imagem: o webhook já mandou a leitura feita pela IA (descrição + classificação).
    const imagemCtx = (body?.imagem_contexto && String(body.imagem_contexto.descricao || '').trim())
      ? {
        descricao: String(body.imagem_contexto.descricao).trim().slice(0, 600),
        classificacao: String(body.imagem_contexto.classificacao || 'documento').toLowerCase(),
      }
      : null;
    let textoAtual = String(ultimaEntrada?.conteudo || texto || '');
    let ultimaEntradaId = String(ultimaEntrada?.wa_message_id || entrada_id);
    if (imagemCtx) {
      const legenda = /^\[imagem\]$/i.test(textoAtual.trim()) ? '' : textoAtual.trim();
      textoAtual = [
        legenda,
        `[imagem enviada pelo cliente — ${imagemCtx.classificacao}: ${imagemCtx.descricao}]`,
      ].filter(Boolean).join('\n');
    }

    // Mídia que o IAGO não consegue interpretar (áudio sem transcrição, imagem, documento):
    // não responde nada em cima disso — o atendente humano precisa ver.
    const semConteudoUtil = !imagemCtx
      && /^\[(áudio|audio|imagem|vídeo|video|documento)\]$/i.test(textoAtual.trim());
    if (semConteudoUtil) {
      await etiquetarAguardandoHumano(supabase, contato_id);
      await supabase.rpc('iago_finish_message', {
        p_contato_id: contato_id,
        p_entrada_id: String(entrada_id || ultimaEntradaId),
      });
      console.log('[IAGO] mídia sem texto legível — escalado para humano', { contato_id });
      return json({ success: true, skipped: 'midia_sem_texto' });
    }


    const finalizarEntrada = async () => {
      const ids = Array.from(new Set([String(entrada_id), ultimaEntradaId].filter(Boolean)));
      for (const id of ids) {
        const { error } = await supabase.rpc('iago_finish_message', {
          p_contato_id: contato_id,
          p_entrada_id: id,
        });
        if (error) console.error('[IAGO] falha ao concluir entrada', error.message);
      }
    };

    // Qualificações ativas (carregadas uma única vez, sob demanda)
    let qualsCache: QualificacaoIA[] | null = null;
    const quals = async () => (qualsCache ??= await carregarQualificacoesDisponiveis(supabase));
    /** Aplica a qualificação por nome; ignora silenciosamente se não estiver cadastrada. */
    const qualificar = async (nome: string, motivoNome?: string) => {
      if (!nome) return false;
      return await qualificarConversa(supabase, contato_id, iago.id, nome, motivoNome, await quals());
    };

    const normalizarTexto = (valor: unknown) => String(valor || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    let saidasRecentes = historico
      .filter((m) => m.direcao === 'saida')
      .map((m) => normalizarTexto(m.conteudo))
      .filter(Boolean);

    // ===== Proposta já enviada por nós antes do IAGO (campanha/template/atendente) =====
    let propostaPrevia = detectarPropostaPrevia(historico);
    // Resposta automática do cliente (ausência/atendimento automático): não é resposta real.
    let respostaAutomatica = ehRespostaAutomatica(textoAtual);

    // ===== Divulgação em massa / robô escrevendo para vários chips =====
    // Não vale negociar: marca para revisão humana e conclui a entrada normalmente.
    if (ehDivulgacao(textoAtual)) {
      let ehMassa = true;
      if (telefoneContato) {
        const trecho = textoAtual.trim().slice(0, 40);
        const { data: iguais } = await supabase
          .from('meta_whatsapp_mensagens')
          .select('instancia_id')
          .eq('telefone', telefoneContato)
          .eq('direcao', 'entrada')
          .ilike('conteudo', `${trecho}%`)
          .gte('criado_em', new Date(Date.now() - 3600_000).toISOString())
          .limit(50);
        const instancias = new Set(((iguais || []) as any[]).map((m) => String(m.instancia_id)));
        ehMassa = instancias.size >= 3;
      }
      if (ehMassa) {
        await supabase.from('iago_conversa_estado').update({
          etapa: 'divulgacao_em_massa',
          aguardando_humano: true,
          followup_em: null,
          followup_feito: true,
          ultima_msg_cliente_em: new Date().toISOString(),
          contexto: { ...(estado.contexto || {}), ultimo_motivo: 'mensagem de divulgação em massa (robô)' },
        }).eq('id', estado.id);
        await etiquetarAguardandoHumano(supabase, contato_id);
        await finalizarEntrada();
        console.log('[IAGO] divulgação em massa — sem resposta automática', { contato_id });
        return json({ success: true, skipped: 'divulgacao_em_massa' });
      }
    }




    // Se outra mensagem chegou enquanto esta execução aguardava a trava, processa a mais recente.
    if (ehOptOut(textoAtual)) {
      await supabase.from('iago_conversa_estado')
        .update({ optout: true, followup_feito: true, followup_em: null, etapa: 'optout' })
        .eq('id', estado.id);
      await qualificar('Sem interesse');
      await finalizarEntrada();

      console.log('[IAGO] opt-out registrado', { contato_id });
      return json({ success: true, etapa: 'optout' });
    }

    // ===== "não sou essa pessoa / número errado" => agradece, encerra e nunca mais contata =====
    const encerrarNumeroErrado = async (origem: string) => {
      const jaEncerrou = historico.some(
        (m: any) => m.direcao === 'saida' && /desculpe o inc[oô]modo/i.test(String(m.conteudo || '')),
      );
      if (!jaEncerrou) {
        try {
          await enviarTexto(supabase, contato, MSG_NUMERO_ERRADO);
        } catch (e: any) {
          console.error('[IAGO] falha ao enviar encerramento de número errado', e?.message || e);
        }
      }
      await supabase.from('iago_conversa_estado').update({
        etapa: 'numero_errado',
        aguardando_humano: true,
        followup_em: null,
        followup_feito: true,
        followup_etapa: 3,
        ultima_msg_em: new Date().toISOString(),
        ultima_msg_cliente_em: new Date().toISOString(),
        contexto: { ...(estado.contexto || {}), ultimo_motivo: 'cliente informou que não é a pessoa procurada' },
      }).eq('id', estado.id);
      await etiquetarAguardandoHumano(supabase, contato_id);
      await qualificar('Não é o Cliente');
      await suprimirDestinatario(
        supabase,
        (contato as any).telefone || (contato as any).bsuid,
        'pessoa_errada: cliente informou que não é a pessoa procurada',
      );
      await finalizarEntrada();

      console.log('[IAGO] número errado — conversa encerrada', { contato_id, origem });
      return json({ success: true, etapa: 'numero_errado', origem });
    };

    if (ehNumeroErrado(textoAtual)) {
      return await encerrarNumeroErrado('texto');
    }


    // ===== Cliente/familiar informou falecimento => condolências e encerra (sem follow-up) =====
    if (ehFalecido(textoAtual)) {
      const jaCondoleu = historico.some(
        (m: any) => m.direcao === 'saida' && /sinto\s*muito/i.test(String(m.conteudo || '')),
      );
      if (!jaCondoleu) {
        try {
          await enviarTexto(supabase, contato, MSG_FALECIDO);
        } catch (e: any) {
          console.error('[IAGO] falha ao enviar condolências', e?.message || e);
        }
      }
      await supabase.from('iago_conversa_estado').update({
        etapa: 'falecido',
        aguardando_humano: true,
        followup_em: null,
        followup_feito: true,
        followup_etapa: 3,
        ultima_msg_em: new Date().toISOString(),
        ultima_msg_cliente_em: new Date().toISOString(),
        contexto: { ...(estado.contexto || {}), ultimo_motivo: 'cliente informou falecimento do titular' },
      }).eq('id', estado.id);
      await etiquetarAguardandoHumano(supabase, contato_id);
      const okQual = await qualificar('Falecido');
      if (!okQual) await qualificar('Não é o Cliente');
      await finalizarEntrada();

      console.log('[IAGO] falecimento informado — conversa encerrada', { contato_id });
      return json({ success: true, etapa: 'falecido' });
    }





    // ===== Humano respondeu? (saída que não é do IAGO depois do último envio dele) =====
    // Regra: enquanto a resposta humana tiver menos de 10 minutos, o IAGO fica calado.
    // Passados os 10 minutos sem nova interação humana, ele volta a atender.
    const idsIA: string[] = Array.isArray(estado.contexto?.msgs_ia) ? estado.contexto.msgs_ia : [];
    const corte = String(estado.contexto?.ultimo_envio_ia || estado.created_at);
    const saidaHumana = historico.filter(
      (m) => m.direcao === 'saida' && !idsIA.includes(m.id) && String(m.criado_em) > corte,
    );
    if (saidaHumana.length && estado.etapa !== 'inicio') {
      const ultimaHumana = saidaHumana.reduce(
        (acc, m) => (String(m.criado_em) > String(acc.criado_em) ? m : acc),
        saidaHumana[0],
      );
      const idadeMs = Date.now() - new Date(String(ultimaHumana.criado_em)).getTime();
      const JANELA_HUMANA_MS = 10 * 60 * 1000;
      if (idadeMs < JANELA_HUMANA_MS) {
        await supabase.from('iago_conversa_estado')
          .update({ followup_em: null }).eq('id', estado.id);
        await finalizarEntrada();
        console.log('[IAGO] humano respondeu há pouco — IAGO calado', {
          contato_id, minutos: Math.round(idadeMs / 60000),
        });
        return json({ success: true, skipped: 'humano respondeu nos últimos 10 min' });
      }
      // Mais de 10 min sem interação humana: assume a conversa a partir dessa saída.
      const novoCorte = String(ultimaHumana.criado_em);
      const { data: liberado } = await supabase
        .from('iago_conversa_estado')
        .update({
          aguardando_humano: false,
          contexto: { ...(estado.contexto || {}), ultimo_envio_ia: novoCorte },
        })
        .eq('id', estado.id)
        .select('*')
        .maybeSingle();
      if (liberado) estado = liberado;
      console.log('[IAGO] humano inativo há mais de 10 min — IAGO retoma', { contato_id });
    }

    // ===== Espera extra de 20s: prioridade para o atendente humano =====
    // Dá 20 segundos a mais antes de responder. Se um humano responder nesse
    // intervalo, o IAGO não envia nada.
    await sleep(20000);
    {
      const corteEspera = String(estado.contexto?.ultimo_envio_ia || estado.created_at);
      const { data: novasSaidas } = await supabase
        .from('meta_whatsapp_mensagens')
        .select('id, criado_em')
        .eq('instancia_id', (contato as any).instancia_id)
        .eq('telefone', (contato as any).telefone || '')
        .eq('direcao', 'saida')
        .gt('criado_em', corteEspera)
        .order('criado_em', { ascending: false })
        .limit(10);
      const idsIAAtuais: string[] = Array.isArray(estado.contexto?.msgs_ia) ? estado.contexto.msgs_ia : [];
      const humanaNova = ((novasSaidas || []) as any[]).find((m) => !idsIAAtuais.includes(m.id));
      if (humanaNova) {
        await supabase.from('iago_conversa_estado')
          .update({ followup_em: null }).eq('id', estado.id);
        await finalizarEntrada();
        console.log('[IAGO] humano respondeu durante a espera de 20s — IAGO calado', { contato_id });
        return json({ success: true, skipped: 'humano respondeu na espera de 20s' });
      }
    }

    // Durante a espera de segurança, o cliente pode enviar o CPF em uma nova mensagem.
    // Recarrega o histórico antes de decidir, para não pedir CPF novamente com dados antigos.
    {
      const { data: msgsAtualizadas } = await supabase
        .from('meta_whatsapp_mensagens')
        .select('id, wa_message_id, direcao, conteudo, criado_em, tipo_conteudo, transcricao')
        .eq('instancia_id', (contato as any).instancia_id)
        .eq('telefone', (contato as any).telefone || '')
        .order('criado_em', { ascending: false })
        .limit(16);

      const historicoAtualizado = ((msgsAtualizadas || []) as any[]).slice().reverse()
        .map((m) => ({ ...m, conteudo: conteudoLegivel(m) }));
      const ultimaEntradaAtualizada = [...historicoAtualizado].reverse().find((m) => m.direcao === 'entrada');

      if (ultimaEntradaAtualizada) {
        const entradaAnteriorId = ultimaEntradaId;
        const novaEntradaId = String(ultimaEntradaAtualizada?.wa_message_id || entradaAnteriorId || entrada_id);
        historico = historicoAtualizado;
        ultimaEntrada = ultimaEntradaAtualizada;
        ultimaEntradaId = novaEntradaId;

        if (novaEntradaId !== entradaAnteriorId) {
          textoAtual = String(ultimaEntradaAtualizada?.conteudo || textoAtual || '').trim();
          console.log('[IAGO] nova entrada detectada durante espera — usando mensagem mais recente', { contato_id, entrada_id: novaEntradaId });
        }

        saidasRecentes = historico
          .filter((m) => m.direcao === 'saida')
          .map((m) => normalizarTexto(m.conteudo))
          .filter(Boolean);
        propostaPrevia = detectarPropostaPrevia(historico);
        respostaAutomatica = ehRespostaAutomatica(textoAtual);
      }
    }


    // ===== Contexto financeiro real =====
    let cpf = estado.cpf || '';
    const docHistorico = [...historico]
      .reverse()
      .filter((m) => m.direcao === 'entrada')
      .map((m) => extrairDoc(String(m.conteudo || '')))
      .find(Boolean) || '';
    const docMsg = extrairDoc(textoAtual) || docHistorico;
    if (docMsg) cpf = docMsg;
    let cpfPorTelefone = false;
    let nomePorTelefone = '';
    let multiplosCandidatos = false;
    // Prioridade 1: CPF gravado na conversa (veio da planilha do Envio Meta)
    if (!cpf) {
      const cpfContato = soDigitos(String((contato as any).cpf || ''));
      if (cpfContato.length === 11 || cpfContato.length === 14) {
        cpf = cpfContato;
        cpfPorTelefone = true;
        await supabase.from('iago_conversa_estado').update({ cpf }).eq('id', estado.id);
      }
    }
    // Prioridade 2: identificação pelo telefone
    if (!cpf) {
      const res = await resolverTelefone(supabase, (contato as any).telefone);
      if (res.cpf) {
        cpf = res.cpf;
        cpfPorTelefone = true;
        nomePorTelefone = res.nome;
        multiplosCandidatos = res.candidatos.length > 1;
        // grava já na primeira interação para não perder a identificação
        await supabase.from('iago_conversa_estado').update({ cpf }).eq('id', estado.id);
      }
    }

    let temAcordo = false;
    let proposta = null as Awaited<ReturnType<typeof calcularProposta>>;
    let atendenteAcordo = '';
    if (cpf) {
      const { data: ta } = await supabase.rpc('cpf_has_acordo', { p_cpf: cpf });
      temAcordo = ta === true;
      if (temAcordo) {
        try {
          const { data: at } = await supabase.rpc('cpf_acordo_funcionario_nome', { p_cpf: cpf });
          atendenteAcordo = String(at || '');
        } catch { /* opcional */ }
      } else {
        // Credor UME: as condições vêm da calculadora de desconto oficial da UME.
        const ehUme = /\bUME\b/i.test(credorCaixa);
        if (ehUme && (cfg as any).ume_consulta_ativa !== false) {
          try {
            const consulta = await consultarUme(supabase, cpf);
            const tabela = String((cfg as any).ume_tabela) === 'especial' ? 'especial' : 'padrao';
            const pUme = propostaDaUme(consulta, tabela as 'padrao' | 'especial');
            if (pUme) {
              proposta = pUme as any;
              console.log('[IAGO] proposta UME', { cpf, tabela, total: pUme.total, opcoes: pUme.opcoes.length });
            } else {
              console.log('[IAGO] CPF não localizado na UME', { cpf });
            }
          } catch (e) {
            console.error('[IAGO] falha na consulta UME', String((e as Error)?.message || e));
          }
        }
        if (!proposta) {
          proposta = await calcularProposta(supabase, cpf, {
            descAvista: (cfg as any).desconto_avista_pct,
            descParcelado: (cfg as any).desconto_parcelado_pct,
          });
        }
      }
    }

    // ===== Nome do cliente: cadastro > informado/confirmado > enviado por nós > perfil do WhatsApp =====
    const ctxNome = (estado.contexto || {}) as any;
    let nomeInformado = String(ctxNome.nome_informado || '').trim();
    let nomePedido = !!ctxNome.nome_pedido;
    const nomePerfil = String((contato as any).nome || '').trim();
    const perfilOk = nomePerfilConfiavel(nomePerfil);
    // Nome que já usamos na saudação das nossas mensagens (campanha/template)
    const nomeEnviadoPorNos = nomeDeSaudacaoEnviada(historico);

    const gravarNome = async (nome: string) => {
      nomeInformado = nome;
      const novo = { ...ctxNome, nome_informado: nome, nome_pedido: true };
      await supabase.from('iago_conversa_estado').update({ contexto: novo }).eq('id', estado.id);
      estado.contexto = novo;
      nomePedido = true;
      if (!perfilOk) {
        await supabase.from('meta_whatsapp_contatos').update({ nome }).eq('id', contato_id);
      }
      console.log('[IAGO] nome do cliente gravado', { contato_id, nome });
    };

    if (!nomeInformado && !proposta?.nomeCliente && !nomePorTelefone) {
      const detectado = extrairNomeInformado(textoAtual);
      if (detectado && (nomePedido || !perfilOk)) {
        await gravarNome(detectado);
      } else if (nomeEnviadoPorNos && ehConfirmacaoIdentidade(textoAtual)) {
        // Cliente confirmou que é a pessoa que nomeamos na abertura => nome resolvido
        await gravarNome(nomeEnviadoPorNos);
      }
    }

    const nomeCliente = proposta?.nomeCliente || nomePorTelefone || nomeInformado
      || nomeEnviadoPorNos || (perfilOk ? nomePerfil : '');
    const precisaPerguntarNome = !nomeCliente && !nomePedido;



    // ===== Cliente já tem acordo => humano assume =====
    if (temAcordo) {
      await supabase.from('iago_conversa_estado')
        .update({ cpf, aguardando_humano: true, etapa: 'ja_tem_acordo', followup_em: null })
        .eq('id', estado.id);
      await avisarEmergencia(supabase,
        `👤 *IAGO — atendimento humano necessário*\n\n` +
        `Cliente: ${nomeCliente || '(sem nome)'}\n` +
        `Telefone: ${(contato as any).telefone || (contato as any).bsuid}\n` +
        `CPF: ${cpfFormatado(cpf)}\n` +
        (credorCaixa ? `Credor: ${credorCaixa}\n` : '') +
        `Motivo: já possui acordo lançado${atendenteAcordo ? ` (atendente: ${atendenteAcordo})` : ''}\n\n` +
        `Assuma a conversa no Inbox Meta Oficial.`, contato_id);
      await finalizarEntrada();
      return json({ success: true, etapa: 'ja_tem_acordo' });
    }

    // ===== Redação da resposta =====
    const ctxAnterior = (estado.contexto || {}) as any;
    const escolhaAnterior = String(ctxAnterior.opcao_escolhida || '');
    const etapaAnterior = String(estado.etapa || 'inicio');

    const resultado = await gerarResposta({
      cfg, itens, historico, texto: textoAtual, proposta, temAcordo: false, credorCaixa, credorAmbiguo,
      nomeCliente, primeiroToque: estado.etapa === 'inicio' && !historico.some((m) => m.direcao === 'saida'),
      cpfIdentificado: !!cpf, cpfPorTelefone, multiplosCandidatos,
      etapaNegociacao: etapaAnterior, escolhaAnterior, imagemCtx,
      qualificacoes: await quals(),
      propostaPrevia, respostaAutomatica, precisaPerguntarNome,
    });

    // ===== A IA entendeu que não é o titular (mesmo com erro de escrita) => encerra =====
    if (resultado?.nao_e_titular === true || String(resultado?.nao_e_titular || '').toLowerCase() === 'sim') {
      return await encerrarNumeroErrado('ia');
    }




    let mensagens: string[] = Array.isArray(resultado?.mensagens)
      ? resultado.mensagens
          .filter((m: any) => {
            const candidata = normalizarTexto(m);
            if (!candidata) return false;
            return !saidasRecentes.some((anterior) =>
              anterior === candidata ||
              (anterior.length >= 30 && candidata.length >= 30 &&
                (anterior.includes(candidata) || candidata.includes(anterior)))
            );
          })
          .map((m: any) => String(m).trim())
          .slice(0, 3)
      : [];

    // ===== Escolha da forma de pagamento => confirmar a DATA antes de chamar humano =====
    let escalar = !!resultado?.escalar;
    const escalouPorDuvida = !!resultado?.escalar;

    let motivo = String(resultado?.motivo || '');
    let etapaNova = escalar ? 'aguardando_humano' : (proposta ? 'proposta' : 'conversando');
    let dataAcordada: string | null = ctxAnterior.data_pagamento || null;
    let reperguntouData = !!ctxAnterior.reperguntou_data;

    const escolhaIA = String((resultado as any)?.escolha || '').trim();
    const escolha = escolhaIA || detectarEscolha(textoAtual) || escolhaAnterior;

    const hojeIA = String((resultado as any)?.pagamento_hoje || '').toLowerCase();
    let pagamentoHoje: 'sim' | 'nao' | 'indefinido' =
      hojeIA === 'sim' || hojeIA === 'nao' ? (hojeIA as 'sim' | 'nao') : 'indefinido';
    if (pagamentoHoje === 'indefinido' && (etapaAnterior === 'escolha_feita' || escolhaIA || escolhaAnterior)) {
      pagamentoHoje = respostaPagamentoHoje(textoAtual);
    }

    let fallbackMsg = '';
    let acordoFechado = false;
    if (escolha) {
      const dataBruta = String((resultado as any)?.data_pagamento || '').trim();
      const dataInfo = classificarDataPagamento(dataBruta || textoAtual);
      const dataResolvida = dataInfo.classe === 'indefinido' ? null : dataInfo;

      if (dataResolvida?.classe === 'hoje' || (pagamentoHoje === 'sim' && !dataResolvida)) {
        escalar = true;
        dataAcordada = 'hoje';
        acordoFechado = true;
        motivo = `cliente escolheu ${escolha} e vai pagar hoje`;
      } else if (dataResolvida?.classe === 'dentro_do_mes') {
        escalar = true;
        dataAcordada = dataResolvida.label;
        acordoFechado = true;
        motivo = `cliente escolheu ${escolha} e vai pagar em ${dataResolvida.label}`;
      } else if (dataResolvida?.classe === 'fora_do_mes') {
        escalar = true;
        dataAcordada = dataResolvida.label;
        motivo = `cliente escolheu ${escolha}, mas informou data FORA do mês atual (${dataResolvida.label})`;
      } else if (pagamentoHoje === 'nao' || etapaAnterior === 'aguardando_data') {
        if (etapaAnterior === 'aguardando_data' && reperguntouData) {
          escalar = true;
          motivo = `cliente escolheu ${escolha} mas não definiu a data do pagamento`;
        } else {
          escalar = false;
          etapaNova = 'aguardando_data';
          reperguntouData = etapaAnterior === 'aguardando_data';
          fallbackMsg = 'Sem problema! Que dia você consegue realizar o pagamento?';
        }
      } else if (etapaAnterior !== 'escolha_feita') {
        escalar = false;
        etapaNova = 'escolha_feita';
        const pn = primeiroNome(nomeCliente);
        fallbackMsg = `Perfeito${pn ? `, ${pn}` : ''}! Escolha anotada. Você consegue realizar o pagamento hoje?`;
      } else {
        escalar = false;
        etapaNova = 'escolha_feita';
      }
    }
    // Comprovante de pagamento: sempre agradece e passa para um humano validar.
    const ehComprovante = imagemCtx?.classificacao === 'comprovante';
    if (ehComprovante) {
      escalar = true;
      if (!motivo) motivo = 'cliente enviou comprovante de pagamento';
      if (!mensagens.length) {
        const pn = primeiroNome(nomeCliente);
        mensagens = [`Recebi${pn ? `, ${pn}` : ''}! Vou encaminhar seu comprovante para a equipe validar o pagamento e já te damos retorno. 🙏`];
      }
    }
    if (escalar) etapaNova = 'aguardando_humano';

    // Não deixa a IA prometer transferência quando ainda falta confirmar a data.
    if (!escalar && fallbackMsg) {
      const transferencia = /(especialista|colega|transferir|transfiro|outro atendente|vou passar)/i;
      mensagens = mensagens.filter((m) => !transferencia.test(m));
      const perguntou = etapaNova === 'aguardando_data' ? /(que dia|qual dia|quando)/i : /hoje/i;
      if (!mensagens.some((m) => perguntou.test(m))) {
        mensagens = [...mensagens.slice(0, 1), fallbackMsg];
      }
    }

    // Dúvida que ele não sabe responder / assunto proibido: NÃO envia nada.
    // Apenas escala para humano (etiqueta + aviso) para não dar resposta errada.
    if (escalouPorDuvida && !escolha && !ehComprovante) {
      mensagens = [];
      console.log('[IAGO] escalada por dúvida — nenhuma mensagem enviada', { contato_id, motivo });
    }



    const delay = Math.max(0, Number(cfg.delay_digitacao_seg ?? 4)) * 1000;
    const novosIds: string[] = [];
    for (let i = 0; i < mensagens.length; i++) {
      if (delay) await sleep(i === 0 ? Math.min(delay, 6000) : Math.min(delay, 4000));
      const envio = await enviarTexto(supabase, contato, String(mensagens[i]).slice(0, 3500));
      if (envio.destinatarioInvalido) {
        await supabase.from('iago_conversa_estado').update({
          etapa: 'destinatario_sem_whatsapp',
          aguardando_humano: true,
          followup_em: null,
          followup_feito: true,
          followup_etapa: 3,
          ultima_msg_cliente_em: new Date().toISOString(),
          contexto: {
            ...(estado.contexto || {}),
            ultimo_motivo: 'UAZAPI recusou o destinatário: número sem WhatsApp ativo',
            ultimo_erro_envio: envio.erro || null,
          },
        }).eq('id', estado.id);
        await etiquetarAguardandoHumano(supabase, contato_id);
        await qualificar('Não é o Cliente');
        await finalizarEntrada();
        console.log('[IAGO] destinatário sem WhatsApp — sem novas tentativas automáticas', { contato_id });
        return json({ success: true, skipped: 'destinatario_sem_whatsapp' });
      }
      if (envio.mensagemId) novosIds.push(envio.mensagemId);
    }

    const agoraIso = new Date().toISOString();
    // Proposta considerada enviada quando valores reais foram para o cliente —
    // inclusive quando vieram de mensagem nossa anterior (campanha/template).
    const propostaEnviada = !!estado.contexto?.proposta_enviada
      || !!propostaPrevia
      || (!!proposta && mensagens.some((m) => /r\$\s*\d/i.test(String(m))));
    // O cliente respondeu: a janela de 24h reabriu, então as etapas de follow-up recomeçam.
    const followupEm = !escalar && cfg.followup_ativo && mensagens.length
      ? new Date(Date.now() + Math.max(1, Number(cfg.followup_horas ?? 2)) * 3600 * 1000).toISOString()
      : null;


    await supabase.from('iago_conversa_estado').update({
      cpf: cpf || null,
      etapa: etapaNova,
      aguardando_humano: escalar,
      msgs_dia: dia,
      msgs_hoje: msgsHoje + mensagens.length,
      ultima_msg_em: agoraIso,
      ultima_msg_cliente_em: agoraIso,
      followup_em: followupEm,
      followup_feito: escalar ? true : false,
      followup_etapa: escalar ? 3 : 0,

      contexto: {
        ...(estado.contexto || {}),
        msgs_ia: [...idsIA, ...novosIds].slice(-30),
        ultimo_envio_ia: new Date(Date.now() + 2000).toISOString(),
        ultimo_motivo: motivo || null,
        proposta_enviada: propostaEnviada,
        opcao_escolhida: escolha || null,
        data_pagamento: dataAcordada,
        reperguntou_data: reperguntouData,
        nome_informado: nomeInformado || (estado.contexto || {}).nome_informado || null,
        nome_pedido: nomePedido || precisaPerguntarNome,
      },

    }).eq('id', estado.id);

    if (escalar) {
      await etiquetarAguardandoHumano(supabase, contato_id);
      if (acordoFechado) await etiquetarAcordoFechado(supabase, contato_id);



      await avisarEmergencia(supabase,
        `👤 *IAGO — preciso de um humano*\n\n` +
        `Cliente: ${nomeCliente || '(sem nome)'}\n` +
        `Telefone: ${(contato as any).telefone || (contato as any).bsuid}\n` +
        (cpf ? `CPF: ${cpfFormatado(cpf)}\n` : '') +
        (credorCaixa ? `Credor: ${credorCaixa}\n` : '') +
        (escolha ? `Opção escolhida: ${escolha}\n` : '') +
        (dataAcordada ? `Pagamento: ${dataAcordada}\n` : '') +
        `Motivo: ${motivo || 'dúvida fora do que foi ensinado'}\n` +
         `Última mensagem do cliente: "${textoAtual.slice(0, 250)}"\n\n` +
        `Assuma a conversa no Inbox Meta Oficial.`, contato_id);
    }

    // ===== Qualificação da conversa pelo próprio IAGO =====
    // Casos determinísticos primeiro; depois o que a IA escolheu (só nomes cadastrados).
    const alegaPagamento = ehComprovante || /(j[áa] paguei|paguei|efetuei o pagamento|comprovante)/i.test(textoAtual);
    if (acordoFechado) {
      await qualificar('Acordo Fechado');
    } else if (alegaPagamento) {
      const ok = await qualificar('Alega Pagamento');
      if (!ok) await qualificar('Já pagou');
    } else if (resultado?.qualificacao) {
      await qualificar(String(resultado.qualificacao), String(resultado.qualificacao_motivo || '') || undefined);
    }

    await finalizarEntrada();

    console.log('[IAGO] atendido', { contato_id, enviadas: mensagens.length, escalar, etapa: etapaNova, motivo });
    return json({ success: true, enviadas: mensagens.length, escalar, etapa: etapaNova, motivo: motivo || null });
  } catch (e: any) {
    const motivoFalha = String(e?.message || e);
    console.error('[IAGO] erro', motivoFalha);
    // Uma execução que morre no meio NÃO pode deixar a conversa travada e sem resposta.
    if (travaContatoId) {
      try {
        await supabase.from('iago_falhas').insert({
          contato_id: travaContatoId,
          entrada_id: travaEntradaId,
          motivo: motivoFalha.slice(0, 300),
          detalhe: String(e?.stack || '').slice(0, 2000) || null,
        } as any);
      } catch (_) { /* nunca deixa o registro de falha derrubar o fluxo */ }
      try {
        await supabase.rpc('iago_finish_message', {
          p_contato_id: travaContatoId,
          p_entrada_id: String(travaEntradaId || ''),
        });
      } catch (_) { /* ignore */ }
      // Sem resposta automática: um humano precisa ver essa conversa.
      try { await etiquetarAguardandoHumano(supabase, travaContatoId); } catch (_) { /* ignore */ }
    }
    return json({ success: false, error: motivoFalha }, 500);
  }

});

async function gerarResposta(args: {
  cfg: any;
  itens: any[];
  historico: any[];
  texto: string;
  proposta: any;
  temAcordo: boolean;
  nomeCliente: string;
  primeiroToque: boolean;
  credorCaixa?: string;
  credorAmbiguo?: boolean;

  cpfIdentificado?: boolean;
  cpfPorTelefone?: boolean;
  multiplosCandidatos?: boolean;
  etapaNegociacao?: string;
  escolhaAnterior?: string;
  imagemCtx?: { descricao: string; classificacao: string } | null;
  qualificacoes?: QualificacaoIA[];
  propostaPrevia?: { valor: string; texto: string } | null;
  respostaAutomatica?: boolean;
  precisaPerguntarNome?: boolean;
}): Promise<{
  mensagens: string[]; escalar: boolean; motivo: string;
  escolha?: string; pagamento_hoje?: string; data_pagamento?: string;
  qualificacao?: string; qualificacao_motivo?: string;
}> {
  const {
    cfg, itens, historico, texto, proposta, nomeCliente, primeiroToque, credorCaixa, credorAmbiguo,
    cpfIdentificado, cpfPorTelefone, multiplosCandidatos, etapaNegociacao, escolhaAnterior,
    imagemCtx, qualificacoes, propostaPrevia, respostaAutomatica, precisaPerguntarNome,
  } = args;



  const instrucoes = blocoConhecimento(itens, 'instrucao');
  const qa = itens.filter((i) => i.tipo === 'qa').map((i) => `P: ${i.gatilho}\nR: ${i.conteudo}`).join('\n\n');
  const proibidos = blocoConhecimento(itens, 'proibido');
  const aprendizados = blocoConhecimento(itens, 'aprendizado');

  const credorFinal = credorAmbiguo ? '' : String(credorCaixa || proposta?.credor || '').trim();


  const semDebito = cpfIdentificado
    ? 'Já identifiquei o cliente pelo telefone, mas não há débitos em aberto para ele. NÃO peça o CPF: informe que não localizou débitos em aberto e escale para um humano conferir (escalar=true).'
    : propostaPrevia
      ? `Ainda não tenho os débitos calculados no sistema, MAS nós já enviamos a este cliente uma proposta de pagamento à vista no valor de R$ ${propostaPrevia.valor}. NÃO peça o CPF agora: retome essa proposta.`
      : 'Ainda não identifiquei os débitos deste cliente. Peça o CPF de forma natural para consultar.';


  const opcoesTxt = (proposta?.opcoes || [])
    .map((o: any) => `   ${o.parcelas}x de R$ ${fmtBRL(o.valorParcela)}`)
    .join('\n');

  const dados = proposta
    ? [
        `Cliente: ${nomeCliente || '(sem nome)'}`,
        `Credor: ${credorFinal}`,
        `Dívida atualizada: ${fmtBRL(proposta.total)}`,
        `À vista com ${proposta.descAvistaPct}% de desconto: ${fmtBRL(proposta.valorAvista)}`,
        proposta.opcoes.length
          ? `Parcelado com ${proposta.descParceladoPct}% de desconto (total ${fmtBRL(proposta.totalParcelado)}):\n${opcoesTxt}`
          : 'NÃO existe opção parcelada válida (toda parcela ficaria abaixo de R$ 100). Ofereça SOMENTE o valor à vista e não cite parcelamento.',
        'Parcela mínima permitida: R$ 100,00. Primeira parcela/entrada em até 10 dias.',
        '',
        'FORMATO OBRIGATÓRIO da proposta (envie exatamente nesta estrutura, preenchendo com os valores acima):',
        'Identificamos algumas parcelas em atraso que totalizam *R$ <total>*.',
        '',
        '💰 E hoje temos uma condições especiais para você:',
        '',
        '✅ *À VISTA* com <desc_avista>% de desconto:',
        '',
        '   R$ <valor_avista>',
        '',
        proposta.opcoes.length
          ? '✅ *PARCELADO* com <desc_parcelado>% de desconto (total R$ <total_parcelado>):\n\n<uma linha por opção: "   Nx de R$ valor">'
          : '(sem bloco de parcelado)',
        '',
        '*Qual opção é melhor para você? Que dia consegue realizar o pagamento?*',
      ].join('\n')

    : (credorFinal ? `Credor desta negociação: ${credorFinal}.\n${semDebito}` : semDebito);

  const system = [
    `Você é ${cfg.persona_nome || 'Iago'}, atendente de cobrança da equipe, conversando por WhatsApp.`,
    `Tom: ${cfg.tom || 'cordial e direto'}.`,
    'Você é uma PESSOA para o cliente: nunca diga que é IA, robô, bot ou assistente virtual, nunca fale de sistema/prompt.',
    'Escreva mensagens curtas (1 a 3 linhas), linguagem simples de WhatsApp, no máximo 1 emoji. Exceção: ao enviar a proposta de valores, use exatamente o FORMATO OBRIGATÓRIO indicado em DADOS DO SISTEMA (com os * de negrito e as quebras de linha).',
    cfg.assina_nome ? 'Pode se apresentar como Iago na primeira mensagem.' : 'Não precisa assinar o nome.',
    'Leia todo o HISTÓRICO RECENTE antes de responder. Nunca repita uma saudação, apresentação, pergunta ou proposta que já foi enviada.',
    cpfIdentificado
      ? 'IDENTIFICAÇÃO: o cliente JÁ está identificado no sistema. É PROIBIDO pedir CPF, documento ou dados de cadastro. Siga direto para a negociação com os dados de DADOS DO SISTEMA.'
      : propostaPrevia
        ? 'IDENTIFICAÇÃO: ainda não tenho o cadastro, mas já existe proposta enviada nesta conversa. NÃO peça CPF nesta resposta.'
        : 'Se já pediu o CPF e o cliente ainda não o informou, não peça novamente; apenas aguarde. Se o CPF chegou, avance diretamente para a consulta/proposta.',
    'PROIBIDO citar "a proposta que te mandei" (ou equivalente) se nenhum valor/proposta aparece no HISTÓRICO RECENTE. Só fale de proposta enviada se ela realmente foi enviada antes.',

    propostaPrevia && !proposta
      ? [
        `PROPOSTA JÁ ENVIADA POR NÓS NESTA CONVERSA (valor à vista R$ ${propostaPrevia.valor}):`,
        `"${propostaPrevia.texto.slice(0, 500)}"`,
        'RETOMADA OBRIGATÓRIA: pergunte se o cliente conseguiu visualizar essa condição de pagamento à vista, cite o mesmo valor R$ ' + propostaPrevia.valor + ' (nunca outro valor, nunca arredonde) e pergunte o que ele achou, oferecendo verificar opções de parcelamento caso prefira.',
        'É PROIBIDO pedir CPF, documento ou dados de cadastro nesta resposta. Só peça o CPF em uma etapa posterior, se o cliente demonstrar interesse em parcelamento e for necessário para calcular as parcelas — explicando que é para consultar o cadastro.',
        'Não repita a mensagem da proposta inteira: apenas retome de forma curta e natural.',
      ].join('\n')
      : '',

    respostaAutomatica
      ? 'A ÚLTIMA MENSAGEM DO CLIENTE É UMA RESPOSTA AUTOMÁTICA (ausência/atendimento automático, muitas vezes com link). NÃO responda o conteúdo dela, não comente nem acesse o link, não agradeça o material divulgado. Apenas siga a conversa retomando o assunto da negociação.'
      : '',


    cpfPorTelefone && nomeCliente
      ? `CONFIRMAÇÃO LEVE: na primeira mensagem confirme a identidade pelo nome, ex.: "Falo com ${primeiroNome(nomeCliente)}?" e já siga a conversa.`
      : '',
    'NOME DO CLIENTE: é PROIBIDO deduzir o nome da pessoa a partir do nome/descrição do perfil do WhatsApp (coisas como "Deus é Fiel", nome de loja, apelido). Use nome APENAS quando ele estiver informado abaixo.',
    nomeCliente
      ? `Use o primeiro nome do cliente com naturalidade (sem repetir em toda mensagem): ${primeiroNome(nomeCliente)}.`
      : '',
    precisaPerguntarNome
      ? 'AINDA NÃO SEI O NOME DESTE CLIENTE: responda normalmente o que ele pediu e, na mesma leva de mensagens, pergunte o nome de forma natural (ex.: "Antes de continuar, como você se chama?"). Nunca chame o cliente por nenhum nome nesta resposta. Se ele não quiser informar, siga o atendimento sem insistir.'
      : '',
    'IDENTIDADE NEGADA: se o cliente disser que não é a pessoa procurada, que é número errado/engano ou que não conhece essa pessoa, responda APENAS uma mensagem curta agradecendo e encerrando o contato (ex.: "Entendi, obrigado pela atenção e desculpe o incômodo!"). Nesse caso é PROIBIDO pedir CPF, citar o credor/empresa, valores ou proposta. Use escalar=false.',
    cpfPorTelefone && multiplosCandidatos
      ? 'ATENÇÃO: este telefone está vinculado a mais de um cadastro. Confirme o nome do cliente ANTES de apresentar qualquer valor ou proposta.'
      : '',
    '',
    contextoDataHoje(),
    '',
    'REGRAS DE VALORES: use APENAS os números fornecidos em DADOS DO SISTEMA. Nunca invente ou arredonde valores, descontos, prazos ou parcelas fora dessa lista.',

    'REGRAS SOBRE SPC/SERASA: quando o cliente perguntar sobre prazo de retirada/remoção/limpeza do nome do SPC, Serasa ou qualquer negativação, informe que o prazo para retirada da restrição é de 5 dias úteis. Não prometa prazo menor ou maior, e não invente outras informações sobre órgãos de proteção ao crédito.',

    imagemCtx
      ? [
        'IMAGEM ENVIADA PELO CLIENTE: a mensagem atual contém a leitura de uma imagem feita pelo sistema (entre colchetes). NUNCA diga que "não consegue ver imagens" nem que é um robô; comente naturalmente o que a imagem mostra, sem citar essa leitura técnica.',
        imagemCtx.classificacao === 'comprovante'
          ? 'ESTA IMAGEM É UM COMPROVANTE DE PAGAMENTO: agradeça, diga que vai encaminhar para a equipe validar o pagamento e que logo darão retorno. É PROIBIDO confirmar que o pagamento foi identificado/baixado, dar quitação ou prometer retirada do nome por conta desse comprovante. Use escalar=true com motivo "cliente enviou comprovante de pagamento".'
          : imagemCtx.classificacao === 'irrelevante'
            ? 'ESTA IMAGEM NÃO TEM RELAÇÃO COM A COBRANÇA (foto, figurinha, mensagem de bom dia): responda em uma frase curta e educada e retome o assunto da negociação (escalar=false).'
            : 'ESTA IMAGEM É UM DOCUMENTO/PRINT: use o que está escrito nela para responder o cliente, sem inventar dados que não aparecem na leitura. Se ela pedir uma decisão que você não pode tomar, escale (escalar=true).',
      ].join('\n')
      : '',


    credorFinal
      ? `CREDOR: esta negociação é referente ao credor "${credorFinal}". Quando o cliente perguntar de qual débito/empresa se trata, informe exatamente "${credorFinal}". Nunca cite outro credor.`
      : credorAmbiguo
        ? 'CREDOR: o credor desta conversa ainda não está definido. É PROIBIDO afirmar ou adivinhar o nome do credor/empresa. Se o cliente perguntar de qual débito se trata, peça o CPF para confirmar no sistema (e, se ainda não der para confirmar, escale para um humano).'
        : '',


    'Você NUNCA fecha ou registra acordo.',
    'FLUXO OBRIGATÓRIO APÓS A ESCOLHA:',
    '1) O cliente escolheu à vista ou um parcelamento: confirme a escolha em uma frase curta e pergunte "Você consegue realizar o pagamento hoje?". NÃO fale de especialista/transferência nesta etapa (escalar=false).',
    '2) Se o cliente disser que NÃO consegue hoje: pergunte "Que dia você consegue realizar o pagamento?" (escalar=false).',
    '3) Se o cliente informar um dia AINDA DENTRO do mês atual (ou "hoje"): confirme a data e escale (escalar=true).',
    '4) Se o cliente informar "mês que vem" ou qualquer data fora do mês atual: NÃO prometa o prazo; diga apenas que um colega vai continuar o atendimento e escale (escalar=true).',
    'Nunca repita a pergunta "consegue pagar hoje?" se ela já está no HISTÓRICO RECENTE — nesse caso pergunte a data.',
    etapaNegociacao === 'escolha_feita'
      ? `ETAPA ATUAL: você já perguntou se ele consegue pagar hoje${escolhaAnterior ? ` (opção escolhida: ${escolhaAnterior})` : ''}. Interprete a resposta dele agora.`
      : etapaNegociacao === 'aguardando_data'
        ? `ETAPA ATUAL: você já perguntou que dia ele consegue pagar${escolhaAnterior ? ` (opção escolhida: ${escolhaAnterior})` : ''}. Interprete a data informada.`
        : '',
    'Escale para humano (escalar=true) quando: a data do pagamento estiver definida (ou fora do mês); o cliente pedir algo fora do que foi ensinado; reclamar/ameaçar processo; tocar em assunto proibido; ou você não tiver certeza da resposta correta.',
    '',
    instrucoes ? `INSTRUÇÕES DO ADMINISTRADOR:\n${instrucoes}` : '',
    qa ? `PERGUNTAS E RESPOSTAS PRONTAS:\n${qa}` : '',
    proibidos ? `ASSUNTOS PROIBIDOS (sempre escalar, sem responder o conteúdo):\n${proibidos}` : '',
    aprendizados ? `APRENDIZADOS DAS NEGOCIAÇÕES REAIS DA EQUIPE:\n${aprendizados}` : '',
    cfg.instrucoes_gerais ? `OBSERVAÇÕES GERAIS:\n${cfg.instrucoes_gerais}` : '',
    '',
    (qualificacoes?.length
      ? [
        'QUALIFICAÇÃO DA CONVERSA: você também classifica o cliente, como um atendente faz. Use EXATAMENTE um dos nomes abaixo (nunca invente outro nome):',
        qualificacoes.map((q) => `- ${q.nome}${q.motivos.length ? ` (motivos: ${q.motivos.map((m) => m.nome).join(' | ')})` : ''}`).join('\n'),
        'Escolha a que melhor descreve a situação atual do cliente e pode mudar em relação à anterior conforme a conversa evolui (ex.: passou a aguardar boleto, ficou sem interesse, fechou acordo).',
        'Se não tiver certeza, deixe "qualificacao" vazio — é melhor não qualificar do que qualificar errado. Só preencha "qualificacao_motivo" com um motivo da lista da qualificação escolhida.',
      ].join('\n')
      : ''),
    '',
    'Responda SOMENTE com JSON válido no formato:',
    '{"mensagens":["texto 1","texto 2"],"escalar":false,"motivo":"","escolha":"","pagamento_hoje":"","data_pagamento":"","qualificacao":"","qualificacao_motivo":"","nao_e_titular":false}',
    'nao_e_titular = true SOMENTE quando o cliente disser que não é a pessoa procurada, que é número/pessoa errada, engano, que não conhece o titular ou que ele não mora mais ali — inclusive com erro de digitação (ex.: "pessoo errada", "num erado"). Nesses casos deixe "mensagens" vazio: o sistema envia o encerramento padrão e não fala mais com esse número.',
    'escolha = forma de pagamento escolhida pelo cliente ("à vista" ou "12x"), vazio se ele ainda não escolheu.',
    'pagamento_hoje = "sim", "nao" ou "" conforme a resposta dele sobre pagar hoje.',
    'data_pagamento = a data que o cliente informou, JÁ RESOLVIDA no formato YYYY-MM-DD usando a lista de datas acima (ex.: "segunda" ou "segunda que vem" => a data da próxima segunda-feira). Use "mes_que_vem" quando ele falar de outro mês sem dia, e vazio se não informou nada.',
    'Se o cliente informar a data na mesma frase da negativa ("não, consigo segunda"), considere a data informada e NÃO repita a pergunta.',

    'mensagens = de 1 a 2 mensagens curtas a enviar agora (vazio só se escalar=true e nada deva ser dito).',
    'Quando escalar=true, envie uma mensagem curta avisando que um colega vai continuar o atendimento e preencha "motivo" em português.',

  ].filter(Boolean).join('\n');

  const conversa = historico.length
    ? historico.map((m) => `${m.direcao === 'entrada' ? 'CLIENTE' : 'NÓS'}: ${String(m.conteudo || '').slice(0, 400)}`).join('\n')
    : '(sem histórico)';

  const user = [
    `DADOS DO SISTEMA:\n${dados}`,
    '',
    `HISTÓRICO RECENTE:\n${conversa}`,
    '',
    `MENSAGEM ATUAL DO CLIENTE: ${texto || '(sem texto)'}`,
    primeiroToque ? 'Esta é a primeira interação sua com este cliente.' : '',
    nomeCliente ? `Primeiro nome do cliente: ${primeiroNome(nomeCliente)}` : '',
  ].filter(Boolean).join('\n');

  try {
    const out = await chamarIA(system, user);
    const parsed = extrairJson(out);
    if (parsed && (Array.isArray(parsed.mensagens) || parsed.escalar)) {
      return {
        mensagens: Array.isArray(parsed.mensagens) ? parsed.mensagens.map((m: any) => String(m)) : [],
        escalar: !!parsed.escalar,
        motivo: String(parsed.motivo || ''),
        escolha: String(parsed.escolha || ''),
        pagamento_hoje: String(parsed.pagamento_hoje || ''),
        data_pagamento: String(parsed.data_pagamento || ''),
      };
    }
    const txt = String(out || '').trim();
    if (txt) return { mensagens: [txt.slice(0, 900)], escalar: false, motivo: '' };
    return { mensagens: [], escalar: true, motivo: 'não consegui formular a resposta' };
  } catch (e: any) {
    console.error('[IAGO] falha na IA', e?.message || e);
    return { mensagens: [], escalar: true, motivo: `falha técnica da IA (${String(e?.message || e).slice(0, 60)})` };
  }
}

/**
 * Procura, nas mensagens de saída (campanha/template/atendente/IAGO), uma proposta
 * de pagamento já enviada ao cliente. Retorna o valor e o texto original.
 */
function detectarPropostaPrevia(historico: any[]): { valor: string; texto: string } | null {
  const saidas = historico.filter((m) => m?.direcao === 'saida');
  for (let i = saidas.length - 1; i >= 0; i--) {
    const texto = String(saidas[i]?.conteudo || '').trim();
    if (!texto) continue;
    const semAcento = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const falaProposta = /(a\s*vista|avista|parcel|desconto|debito|divida|pagamento|proposta|autorizado)/.test(semAcento);
    if (!falaProposta) continue;
    const valores = texto.match(/r\$\s*[\d.]+,\d{2}/gi);
    if (!valores?.length) continue;
    const valor = valores[0].replace(/r\$\s*/i, '').trim();
    return { valor, texto };
  }
  return null;
}

/** Mensagem automática de ausência do cliente (não é resposta real). */
function ehRespostaAutomatica(texto: string): boolean {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!t.trim()) return false;
  const padroes = [
    'agradece seu contato',
    'assim que possivel',
    'aguarde um instante',
    'ja te respondo',
    'logo retornarei',
    'em breve retornarei',
    'mensagem automatica',
    'estou ausente',
    'no momento nao posso atender',
    'enquanto aguarda',
    'como posso ajudar voce',
  ];
  const acertos = padroes.filter((p) => t.includes(p)).length;
  const temLink = /https?:\/\/|www\./.test(t);
  return acertos >= 2 || (acertos >= 1 && (temLink || t.length > 120));
}

/**
 * Mensagem de divulgação/robô (não é cliente respondendo cobrança).
 * Usada junto com a checagem de "mesmo texto em vários chips" antes de silenciar.
 */
function ehDivulgacao(texto: string): boolean {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (t.trim().length < 60) return false;
  const padroes = [
    'sua conta foi criada',
    'clique no botao abaixo',
    'basta clicar no botao',
    'para mais informacoes, basta',
    'aproveite nossa promocao',
    'aproveite a promocao',
    'cadastre-se',
    'faca seu cadastro',
    'ganhe bonus',
    'bonus de boas',
    'link de acesso',
    'saiba mais em',
    'aqui e a ',
  ];
  const acertos = padroes.filter((p) => t.includes(p)).length;
  const temLink = /https?:\/\/|www\.|\.com\b/.test(t);
  return acertos >= 2 || (acertos >= 1 && temLink);
}
