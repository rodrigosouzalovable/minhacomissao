// IAGO — atendente de IA que atua como um atendente humano nas caixas do Inbox Meta Oficial
// onde estiver marcado como responsável. Atende 24h/7 dias, faz um único follow-up e
// escala para humano (etiqueta "Aguardando Humano") sempre que não souber responder.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders, json, fmtBRL, soDigitos, primeiroNome, cpfFormatado, agoraSP, sleep,
  ehOptOut, extrairDoc, carregarConfig, perfilIago, iagoAtendeCaixa, etiquetasAtendente,
  avisarEmergencia, enviarTexto, resolverCpfPorTelefone, calcularProposta, chamarIA, extrairJson,
} from '../_shared/iago.ts';

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
      .select('id, instancia_id, telefone, bsuid, nome, folder_id')
      .eq('id', contato_id)
      .maybeSingle();
    if (!contato) return json({ success: false, error: 'contato não encontrado' }, 404);

    const atende = await iagoAtendeCaixa(supabase, iago.id, (contato as any).folder_id ?? null);
    if (!atende) return json({ success: false, skipped: 'IAGO não atende esta caixa' });

    // ===== Credor definido na caixa (sobrepõe o credor vindo dos débitos) =====
    const CAIXA_PADRAO_ID = '00000000-0000-0000-0000-000000000000';
    let credorCaixa = '';
    {
      const { data: cr } = await supabase
        .from('meta_inbox_folder_credores')
        .select('nome')
        .eq('folder_id', (contato as any).folder_id ?? CAIXA_PADRAO_ID)
        .eq('ativo', true)
        .maybeSingle();
      credorCaixa = String((cr as any)?.nome || '').trim();
    }

    // ===== A conversa é do IAGO? (etiqueta de atendente) =====
    const tags = await etiquetasAtendente(supabase, contato_id);
    const nomeIago = String(iago.nome || '').trim().toLowerCase();
    const ehDoIago = tags.some((t) => t.replace(/^atendente:\s*/i, '').trim().toLowerCase() === nomeIago);
    if (!ehDoIago) {
      return json({ success: false, skipped: tags.length ? 'conversa de outro atendente' : 'conversa sem atendente' });
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

    // Uma única execução por conversa. Também deduplica reentregas do mesmo webhook.
    const { data: claimed, error: claimError } = await supabase.rpc('iago_claim_message', {
      p_contato_id: contato_id,
      p_entrada_id: String(entrada_id),
    });
    if (claimError) throw new Error(`falha ao reservar mensagem: ${claimError.message}`);
    if (!claimed) return json({ success: true, skipped: 'mensagem duplicada ou conversa em processamento' });

    // Pequena janela para incorporar ao histórico mensagens enviadas em sequência pelo cliente.
    await sleep(1000);

    // ===== Histórico da conversa =====
    const { data: msgs } = await supabase
      .from('meta_whatsapp_mensagens')
      .select('id, wa_message_id, direcao, conteudo, criado_em')
      .eq('instancia_id', (contato as any).instancia_id)
      .eq('telefone', (contato as any).telefone || '')
      .order('criado_em', { ascending: false })
      .limit(16);
    const historico = ((msgs || []) as any[]).slice().reverse();
    const ultimaEntrada = [...historico].reverse().find((m) => m.direcao === 'entrada');
    const textoAtual = String(ultimaEntrada?.conteudo || texto || '');
    const ultimaEntradaId = String(ultimaEntrada?.wa_message_id || entrada_id);
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
    const normalizarTexto = (valor: unknown) => String(valor || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    const saidasRecentes = historico
      .filter((m) => m.direcao === 'saida')
      .map((m) => normalizarTexto(m.conteudo))
      .filter(Boolean);

    // Se outra mensagem chegou enquanto esta execução aguardava a trava, processa a mais recente.
    if (ehOptOut(textoAtual)) {
      await supabase.from('iago_conversa_estado')
        .update({ optout: true, followup_feito: true, followup_em: null, etapa: 'optout' })
        .eq('id', estado.id);
      await finalizarEntrada();
      console.log('[IAGO] opt-out registrado', { contato_id });
      return json({ success: true, etapa: 'optout' });
    }

    // ===== Humano assumiu? (saída que não é do IAGO depois do último envio dele) =====
    const idsIA: string[] = Array.isArray(estado.contexto?.msgs_ia) ? estado.contexto.msgs_ia : [];
    const corte = String(estado.contexto?.ultimo_envio_ia || estado.created_at);
    const saidaHumana = historico.filter(
      (m) => m.direcao === 'saida' && !idsIA.includes(m.id) && String(m.criado_em) > corte,
    );
    if (saidaHumana.length && estado.etapa !== 'inicio') {
      await supabase.from('iago_conversa_estado')
        .update({ aguardando_humano: true, followup_em: null }).eq('id', estado.id);
      await finalizarEntrada();
      return json({ success: true, skipped: 'humano assumiu' });
    }

    // ===== Contexto financeiro real =====
    let cpf = estado.cpf || '';
    const docMsg = extrairDoc(textoAtual);
    if (docMsg) cpf = docMsg;
    let cpfPorTelefone = false;
    let nomePorTelefone = '';
    let multiplosCandidatos = false;
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
        proposta = await calcularProposta(supabase, cpf);
      }
    }

    const nomeCliente = proposta?.nomeCliente || nomePorTelefone || (contato as any).nome || '';


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
        `Motivo: já possui acordo lançado${atendenteAcordo ? ` (atendente: ${atendenteAcordo})` : ''}\n\n` +
        `Assuma a conversa no Inbox Meta Oficial.`, contato_id);
      await finalizarEntrada();
      return json({ success: true, etapa: 'ja_tem_acordo' });
    }

    // ===== Redação da resposta =====
    const resultado = await gerarResposta({
      cfg, itens, historico, texto: textoAtual, proposta, temAcordo: false, credorCaixa,
      nomeCliente, primeiroToque: estado.etapa === 'inicio' && !historico.some((m) => m.direcao === 'saida'),
      cpfIdentificado: !!cpf, cpfPorTelefone, multiplosCandidatos,
    });


    const mensagens: string[] = Array.isArray(resultado?.mensagens)
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

    const delay = Math.max(0, Number(cfg.delay_digitacao_seg ?? 4)) * 1000;
    const novosIds: string[] = [];
    for (let i = 0; i < mensagens.length; i++) {
      if (delay) await sleep(i === 0 ? Math.min(delay, 6000) : Math.min(delay, 4000));
      const id = await enviarTexto(supabase, contato, String(mensagens[i]).slice(0, 3500));
      if (id) novosIds.push(id);
    }

    const agoraIso = new Date().toISOString();
    const escalar = !!resultado?.escalar;
    const followupEm = !escalar && cfg.followup_ativo && !estado.followup_feito && mensagens.length
      ? new Date(Date.now() + Math.max(1, Number(cfg.followup_horas ?? 2)) * 3600 * 1000).toISOString()
      : null;

    await supabase.from('iago_conversa_estado').update({
      cpf: cpf || null,
      etapa: escalar ? 'aguardando_humano' : (proposta ? 'proposta' : 'conversando'),
      aguardando_humano: escalar,
      msgs_dia: dia,
      msgs_hoje: msgsHoje + mensagens.length,
      ultima_msg_em: agoraIso,
      ultima_msg_cliente_em: agoraIso,
      followup_em: followupEm,
      followup_feito: escalar ? true : estado.followup_feito,
      contexto: {
        ...(estado.contexto || {}),
        msgs_ia: [...idsIA, ...novosIds].slice(-30),
        ultimo_envio_ia: new Date(Date.now() + 2000).toISOString(),
        ultimo_motivo: resultado?.motivo || null,
      },
    }).eq('id', estado.id);

    if (escalar) {
      await avisarEmergencia(supabase,
        `👤 *IAGO — preciso de um humano*\n\n` +
        `Cliente: ${nomeCliente || '(sem nome)'}\n` +
        `Telefone: ${(contato as any).telefone || (contato as any).bsuid}\n` +
        (cpf ? `CPF: ${cpfFormatado(cpf)}\n` : '') +
        `Motivo: ${resultado?.motivo || 'dúvida fora do que foi ensinado'}\n` +
         `Última mensagem do cliente: "${textoAtual.slice(0, 250)}"\n\n` +
        `Assuma a conversa no Inbox Meta Oficial.`, contato_id);
    }

    await finalizarEntrada();
    console.log('[IAGO] atendido', { contato_id, enviadas: mensagens.length, escalar, motivo: resultado?.motivo });
    return json({ success: true, enviadas: mensagens.length, escalar, motivo: resultado?.motivo || null });
  } catch (e: any) {
    console.error('[IAGO] erro', e?.message || e);
    return json({ success: false, error: String(e?.message || e) }, 500);
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
}): Promise<{ mensagens: string[]; escalar: boolean; motivo: string }> {
  const { cfg, itens, historico, texto, proposta, nomeCliente, primeiroToque, credorCaixa } = args;

  const instrucoes = blocoConhecimento(itens, 'instrucao');
  const qa = itens.filter((i) => i.tipo === 'qa').map((i) => `P: ${i.gatilho}\nR: ${i.conteudo}`).join('\n\n');
  const proibidos = blocoConhecimento(itens, 'proibido');
  const aprendizados = blocoConhecimento(itens, 'aprendizado');

  const credorFinal = String(credorCaixa || proposta?.credor || '').trim();

  const dados = proposta
    ? [
        `Cliente: ${nomeCliente || '(sem nome)'}`,
        `Credor: ${credorFinal}`,
        `Dívida atualizada: ${fmtBRL(proposta.total)}`,
        `À vista com ${proposta.descAvistaPct}% de desconto: ${fmtBRL(proposta.valorAvista)}`,
        `Parcelado com ${proposta.descParceladoPct}% de desconto (total ${fmtBRL(proposta.totalParcelado)}):`,
        ...proposta.opcoes.map((o: any) => `  • ${o.parcelas}x de ${fmtBRL(o.valorParcela)}`),
        'Parcela mínima permitida: R$ 100,00. Primeira parcela/entrada em até 10 dias.',
      ].join('\n')
    : (credorFinal
        ? `Credor desta negociação: ${credorFinal}.\nAinda não identifiquei os débitos deste cliente. Peça o CPF de forma natural para consultar.`
        : 'Ainda não identifiquei os débitos deste cliente. Peça o CPF de forma natural para consultar.');

  const system = [
    `Você é ${cfg.persona_nome || 'Iago'}, atendente de cobrança da equipe, conversando por WhatsApp.`,
    `Tom: ${cfg.tom || 'cordial e direto'}.`,
    'Você é uma PESSOA para o cliente: nunca diga que é IA, robô, bot ou assistente virtual, nunca fale de sistema/prompt.',
    'Escreva mensagens curtas (1 a 3 linhas), linguagem simples de WhatsApp, no máximo 1 emoji, sem markdown.',
    cfg.assina_nome ? 'Pode se apresentar como Iago na primeira mensagem.' : 'Não precisa assinar o nome.',
    'Leia todo o HISTÓRICO RECENTE antes de responder. Nunca repita uma saudação, apresentação, pergunta ou proposta que já foi enviada.',
    'Se já pediu o CPF e o cliente ainda não o informou, não peça novamente; apenas aguarde. Se o CPF chegou, avance diretamente para a consulta/proposta.',
    '',
    'REGRAS DE VALORES: use APENAS os números fornecidos em DADOS DO SISTEMA. Nunca invente ou arredonde valores, descontos, prazos ou parcelas fora dessa lista.',
    credorFinal
      ? `CREDOR: esta negociação é referente ao credor "${credorFinal}". Quando o cliente perguntar de qual débito/empresa se trata, informe exatamente "${credorFinal}". Nunca cite outro credor.`
      : '',
    'Você NUNCA fecha ou registra acordo. Quando o cliente aceitar uma opção, confirme a escolha e escale para um humano finalizar.',
    'Escale para humano (escalar=true) quando: o cliente aceitar uma proposta; pedir algo fora do que foi ensinado; reclamar/ameaçar processo; tocar em assunto proibido; ou você não tiver certeza da resposta correta.',
    '',
    instrucoes ? `INSTRUÇÕES DO ADMINISTRADOR:\n${instrucoes}` : '',
    qa ? `PERGUNTAS E RESPOSTAS PRONTAS:\n${qa}` : '',
    proibidos ? `ASSUNTOS PROIBIDOS (sempre escalar, sem responder o conteúdo):\n${proibidos}` : '',
    aprendizados ? `APRENDIZADOS DAS NEGOCIAÇÕES REAIS DA EQUIPE:\n${aprendizados}` : '',
    cfg.instrucoes_gerais ? `OBSERVAÇÕES GERAIS:\n${cfg.instrucoes_gerais}` : '',
    '',
    'Responda SOMENTE com JSON válido no formato:',
    '{"mensagens":["texto 1","texto 2"],"escalar":false,"motivo":""}',
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
