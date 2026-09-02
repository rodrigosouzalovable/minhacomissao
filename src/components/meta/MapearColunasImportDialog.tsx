import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { amostrasParecemValor, formatarValorBR, type FormatoValor } from "@/lib/valorBR";
import { normalizarCredor, type CredorSlug } from "@/lib/credorMarcas";

const VALOR_HEADER_RX = /(saldo|valor|d[ií]vida|debito|débito|montante|total|parcela|entrada)/i;

// ColRole aceita papéis fixos ("telefone"/"nome"/...) ou uma variável do template ("tplvar:1", "tplvar:nome_completo").
export type ColRole = string;

const FIXED_LABELS: Record<string, string> = {
  ignore: "Ignorar",
  telefone: "Telefone",
  nome: "Nome",
  cpf: "CPF / CNPJ",
  atraso: "Atraso (dias)",
  saldo: "Saldo (R$)",
  credor: "Credor",
};

const HEADER_HINTS: Array<{ role: string; rx: RegExp }> = [
  { role: "telefone", rx: /(telefone|celular|whats|fone|phone|numero|número|tel)/i },
  { role: "cpf", rx: /(cpf|cnpj|documento|doc)/i },
  { role: "nome", rx: /(nome|cliente|razao|razão|contato)/i },
  { role: "atraso", rx: /(atraso|dias|days)/i },
  { role: "credor", rx: /(credor|carteira)/i },
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
  const credorLike = nonEmpty.filter((v) => normalizarCredor(v));
  if (credorLike.length / nonEmpty.length > 0.6) return "credor";
  const digitLike = nonEmpty.filter((v) => /^\+?\d[\d\s().-]{3,}$/.test(v));
  const digitRatio = digitLike.length / nonEmpty.length;
  if (digitRatio > 0.6) {
    const digitLengths = digitLike.map((v) => v.replace(/\D/g, "").length);
    const docRatio = digitLengths.filter((len) => len === 14 || len === 11).length / digitLengths.length;
    const phoneRatio = digitLengths.filter((len) => len >= 10 && len <= 13).length / digitLengths.length;
    // CPF sem zeros à esquerda (Excel): 5 a 9 dígitos — nunca é telefone.
    const shortDocRatio = digitLengths.filter((len) => len >= 5 && len <= 9).length / digitLengths.length;
    if (shortDocRatio > 0.6) return "cpf";
    if (digitLengths.filter((len) => len === 14).length / digitLengths.length > 0.6) return "cpf";
    if (phoneRatio > 0.6) return "telefone";
    if (docRatio > 0.6) return "cpf";
  }
  return "ignore";
}

function columnLooksLikeDocument(rows: any[][], col: number, skipHeader: boolean): boolean {
  const raw = rows
    .slice(skipHeader ? 1 : 0, skipHeader ? 11 : 10)
    .map((r) => String((r || [])[col] ?? "").trim())
    .filter(Boolean);
  if (raw.length === 0) return false;
  // Datas e valores monetários NÃO são documento (evita travar a importação).
  const ehDataOuValor = (s: string) =>
    /\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(s) || /[,]\d{1,2}\b/.test(s) || /R\$/i.test(s);
  const samples = raw.filter((s) => !ehDataOuValor(s)).map((s) => s.replace(/\D/g, "")).filter(Boolean);
  if (samples.length / raw.length < 0.6) return false;
  // Aceita CPF encurtado pelo Excel (zeros à esquerda perdidos) e CNPJ.
  return samples.filter((d) => (d.length >= 5 && d.length <= 11) || d.length === 14).length / samples.length > 0.6;
}


function normalizeDocument(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  // Excel pode remover zeros à esquerda: recompõe CPF (11) ou CNPJ (14).
  if (digits.length >= 5 && digits.length <= 11) return digits.padStart(11, "0");
  if (digits.length >= 12 && digits.length <= 14) return digits.padStart(14, "0");
  return "";
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
  /** Exige a coluna Credor quando templates são roteados por carteira. */
  requireCredor?: boolean;
  /** Exige a coluna CPF / CNPJ (padrão do Envio Meta). */
  requireCpf?: boolean;
  /** Sufixos (8 dígitos) de números nossos da UAZAPI — isentos de deduplicação. */
  isentosDedup?: Set<string>;
  onConfirm: (
    csvLines: string[],
    stats: { total: number; ignorados: number; duplicados: number; preservados?: number },
    varsByTel: Record<string, Record<string, string>>,
    headers: string[],
    credorByTel?: Record<string, CredorSlug>,
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

export default function MapearColunasImportDialog({ open, onOpenChange, rows, template, requireCredor = false, requireCpf = true, isentosDedup, onConfirm }: Props) {
  const nCols = useMemo(() => rows.reduce((m, r) => Math.max(m, (r || []).length), 0), [rows]);

  const firstRow = rows[0] || [];
  const firstIsHeader = useMemo(() => {
    const digitos = String(firstRow[0] ?? "").replace(/\D/g, "");
    return digitos.length < 8;
  }, [firstRow]);

  const placeholders = useMemo(() => {
    const fromBody = template?.body_text ? extractPlaceholders(template.body_text) : [];
    const seen = new Set(fromBody);
    // Também inclui variáveis declaradas no template (ex.: {{1}}, {{2}}) mesmo quando
    // o body_text está vazio no banco — usuários precisam mapear essas colunas na planilha.
    const fromVars: string[] = [];
    if (template?.variaveis && typeof template.variaveis === "object") {
      for (const k of Object.keys(template.variaveis)) {
        if (k.startsWith("_")) continue; // metadados internos (_components, _format, ...)
        if (!seen.has(k)) { seen.add(k); fromVars.push(k); }
      }
      // Ordena numericamente as chaves que parecem números (1,2,3...)
      fromVars.sort((a, b) => {
        const na = Number(a), nb = Number(b);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return a.localeCompare(b);
      });
    }
    return [...fromBody, ...fromVars];
  }, [template?.body_text, template?.variaveis]);

  const [mapping, setMapping] = useState<ColRole[]>([]);
  // Formato de saída por coluna: "brl" (R$ 4.607,58), "numero" (4.607,58) ou "raw".
  const [formatoPorColuna, setFormatoPorColuna] = useState<Record<number, FormatoValor>>({});

  // Colunas cujos valores parecem monetários (habilita o seletor de formato).
  const colunasMonetarias = useMemo(() => {
    const set = new Set<number>();
    for (let c = 0; c < nCols; c++) {
      const samples = rows.slice(firstIsHeader ? 1 : 0, firstIsHeader ? 11 : 10).map((r) => String((r || [])[c] ?? ""));
      if (amostrasParecemValor(samples)) set.add(c);
    }
    return set;
  }, [rows, nCols, firstIsHeader]);

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
    // Coluna monetária sem papel: sugere a próxima variável livre do template (ou Saldo).
    for (let c = 0; c < nCols; c++) {
      if (initial[c] !== "ignore" || !colunasMonetarias.has(c)) continue;
      const livre = placeholders.find((k) => !initial.includes(`tplvar:${k}`));
      if (livre) initial[c] = `tplvar:${livre}`;
      else if (!initial.includes("saldo")) initial[c] = "saldo";
    }
    setMapping(initial);


    // Formato inicial: R$ para colunas monetárias (ou cabeçalho de valor), raw nas demais.
    const fmts: Record<number, FormatoValor> = {};
    for (let c = 0; c < nCols; c++) {
      const headerValor = firstIsHeader && VALOR_HEADER_RX.test(String(firstRow[c] ?? ""));
      fmts[c] = colunasMonetarias.has(c) || headerValor ? "brl" : "raw";
    }
    setFormatoPorColuna(fmts);
  }, [open, nCols, firstIsHeader, colunasMonetarias, placeholders]);

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

  const fmtCol = (c: number): FormatoValor => formatoPorColuna[c] ?? "raw";
  const valorCelula = (c: number, raw: unknown) => formatarValorBR(raw, fmtCol(c));

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
    const idxCredor = mapping.findIndex((r) => r === "credor");

    if (requireCpf && idxCpf < 0) {
      toast.error("Selecione a coluna de CPF / CNPJ — ela é obrigatória para esta importação.");
      return;
    }
    if (requireCredor && idxCredor < 0) {
      toast.error("Selecione a coluna Credor para direcionar UME e Novo Mundo aos templates corretos.");
      return;
    }
    if (requireCredor && idxCredor >= 0) {
      const invalidCredor = (firstIsHeader ? rows.slice(1) : rows).filter((row) => row?.[idxTel] && !normalizarCredor(String(row?.[idxCredor] ?? ""))).length;
      if (invalidCredor > 0) {
        toast.error(`${invalidCredor} linha(s) têm credor vazio ou não reconhecido. Use UME ou NOVO MUNDO.`);
        return;
      }
    }

    if (idxCpf < 0 && idxNome >= 0 && columnLooksLikeDocument(rows, idxNome, firstIsHeader)) {
      toast.error(`A coluna ${colLetter(idxNome)} parece ser CPF/CNPJ. Marque como "CPF / CNPJ" para preencher a variável {cpf}.`);
      return;
    }

    // Coluna ignorada que parece documento: avisa (sem travar) para não perder o CPF da campanha.
    if (idxCpf < 0) {
      const idxDocIgnorado = mapping.findIndex((r, c) => r === "ignore" && c !== idxTel && columnLooksLikeDocument(rows, c, firstIsHeader));
      if (idxDocIgnorado >= 0) {
        toast.warning(`A coluna ${colLetter(idxDocIgnorado)} parece ser CPF/CNPJ. Marque como "CPF / CNPJ" se quiser o CPF no cabeçalho da conversa.`);
      }
    }


    const tplvarCols: Array<{ col: number; key: string }> = mapping
      .map((r, c) => (r.startsWith("tplvar:") ? { col: c, key: r.slice("tplvar:".length) } : null))
      .filter(Boolean) as Array<{ col: number; key: string }>;
    const tplByKey = new Map(tplvarCols.map((t) => [t.key, t.col]));

    const bodyText = template?.body_text || "";
    // Monta colunas de saída dinâmicas — só o que foi realmente mapeado.
    type OutCol = { header: string; get: (arr: any[]) => string };
    const cols: OutCol[] = [];
    cols.push({ header: "Telefone", get: (arr) => String(arr[idxTel] ?? "").trim() });
    if (idxNome >= 0) cols.push({ header: "Nome", get: (arr) => String(arr[idxNome] ?? "").trim() });
    if (idxCpf >= 0) cols.push({ header: "CPF/CNPJ", get: (arr) => normalizeDocument(arr[idxCpf]) });
    if (idxAtraso >= 0) cols.push({ header: "Atraso", get: (arr) => String(arr[idxAtraso] ?? "").trim() });
    if (idxSaldo >= 0) cols.push({
      header: "Saldo",
      get: (arr) => (fmtCol(idxSaldo) === "raw"
        ? String(arr[idxSaldo] ?? "").trim().replace(/[^\d,.-]/g, "").replace(",", ".")
        : valorCelula(idxSaldo, arr[idxSaldo])),
    });
    // Placeholders do template na ordem em que aparecem no corpo.
    for (const pk of placeholders) {
      const col = tplByKey.get(pk);
      if (col == null) continue;
      const ctx = placeholderContext(bodyText, pk);
      const header = ctx ? `{{${pk}}} — ${ctx}` : `{{${pk}}}`;
      cols.push({ header, get: (arr) => valorCelula(col, arr[col]) });
    }

    const headers = cols.map((c) => c.header);

    const dataRows = firstIsHeader ? rows.slice(1) : rows;
    const seen = new Set<string>();
    const out: string[] = [];
    const varsByTel: Record<string, Record<string, string>> = {};
    const credorByTel: Record<string, CredorSlug> = {};
    let ignorados = 0;
    let duplicados = 0;
    let preservados = 0;
    for (const r of dataRows) {
      const arr = r || [];
      const telRaw = String(arr[idxTel] ?? "").trim();
      const digitos = telRaw.replace(/\D/g, "");
      if (!digitos) { if (arr.some((x) => String(x ?? "").trim())) ignorados++; continue; }
      const key = normalizeTelKey(digitos);
      const isento = !!isentosDedup?.has(key);
      if (seen.has(key)) {
        if (!isento) { duplicados++; continue; }
        preservados++;
      }
      seen.add(key);

      // varsByTel: só o que veio das colunas tplvar mapeadas
      const rowVars: Record<string, string> = {};
      for (const pk of placeholders) {
        const col = tplByKey.get(pk);
        if (col == null) continue;
        const raw = valorCelula(col, arr[col]);
        if (raw) rowVars[pk] = raw;
      }
      if (Object.keys(rowVars).length > 0) varsByTel[key] = rowVars;

      if (idxCredor >= 0) {
        const cred = normalizarCredor(String(arr[idxCredor] ?? ""));
        if (cred) credorByTel[key] = cred;
      }

      out.push(cols.map((c) => c.get(arr)).join(", "));
    }
    if (out.length === 0) { toast.error("Nenhum telefone válido encontrado após mapeamento"); return; }
    onConfirm(out, { total: out.length, ignorados, duplicados, preservados }, varsByTel, headers, credorByTel);
    onOpenChange(false);
  };


  const bodyPreview = template?.body_text || "";

  // Primeira linha de dados — usada como exemplo na prévia do template.
  const linhaExemplo: any[] = (firstIsHeader ? rows[1] : rows[0]) || [];

  const colPorPlaceholder = useMemo(() => {
    const m = new Map<string, number>();
    mapping.forEach((r, c) => {
      if (r && r.startsWith("tplvar:")) m.set(r.slice("tplvar:".length), c);
    });
    return m;
  }, [mapping]);

  const previewNodes = useMemo(() => {
    const nodes: (string | JSX.Element)[] = [];
    let last = 0;
    let i = 0;
    const rx = /\{\{\s*([^}\s]+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(bodyPreview)) !== null) {
      if (m.index > last) nodes.push(bodyPreview.slice(last, m.index));
      const key = m[1];
      const col = colPorPlaceholder.get(key);
      const valor = col != null ? String(valorCelula(col, linhaExemplo[col]) ?? "").trim() : "";
      nodes.push(
        valor ? (
          <span key={`p-${i++}`} className="rounded bg-emerald-500/20 px-1 py-0.5 font-semibold text-emerald-700 dark:text-emerald-400">
            {valor}
          </span>
        ) : (
          <span key={`p-${i++}`} className="rounded bg-primary/15 px-1 py-0.5 font-semibold text-primary">
            {`{{${key}}}`}
          </span>
        ),
      );
      last = m.index + m[0].length;
    }
    if (last < bodyPreview.length) nodes.push(bodyPreview.slice(last));
    return nodes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyPreview, colPorPlaceholder, formatoPorColuna, rows, firstIsHeader]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Mapear colunas da planilha</DialogTitle>
          <DialogDescription>
            Para cada coluna, escolha se ela representa um campo padrão ou uma variável do template. <strong>Telefone</strong> é obrigatório{requireCpf && <>, <strong>CPF / CNPJ</strong> também é obrigatório</>}{requireCredor && <> e <strong>Credor</strong> (UME ou Novo Mundo) também é obrigatório</>}.
            {firstIsHeader && " A primeira linha foi detectada como cabeçalho e será ignorada."}
          </DialogDescription>
        </DialogHeader>

        {template && placeholders.length > 0 && (
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Template: {template.nome_template}
            </div>
            <div className="text-xs whitespace-pre-wrap font-mono leading-relaxed">{previewNodes}</div>
            <div className="text-[10px] text-muted-foreground">
              Exemplo com os dados da primeira linha da planilha.
            </div>
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
                    {(
                      <Select
                        value={fmtCol(c)}
                        onValueChange={(v) => setFormatoPorColuna((p) => ({ ...p, [c]: v as FormatoValor }))}
                      >
                        <SelectTrigger className="h-7 mt-1 text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="brl">R$ 4.607,58</SelectItem>
                          <SelectItem value="numero">4.607,58</SelectItem>
                          <SelectItem value="raw">Texto original</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {firstIsHeader && (
                      <div className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap break-words max-w-[360px]" title={String(firstRow[c] ?? "")}>
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
                    <td key={c} className="p-2 font-mono align-top whitespace-pre-wrap break-words max-w-[420px]" title={valorCelula(c, (r || [])[c])}>
                      {valorCelula(c, (r || [])[c])}
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
