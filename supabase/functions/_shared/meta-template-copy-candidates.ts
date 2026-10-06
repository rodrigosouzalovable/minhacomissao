export function modelosParaCopiar<T extends { id: string; nome: string; idioma: string }>(
  masters: T[], knownIds: Set<string>, knownKeys: Set<string>, queuedIds: Set<string>,
): T[] {
  return masters.filter(m => !knownIds.has(m.id) && !knownKeys.has(`${m.nome}|${m.idioma || 'pt_BR'}`) && !queuedIds.has(m.id));
}