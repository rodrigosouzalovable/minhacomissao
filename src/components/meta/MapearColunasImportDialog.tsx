import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export type ColRole = "ignore" | "telefone" | "nome" | "cpf" | "atraso" | "saldo";

const ROLE_LABELS: Record<ColRole, string> = {
  ignore: "Ignorar",
  telefone: "Telefone",
  nome: "Nome",
  cpf: "CPF / CNPJ",
  atraso: "Atraso (dias)",
  saldo: "Saldo (R$)",
};

const HEADER_HINTS: Array<{ role: ColRole; rx: RegExp }> = [
  { role: "telefone", rx: /(telefone|celular|whats|fone|phone|numero|número|tel)/i },
  { role: "cpf", rx: /(cpf|cnpj|documento|doc)/i },
  { role: "nome", rx: /(nome|cliente|razao|razão|contato)/i },
  { role: "atraso", rx: /(atraso|dias|days)/i },
  { role: "saldo", rx: /(saldo|valor|d[ií]vida|debito|débito|montante|total)/i },
];

function detectRoleFromHeader(header: string): ColRole {
  const h = String(header || "").trim();
  if (!h) return "ignore";
  for (const { role, rx } of HEADER_HINTS) {
    if (rx.test(h)) return role;
  }
  return "ignore";
}

function detectRoleFromSample(samples: string[]): ColRole {
  const nonEmpty = samples.map((s) => String(s || "").trim()).filter(Boolean);
  if (nonEmpty.length === 0) return "ignore";
  const digitLike = nonEmpty.filter((v) => /^\+?\d[\d\s().-]{6,}$/.test(v));
  const digitRatio = digitLike.length / nonEmpty.length;
  if (digitRatio > 0.6) {
    const digitLengths = digitLike.map((v) => v.replace(/\D/g, "").length);
    const docRatio = digitLengths.filter((len) => len === 14 || len === 11).length / digitLengths.length;
    const phoneRatio = digitLengths.filter((len) => len >= 10 && len <= 13).length / digitLengths.length;
    // CNPJ (14 dígitos) precisa ganhar de telefone; antes ele podia cair como Nome/Telefone.
    if (digitLengths.filter((len) => len === 14).length / digitLengths.length > 0.6) return "cpf";
    if (phoneRatio > 0.6) return "telefone";
    if (docRatio > 0.6) return "cpf";
  }
  return "ignore";
}

function columnLooksLikeDocument(rows: any[][], col: number, skipHeader: boolean): boolean {
  const samples = rows
    .slice(skipHeader ? 1 : 0, skipHeader ? 11 : 10)
    .map((r) => String((r || [])[col] ?? "").replace(/\D/g, ""))
    .filter(Boolean);
  if (samples.length === 0) return false;
  return samples.filter((d) => d.length === 11 || d.length === 14).length / samples.length > 0.6;
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: any[][]; // primeira linha pode ser cabeçalho
  onConfirm: (csvLines: string[], stats: { total: number; ignorados: number; duplicados: number }) => void;
};

export default function MapearColunasImportDialog({ open, onOpenChange, rows, onConfirm }: Props) {
  const nCols = useMemo(() => rows.reduce((m, r) => Math.max(m, (r || []).length), 0), [rows]);

  const firstRow = rows[0] || [];
  const firstIsHeader = useMemo(() => {
    const digitos = String(firstRow[0] ?? "").replace(/\D/g, "");
    return digitos.length < 8;
  }, [firstRow]);

  const [mapping, setMapping] = useState<ColRole[]>([]);

  useEffect(() => {
    if (!open) return;
    const initial: ColRole[] = [];
    const used = new Set<ColRole>();
    for (let c = 0; c < nCols; c++) {
      let role: ColRole = "ignore";
      if (firstIsHeader) role = detectRoleFromHeader(String(firstRow[c] ?? ""));
      if (role === "ignore") {
        const samples = rows.slice(firstIsHeader ? 1 : 0, firstIsHeader ? 6 : 5).map((r) => String((r || [])[c] ?? ""));
        role = detectRoleFromSample(samples);
      }
      if (role !== "ignore" && role !== "nome" && used.has(role)) role = "ignore";
      if (role !== "ignore") used.add(role);
      initial.push(role);
    }
    if (!initial.includes("telefone")) {
      const idx = initial.findIndex((r) => r === "ignore");
      if (idx >= 0) initial[idx] = "telefone";
      else if (initial.length > 0) initial[0] = "telefone";
    }
    if (!initial.includes("cpf")) {
      const idx = initial.findIndex((role, c) => role !== "telefone" && columnLooksLikeDocument(rows, c, firstIsHeader));
      if (idx >= 0) initial[idx] = "cpf";
    }
    setMapping(initial);
  }, [open, nCols, firstIsHeader]);

  const setCol = (idx: number, role: ColRole) => {
    setMapping((prev) => {
      const next = [...prev];
      if (role !== "ignore" && role !== "nome") {
        for (let i = 0; i < next.length; i++) if (i !== idx && next[i] === role) next[i] = "ignore";
      }
      next[idx] = role;
      return next;
    });
  };

  const preview = firstIsHeader ? rows.slice(1, 6) : rows.slice(0, 5);

  const colLetter = (i: number) => {
    let s = "";
    let n = i;
    do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return s;
  };

  const confirmar = () => {
    const idxTel = mapping.findIndex((r) => r === "telefone");
    if (idxTel < 0) { toast.error("Selecione qual coluna é o Telefone"); return; }
    const idxNome = mapping.findIndex((r) => r === "nome");
    const idxCpf = mapping.findIndex((r) => r === "cpf");
    const idxAtraso = mapping.findIndex((r) => r === "atraso");
    const idxSaldo = mapping.findIndex((r) => r === "saldo");

    if (idxCpf < 0 && idxNome >= 0 && columnLooksLikeDocument(rows, idxNome, firstIsHeader)) {
      toast.error(`A coluna ${colLetter(idxNome)} parece ser CPF/CNPJ. Marque como "CPF / CNPJ" para preencher a variável {cpf}.`);
      return;
    }

    const dataRows = firstIsHeader ? rows.slice(1) : rows;
    const seen = new Set<string>();
    const out: string[] = [];
    let ignorados = 0;
    let duplicados = 0;
    for (const r of dataRows) {
      const arr = r || [];
      const telRaw = String(arr[idxTel] ?? "").trim();
      const digitos = telRaw.replace(/\D/g, "");
      if (!digitos) { if (arr.some((x) => String(x ?? "").trim())) ignorados++; continue; }
      const key = digitos.length >= 8 ? digitos.slice(-8) : digitos;
      if (seen.has(key)) { duplicados++; continue; }
      seen.add(key);
      const nome = idxNome >= 0 ? String(arr[idxNome] ?? "").trim() : "";
      const cpf = idxCpf >= 0 ? String(arr[idxCpf] ?? "").replace(/\D/g, "") : "";
      const atraso = idxAtraso >= 0 ? String(arr[idxAtraso] ?? "").trim() : "";
      const saldo = idxSaldo >= 0 ? String(arr[idxSaldo] ?? "").trim().replace(/[^\d,.-]/g, "").replace(",", ".") : "";
      const parts = [telRaw, nome, cpf, atraso, saldo];
      // Só recorta trailing vazio pra ficar limpo, mas preserva vazios no meio
      while (parts.length > 1 && !parts[parts.length - 1]) parts.pop();
      out.push(parts.join(", "));
    }
    if (out.length === 0) { toast.error("Nenhum telefone válido encontrado após mapeamento"); return; }
    onConfirm(out, { total: out.length, ignorados, duplicados });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Mapear colunas da planilha</DialogTitle>
          <DialogDescription>
            Para cada coluna, escolha qual variável ela representa. Somente <strong>Telefone</strong> é obrigatório.
            {firstIsHeader && " A primeira linha foi detectada como cabeçalho e será ignorada."}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto max-h-[55vh] border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                {Array.from({ length: nCols }).map((_, c) => (
                  <th key={c} className="p-2 text-left border-b min-w-[160px]">
                    <div className="font-semibold mb-1">Coluna {colLetter(c)}</div>
                    <Select value={mapping[c] || "ignore"} onValueChange={(v) => setCol(c, v as ColRole)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ROLE_LABELS) as ColRole[]).map((r) => (
                          <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {firstIsHeader && (
                      <div className="mt-1 text-[10px] text-muted-foreground truncate" title={String(firstRow[c] ?? "")}>
                        {String(firstRow[c] ?? "") || "—"}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={i} className="border-b">
                  {Array.from({ length: nCols }).map((_, c) => (
                    <td key={c} className="p-2 font-mono truncate max-w-[220px]" title={String((r || [])[c] ?? "")}>
                      {String((r || [])[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirmar}>Confirmar e importar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
