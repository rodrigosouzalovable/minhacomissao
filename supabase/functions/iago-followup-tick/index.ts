// Follow-up único do IAGO: se o cliente não respondeu, retoma UMA vez algumas horas depois,
// somente dentro da janela permitida (padrão 08h–19h BRT) e dentro das 24h da última
// mensagem do cliente (janela oficial da Meta para mensagem livre).
// O texto é sempre coerente com o que já foi conversado: só fala de "proposta" se
// uma proposta com valores realmente foi enviada antes.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders, json, agoraSP, primeiroNome, carregarConfig, perfilIago, iagoAtendeCaixa,
  etiquetasAtendente, enviarTexto, chamarIA, extrairJson,
} from '../_shared/iago.ts';

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

/** Texto de retomada quando NENHUMA proposta foi enviada: gerado a partir do histórico. */
async function textoSemProposta(args: {
  cfg: any; historico: any[]; nome: string; credor: string;
}): Promise<string> {
  const { cfg, historico, nome, credor } = args;
  const conversa = historico
    .map((m) => `${m.direcao === 'entrada' ? 'CLIENTE' : 'NÓS'}: ${String(m.conteudo || '').slice(0, 300)}`)
    .join('\n') || '(sem histórico)';

  const system = [
    `Você é ${cfg.persona_nome || 'Iago'}, atendente de cobrança conversando por WhatsApp.`,
    `Tom: ${cfg.tom || 'cordial e direto'}. Você é uma PESSOA: nunca diga que é IA, robô ou assistente.`,
    'Escreva UMA única mensagem curta (1 a 2 linhas), sem markdown, no máximo 1 emoji.',
    'Contexto: o cliente parou de responder e você vai retomar a conversa UMA vez.',
    'NENHUMA proposta ou valor foi enviada a este cliente. É PROIBIDO mencionar proposta, valores, descontos ou dizer "a proposta que te mandei".',
    'Não se apresente de novo se já se apresentou. Não repita literalmente uma frase que já está no histórico.',
    'Se o que falta é o CPF para consultar, retome esse pedido de outra forma, explicando rapidamente o motivo do contato.',
    credor ? `Se precisar citar a origem do débito, use exatamente o credor "${credor}".` : '',
    '',
    'Responda SOMENTE com JSON válido: {"mensagem":"texto"}',
  ].filter(Boolean).join('\n');

  const user = [
    `HISTÓRICO RECENTE:\n${conversa}`,
    nome ? `Primeiro nome do cliente: ${nome}` : '',
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

    const hora = agoraSP().getHours();
    const hIni = Number(cfg.followup_hora_inicio ?? 8);
    const hFim = Number(cfg.followup_hora_fim ?? 19);
    if (hora < hIni || hora >= hFim) return json({ success: true, skipped: `fora da janela ${hIni}h-${hFim}h` });

    const iago = await perfilIago(supabase, cfg);
    if (!iago?.id) return json({ success: true, skipped: 'usuário do IAGO não encontrado' });

    const agora = new Date();
    const { data: pendentes } = await supabase
      .from('iago_conversa_estado')
      .select('*')
      .eq('followup_feito', false)
      .eq('optout', false)
      .eq('aguardando_humano', false)
      .not('followup_em', 'is', null)
      .lte('followup_em', agora.toISOString())
      .limit(40);

    let enviados = 0;
    const pulados: string[] = [];

    for (const est of (pendentes || []) as any[]) {
      const { data: contato } = await supabase
        .from('meta_whatsapp_contatos')
        .select('id, instancia_id, telefone, bsuid, nome, folder_id, ultima_msg_entrada_em')
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
      if (!ultimaEntrada || agora.getTime() - ultimaEntrada >= 24 * 60 * 60 * 1000) {
        await supabase.from('iago_conversa_estado')
          .update({ followup_feito: true, followup_em: null }).eq('id', est.id);
        pulados.push('janela 24h fechada');
        continue;
      }

      // A conversa continua sendo do IAGO e na caixa dele?
      const atende = await iagoAtendeCaixa(supabase, iago.id, (contato as any).folder_id ?? null);
      const tags = await etiquetasAtendente(supabase, (contato as any).id);
      const nomeIago = String(iago.nome || '').trim().toLowerCase();
      const ehDoIago = tags.some((t) => t.replace(/^atendente:\s*/i, '').trim().toLowerCase() === nomeIago);
      if (!atende || !ehDoIago) {
        await supabase.from('iago_conversa_estado')
          .update({ followup_feito: true, followup_em: null }).eq('id', est.id);
        pulados.push('conversa não é do IAGO');
        continue;
      }

      // ===== Histórico real da conversa =====
      const { data: msgs } = await supabase
        .from('meta_whatsapp_mensagens')
        .select('direcao, conteudo, criado_em')
        .eq('instancia_id', (contato as any).instancia_id)
        .eq('telefone', (contato as any).telefone || '')
        .order('criado_em', { ascending: false })
        .limit(12);
      const historico = ((msgs || []) as any[]).slice().reverse();
      const saidas = historico.filter((m) => m.direcao === 'saida');
      const saidasNorm = saidas.map((m) => normalizar(m.conteudo)).filter(Boolean);

      // Proposta só conta se valores realmente foram enviados ao cliente.
      const propostaEnviada = !!est.contexto?.proposta_enviada
        || saidas.some((m) => /r\$\s*\d/i.test(String(m.conteudo || '')));

      const nome = primeiroNome((contato as any).nome);
      let texto = '';

      if (propostaEnviada) {
        const base = String(cfg.followup_texto || 'Oi, tudo bem? Só passando pra saber se você viu a proposta que te mandei.');
        texto = nome ? `${nome}, ${base.charAt(0).toLowerCase()}${base.slice(1)}` : base;
      } else {
        // Credor configurado na caixa de mensagens (se houver)
        let credor = '';
        if ((contato as any).folder_id) {
          const { data: cr } = await supabase
            .from('meta_inbox_folder_credores')
            .select('nome')
            .eq('folder_id', (contato as any).folder_id)
            .eq('ativo', true)
            .limit(1)
            .maybeSingle();
          credor = String((cr as any)?.nome || '');
        }
        texto = await textoSemProposta({ cfg, historico, nome, credor });
      }

      if (!texto || pareceRepetido(texto, saidasNorm)) {
        await supabase.from('iago_conversa_estado')
          .update({ followup_feito: true, followup_em: null }).eq('id', est.id);
        pulados.push(texto ? 'texto repetiria algo já enviado' : 'sem texto coerente para retomar');
        continue;
      }

      try {
        const id = await enviarTexto(supabase, contato, texto);
        const ids = Array.isArray(est.contexto?.msgs_ia) ? est.contexto.msgs_ia : [];
        await supabase.from('iago_conversa_estado').update({
          followup_feito: true,
          followup_em: null,
          etapa: 'followup',
          ultima_msg_em: new Date().toISOString(),
          contexto: {
            ...(est.contexto || {}),
            msgs_ia: [...ids, ...(id ? [id] : [])].slice(-30),
            ultimo_envio_ia: new Date(Date.now() + 2000).toISOString(),
          },
        }).eq('id', est.id);
        enviados += 1;
      } catch (e: any) {
        console.error('[IAGO followup] falha no envio', e?.message || e);
        await supabase.from('iago_conversa_estado')
          .update({ followup_feito: true, followup_em: null }).eq('id', est.id);
      }
    }

    console.log('[IAGO followup]', { candidatos: (pendentes || []).length, enviados, pulados });
    return json({ success: true, candidatos: (pendentes || []).length, enviados, pulados });
  } catch (e: any) {
    console.error('[IAGO followup] erro', e?.message || e);
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
});
