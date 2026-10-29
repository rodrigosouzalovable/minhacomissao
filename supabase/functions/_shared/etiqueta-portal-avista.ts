// Acordos À VISTA fechados pelo cliente no portal recebem a etiqueta
// "Atendente: RODRIGO RIBEIRO DE SOUZA" no Inbox (no envio da confirmação e
// quando o cliente escreve). Usa a etiqueta existente; nunca cria etiquetas.

export const ETIQUETA_RODRIGO_ID = '03a9298c-f201-4b4a-ab05-f6e6cafa4116';
export const PORTAL_ADMIN_USER_ID = 'ee649720-b8ce-47a2-859e-100a3a9ae6bb';
export const PORTAL_OBS_PREFIXO = 'Acordo fechado pelo cliente no portal';

export function ehAcordoPortalAVista(a: { parcelas?: number | null; observacoes?: string | null; status?: string | null }): boolean {
  if (Number(a?.parcelas) !== 1) return false;
  if (!String(a?.observacoes || '').startsWith(PORTAL_OBS_PREFIXO)) return false;
  const st = String(a?.status || '').toLowerCase();
  return !['quebrado', 'cancelado'].includes(st);
}

/** Aplica a etiqueta do Rodrigo ao contato, trocando outra etiqueta de atendente. Idempotente. */
export async function aplicarEtiquetaRodrigo(db: any, contatoId: string): Promise<boolean> {
  const { data: links } = await db.from('meta_whatsapp_contato_etiquetas')
    .select('etiqueta_id, meta_whatsapp_etiquetas!inner(nome)').eq('contato_id', contatoId);
  const lista = (links ?? []) as any[];
  if (lista.some((l) => l.etiqueta_id === ETIQUETA_RODRIGO_ID)) return true;
  const outras = lista.filter((l) => String(l?.meta_whatsapp_etiquetas?.nome || '').toLowerCase().startsWith('atendente:')).map((l) => l.etiqueta_id);
  if (outras.length) await db.from('meta_whatsapp_contato_etiquetas').delete().eq('contato_id', contatoId).in('etiqueta_id', outras);
  const { error } = await db.from('meta_whatsapp_contato_etiquetas').insert({ contato_id: contatoId, etiqueta_id: ETIQUETA_RODRIGO_ID });
  if (error && !String(error.message).includes('duplicate')) { console.log('[etiqueta-portal-avista] erro', error.message); return false; }
  return true;
}

/** Mensagem recebida: se o telefone tem acordo à vista do portal, etiqueta o contato. */
export async function etiquetarSeAcordoPortalAVista(db: any, contatoId: string, telefone: string): Promise<boolean> {
  const suf = String(telefone || '').replace(/\D/g, '').slice(-8);
  if (suf.length < 8 || !contatoId) return false;
  const { data } = await db.from('acordos').select('parcelas, observacoes, status')
    .eq('user_id', PORTAL_ADMIN_USER_ID).eq('parcelas', 1)
    .like('observacoes', `${PORTAL_OBS_PREFIXO}%`).like('cliente_telefone', `%${suf}`)
    .order('criado_em', { ascending: false }).limit(1);
  const a = (data ?? [])[0];
  if (!a || !ehAcordoPortalAVista(a)) return false;
  return aplicarEtiquetaRodrigo(db, contatoId);
}
