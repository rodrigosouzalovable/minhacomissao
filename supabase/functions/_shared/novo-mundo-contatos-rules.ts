import { telefoneMeta } from './meta-destinatario.ts';
export const NOVO_MUNDO_ORIGEM = 'recuperacao_novo_mundo';
export const NOVO_MUNDO_MAX = 5000;
export const NOVO_MUNDO_AVISO = 500;
export const NOVO_MUNDO_TETO = 20.30;
const ddds = new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
export type NovoMundoContato = { telefone: string; var1: string; var2: string };
export function telefoneNovoMundo(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!/^[+\d\s().-]+$/.test(raw)) return null;
  const phone = telefoneMeta(raw);
  if (!phone?.startsWith('55') || ![12, 13].includes(phone.length) || !ddds.has(phone.slice(2, 4))) return null;
  return /^[2-9]/.test(phone.slice(4)) ? phone : null;
}
export function conferirContatosNovoMundo(rows: unknown[][]) {
  const first = rows[0] ?? [];
  const header = /^(telefone|celular|whatsapp)$/i.test(String(first[0] ?? '').trim()) && String(first[1] ?? '').trim() === '{{1}}' && String(first[2] ?? '').trim() === '{{2}}';
  const data = (header ? rows.slice(1) : rows).filter(r => r.some(v => v !== null && v !== undefined && String(v).trim() !== ''));
  if (data.length > NOVO_MUNDO_MAX) throw new Error('Envie um arquivo com até 5.000 contatos, além do cabeçalho.');
  if (!data.length) throw new Error('A planilha não contém contatos.');
  let invalidos = 0, duplicados = 0;
  const coincidencias: { telefone: string; mantido: string; linha: number }[] = [];
  const contatos: NovoMundoContato[] = [];
  const seen = new Map<string, NovoMundoContato>();
  const conflitos = new Set<string>();
  for (const [index, row] of data.entries()) {
    const telefone = telefoneNovoMundo(row[0]);
    const var1 = String(row[1] ?? '');
    const var2 = String(row[2] ?? '');
    if (!telefone || !var1.trim() || !var2.trim() || var1.length > 200 || var2.length > 200 || /[\r\n\u0000]/.test(var1 + var2)) { invalidos++; continue; }
    const suffix = telefone.slice(-8);
    const previous = seen.get(suffix);
    if (previous) {
      duplicados++;
      if (previous.telefone !== telefone) {
        coincidencias.push({ telefone, mantido: previous.telefone, linha: index + (header ? 2 : 1) });
      } else if (previous.var1 !== var1 || previous.var2 !== var2) conflitos.add(suffix);
      continue;
    }
    const contato = { telefone, var1, var2 };
    seen.set(suffix, contato); contatos.push(contato);
  }
  return { contatos, total: data.length, invalidos, duplicados, coincidencias, conflitos: [...conflitos] };
}
export function capacidadeNovoMundo(pendentes: number, novos: number) {
  return novos >= 0 && pendentes >= 0 && pendentes + novos <= NOVO_MUNDO_MAX;
}