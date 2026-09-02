import { useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { parseValorPlanilha, normalizarDocumento } from '@/lib/gradeCredor';

export type PapelColuna = 'ignore' | 'nome' | 'telefone' | 'valor' | 'cpf';

export interface MapeamentoPlanilha {
  papeis: PapelColuna[];
  temCabecalho: boolean;
}

const LABELS: Record<PapelColuna, string> = {
  ignore: 'Ignorar',
  nome: 'Nome',
  telefone: 'Telefone',
  cpf: 'CPF',
  valor: 'Valor total devido',
};

const RX_TEL = /(telefone|celular|whats|fone|phone|n[uú]mero|tel)/i;
const RX_NOME = /(nome|cliente|raz[aã]o|contato|devedor)/i;
const RX_VALOR = /(saldo|valor|d[ií]vida|debito|débito|montante|total|aberto)/i;
const RX_CPF = /(cpf|cnpj|documento|doc\b)/i;

const soDigitos = (s: any) => String(s ?? '').replace(/\D+/g, '');

function pareceCabecalho(row: any[] | undefined): boolean {
  if (!row) return false;
  const celulas = row.map((c) => String(c ?? '').trim()).filter(Boolean);
  if (celulas.length === 0) return false;
  const textuais = celulas.filter((c) => /[a-zA-ZÀ-ÿ]/.test(c) && !/\d{4,}/.test(c));
  const temHint = celulas.some((c) => RX_TEL.test(c) || RX_NOME.test(c) || RX_VALOR.test(c));
  return temHint && textuais.length / celulas.length > 0.6;
}

function detectar(rows: any[][], temCabecalho: boolean): PapelColuna[] {
  const nCols = rows.reduce((m, r) => Math.max(m, r?.length ?? 0), 0);
  const header = temCabecalho ? rows[0] ?? [] : [];
  const corpo = rows.slice(temCabecalho ? 1 : 0, temCabecalho ? 31 : 30);
  const papeis: PapelColuna[] = new Array(nCols).fill('ignore');
  const usado = new Set<PapelColuna>();

  const setar = (i: number, p: PapelColuna) => {
    if (usado.has(p) || papeis[i] !== 'ignore') return;
    papeis[i] = p;
    usado.add(p);
  };

  // 1) cabeçalho
  for (let i = 0; i < nCols; i++) {
    const h = String(header?.[i] ?? '').trim();
    if (!h) continue;
    if (RX_CPF.test(h)) setar(i, 'cpf');
    else if (RX_TEL.test(h)) setar(i, 'telefone');
    else if (RX_VALOR.test(h)) setar(i, 'valor');
    else if (RX_NOME.test(h)) setar(i, 'nome');
  }

  // 2) conteúdo
  for (let i = 0; i < nCols; i++) {
    if (papeis[i] !== 'ignore') continue;
    const amostras = corpo.map((r) => String(r?.[i] ?? '').trim()).filter(Boolean);
    if (amostras.length === 0) continue;
    const digitos = amostras.map((s) => soDigitos(s));
    const telLike = digitos.filter((d) => d.length >= 10 && d.length <= 13).length / amostras.length;
    const temLetras = amostras.filter((s) => /[a-zA-ZÀ-ÿ]{3,}/.test(s)).length / amostras.length;
    const cpfLike =
      amostras.filter((s) => {
        const d = soDigitos(s);
        return !/[a-zA-ZÀ-ÿ]/.test(s) && (d.length === 11 || d.length === 14);
      }).length / amostras.length;
    const valorLike =
      amostras.filter((s) => parseValorPlanilha(s) > 0 && !/^\d{10,}$/.test(soDigitos(s))).length /
      amostras.length;

    if (!usado.has('cpf') && cpfLike > 0.6) setar(i, 'cpf');
    else if (!usado.has('telefone') && telLike > 0.6 && temLetras < 0.3) setar(i, 'telefone');
    else if (!usado.has('nome') && temLetras > 0.6) setar(i, 'nome');
    else if (!usado.has('valor') && valorLike > 0.6) setar(i, 'valor');
  }

  return papeis;
}

interface Props {
  rows: any[][];
  mapeamento: MapeamentoPlanilha | null;
  onChange: (m: MapeamentoPlanilha) => void;
}

export function MapearColunasPlanilha({ rows, mapeamento, onChange }: Props) {
  const nCols = useMemo(() => rows.reduce((m, r) => Math.max(m, r?.length ?? 0), 0), [rows]);

  // detecção inicial
  useEffect(() => {
    if (!rows.length || mapeamento) return;
    const temCabecalho = pareceCabecalho(rows[0]);
    onChange({ temCabecalho, papeis: detectar(rows, temCabecalho) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, mapeamento]);

  if (!rows.length || !mapeamento) return null;

  const { papeis, temCabecalho } = mapeamento;
  const amostra = rows.slice(temCabecalho ? 1 : 0, (temCabecalho ? 1 : 0) + 10);

  function setPapel(i: number, p: PapelColuna) {
    const novos = papeis.slice();
    if (p !== 'ignore') {
      for (let k = 0; k < novos.length; k++) if (novos[k] === p) novos[k] = 'ignore';
    }
    novos[i] = p;
    onChange({ ...mapeamento, papeis: novos });
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm font-medium">
            Confira as colunas e selecione o que cada uma representa
          </p>
          <div className="flex items-center gap-2">
            <Checkbox
              id="tem-cabecalho"
              checked={temCabecalho}
              onCheckedChange={(v) => {
                const tc = Boolean(v);
                onChange({ temCabecalho: tc, papeis: detectar(rows, tc) });
              }}
            />
            <Label htmlFor="tem-cabecalho" className="text-xs font-normal">
              A primeira linha é cabeçalho
            </Label>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                {Array.from({ length: nCols }).map((_, i) => (
                  <TableHead key={i} className="align-top min-w-[190px]">
                    <div className="space-y-1 py-1">
                      <Select
                        value={papeis[i] ?? 'ignore'}
                        onValueChange={(v) => setPapel(i, v as PapelColuna)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(LABELS) as PapelColuna[]).map((p) => (
                            <SelectItem key={p} value={p} className="text-xs">
                              {LABELS[p]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {temCabecalho
                          ? String(rows[0]?.[i] ?? `Coluna ${i + 1}`)
                          : `Coluna ${i + 1}`}
                      </p>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {amostra.map((row, r) => (
                <TableRow key={r}>
                  {Array.from({ length: nCols }).map((_, i) => (
                    <TableCell key={i} className="text-xs whitespace-nowrap max-w-[240px] truncate">
                      {String(row?.[i] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/** Extrai as linhas úteis conforme o mapeamento, descartando inválidas e duplicadas. */
export function extrairLinhas(
  rows: any[][],
  m: MapeamentoPlanilha,
): { nome: string; telefone: string; valor: number; cpf: string }[] {
  const idxNome = m.papeis.indexOf('nome');
  const idxTel = m.papeis.indexOf('telefone');
  const idxValor = m.papeis.indexOf('valor');
  const idxCpf = m.papeis.indexOf('cpf');
  if (idxTel < 0 || idxValor < 0) return [];
  const vistos = new Set<string>();
  const out: { nome: string; telefone: string; valor: number; cpf: string }[] = [];
  for (const row of rows.slice(m.temCabecalho ? 1 : 0)) {
    const nome = idxNome >= 0 ? String(row?.[idxNome] ?? '').trim() : '';
    const telefone = String(row?.[idxTel] ?? '').replace(/\D+/g, '');
    const valor = parseValorPlanilha(row?.[idxValor]);
    const cpf = idxCpf >= 0 ? normalizarDocumento(row?.[idxCpf]) : '';
    if (!telefone || valor <= 0) continue;
    const key = `${nome.toLowerCase()}|${telefone}|${valor.toFixed(2)}`;
    if (vistos.has(key)) continue;
    vistos.add(key);
    out.push({ nome, telefone, valor, cpf });
  }
  return out;
}
