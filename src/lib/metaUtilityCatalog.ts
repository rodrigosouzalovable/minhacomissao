export type UtilityMaster = {
  id: string; nome: string; idioma: string; categoria: string; criado_por: string | null;
  reclassificado_marketing: boolean; corpo: string; cabecalho_tipo: string | null;
  cabecalho_texto: string | null; rodape: string | null; botoes: unknown; cabecalho_media_url?: string | null;
};
export type TemplateCopy = {
  id: string; nome_template: string; idioma: string; categoria: string | null;
  instancia_id: string; status: string; body_text: string | null; variaveis: Record<string, any> | null;
};
export type UtilityGroup = {
  key: string; nome: string; idioma: string; categoria: string | null; sample: TemplateCopy;
  rows: TemplateCopy[]; mestreId?: string; instanciasAprovadasIds: Set<string>; todasInstanciasAprovadasIds: Set<string>; varsCount: number; marketingIds?: Set<string>;
};

export function catalogoUtility(copies: TemplateCopy[], masters: UtilityMaster[], userId: string,
  accessibleIds: string[], selectedIds: string[], countVars: (t: TemplateCopy) => number): UtilityGroup[] {
  const groups = new Map<string, UtilityGroup>();
  for (const t of copies) {
    if (!accessibleIds.includes(t.instancia_id) || t.categoria?.toUpperCase() !== 'UTILITY') continue;
    const key = `${t.nome_template}::${t.idioma}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, nome: t.nome_template, idioma: t.idioma, categoria: t.categoria,
        sample: t, rows: [], instanciasAprovadasIds: new Set(), todasInstanciasAprovadasIds: new Set(), varsCount: countVars(t) };
      groups.set(key, g);
    }
    g.rows.push(t);
    if (t.status.toLowerCase() === 'approved') {
      g.todasInstanciasAprovadasIds.add(t.instancia_id);
      if (selectedIds.includes(t.instancia_id)) g.instanciasAprovadasIds.add(t.instancia_id);
      if (g.sample.status.toLowerCase() !== 'approved') { g.sample = t; g.varsCount = countVars(t); }
    }
  }
  const marketing = new Map<string, Set<string>>();
  for (const t of copies) {
    if (t.categoria?.toUpperCase() !== 'MARKETING' || t.status.toLowerCase() !== 'approved') continue;
    const k = `${t.nome_template}::${t.idioma}`;
    if (!marketing.has(k)) marketing.set(k, new Set());
    marketing.get(k)!.add(t.instancia_id);
  }
  for (const m of masters) {
    // A Marketing copy must not hide the owner's Utility master or prevent distribution.
    // Sending approvals remain derived exclusively from actual Utility copies above.
    if (m.criado_por !== userId || m.categoria.toUpperCase() !== 'UTILITY') continue;
    const key = `${m.nome}::${m.idioma}`;
    const g = groups.get(key);
    if (g) { g.mestreId = m.id; continue; }
    const components: any[] = [{ type: 'BODY', text: m.corpo }];
    if (m.cabecalho_tipo) components.unshift({ type: 'HEADER', format: m.cabecalho_tipo, text: m.cabecalho_texto });
    if (m.rodape) components.push({ type: 'FOOTER', text: m.rodape });
    if (Array.isArray(m.botoes)) components.push({ type: 'BUTTONS', buttons: m.botoes });
    // Preview-only: no invented sending identifier for a master without a Meta copy.
    const sample: TemplateCopy = { id: '', instancia_id: '', nome_template: m.nome, idioma: m.idioma,
      categoria: m.categoria, status: 'draft', body_text: m.corpo, variaveis: { _components: components } };
    groups.set(key, { key, nome: m.nome, idioma: m.idioma, categoria: m.categoria, sample,
      mestreId: m.id, rows: [], instanciasAprovadasIds: new Set(), todasInstanciasAprovadasIds: new Set(), varsCount: countVars(sample) });
  }
  for (const g of groups.values()) g.marketingIds = marketing.get(g.key) ?? new Set();
  return [...groups.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

export function situacaoUtility(group: UtilityGroup, instanceId: string, queueStatus?: string): string {
  const rows = group.rows.filter(t => t.instancia_id === instanceId);
  if (rows.some(t => t.status.toLowerCase() === 'approved' && t.categoria?.toUpperCase() === 'UTILITY')) return 'Aprovado';
  if (rows.some(t => ['pending', 'in_appeal', 'pending_deletion'].includes(t.status.toLowerCase()))) return 'Em análise na Meta';
  if (group.marketingIds?.has(instanceId))
    return 'Aprovado pela Meta como Marketing — não pode ser usado como Utilidade';
  if (queueStatus === 'PENDENTE') return 'Na fila';
  if (queueStatus === 'ENVIADO') return 'Em análise na Meta';
  if (queueStatus === 'APPROVED') return 'Aprovado — atualize a sincronização';
  if (queueStatus === 'FALHA_ENVIO') return 'Falha na aplicação — confira o motivo abaixo';
  if (queueStatus === 'CANCELADO') return 'Aplicação encerrada — requer revisão';
  if (rows.some(t => t.status.toLowerCase() === 'rejected') || queueStatus === 'REJECTED') return 'Rejeitado';
  return 'Ausente';
}