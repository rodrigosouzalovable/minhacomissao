import { test, expect } from "vitest";
import * as XLSX from "xlsx";
import { normalizarDatasPlanilha } from "../src/lib/planilhaDatas";
import { readFileSync } from "fs";
test("data do Excel vira dd/mm/aaaa", () => {
  const wb = XLSX.read(readFileSync("/mnt/user-uploads/CERTIFICADO_1.xlsx"), { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]]; normalizarDatasPlanilha(ws);
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
  expect(rows[1][3]).toBe("21/10/2026");
  expect(rows[2][3]).toBe("19/10/2026");
});
