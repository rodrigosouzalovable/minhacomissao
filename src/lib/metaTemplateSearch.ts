export function matchesTemplateSearch(option: { nome: string; descricao?: string | null }, search: string, content = false): boolean {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const term = normalize(search.trim());
  return !term || normalize(option.nome).includes(term) || (content && normalize(option.descricao || '').includes(term));
}