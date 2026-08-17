import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, Wand2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { GRADE_PARCELAS, PARCELA_MINIMA } from '@/lib/parseCobmaisPlanilha';

interface LinhaBase {
  nome: string;
  telefone: string;
  valor: number;
}

interface LinhaPreview extends LinhaBase {
  parcelamento: string;
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function parseValor(v: any): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\s/g, '').replace(/R\$/gi, '');
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  return Number(s) || 0;
}

function montaParcelamento(total: number, descPct: number): string {
  const base = total * (1 - (descPct || 0) / 100);
  if (base <= 0) return 'Somente à vista';
  let opcoes = GRADE_PARCELAS.filter((n) => base / n >= PARCELA_MINIMA);
  if (opcoes.length === 0) {
    const menor = GRADE_PARCELAS[0];
    if (base / menor >= PARCELA_MINIMA) opcoes = [menor];
    else return 'Somente à vista';
  }
  const partes = opcoes.map((n) => `${n}x de R$ ${fmtBRL(base / n)}`);
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(', ')} ou ${partes[partes.length - 1]}`;
}

export function LayoutPlanilhaTab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<string>('');
  const [base, setBase] = useState<LinhaBase[]>([]);
  const [desconto, setDesconto] = useState(30);
  const [preview, setPreview] = useState<LinhaPreview[]>([]);

  async function handleFile(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error('Planilha vazia');
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as any[][];

      const vistos = new Set<string>();
      const out: LinhaBase[] = [];
      for (const row of rows) {
        const nome = String(row?.[0] ?? '').trim();
        const telefone = String(row?.[1] ?? '').replace(/\D+/g, '');
        const valor = parseValor(row?.[2]);
        if (!telefone || valor <= 0) continue; // ignora cabeçalho e linhas inválidas
        const key = `${nome.toLowerCase()}|${telefone}|${valor.toFixed(2)}`;
        if (vistos.has(key)) continue;
        vistos.add(key);
        out.push({ nome, telefone, valor });
      }
      if (out.length === 0) throw new Error('Nenhuma linha válida encontrada (A=nome, B=telefone, C=valor)');
      setBase(out);
      setPreview([]);
      setArquivo(file.name);
      toast.success(`${out.length} clientes carregados`);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao ler a planilha');
    }
  }

  function aplicar() {
    if (base.length === 0) return toast.error('Importe uma planilha primeiro');
    setPreview(base.map((l) => ({ ...l, parcelamento: montaParcelamento(l.valor, desconto) })));
    toast.success('Pré-visualização gerada');
  }

  function baixar() {
    if (preview.length === 0) return;
    const aoa = preview.map((l) => [l.nome, l.telefone, l.parcelamento]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 38 }, { wch: 18 }, { wch: 120 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Parcelamento');
    XLSX.writeFile(wb, `parcelamento-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function limpar() {
    setBase([]);
    setPreview([]);
    setArquivo('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Planilha (A: nome, B: telefone, C: valor total)</Label>
              <Input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
            <div className="space-y-1 w-40">
              <Label>Desconto parcelado (%)</Label>
              <Input
                type="number"
                min={0}
                max={90}
                value={desconto}
                onChange={(e) => setDesconto(Math.min(90, Math.max(0, Number(e.target.value) || 0)))}
              />
            </div>
            <Button onClick={aplicar} disabled={base.length === 0}>
              <Wand2 className="h-4 w-4 mr-2" /> Aplicar
            </Button>
            <Button variant="outline" onClick={baixar} disabled={preview.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Baixar Excel
            </Button>
            {base.length > 0 && (
              <Button variant="ghost" onClick={limpar}>
                <Trash2 className="h-4 w-4 mr-2" /> Limpar
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Upload className="h-3 w-3" />
            {arquivo
              ? `${arquivo} — ${base.length} clientes. Parcela mínima R$ ${fmtBRL(PARCELA_MINIMA)}.`
              : `Grade: ${GRADE_PARCELAS.join('x, ')}x. Parcela mínima R$ ${fmtBRL(PARCELA_MINIMA)}.`}
          </p>
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Parcelamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((l, i) => (
                    <TableRow key={`${l.telefone}-${i}`}>
                      <TableCell className="whitespace-nowrap">{l.nome}</TableCell>
                      <TableCell className="whitespace-nowrap">{l.telefone}</TableCell>
                      <TableCell className="text-xs">{l.parcelamento}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
