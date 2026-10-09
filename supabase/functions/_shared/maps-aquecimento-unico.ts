export async function reservarMapsAquecimentoUnico(
  db: any,
  instanciaId: string,
  telefone: string,
): Promise<boolean> {
  const sufixo = telefone.replace(/\D/g, '').slice(-8);
  if (!/^\d{8}$/.test(sufixo)) return false;
  const { data, error } = await db.rpc('reservar_maps_aquecimento_unico', {
    p_instancia: instanciaId,
    p_sufixo: sufixo,
  });
  // Fail closed: no retry or external send after an inconclusive reservation.
  return !error && data === true;
}

export async function filtrarMapsIneditos<T extends { telefone: string }>(
  db: any,
  candidatos: T[],
): Promise<T[]> {
  const usados = new Set<string>();
  const sufixos = [...new Set(candidatos.map(c => c.telefone.replace(/\D/g, '').slice(-8)))];
  for (let offset = 0; offset < sufixos.length; offset += 200) {
    const { data, error } = await db.from('meta_maps_aquecimento_consumidos')
      .select('telefone_sufixo').in('telefone_sufixo', sufixos.slice(offset, offset + 200));
    if (error) return [];
    for (const row of data || []) usados.add(row.telefone_sufixo);
  }
  return candidatos.filter(c => !usados.has(c.telefone.replace(/\D/g, '').slice(-8)));
}