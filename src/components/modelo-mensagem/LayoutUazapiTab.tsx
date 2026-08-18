import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, Wand2, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Instancia {
  id: string;
  nome: string | null;
  telefone: string | null;
}

interface LinhaSaida {
  celulas: any[];
  injetada: boolean;
  instancia?: string;
}

const soDigitos = (v: any) => String(v ?? '').replace(/\D+/g, '');
const colLabel = (i: number) => XLSX.utils.encode_col(i);

function parecemTelefone(valores: any[]): boolean {
  const amostra = valores.filter((v) => v != null && String(v).trim() !== '').slice(0, 20);
  if (amostra.length === 0) return false;
  const ok = amostra.filter((v) => {
    const d = soDigitos(v);
    return d.length >= 10 && d.length <= 13;
  }).length;
  return ok / amostra.length >= 0.7;
}

export function LayoutUazapiTab() {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState('');
  const [rows, setRows] = useState<any[][]>([]);
  const [colTelefone, setColTelefone] = useState<number | null>(null);
  const [intervalo, setIntervalo] = useState(10);
  const [saida, setSaida] = useState<LinhaSaida[]>([]);
  const [instancias, setInstancias] = useState<Instancia[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('user_whatsapp_instances' as any)
        .select('id, nome, telefone, ativo, ordem')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .order('ordem' as any, { ascending: true });
      const lista = ((data as any[]) || [])
        .filter((i) => soDigitos(i.telefone).length >= 10)
        .map((i) => ({ id: i.id, nome: i.nome, telefone: soDigitos(i.telefone) }));
      setInstancias(lista);
    })();
  }, [user]);

  const nColunas = useMemo(() => rows.reduce((m, r) => Math.max(m, r?.length || 0), 0), [rows]);

  async function handleFile(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error('Planilha vazia');
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as any[][];
      const limpas = data.filter((r) => (r || []).some((c) => String(c ?? '').trim() !== ''));
      if (limpas.length === 0) throw new Error('Nenhuma linha encontrada');
      setRows(limpas);
      setSaida([]);
      setArquivo(file.name);
      const total = limpas.reduce((m, r) => Math.max(m, r?.length || 0), 0);
      let sugerida: number | null = null;
      for (let c = 0; c < total; c++) {
        if (parecemTelefone(limpas.map((r) => r?.[c]))) {
          sugerida = c;
          break;
        }
      }
      setColTelefone(sugerida);
      toast.success(`${limpas.length} linhas carregadas`);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao ler a planilha');
    }
  }

  function gerar() {
    if (rows.length === 0) return toast.error('Importe uma planilha primeiro');
    if (colTelefone == null) return toast.error('Selecione a coluna dos telefones');
    if (instancias.length === 0) return toast.error('Nenhum número UAZAPI ativo com telefone cadastrado');
    const step = Math.max(1, intervalo);
    const out: LinhaSaida[] = [];
    let idx = 0;
    rows.forEach((r, i) => {
      const celulas = Array.from({ length: nColunas }, (_, c) => r?.[c] ?? '');
      out.push({ celulas, injetada: false });
      if ((i + 1) % step === 0) {
        const inst = instancias[idx % instancias.length];
        idx++;
        const copia = [...celulas];
        copia[colTelefone] = inst.telefone as string;
        out.push({ celulas: copia, injetada: true, instancia: inst.nome || inst.telefone || '' });
      }
    });
    setSaida(out);
    toast.success(`${out.filter((l) => l.injetada).length} números nossos inseridos`);
  }

  function baixar() {
    if (saida.length === 0) return;
    const aoa = saida.map((l) => l.celulas);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = Array.from({ length: nColunas }, () => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Telefones');
    XLSX.writeFile(wb, `layout-uazapi-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function limpar() {
    setRows([]);
    setSaida([]);
    setArquivo('');
    setColTelefone(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const usoPorInstancia = useMemo(() => {
    const m = new Map<string, number>();
    saida.filter((l) => l.injetada).forEach((l) => m.set(l.instancia || '', (m.get(l.instancia || '') || 0) + 1));
    return Array.from(m.entries());
  }, [saida]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Planilha de clientes (.xlsx/.xls)</Label>
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
            <div className="space-y-1 w-56">
              <Label>Coluna dos telefones</Label>
              <Select
                value={colTelefone == null ? '' : String(colTelefone)}
                onValueChange={(v) => setColTelefone(Number(v))}
                disabled={rows.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: nColunas }, (_, c) => (
                    <SelectItem key={c} value={String(c)}>
                      Coluna {colLabel(c)} — {String(rows[0]?.[c] ?? '').slice(0, 24) || '(vazio)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 w-36">
              <Label>Inserir a cada</Label>
              <Input
                type="number"
                min={1}
                value={intervalo}
                onChange={(e) => setIntervalo(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <Button onClick={gerar} disabled={rows.length === 0}>
              <Wand2 className="h-4 w-4 mr-2" /> Gerar
            </Button>
            <Button variant="outline" onClick={baixar} disabled={saida.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Baixar Excel
            </Button>
            {rows.length > 0 && (
              <Button variant="ghost" onClick={limpar}>
                <Trash2 className="h-4 w-4 mr-2" /> Limpar
              </Button>
            )}
          </div>

          {instancias.length === 0 ? (
            <p className="text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" />
              Nenhum número UAZAPI ativo com telefone cadastrado. Preencha o telefone na aba UAZAPI → Configurações.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Upload className="h-3 w-3" />
              {arquivo ? `${arquivo} — ${rows.length} linhas. ` : ''}
              {instancias.length} números nossos em rodízio:{' '}
              {instancias.map((i) => i.telefone).join(', ')}
            </p>
          )}

          {saida.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                Total final: <strong>{saida.length}</strong> linhas — {saida.filter((l) => l.injetada).length} inseridas por nós.
              </p>
              <p>{usoPorInstancia.map(([n, q]) => `${n}: ${q}x`).join(' • ')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {saida.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    {Array.from({ length: nColunas }, (_, c) => (
                      <TableHead key={c}>{colLabel(c)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saida.map((l, i) => (
                    <TableRow
                      key={i}
                      className={l.injetada ? 'bg-primary/10 border-l-4 border-l-primary' : undefined}
                    >
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      {l.celulas.map((c, ci) => (
                        <TableCell key={ci} className="text-xs whitespace-nowrap">
                          {String(c ?? '')}
                          {l.injetada && ci === colTelefone && (
                            <Badge variant="default" className="ml-2">UAZAPI</Badge>
                          )}
                        </TableCell>
                      ))}
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
