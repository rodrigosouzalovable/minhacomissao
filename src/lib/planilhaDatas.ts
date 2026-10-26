import * as XLSX from "xlsx";

/** Converte serial de data do Excel em dd/mm/aaaa. */
export function serialExcelParaData(serial: number): string {
  const d = XLSX.SSF.parse_date_code(serial);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.d)}/${p(d.m)}/${d.y}`;
}

/** Substitui células formatadas como data por texto dd/mm/aaaa. */
export function normalizarDatasPlanilha(ws: XLSX.WorkSheet): void {
  for (const k of Object.keys(ws)) {
    if (k.startsWith("!")) continue;
    const c = ws[k] as XLSX.CellObject;
    if (c?.t === "n" && typeof c.v === "number" && c.z && XLSX.SSF.is_date(String(c.z))) {
      const s = serialExcelParaData(c.v);
      ws[k] = { t: "s", v: s, w: s };
    }
  }
}
