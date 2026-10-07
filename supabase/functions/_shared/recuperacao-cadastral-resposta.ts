import { enviarTexto } from './iago.ts';
import { AGRADECIMENTO_CADASTRAL, ORIGEM_CADASTRAL, respostaCadastral } from './recuperacao-cadastral-rules.ts';

// Persistent flow marker wins over generic IAGO, including after acknowledgement.
export async function atenderRespostaCadastral(db: any, contato: any, texto: string, tipo = 'text'): Promise<boolean> {
  if (contato?.origem_aquecimento !== ORIGEM_CADASTRAL) return false;
  const suf = String(contato.telefone || '').replace(/\D/g, '').slice(-8);
  const { data: log, error } = await db.from('meta_recuperacao_log')
    .select('id, status, agradecimento_claim_em, resposta_tipo')
    .eq('instancia_id', contato.instancia_id).eq('telefone_sufixo', suf).eq('cadastral', true)
    .order('enviado_em', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error; // Never fall through to AI on a failed lookup.
  if (!log) return true;
  const resposta = ['text', 'texto', 'button', 'interactive'].includes(tipo) ? respostaCadastral(texto) : 'outra';
  if (resposta === 'saida') {
    const { error: saidaErro } = await db.rpc('blacklist_saida_cadastral', {
      p_instancia: contato.instancia_id, p_telefone: contato.telefone, p_texto: texto,
    });
    if (saidaErro) throw saidaErro;
    return true;
  }
  await db.from('iago_conversa_estado').update({ followup_em: null, followup_feito: true }).eq('contato_id', contato.id);
  if (resposta === 'negativa') {
    await db.from('meta_recuperacao_log').update({ resposta_tipo: 'negativa', resposta_em: new Date().toISOString() }).eq('id', log.id).neq('resposta_tipo', 'saida');
    await db.from('meta_recuperacao_cadastral_destinos').update({ bloqueado_em: new Date().toISOString() }).eq('telefone_sufixo', suf);
    return true;
  }
  if (resposta !== 'confirmacao' || log.status !== 'enviado' || log.agradecimento_claim_em) return true;
  const { data: claimed, error: claimError } = await db.rpc('claim_agradecimento_cadastral', { p_log: log.id });
  if (claimError) throw claimError;
  if (!claimed) return true;
  // At-most-once: an ambiguous transport error does not release the claim for another send.
  try {
    const result = await enviarTexto(db, contato, AGRADECIMENTO_CADASTRAL);
    await db.from('meta_recuperacao_log').update({ agradecimento_wamid: result.mensagemId, agradecimento_erro: result.erro || null }).eq('id', log.id);
  } catch (e) {
    await db.from('meta_recuperacao_log').update({ agradecimento_erro: String(e).slice(0, 400) }).eq('id', log.id);
  }
  return true;
}