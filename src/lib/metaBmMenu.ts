export function filterBmsByName<T extends { nome: string }>(bms: T[], search: string): T[] {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
  const query = normalize(search);
  return query ? bms.filter((bm) => normalize(bm.nome).includes(query)) : bms;
}

export function toggleVisibleBms(selected: string[], visible: string[]): string[] {
  if (visible.length === 0) return selected;
  return visible.every((id) => selected.includes(id))
    ? selected.filter((id) => !visible.includes(id))
    : Array.from(new Set([...selected, ...visible]));
}