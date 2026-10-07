import { validPortalCpf } from './portalNegotiation';

export function parseOdresCpfs(rows: unknown[][]) {
  const cpfs = new Set<string>();
  let invalidos = 0;
  let repetidos = 0;
  let linhas = 0;
  for (const row of rows) {
    const raw = String(row[0] ?? '').trim();
    if (!raw || /^(cpf(?:\s*\/\s*cnpj)?|documento)$/i.test(raw)) continue;
    linhas++;
    const digits = raw.replace(/\D/g, '');
    const cpf = digits.length > 0 && digits.length <= 11 ? digits.padStart(11, '0') : digits;
    if (/[a-z]/i.test(raw) || !validPortalCpf(cpf)) { invalidos++; continue; }
    if (cpfs.has(cpf)) repetidos++;
    else cpfs.add(cpf);
  }
  return { cpfs: [...cpfs], invalidos, repetidos, linhas };
}