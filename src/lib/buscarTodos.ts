// Lê todas as linhas de uma consulta em blocos de 1.000 (limite padrão da API).
// `montar` deve devolver a consulta já ordenada por uma coluna única.
export async function buscarTodos<T = any>(montar: () => any): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar().range(de, de + 999);
    if (error) throw error;
    linhas.push(...((data || []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return linhas;
}
