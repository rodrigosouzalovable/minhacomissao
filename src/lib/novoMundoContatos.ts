import { conferirContatosNovoMundo as conferirDados } from '../../supabase/functions/_shared/novo-mundo-contatos-rules';
import { metaFirstRowIsHeader, metaHeaderVariable } from './metaImportHeader';
export { capacidadeNovoMundo, NOVO_MUNDO_MAX, NOVO_MUNDO_AVISO } from '../../supabase/functions/_shared/novo-mundo-contatos-rules';
export type { NovoMundoContato } from '../../supabase/functions/_shared/novo-mundo-contatos-rules';

export function conferirContatosNovoMundo(rows: unknown[][]) {
  const hasHeader = metaFirstRowIsHeader(rows);
  const headers = hasHeader ? (rows[0] ?? []).map(value => String(value ?? '').trim()) : null;
  if (headers && (!/^(telefone|celular|whatsapp)$/i.test(headers[0] ?? '') || metaHeaderVariable(headers[1]) !== '1' || metaHeaderVariable(headers[2]) !== '2' || headers.slice(3).some(Boolean))) {
    throw new Error('Revise o cabeçalho: A = Telefone, B = {{1}} e C = {{2}}. Não use variáveis repetidas ou em outra ordem.');
  }
  const normalized = hasHeader ? [['Telefone', '{{1}}', '{{2}}'], ...rows.slice(1)] : rows;
  return { ...conferirDados(normalized), headers };
}