// Follow-ups do IAGO: até 3 retomadas dentro da MESMA janela de 24h da Meta, cada uma
// com mensagem diferente, sempre que o cliente não respondeu.
//   Etapa 1 -> algumas horas após o nosso envio (cfg.followup_horas, padrão 2h)
//   Etapa 2 -> 12h de janela aberta (cfg.followup2_horas)
//   Etapa 3 -> 23h de janela aberta, 1h antes de fechar (cfg.followup3_horas)
// Tudo respeitando o horário permitido (padrão 08h–19h BRT). Se o marco cair fora do
// horário, sai na primeira passagem permitida — e a etapa 3 sai na última passagem
// possível antes de a janela fechar, para não perder a chance.
// O texto é sempre coerente com o que já foi conversado: só fala de "proposta" se
// uma proposta com valores realmente foi enviada antes.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders, json, agoraSP, primeiroNome, carregarConfig, perfilIago, iagoAtendeCaixa,
  etiquetasAtendente, temAtendenteHumanoNoTelefone, enviarTexto, chamarIA, extrairJson, ehNumeroErrado, ehFalecido, etiquetarAguardandoHumano, suprimirDestinatario,
  nomePerfilConfiavel, nomeDeSaudacaoEnviada, resolverCredorConversa,
} from '../_shared/iago.ts';

const HORA = 60 * 60 * 1000;
const JANELA_MS = 24 * HORA;

const normalizar = (valor: unknown) => String(valor || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const pareceRepetido = (candidato: string, anteriores: string[]) => {
  const c = normalizar(candidato);
  if (!c) return true;
  return anteriores.some((a) =>
    a === c || (a.length >= 25 && c.length >= 25 && (a.includes(c) || c.includes(a))));
};

/** Instruções específicas de cada etapa — garantem mensagens diferentes a cada retomada. */
function instrucoesEtapa(etapa: number, propostaEnviada: boolean): string[] {
  if (etapa <= 1) {
    return [
      'Contexto: o cliente parou de responder há algumas horas e você vai retomar a conversa de forma leve.',
      propostaEnviada
        ? 'Pergunte de forma simples se ele conseguiu ver as condições que você enviou.'
        : 'Retome o que falta para seguir (por exemplo o CPF) de outra forma, explicando rapidamente o motivo do contato.',
    ];
  }
  if (etapa === 2) {
    return [
      'Contexto: já passou meio dia desde a última mensagem do cliente e ele segue sem responder. Esta é a SEGUNDA tentativa de retomada.',
      'Traga um reforço útil, sem repetir a primeira cobrança: lembre em uma frase o benefício de resolver agora (regularizar o nome, condição facilitada) e pergunte o que ele achou.',
      propostaEnviada
        ? 'Você pode citar que a condição enviada continua valendo, mas NÃO repita os valores linha por linha.'
        : 'É PROIBIDO mencionar proposta, valores ou descontos específicos — nada disso foi enviado ainda.',
      'Não comece a mensagem do mesmo jeito que as mensagens anteriores do histórico.',
    ];
  }
  return [
    'Contexto: a conversa está perto de encerrar por inatividade e esta é a ÚLTIMA tentativa de retomada.',
    'Deixe claro, com educação e sem ameaçar, que você vai encerrar o atendimento por aqui se ele não conseguir responder, e que a condição pode não continuar disponível depois.',
    'Peça um retorno rápido, mesmo que seja só um "sim" ou "depois".',
    propostaEnviada
      ? 'Pode citar que a condição enviada ainda está aberta, sem repetir os valores linha por linha.'
      : 'É PROIBIDO mencionar proposta, valores ou descontos específicos — nada disso foi enviado ainda.',
    'Nunca fale de processo, cartório, negativação nova ou qualquer consequência legal.',
  ];
}

/** Texto da retomada, gerado a partir do histórico real e da etapa. */
async function textoRetomada(args: {
  cfg: any; historico: any[]; nome: string; credor: string; etapa: number; propostaEnviada: boolean;
}): Promise<string> {
  const { cfg, historico, nome, credor, etapa, propostaEnviada } = args;
  const conversa = historico
    .map((m) => `${m.direcao === 'entrada' ? 'CLIENTE' : 'NÓS'}: ${String(m.conteudo || '').slice(0, 300)}`)
    .join('\n') || '(sem histórico)';

  const system = [
    `Você é ${cfg.persona_nome || 'Iago'}, atendente de cobrança conversando por WhatsApp.`,
    `Tom: ${cfg.tom || 'cordial e direto'}. Você é uma PESSOA: nunca diga que é IA, robô ou assistente.`,
    'Escreva UMA única mensagem curta (1 a 2 linhas), sem markdown, no máximo 1 emoji.',
    ...instrucoesEtapa(etapa, propostaEnviada),
    'Não se apresente de novo se já se apresentou. Não repita literalmente nenhuma frase que já está no histórico.',
    credor ? `Se precisar citar a origem do débito, use exatamente o credor "${credor}".` : '',
    '',
    'Responda SOMENTE com JSON válido: {"mensagem":"texto"}',
  ].filter(Boolean).join('\n');

  const user = [
    `HISTÓRICO RECENTE:\n${conversa}`,
    nome ? `Primeiro nome do cliente: ${nome}` : '',
    `Tentativa de retomada nº ${etapa}.`,
  ].filter(Boolean).join('\n\n');

  try {
    const out = await chamarIA(system, user);
    const parsed = extrairJson(out);
    const msg = String(parsed?.mensagem || '').trim();
    if (msg) return msg.slice(0, 700);
    const cru = String(out || '').trim();
    return cru && cru.length < 500 ? cru : '';
  } catch (e: any) {
    console.error('[IAGO followup] falha na IA', e?.message || e);
    return '';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const cfg = await carregarConfig(supabase);
    if (!cfg?.ativo || !cfg?.followup_ativo) return json({ success: true, skipped: 'follow-up desligado' });

    const spNow = agoraSP();
    const hora = spNow.getHours();
    const hIni = Number(cfg.followup_hora_inicio ?? 8);
    const hFim = Number(cfg.followup_hora_fim ?? 19);
    if (hora < hIni || hora >= hFim) return json({ success: true, skipped: `fora da janela ${hIni}h-${hFim}h` });

    const iago = await perfilIago(supabase, cfg);
    if (!iago?.id) return json({ success: true, skipped: 'usuário do IAGO não encontrado' });

    const agora = new Date();
    const h2 = Math.max(1, Number(cfg.followup2_horas ?? 12));
    const h3 = Math.max(1, Number(cfg.followup3_horas ?? 23));
    const etapa2Ativa = cfg.followup2_ativo !== false;
    const etapa3Ativa = cfg.followup3_ativo !== false;

    // Minutos restantes de horário permitido hoje (BRT) — usados para a "última chance".
    const minutosAteFimPermitido = (hFim - hora) * 60 - spNow.getMinutes();

    // ===== Candidatos: etapa 1 (agendada) + etapas 2/3 (marcos da janela) =====
    const { data: agendados } = await supabase
      .from('iago_conversa_estado')
      .select('*')
      .eq('followup_feito', false)
      .eq('optout', false)
      .eq('aguardando_humano', false)
      .not('followup_em', 'is', null)
      .lte('followup_em', agora.toISOString())
      .limit(40);

    let extras: any[] = [];
    if (etapa2Ativa || etapa3Ativa) {
      const { data } = await supabase
        .from('iago_conversa_estado')
        .select('*')
        .eq('optout', false)
        .eq('aguardando_humano', false)
        .lt('followup_etapa', 3)
        .gte('ultima_msg_cliente_em', new Date(agora.getTime() - JANELA_MS).toISOString())
        .order('ultima_msg_cliente_em', { ascending: true })
        .limit(60);
      extras = (data || []) as any[];
    }

    const candidatos = new Map<string, { est: any; etapa: number }>();
    for (const est of (agendados || []) as any[]) {
      candidatos.set(est.id, { est, etapa: 1 });
    }

    let enviados = 0;
    const pulados: string[] = [];

    // Define a etapa dos candidatos por marco de janela (12h / 23h / última chance).
    for (const est of extras) {
      if (candidatos.has(est.id)) continue;
      const abertura = est.ultima_msg_cliente_em ? new Date(est.ultima_msg_cliente_em).getTime() : 0;
      if (!abertura) continue;
      const idadeH = (agora.getTime() - abertura) / HORA;
      if (idadeH >= 24) continue;
      const feita = Number(est.followup_etapa || 0);
      const restaJanelaMin = (abertura + JANELA_MS - agora.getTime()) / 60000;
      // Última chance: a janela fecha antes do próximo horário permitido.
      const ultimaChance = restaJanelaMin <= minutosAteFimPermitido + 20;

      let etapa = 0;
      if (etapa3Ativa && feita < 3 && (idadeH >= h3 || ultimaChance)) etapa = 3;
      else if (etapa2Ativa && feita < 2 && idadeH >= h2) etapa = 2;
      if (etapa) candidatos.set(est.id, { est, etapa });
    }

    const ETAPAS_ENCERRADAS = new Set(['numero_errado', 'falecido', 'optout']);

    // Orçamento de tempo: evita 504 quando há muitos candidatos (IA + envio por conversa).
    const inicioRun = Date.now();
    const LIMITE_MS = 100_000;

    for (const { est, etapa } of candidatos.values()) {
      if (Date.now() - inicioRun > LIMITE_MS) { pulados.push('tempo limite da execução'); break; }

      // Conversa já encerrada (pessoa errada / falecimento / opt-out): nunca retomar.
      if (ETAPAS_ENCERRADAS.has(String(est.etapa || '')) || est.optout === true) {
        await supabase.from('iago_conversa_estado')
          .update({ followup_feito: true, followup_em: null, followup_etapa: 3 }).eq('id', est.id);
        pulados.push(`conversa encerrada (${est.etapa || 'optout'})`);
        continue;
      }

      const { data: contato } = await supabase
        .from('meta_whatsapp_contatos')
        .select('id, instancia_id, telefone, bsuid, nome, folder_id, credor, ultima_msg_entrada_em')
        .eq('id', est.contato_id)
        .maybeSingle();
      if (!contato) { pulados.push('contato inexistente'); continue; }

      // Cliente respondeu depois do nosso último envio? => follow-up desnecessário
      const { data: entradas } = await supabase
        .from('meta_whatsapp_mensagens')
        .select('id')
        .eq('instancia_id', (contato as any).instancia_id)
        .eq('telefone', (contato as any).telefone || '')
        .eq('direcao', 'entrada')
        .gt('criado_em', String(est.ultima_msg_em || est.created_at))
        .limit(1);
      if ((entradas || []).length) {
        await supabase.from('iago_conversa_estado')
          .update({ followup_em: null }).eq('id', est.id);
        pulados.push('cliente respondeu');
        continue;
      }

      // Janela de 24h da Meta precisa estar aberta
      const ultimaEntrada = (contato as any).ultima_msg_entrada_em
        ? new Date((contato as any).ultima_msg_entrada_em).getTime() : 0;
      if (!ultimaEntrada || agora.getTime() - ultimaEntrada >= JANELA_MS) {
        await supabase.from('iago_conversa_estado')
          .update({ followup_feito: true, followup_em: null, followup_etapa: 3 }).eq('id', est.id);
        pulados.push('janela 24h fechada');
        continue;
      }

      // A conversa continua sendo do IAGO e na caixa dele?
      const atende = await iagoAtendeCaixa(supabase, iago.id, (contato as any).folder_id ?? null);
      const tags = await etiquetasAtendente(supabase, (contato as any).id);
      const nomeIago = String(iago.nome || '').trim().toLowerCase();
      const ehDoIago = tags.some((t) => t.replace(/^atendente:\s*/i, '').trim().toLowerCase() === nomeIago);
      const humanoVinculado = await temAtendenteHumanoNoTelefone(supabase, (contato as any).id, iago.nome || '');
      if (!atende || !ehDoIago || humanoVinculado) {
        await supabase.from('iago_conversa_estado')
          .update({ followup_feito: true, followup_em: null, followup_etapa: 3 }).eq('id', est.id);
        pulados.push(humanoVinculado ? `atendente humano vinculado (${humanoVinculado})` : 'conversa não é do IAGO');
        continue;
      }

      // ===== Histórico real da conversa =====
      const { data: msgs } = await supabase
        .from('meta_whatsapp_mensagens')
        .select('direcao, conteudo, criado_em')
        .eq('instancia_id', (contato as any).instancia_id)
        .eq('telefone', (contato as any).telefone || '')
        .order('criado_em', { ascending: false })
        .limit(14);
      const historico = ((msgs || []) as any[]).slice().reverse();

      // ===== Cliente avisou que não é a pessoa procurada => nunca fazer follow-up =====
      const negouIdentidade = historico.some((m) => m.direcao === 'entrada' && ehNumeroErrado(String(m.conteudo || '')))
        || historico.some((m) => m.direcao === 'saida' && /desculpe o inc[oô]modo/i.test(String(m.conteudo || '')));
      if (negouIdentidade) {
        await supabase.from('iago_conversa_estado').update({
          followup_feito: true,
          followup_em: null,
          followup_etapa: 3,
          aguardando_humano: true,
          etapa: 'numero_errado',
        }).eq('id', est.id);
        try { await etiquetarAguardandoHumano(supabase, (contato as any).id); } catch (_) { /* noop */ }
        await suprimirDestinatario(
          supabase,
          (contato as any).telefone || (contato as any).bsuid,
          'pessoa_errada: cliente informou que não é a pessoa procurada',
        );
        pulados.push('número errado');
        continue;
      }

      // ===== Cliente informou falecimento do titular => nunca fazer follow-up =====
      const informouFalecimento = historico.some((m) => m.direcao === 'entrada' && ehFalecido(String(m.conteudo || '')));
      if (informouFalecimento) {
        await supabase.from('iago_conversa_estado').update({
          followup_feito: true,
          followup_em: null,
          followup_etapa: 3,
          aguardando_humano: true,
          etapa: 'falecido',
        }).eq('id', est.id);
        try { await etiquetarAguardandoHumano(supabase, (contato as any).id); } catch (_) { /* noop */ }
        pulados.push('falecimento informado');
        continue;
      }

      const saidas = historico.filter((m) => m.direcao === 'saida');
      const saidasNorm = saidas.map((m) => normalizar(m.conteudo)).filter(Boolean);


      // Proposta só conta se valores realmente foram enviados ao cliente.
      const propostaEnviada = !!est.contexto?.proposta_enviada
        || saidas.some((m) => /r\$\s*\d/i.test(String(m.conteudo || '')));

      // Nome informado pelo cliente tem prioridade; depois o nome que nós usamos na saudação;
      // nome de perfil do WhatsApp só se for confiável.
      const nomeCtx = String((est.contexto || {}).nome_informado || '').trim();
      const nomePerfilFup = String((contato as any).nome || '').trim();
      const nome = primeiroNome(
        nomeCtx || nomeDeSaudacaoEnviada(historico) || (nomePerfilConfiavel(nomePerfilFup) ? nomePerfilFup : ''),
      );


      // Credor da conversa: cabeçalho da conversa > credor único ativo da caixa
      const credor = (await resolverCredorConversa(
        supabase,
        (contato as any).folder_id ?? null,
        (contato as any).credor ?? null,
      )).nome;


      let texto = '';
      if (etapa === 1 && propostaEnviada) {
        const base = String(cfg.followup_texto || 'Oi, tudo bem? Só passando pra saber se você viu a proposta que te mandei.');
        texto = nome ? `${nome}, ${base.charAt(0).toLowerCase()}${base.slice(1)}` : base;
      } else {
        texto = await textoRetomada({ cfg, historico, nome, credor, etapa, propostaEnviada });
      }

      if (!texto || pareceRepetido(texto, saidasNorm)) {
        await supabase.from('iago_conversa_estado')
          .update({
            followup_feito: true,
            followup_em: null,
            followup_etapa: Math.max(Number(est.followup_etapa || 0), etapa),
          }).eq('id', est.id);
        pulados.push(texto ? 'texto repetiria algo já enviado' : 'sem texto coerente para retomar');
        continue;
      }

      try {
        const id = await enviarTexto(supabase, contato, texto);
        const ids = Array.isArray(est.contexto?.msgs_ia) ? est.contexto.msgs_ia : [];
        await supabase.from('iago_conversa_estado').update({
          followup_feito: true,
          followup_em: null,
          followup_etapa: Math.max(Number(est.followup_etapa || 0), etapa),
          etapa: 'followup',
          ultima_msg_em: new Date().toISOString(),
          contexto: {
            ...(est.contexto || {}),
            msgs_ia: [...ids, ...(id ? [id] : [])].slice(-30),
            ultimo_envio_ia: new Date(Date.now() + 2000).toISOString(),
            ultimo_followup_etapa: etapa,
            ultimo_followup_em: new Date().toISOString(),
          },
        }).eq('id', est.id);
        enviados += 1;
        console.log('[IAGO followup] enviado', { contato_id: est.contato_id, etapa });
      } catch (e: any) {
        console.error('[IAGO followup] falha no envio', e?.message || e);
        // Falha de envio (token/instância/rede) não é culpa do cliente: tenta de novo
        // em 20 min, até 2 tentativas por etapa, antes de desistir da retomada.
        const tentativas = Number((est.contexto || {})[`falhas_followup_${etapa}`] || 0) + 1;
        const podeTentarDeNovo = tentativas < 2;
        await supabase.from('iago_conversa_estado')
          .update({
            followup_feito: !podeTentarDeNovo,
            followup_em: podeTentarDeNovo
              ? new Date(Date.now() + 20 * 60 * 1000).toISOString()
              : null,
            followup_etapa: podeTentarDeNovo
              ? Number(est.followup_etapa || 0)
              : Math.max(Number(est.followup_etapa || 0), etapa),
            contexto: {
              ...(est.contexto || {}),
              [`falhas_followup_${etapa}`]: tentativas,
              ultimo_erro_followup: String(e?.message || e).slice(0, 300),
            },
          }).eq('id', est.id);
      }

    }

    console.log('[IAGO followup]', { candidatos: candidatos.size, enviados, pulados });
    return json({ success: true, candidatos: candidatos.size, enviados, pulados });
  } catch (e: any) {
    console.error('[IAGO followup] erro', e?.message || e);
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
});
