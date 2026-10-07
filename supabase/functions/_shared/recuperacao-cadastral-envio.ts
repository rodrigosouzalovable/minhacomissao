import { destinosAquecimento, enviarTemplateAquecimento, erroFatalMeta, FOLDERS_AQUECIMENTO_FALLBACK } from './meta-aquecimento-alvo.ts';
import { ORIGEM_CADASTRAL, TEMPLATE_CADASTRAL, templateCadastralValido, valoresCadastrais } from './recuperacao-cadastral-rules.ts';

export async function executarRecuperacaoCadastral(db: any, insts: any[], simulacao: boolean) {
  const { data: destinos, error } = await db.from('meta_recuperacao_cadastral_destinos')
    .select('*').eq('user_id', insts[0]?.user_id || '').not('autorizado_em', 'is', null)
    .is('bloqueado_em', null).order('criado_em').limit(1500);
  if (error) throw error;
  const uazapi = await destinosAquecimento(db);
  const online = new Set(uazapi.map(d => d.id));
  const { data: supressoes, error: supErro } = await db.from('meta_destinatario_supressao')
    .select('telefone_sufixo').in('telefone_sufixo', (destinos || []).map((d: any) => d.telefone_sufixo));
  if (supErro) throw supErro;
  const bloqueados = new Set((supressoes || []).map((s: any) => s.telefone_sufixo));
  const disponiveis = (destinos || []).filter((d: any) => !bloqueados.has(d.telefone_sufixo) &&
    (d.fonte === 'uazapi' ? online.has(d.destino_instancia_id) : !d.consumido_em));
  const resultados: any[] = [];
  const usados = new Set<string>();
  for (const inst of insts.slice(0, 8)) {
    const { data: copias, error: copiaError } = await db.from('meta_templates_instancia')
      .select('status, meta_templates_mestre!inner(nome, idioma, corpo, categoria, criado_por, reclassificado_marketing)')
      .eq('instancia_id', inst.id).eq('status', 'APPROVED')
      .eq('meta_templates_mestre.nome', TEMPLATE_CADASTRAL).eq('meta_templates_mestre.criado_por', inst.user_id)
      .eq('meta_templates_mestre.categoria', 'UTILITY').eq('meta_templates_mestre.reclassificado_marketing', false).limit(1);
    if (copiaError) throw copiaError;
    const mestre = copias?.[0]?.meta_templates_mestre;
    const tpl = mestre ? { name: mestre.nome, language: mestre.idioma || 'pt_BR', categoria: mestre.categoria, body: mestre.corpo,
      params: { tipo: 'posicional' as const, chaves: [...new Set<string>((String(mestre.corpo).match(/\{\{\s*\d+\s*\}\}/g) || []).map((t: string) => t.replace(/[{}\s]/g, '')))] } } : null;
    if (!templateCadastralValido(tpl) || !tpl) { resultados.push({ instancia: inst.nome, skip: 'aguarda_template_cadastral_aprovado' }); continue; }
    const { data: ultimo } = await db.from('meta_recuperacao_log').select('fonte, telefone_sufixo')
      .eq('instancia_id', inst.id).eq('cadastral', true).eq('status', 'enviado').order('enviado_em', { ascending: false }).limit(1).maybeSingle();
    const fontes = ultimo?.fonte === 'uazapi' ? ['confirmado', 'candidato', 'uazapi'] : ultimo?.fonte === 'confirmado' ? ['candidato', 'uazapi', 'confirmado'] : ['uazapi', 'confirmado', 'candidato'];
    let reservado: any = null;
    let logId: string | null = null;
    for (const fonte of fontes) {
      for (const d of disponiveis.filter((d: any) => d.fonte === fonte).slice(0, 30)) {
        if (usados.has(d.telefone_sufixo) || ultimo?.telefone_sufixo === d.telefone_sufixo) continue;
        try { valoresCadastrais(d.nome_empresa); } catch { continue; }
        if (simulacao) { reservado = d; break; }
        const { data: id, error: reservaError } = await db.rpc('reservar_recuperacao_cadastral', { p_instancia: inst.id, p_sufixo: d.telefone_sufixo });
        if (reservaError) throw reservaError;
        if (id) { reservado = d; logId = id; break; }
      }
      if (reservado) break;
    }
    if (!reservado) { resultados.push({ instancia: inst.nome, skip: 'sem_destino_autorizado_ou_aguardando_limites' }); continue; }
    usados.add(reservado.telefone_sufixo);
    const valores = valoresCadastrais(reservado.nome_empresa);
    const preview = String(tpl.body).replace(/\{\{\s*1\s*\}\}/g, valores[0]).replace(/\{\{\s*2\s*\}\}/g, valores[1]);
    if (simulacao) { resultados.push({ instancia: inst.nome, fonte: reservado.fonte, nome_empresa: reservado.nome_empresa, variaveis: valores, preview, simulado: true }); continue; }
    if (!logId) continue;
    const { data: contatoId, error: contatoError } = await db.rpc('preparar_conversa_cadastral', { p_log: logId });
    if (contatoError || !contatoId) {
      await db.from('meta_recuperacao_log').update({ status: 'falha', erro: 'Conversa em outra caixa, supressão ou preparação indisponível' }).eq('id', logId);
      continue;
    }
    // Last opt-out check immediately before external send. No retry after ambiguous transport.
    const { data: bloqueio, error: checagemErro } = await db.from('meta_destinatario_supressao').select('telefone_sufixo').eq('telefone_sufixo', reservado.telefone_sufixo).maybeSingle();
    if (bloqueio || checagemErro) { await db.from('meta_recuperacao_log').update({ status: 'falha', erro: 'Opt-out ou checagem inconclusiva' }).eq('id', logId); continue; }
    let envio: { ok: boolean; wamid?: string; erro?: string; codigo?: number };
    try { envio = await enviarTemplateAquecimento(inst, reservado.telefone, tpl, reservado.nome_empresa, valores); }
    catch (e) { envio = { ok: false, erro: `Transporte inconclusivo, sem reenvio: ${String(e).slice(0, 200)}` }; }
    const agora = new Date().toISOString();
    await db.from('meta_recuperacao_log').update({ status: envio.ok ? 'enviado' : 'falha', erro: envio.erro || null, wamid: envio.wamid || null, contato_id: contatoId, enviado_em: agora }).eq('id', logId);
    if (envio.ok) {
      await db.from('meta_whatsapp_mensagens').insert({ user_id: inst.user_id, instancia_id: inst.id, telefone: reservado.telefone,
        direcao: 'saida', conteudo: preview, tipo_conteudo: 'texto', timestamp_msg: agora, status_envio: 'enviada', wa_message_id: envio.wamid,
        template_nome: TEMPLATE_CADASTRAL, origem_envio: ORIGEM_CADASTRAL });
      await db.from('meta_whatsapp_contatos').update({ ultima_mensagem: preview, ultima_mensagem_em: agora, atualizado_em: agora,
        origem_aquecimento: ORIGEM_CADASTRAL, folder_id: FOLDERS_AQUECIMENTO_FALLBACK[0] }).eq('id', contatoId);
    }
    if (!envio.ok && erroFatalMeta(envio.codigo, envio.erro)) await db.from('meta_whatsapp_instances').update({ recuperacao_ativa: false }).eq('id', inst.id);
    resultados.push({ instancia: inst.nome, fonte: reservado.fonte, nome_empresa: reservado.nome_empresa, variaveis: valores, ok: envio.ok, erro: envio.erro || null });
  }
  let reposicao: any = null;
  if (!simulacao && insts.length && !disponiveis.some((d: any) => d.fonte !== 'uazapi')) {
    const token = crypto.randomUUID();
    const { data: claim, error: reposicaoErro } = await db.rpc('claim_reposicao_cadastral', { p_owner: insts[0].user_id, p_token: token });
    if (reposicaoErro) throw reposicaoErro;
    if (claim) {
      const result = await db.functions.invoke('google-maps-leads-abastecer', { body: { tipo: 'cadastral', owner_id: insts[0].user_id, reposicao_token: token } });
      reposicao = result.error ? { erro: 'Reposição indisponível', alvo: 100 } : result.data;
      await db.from('meta_recuperacao_cadastral_config').update({ reposicao_resultado: reposicao }).eq('user_id', insts[0].user_id).eq('reposicao_token', token);
    }
  }
  return { ok: true, cadastral: true, simulacao, resultados, reposicao, estoque_elegivel: disponiveis.filter((d: any) => d.fonte !== 'uazapi').length };
}