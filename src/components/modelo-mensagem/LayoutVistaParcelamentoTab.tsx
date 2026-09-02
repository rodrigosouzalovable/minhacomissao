import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, Wand2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PARCELA_MINIMA } from '@/lib/parseCobmaisPlanilha';
import {
  CREDOR_LABEL,
  GRADE_POR_CREDOR,
  montarParcelamentoTexto,
  primeiroNome,
  type CredorPlanilha,
} from '@/lib/gradeCredor';
import {
  MapearColunasPlanilha,
  extrairLinhas,
  type MapeamentoPlanilha,
} from './MapearColunasPlanilha';

interface LinhaPreview {
  nome: string;
  cpf: string;
  telefone: string;
  valor: number;
  aVista: number;
  parcelamento: string;
}

const SOMENTE_AVISTA = 'Somente à vista';

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const moeda = (n: number) => `R$ ${fmtBRL(n)}`;

export function LayoutVistaParcelamentoTab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState('');
  const [rows, setRows] = useState<any[][]>([]);
  const [mapeamento, setMapeamento] = useState<MapeamentoPlanilha | null>(null);
  const [credor, setCredor] = useState<CredorPlanilha>('novo_mundo');
  const [descVista, setDescVista] = useState(50);
  const [descParcelado, setDescParcelado] = useState(30);
  const [preview, setPreview] = useState<LinhaPreview[]>([]);

  const comParcelamento = preview.filter((l) => l.parcelamento !== SOMENTE_AVISTA);
  const somenteAVista = preview.filter((l) => l.parcelamento === SOMENTE_AVISTA);

  async function handleFile(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error('Planilha vazia');
      const lidas = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as any[][];
      const uteis = lidas.filter((r) => (r || []).some((c) => String(c ?? '').trim() !== ''));
      if (uteis.length === 0) throw new Error('Nenhuma linha encontrada na planilha');
      setRows(uteis);
      setMapeamento(null);
      setPreview([]);
      setArquivo(file.name);
      toast.success(`${uteis.length} linhas lidas — selecione as colunas`);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao ler a planilha');
    }
  }

  function aplicar() {
    if (!mapeamento) return toast.error('Importe uma planilha primeiro');
    if (!mapeamento.papeis.includes('telefone') || !mapeamento.papeis.includes('valor'))
      return toast.error('Selecione as colunas de Telefone e de Valor total devido');
    const base = extrairLinhas(rows, mapeamento);
    if (base.length === 0) return toast.error('Nenhuma linha válida com telefone e valor');
    const grade = GRADE_POR_CREDOR[credor];
    setPreview(
      base.map((l) => ({
        ...l,
        nome: primeiroNome(l.nome),
        aVista: l.valor * (1 - (descVista || 0) / 100),
        parcelamento: montarParcelamentoTexto(l.valor * (1 - (descParcelado || 0) / 100), grade),
      })),
    );
    toast.success(`${base.length} clientes processados`);
  }

  function exportar(linhas: LinhaPreview[], comColunaParcelamento: boolean, nome: string) {
    if (linhas.length === 0) return;
    const head = ['Telefone', 'CPF', 'Nome', 'Valor original', 'À vista'];
    if (comColunaParcelamento) head.push('Parcelamento');
    const aoa = [
      head,
      ...linhas.map((l) => {
        const linha: (string | number)[] = [
          l.telefone,
          l.cpf,
          l.nome,
          moeda(l.valor),
          moeda(l.aVista),
        ];
        if (comColunaParcelamento) linha.push(l.parcelamento);
        return linha;
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 120 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, comColunaParcelamento ? 'A vista e Parcelado' : 'Somente a vista');
    XLSX.writeFile(wb, `${nome}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function limpar() {
    setRows([]);
    setMapeamento(null);
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
              <Label>Planilha (.xlsx / .xls)</Label>
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
            <div className="space-y-1 w-52">
              <Label>Credor</Label>
              <Select value={credor} onValueChange={(v) => setCredor(v as CredorPlanilha)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(GRADE_POR_CREDOR) as CredorPlanilha[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CREDOR_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 w-40">
              <Label>Desconto à vista (%)</Label>
              <Input
                type="number"
                min={0}
                max={90}
                value={descVista}
                onChange={(e) =>
                  setDescVista(Math.min(90, Math.max(0, Number(e.target.value) || 0)))
                }
              />
            </div>
            <div className="space-y-1 w-40">
              <Label>Desconto parcelado (%)</Label>
              <Input
                type="number"
                min={0}
                max={90}
                value={descParcelado}
                onChange={(e) =>
                  setDescParcelado(Math.min(90, Math.max(0, Number(e.target.value) || 0)))
                }
              />
            </div>
            <Button onClick={aplicar} disabled={rows.length === 0}>
              <Wand2 className="h-4 w-4 mr-2" /> Aplicar
            </Button>
            {rows.length > 0 && (
              <Button variant="ghost" onClick={limpar}>
                <Trash2 className="h-4 w-4 mr-2" /> Limpar
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Upload className="h-3 w-3" />
            {arquivo ? `${arquivo} — ${rows.length} linhas. ` : ''}
            {`Grade ${CREDOR_LABEL[credor]}: ${GRADE_POR_CREDOR[credor].join('x, ')}x. Parcela mínima R$ ${fmtBRL(PARCELA_MINIMA)}.`}
          </p>
        </CardContent>
      </Card>

      <MapearColunasPlanilha rows={rows} mapeamento={mapeamento} onChange={setMapeamento} />

      {preview.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1 w-52">
                <Label>Credor</Label>
                <Select
                  value={credor}
                  onValueChange={(v) => setCredor(v as CredorPlanilha)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(GRADE_POR_CREDOR) as CredorPlanilha[]).map((c) => (
                      <SelectItem key={c} value={c}>
                        {CREDOR_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="secondary" onClick={aplicar}>
                <Wand2 className="h-4 w-4 mr-2" /> Reaplicar
              </Button>
              <Button
                variant="outline"
                onClick={() => exportar(comParcelamento, true, 'avista-parcelamento')}
                disabled={comParcelamento.length === 0}
              >
                <Download className="h-4 w-4 mr-2" /> À vista + parcelado ({comParcelamento.length})
              </Button>
              <Button
                variant="outline"
                onClick={() => exportar(somenteAVista, false, 'somente-a-vista')}
                disabled={somenteAVista.length === 0}
              >
                <Download className="h-4 w-4 mr-2" /> Somente à vista ({somenteAVista.length})
              </Button>
            </div>

            <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Valor original</TableHead>
                    <TableHead>À vista</TableHead>
                    <TableHead>Parcelamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((l, i) => (
                    <TableRow key={`${l.telefone}-${i}`}>
                      <TableCell className="whitespace-nowrap">{l.telefone}</TableCell>
                      <TableCell className="whitespace-nowrap">{l.cpf || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{l.nome}</TableCell>
                      <TableCell className="whitespace-nowrap">{moeda(l.valor)}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {moeda(l.aVista)}
                      </TableCell>
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
