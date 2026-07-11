import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SearchCheck, Download, Loader2, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

function normalizeCpf(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 11) return digits.padStart(11, '0');
  return digits;
}

async function coletarCpfsPresentes(
  tabela: 'devedores' | 'acordos_devedor',
  coluna: 'cpf' | 'devedor_cpf',
  lote: string[],
  onPage: (n: number) => void,
  filtroAtivo: boolean,
): Promise<Set<string>> {
  const encontrados = new Set<string>();
  const PAGE = 1000;
  let from = 0;
  let pagina = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    pagina++;
    onPage(pagina);
    let q: any = (supabase as any).from(tabela).select(coluna).in(coluna, lote).range(from, from + PAGE - 1);
    if (filtroAtivo) q = q.eq('ativo', true);
    const { data, error } = await q;
    if (error) throw error;
    for (const r of (data ?? []) as any[]) {
      const v = (r as any)[coluna];
      if (v != null) encontrados.add(String(v));
    }
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return encontrados;
}

export function BatimentoCpfsPortalCard() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cpfs, setCpfs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [ausentes, setAusentes] = useState<string[] | null>(null);

  const reset = () => {
    setAusentes(null);
    setProgress(0);
    setProgressMsg('');
  };

  const handleFile = async (f: File | null) => {
    reset();
    setFile(f);
    setCpfs([]);
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
      const set = new Set<string>();
      for (const r of rows) {
        const first = Array.isArray(r) ? r[0] : undefined;
        const cpf = normalizeCpf(first);
        if (cpf.length === 11) set.add(cpf);
      }
      const arr = Array.from(set);
      setCpfs(arr);
      if (arr.length === 0) {
        toast({ title: 'Nenhum CPF encontrado', description: 'Verifique se a primeira coluna contém CPFs.', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Erro ao ler planilha', description: String(e?.message ?? e), variant: 'destructive' });
    }
  };

  const rodarBatimento = async () => {
    if (cpfs.length === 0) return;
    setRunning(true);
    reset();
    try {
      const BATCH = 200;
      const presentes = new Set<string>();
      const total = cpfs.length;
      const totalLotes = Math.ceil(total / BATCH);

      for (let i = 0; i < total; i += BATCH) {
        const lote = cpfs.slice(i, i + BATCH);
        const loteIdx = Math.floor(i / BATCH) + 1;

        const setPageMsg = (tabelaLabel: string) => (n: number) => {
          setProgressMsg(`Verificando lote ${loteIdx}/${totalLotes} — ${tabelaLabel} (página ${n})…`);
        };

        const devPresentes = await coletarCpfsPresentes('devedores', 'cpf', lote, setPageMsg('devedores'), true);
        for (const c of devPresentes) presentes.add(c);

        const acPresentes = await coletarCpfsPresentes('acordos_devedor', 'devedor_cpf', lote, setPageMsg('acordos'), false);
        for (const c of acPresentes) presentes.add(c);

        setProgress(Math.min(100, Math.round(((i + lote.length) / total) * 100)));
      }

      const ausentesList = cpfs.filter((c) => !presentes.has(c)).sort();
      setAusentes(ausentesList);
      setProgressMsg('');
      toast({
        title: 'Batimento concluído',
        description: `${ausentesList.length} ausente(s) de ${total} CPF(s) verificado(s).`,
      });
    } catch (e: any) {
      toast({ title: 'Erro no batimento', description: String(e?.message ?? e), variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const baixarResultado = () => {
    if (!ausentes || ausentes.length === 0) return;
    const aoa: any[][] = [['CPF'], ...ausentes.map((c) => [c])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    for (let i = 1; i <= ausentes.length; i++) {
      const addr = `A${i + 1}`;
      if (ws[addr]) {
        ws[addr].t = 's';
        ws[addr].z = '@';
      }
    }
    ws['!cols'] = [{ wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CPFs Ausentes');
    const hoje = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `cpfs-ausentes-portal-${hoje}.xlsx`);
  };

  const limpar = () => {
    setFile(null);
    setCpfs([]);
    reset();
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SearchCheck className="h-5 w-5" />
          Batimento de CPFs no Portal
        </CardTitle>
        <CardDescription>
          Envie uma planilha com uma coluna de CPFs (xlsx/xls/csv). O sistema devolve um arquivo com os CPFs que
          <strong> não </strong>estão no portal de negociação.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            disabled={running}
            className="text-sm file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-secondary/80"
          />
          {file && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              {file.name} — {cpfs.length} CPF(s)
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={rodarBatimento} disabled={running || cpfs.length === 0}>
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <SearchCheck className="h-4 w-4 mr-2" />}
            Rodar batimento
          </Button>
          {(file || ausentes) && !running && (
            <Button variant="outline" onClick={limpar}>Limpar</Button>
          )}
        </div>

        {running && (
          <div className="space-y-1.5">
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground">{progressMsg}</p>
          </div>
        )}

        {ausentes && !running && (
          <div className="rounded-md border p-3 flex flex-wrap items-center justify-between gap-3 bg-muted/30">
            <div className="text-sm">
              <strong>{ausentes.length}</strong> CPF(s) ausente(s) de <strong>{cpfs.length}</strong> verificado(s).
            </div>
            {ausentes.length > 0 && (
              <Button onClick={baixarResultado} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Baixar CPFs ausentes.xlsx
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
