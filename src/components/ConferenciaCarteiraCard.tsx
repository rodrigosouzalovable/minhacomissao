import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Scale, Download, Loader2 } from 'lucide-react';
import { exportarParaExcel } from '@/lib/exportExcel';

interface Divergencia {
  cpf: string;
  nome: string;
  total_planilha: number;
  total_portal: number;
  diferenca: number;
}

function normalizeCpf(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 11) return digits.padStart(11, '0');
  return digits;
}

function parseNum(v: unknown): number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/[R$\s.]/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ConferenciaCarteiraCard() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [divergencias, setDivergencias] = useState<Divergencia[] | null>(null);
  const [totalCpfs, setTotalCpfs] = useState(0);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setDivergencias(null);
    setProgress(0);
    setRunning(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 'A' }).slice(1);

      const planilha = new Map<string, { nome: string; total: number }>();
      for (const r of rows) {
        const cpf = normalizeCpf(r['A']);
        if (cpf.length < 11) continue;
        const nome = String(r['B'] ?? '').trim();
        const valor = parseNum(r['G']);
        const cur = planilha.get(cpf);
        if (cur) cur.total += valor;
        else planilha.set(cpf, { nome, total: valor });
      }

      const cpfs = Array.from(planilha.keys());
      setTotalCpfs(cpfs.length);
      if (cpfs.length === 0) {
        toast({ title: 'Nenhum CPF encontrado', description: 'Verifique se a planilha segue o layout UME consolidado.', variant: 'destructive' });
        setRunning(false);
        return;
      }

      const portal = new Map<string, number>();
      const CHUNK = 200;
      const PAGE = 1000;
      for (let i = 0; i < cpfs.length; i += CHUNK) {
        const lote = cpfs.slice(i, i + CHUNK);
        setProgressMsg(`Conferindo ${Math.min(i + CHUNK, cpfs.length)} de ${cpfs.length} CPFs...`);
        setProgress(Math.round((i / cpfs.length) * 100));
        let from = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data, error } = await (supabase as any)
            .from('devedores')
            .select('cpf, valor_atualizado')
            .eq('ativo', true)
            .in('cpf', lote)
            .range(from, from + PAGE - 1);
          if (error) throw error;
          const rs = (data ?? []) as any[];
          for (const r of rs) {
            const cpf = String(r.cpf ?? '');
            portal.set(cpf, (portal.get(cpf) ?? 0) + Number(r.valor_atualizado ?? 0));
          }
          if (rs.length < PAGE) break;
          from += PAGE;
        }
      }

      const result: Divergencia[] = [];
      for (const [cpf, info] of planilha) {
        const totalPortal = portal.get(cpf) ?? 0;
        const dif = totalPortal - info.total;
        if (Math.abs(dif) > 0.01) {
          result.push({ cpf, nome: info.nome, total_planilha: info.total, total_portal: totalPortal, diferenca: dif });
        }
      }
      result.sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca));
      setDivergencias(result);
      setProgress(100);
      setProgressMsg('');
      toast({
        title: 'Conferência concluída',
        description: `${result.length} CPF(s) com divergência de ${cpfs.length} conferidos.`,
      });
    } catch (e: any) {
      console.error('[conferencia] erro', e);
      toast({ title: 'Erro na conferência', description: e?.message, variant: 'destructive' });
    }
    setRunning(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const exportar = async () => {
    if (!divergencias || divergencias.length === 0) return;
    await exportarParaExcel(
      divergencias.map((d) => ({
        cpf: d.cpf,
        nome: d.nome,
        total_planilha: d.total_planilha.toFixed(2).replace('.', ','),
        total_portal: d.total_portal.toFixed(2).replace('.', ','),
        diferenca: d.diferenca.toFixed(2).replace('.', ','),
      })),
      [
        { chave: 'cpf', titulo: 'CPF' },
        { chave: 'nome', titulo: 'Nome' },
        { chave: 'total_planilha', titulo: 'Total planilha (R$)' },
        { chave: 'total_portal', titulo: 'Total portal (R$)' },
        { chave: 'diferenca', titulo: 'Diferença (R$)' },
      ],
      `conferencia-carteira-${new Date().toISOString().slice(0, 10)}`
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" />
          Conferência de carteira (portal x planilha)
        </CardTitle>
        <CardDescription>
          Carregue a planilha consolidada do Cobmais (layout UME) para ver os CPFs em que a soma das parcelas ativas no
          portal difere da soma do arquivo. Nada é alterado — apenas conferência.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          disabled={running}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="max-w-sm"
        />

        {running && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {progressMsg || 'Processando planilha...'}
            </p>
          </div>
        )}

        {divergencias && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">
                {totalCpfs} CPF(s) conferidos — <strong>{divergencias.length}</strong> com divergência
              </span>
              {divergencias.length > 0 && (
                <Button size="sm" variant="outline" onClick={exportar}>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar Excel
                </Button>
              )}
            </div>

            {divergencias.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">CPF</th>
                      <th className="p-2 text-left">Nome</th>
                      <th className="p-2 text-right">Planilha</th>
                      <th className="p-2 text-right">Portal</th>
                      <th className="p-2 text-right">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divergencias.slice(0, 300).map((d) => (
                      <tr key={d.cpf} className="border-t">
                        <td className="p-2 font-mono">{d.cpf}</td>
                        <td className="p-2">{d.nome}</td>
                        <td className="p-2 text-right">{brl(d.total_planilha)}</td>
                        <td className="p-2 text-right">{brl(d.total_portal)}</td>
                        <td className={`p-2 text-right font-medium ${d.diferenca > 0 ? 'text-destructive' : ''}`}>
                          {brl(d.diferenca)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {divergencias.length > 300 && (
                  <p className="p-2 text-xs text-muted-foreground">
                    Mostrando as 300 maiores divergências — o Excel traz a lista completa.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
