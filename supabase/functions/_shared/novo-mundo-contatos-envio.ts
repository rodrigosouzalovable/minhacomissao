import { escolherTemplateAprovado, enviarTemplateAquecimento, erroFatalMeta } from './meta-aquecimento-alvo.ts';
import { templateCadastralValido, TEMPLATE_CADASTRAL } from './recuperacao-cadastral-rules.ts';
import { NOVO_MUNDO_ORIGEM, telefoneNovoMundo } from './novo-mundo-contatos-rules.ts';
import { classifyMessagingHealth } from './meta-messaging-health.ts';

async function confirmarSaude(inst: any) {
  if (!telefoneNovoMundo(inst.display_phone) || !inst.phone_number_id || !inst.waba_id || !inst.access_token) return false;
  const read = async (id: string, fields: string) => {
    const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(id)}?fields=${fields}`, { headers: { Authorization: `Bearer ${inst.access_token}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return r.json();
  };
  try {
    const phone = await read(inst.phone_number_id, 'quality_rating,status,health_status');
    if (!phone || !['RED', 'YELLOW'].includes(phone.quality_rating) || phone.status !== 'CONNECTED') return false;
    const waba = await read(inst.waba_id, 'health_status');
    return classifyMessagingHealth(phone.health_status, waba?.health_status).confirmed;
  } catch { return false; }
}

/** Reuses the recovery scheduler. No fanout, retries, fallback source or extra schedule. */
export async function executarBaseNovoMundo(db: any, insts: any[], simulacao: boolean) {
  const resultados: any[] = [];
  const owner = insts[0]?.user_id;
  if (!owner) return { ok: true, fonte: 'novo_mundo', resultados };
  const lease = crypto.randomUUID();
  if (!simulacao) {
    const { data, error } = await db.rpc('claim_base_novo_mundo', { p_owner: owner, p_token: lease });
    if (error) throw error;
    if (!data) return { ok: true, fonte: 'novo_mundo', resultados, skipped: 'ciclo_em_execucao_ou_base_pausada' };
  }
  const deadline = Date.now() + 40_000;
  try {
    const { data: stock, error: stockError } = await db.from('meta_novo_mundo_contatos').select('id').eq('user_id', owner).eq('estado', 'pendente').limit(1);
    if (stockError) throw stockError;
    if (!stock?.length) return { ok: true, fonte: 'novo_mundo', resultados, skipped: 'estoque_esgotado' };
    // Filter before bounding work: old pending copies must not starve approved senders.
    const { data: copies, error: copiesError } = await db.from('meta_templates_instancia')
      .select('instancia_id,meta_templates_mestre!inner(nome,categoria,criado_por,reclassificado_marketing)')
      .eq('status', 'APPROVED').eq('meta_templates_mestre.nome', TEMPLATE_CADASTRAL)
      .eq('meta_templates_mestre.categoria', 'UTILITY').eq('meta_templates_mestre.criado_por', owner);
    if (copiesError) throw copiesError;
    const approved = new Set((copies || []).filter((copy: any) => !copy.meta_templates_mestre?.reclassificado_marketing).map((copy: any) => copy.instancia_id));
    // Quarantined senders are skipped up front so they never block the rest of the queue.
    const eligible = insts.filter(inst => approved.has(inst.id) && telefoneNovoMundo(inst.display_phone) &&
      !(inst.quarentena_ate && Date.parse(inst.quarentena_ate) > Date.now()) &&
      (!inst.recuperacao_proximo_envio_em || Date.parse(inst.recuperacao_proximo_envio_em) <= Date.now()));
    const defer = async (inst: any, reason: string) => {
      resultados.push({ instancia: inst.nome, skip: reason });
      const next = new Date(Date.now() + (1200 + Math.floor(Math.random() * 1201)) * 1000).toISOString();
      const { error } = await db.from('meta_whatsapp_instances').update({ recuperacao_proximo_envio_em: next }).eq('id', inst.id);
      if (error) throw error;
    };
    for (const inst of eligible.slice(0, 8)) {
      if (Date.now() >= deadline) break;
      if (!telefoneNovoMundo(inst.display_phone) || (inst.recuperacao_proximo_envio_em && Date.parse(inst.recuperacao_proximo_envio_em) > Date.now())) continue;
      if (simulacao) { resultados.push({ instancia: inst.nome, simulado: true, fonte: 'novo_mundo' }); continue; }
      if (!await confirmarSaude(inst)) { await defer(inst, 'saude_meta_inconclusiva_ou_inapta'); continue; }
      let tpl;
      try { tpl = await escolherTemplateAprovado(inst, TEMPLATE_CADASTRAL); }
      catch { await defer(inst, 'consulta_template_inconclusiva'); continue; }
      if (!tpl || !templateCadastralValido(tpl)) { await defer(inst, 'aguarda_template_utility_aprovado'); continue; }
      const { data: logId, error: reservationError } = await db.rpc('reservar_novo_mundo', { p_instancia: inst.id });
      if (reservationError) { await defer(inst, reservationError.message); continue; }
      if (!logId) { resultados.push({ instancia: inst.nome, skip: 'estoque_ou_limites_indisponiveis' }); continue; }
      const { data: log, error: logError } = await db.from('meta_recuperacao_log').select('id,destino_telefone,telefone_sufixo,variaveis,nome_empresa').eq('id', logId).single();
      if (logError || !log) throw logError || new Error('Reserva indisponível');
      const { data: contatoId, error: prepareError } = await db.rpc('preparar_conversa_novo_mundo', { p_log: logId });
      if (prepareError || !contatoId) {
        await db.from('meta_recuperacao_log').update({ status: 'falha', erro: prepareError?.message || 'Conversa em outra caixa ou contato bloqueado' }).eq('id', logId);
        continue;
      }
      const { data: suppression, error: suppressionError } = await db.from('meta_destinatario_supressao').select('telefone_sufixo').eq('telefone_sufixo', log.telefone_sufixo).maybeSingle();
      const { data: config, error: configError } = await db.from('meta_novo_mundo_config').select('ativo').eq('user_id', owner).single();
      if (suppression || suppressionError || configError || !config?.ativo) {
        await db.from('meta_recuperacao_log').update({ status: 'falha', erro: 'Base pausada, opt-out ou checagem inconclusiva; sem reenvio' }).eq('id', logId);
        continue;
      }
      const vars: string[] = log.variaveis;
      if (!Array.isArray(vars) || vars.length !== 2 || vars.some(v => typeof v !== 'string' || !v.trim())) throw new Error('Variáveis da reserva inválidas');
      const preview = String(tpl.body).replace(/\{\{\s*1\s*\}\}/g, () => vars[0]).replace(/\{\{\s*2\s*\}\}/g, () => vars[1]);
      let envio;
      try { envio = await enviarTemplateAquecimento(inst, log.destino_telefone, tpl, log.nome_empresa, vars); }
      catch (error) { envio = { ok: false, erro: `Transporte inconclusivo; sem reenvio: ${String(error).slice(0, 180)}` }; }
      const now = new Date().toISOString();
      const { error: saveError } = await db.from('meta_recuperacao_log').update({ status: envio.ok ? 'enviado' : 'falha', erro: envio.erro || null, wamid: envio.wamid || null, contato_id: contatoId, enviado_em: now }).eq('id', logId);
      if (saveError) throw saveError;
      if (envio.ok) {
        const { error: messageError } = await db.from('meta_whatsapp_mensagens').insert({ user_id: owner, instancia_id: inst.id, telefone: log.destino_telefone, direcao: 'saida', conteudo: preview, tipo_conteudo: 'texto', timestamp_msg: now, status_envio: 'enviada', wa_message_id: envio.wamid, template_nome: TEMPLATE_CADASTRAL, origem_envio: NOVO_MUNDO_ORIGEM });
        if (messageError) throw messageError;
        const { error: contactError } = await db.from('meta_whatsapp_contatos').update({ ultima_mensagem: preview, ultima_mensagem_em: now, atualizado_em: now, folder_id: null, origem_aquecimento: NOVO_MUNDO_ORIGEM }).eq('id', contatoId);
        if (contactError) throw contactError;
      }
      if (!envio.ok && erroFatalMeta(envio.codigo, envio.erro)) await db.from('meta_whatsapp_instances').update({ recuperacao_ativa: false }).eq('id', inst.id);
      resultados.push({ instancia: inst.nome, fonte: 'novo_mundo', ok: envio.ok, erro: envio.erro || null });
    }
    return { ok: true, fonte: 'novo_mundo', resultados };
  } finally {
    if (!simulacao) {
      const { error } = await db.rpc('release_base_novo_mundo', { p_owner: owner, p_token: lease });
      if (error) console.error('Não foi possível encerrar a trava da base Novo Mundo', error.message);
    }
  }
}