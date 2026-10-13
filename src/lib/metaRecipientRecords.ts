import Papa from 'papaparse';
import { splitLinhaEnvio, parseNumeroBR } from './valorBR';

/** Imported records use quoted CSV; legacy manually typed lines keep their decimal rules. */
export function recipientRecordLines(input: string): string[] {
  if (!input.trim()) return [];
  if (!input.trimStart().startsWith('"')) return input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const parsed = Papa.parse<string[]>(input, { delimiter: ',', skipEmptyLines: 'greedy' });
  return parsed.data.map(serializeRecipientRecord);
}

export function serializeRecipientRecord(cells: string[]): string {
  return Papa.unparse([cells], { quotes: true, delimiter: ',', newline: '\n' });
}

export function recipientRecordCells(line: string): string[] {
  return line.trimStart().startsWith('"')
    ? Papa.parse<string[]>(line, { delimiter: ',', skipEmptyLines: 'greedy' }).data[0] ?? []
    : splitLinhaEnvio(line);
}

export function mappedRecipientFields(cells: string[], roles: string[]) {
  const value = (role: string) => cells[roles.indexOf(role)] ?? '';
  const vars: Record<string, string> = {};
  roles.forEach((role, index) => {
    if (role.startsWith('tplvar:')) vars[role.slice(7)] = cells[index] ?? '';
  });
  return {
    telefone: value('telefone'), nome: value('nome'), cpf: value('cpf'),
    atraso: value('atraso'), saldo: parseNumeroBR(value('saldo')) ?? 0, vars,
  };
}