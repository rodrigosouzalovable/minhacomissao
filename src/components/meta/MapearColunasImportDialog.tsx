import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// ColRole aceita papéis fixos ("telefone"/"nome"/...) ou uma variável do template ("tplvar:1", "tplvar:nome_completo").
export type ColRole = string;

const FIXED_LABELS: Record<string, string> = {
  ignore: "Ignorar",
  telefone: "Telefone",
  nome: "Nome",
  cpf: "CPF / CNPJ",
  atraso: "Atraso (dias)",
  saldo: "Saldo (R$)",
};

const HEADER_HINTS: Array<{ role: string; rx: RegExp }> = [
  { role: "telefone", rx: /(telefone|celular|whats|fone|phone|numero|número|tel)/i },
  { role: "cpf", rx: /(cpf|cnpj|documento|doc)/i },
  { role: "nome", rx: /(nome|cliente|razao|razão|contato)/i },
  { role: "atraso", rx: /(atraso|dias|days)/i },
  { role: "saldo", rx: /(saldo|valor|d[ií]vida|debito|débito|montante|total)/i },
];

function detectRoleFromHeader(header: string): string {
  const h = String(header || "").trim();
  if (!h) return "ignore";
  for (const { role, rx } of HEADER_HINTS) {
    if (rx.test(h)) return role;
  }
  return "ignore";
}

function detectRoleFromSample(samples: string[]): string {
  const nonEmpty = samples.map((s) => String(s || "").trim()).filter(Boolean);
  if (nonEmpty.length === 0) return "ignore";
  const digitLike = nonEmpty.filter((v) => /^\+?\d[\d\s().-]{6,}$/.test(v));
  const digitRatio = digitLike.length / nonEmpty.length;
  if (digitRatio > 0.6) {
    const digitLengths = digitLike.map((v) => v.replace(/\D/g, "").length);
    const docRatio = digitLengths.filter((len) => len === 14 || len === 11).length / digitLengths.length;
    const phoneRatio = digitLengths.filter((len) => len >= 10 && len <= 13).length / digitLengths.length;
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

function normalizeTelKey(t: string): string {
  const d = String(t || "").replace(/\D+/g, "");
  return d.length >= 8 ? d.slice(-8) : d;
}

type TemplateInfo = {
  nome_template: string;
  body_text: string;
  variaveis?: Record<string, any> | null;
} | null;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: any[][];
  template?: TemplateInfo;
  onConfirm: (
    csvLines: string[],
    stats: { total: number; ignorados: number; duplicados: number },
    varsByTel: Record<string, Record<string, string>>,
  ) => void;
};

function extractPlaceholders(bodyText: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of bodyText.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)) {
    const k = m[1];
    if (!seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

function placeholderContext(bodyText: string, key: string): string {
  const rx = new RegExp(`(.{0,25})\\{\\{\\s*${key.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*\\}\\}(.{0,25})`);
  const m = bodyText.match(rx);
  if (!m) return "";
  const around = `${(m[1] || "").trim()} … ${(m[2] || "").trim()}`.replace(/\s+/g, " ").trim();
  return around;
}

export default function MapearColunasImportDialog({ open, onOpenChange, rows, template, onConfirm }: Props) {
  const nCols = useMemo(() => rows.reduce((m, r) => Math.max(m, (r || []).length), 0), [rows]);

  const firstRow = rows[0] || [];
  const firstIsHeader = useMemo(() => {
    const digitos = String(firstRow[0] ?? "").replace(/\D/g, "");
    return digitos.length < 8;
  }, [firstRow]);

  const placeholders = useMemo(
    () => (template?.body_text ? extractPlaceholders(template.body_text) : []),
    [template?.body_text],
  );

  const [mapping, setMapping] = useState<ColRole[]>([]);

  useEffect(() => {
    if (!open) return;
    const initial: ColRole[] = [];
    const used = new Set<string>();
    for (let c = 0; c < nCols; c++) {
      let role: string = "ignore";
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

  const setCol = (idx: number, role: string) => {
    setMapping((prev) => {
      const next = [...prev];
      // Papéis únicos: qualquer coisa exceto "ignore" e "nome" só pode aparecer 1x.
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

  const labelOf = (role: string): string => {
    if (FIXED_LABELS[role]) return FIXED_LABELS[role];
    if (role.startsWith("tplvar:")) {
      const k = role.slice("tplvar:".length);
      return `{{${k}}}`;
    }
    return role;
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

    const tplvarCols: Array<{ col: number; key: string }> = mapping
      .map((r, c) => (r.startsWith("tplvar:") ? { col: c, key: r.slice("tplvar:".length) } : null))
      .filter(Boolean) as Array<{ col: number; key: string }>;

    const dataRows = firstIsHeader ? rows.slice(1) : rows;
    const seen = new Set<string>();
    const out: string[] = [];
    const varsByTel: Record<string, Record<string, string>> = {};
    let ignorados = 0;
    let duplicados = 0;
    for (const r of dataRows) {
      const arr = r || [];
      const telRaw = String(arr[idxTel] ?? "").trim();
      const digitos = telRaw.replace(/\D/g, "");
      if (!digitos) { if (arr.some((x) => String(x ?? "").trim())) ignorados++; continue; }
      const key = normalizeTelKey(digitos);
      if (seen.has(key)) { duplicados++; continue; }
      seen.add(key);
      const nome = idxNome >= 0 ? String(arr[idxNome] ?? "").trim() : "";
      const cpf = idxCpf >= 0 ? String(arr[idxCpf] ?? "").replace(/\D/g, "") : "";
      const atraso = idxAtraso >= 0 ? String(arr[idxAtraso] ?? "").trim() : "";
      const saldo = idxSaldo >= 0 ? String(arr[idxSaldo] ?? "").trim().replace(/[^\d,.-]/g, "").replace(",", ".") : "";
      // Coleta valores das variáveis do template na ordem dos placeholders para exibir no textarea
      const tplValuesInOrder: string[] = [];
      const rowVars: Record<string, string> = {};
      if (tplvarCols.length > 0) {
        const byKey = new Map(tplvarCols.map((t) => [t.key, t.col]));
        for (const pk of placeholders) {
          const col = byKey.get(pk);
          const raw = col != null ? String(arr[col] ?? "").trim() : "";
          tplValuesInOrder.push(raw);
          if (raw) rowVars[pk] = raw;
        }
      }

      const parts = [telRaw, nome, cpf, atraso, saldo, ...tplValuesInOrder];
      while (parts.length > 1 && !parts[parts.length - 1]) parts.pop();
      out.push(parts.join(", "));

      if (Object.keys(rowVars).length > 0) varsByTel[key] = rowVars;
    }
    if (out.length === 0) { toast.error("Nenhum telefone válido encontrado após mapeamento"); return; }
    onConfirm(out, { total: out.length, ignorados, duplicados }, varsByTel);
    onOpenChange(false);
  };

  const bodyPreview = template?.body_text || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Mapear colunas da planilha</DialogTitle>
          <DialogDescription>
            Para cada coluna, escolha se ela representa um campo padrão ou uma variável do template.
            Somente <strong>Telefone</strong> é obrigatório.
            {firstIsHeader && " A primeira linha foi detectada como cabeçalho e será ignorada."}
          </DialogDescription>
        </DialogHeader>

        {template && placeholders.length > 0 && (
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Template: {template.nome_template}
            </div>
            <div
              className="text-xs whitespace-pre-wrap font-mono leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: bodyPreview
                  .replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string))
                  .replace(/\{\{\s*([^}\s]+)\s*\}\}/g, '<span class="rounded bg-primary/15 px-1 py-0.5 font-semibold text-primary">{{$1}}</span>'),
              }}
            />
            <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
              {placeholders.map((k) => (
                <span key={k} className="rounded border px-1.5 py-0.5">
                  <code>{`{{${k}}}`}</code>
                  {placeholderContext(bodyPreview, k) && <> — {placeholderContext(bodyPreview, k)}</>}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-auto max-h-[50vh] border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                {Array.from({ length: nCols }).map((_, c) => (
                  <th key={c} className="p-2 text-left border-b min-w-[190px]">
                    <div className="font-semibold mb-1">Coluna {colLetter(c)}</div>
                    <Select value={mapping[c] || "ignore"} onValueChange={(v) => setCol(c, v)}>
                      <SelectTrigger className="h-8"><SelectValue>{labelOf(mapping[c] || "ignore")}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel className="text-[10px]">Campos padrão</SelectLabel>
                          {(Object.keys(FIXED_LABELS)).map((r) => (
                            <SelectItem key={r} value={r}>{FIXED_LABELS[r]}</SelectItem>
                          ))}
                        </SelectGroup>
                        {placeholders.length > 0 && (
                          <>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel className="text-[10px]">Variáveis do template</SelectLabel>
                              {placeholders.map((k) => {
                                const ctx = placeholderContext(bodyPreview, k);
                                return (
                                  <SelectItem key={`tplvar:${k}`} value={`tplvar:${k}`}>
                                    {`{{${k}}}`}
                                    {ctx && <span className="ml-2 text-[10px] text-muted-foreground truncate max-w-[220px] inline-block align-middle">— {ctx}</span>}
                                  </SelectItem>
                                );
                              })}
                            </SelectGroup>
                          </>
                        )}
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
