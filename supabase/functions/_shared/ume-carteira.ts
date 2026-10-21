// ID oficial do cliente UME (borrowerId) gravado pelos arquivos diários do SFTP.
// Retorna null quando o CPF ainda não veio em nenhum arquivo — quem chama usa a consulta online.
// deno-lint-ignore no-explicit-any
export async function borrowerIdSftp(db: any, cpf: string): Promise<string | null> {
  const c = String(cpf ?? '').replace(/\D/g, '').padStart(11, '0');
  if (c.length !== 11) return null;
  const { data } = await db.from('ume_carteira_clientes').select('borrower_id').eq('cpf', c).maybeSingle();
  return data?.borrower_id ? String(data.borrower_id) : null;
}
