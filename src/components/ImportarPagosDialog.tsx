import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { parsePagamentosCobmais, type LinhaPagamentoImportada } from '@/lib/parsePagamentosCobmais';
import { formatarMoeda, formatarData } from '@/lib/comissao';

type StatusLinha =
  | 'pronto'
  | 'valor_divergente'
  | 'sem_acordo'
  | 'sem_parcela_pendente'
  | 'ja_pago';

interface LinhaAvaliada extends LinhaPagamentoImportada {
  status: StatusLinha;
  pagamento_id?: string;
  acordo_id?: string;
  numero_parcela_sistema?: number;
  valor_esperado?: number;
  data_prevista?: string;
  detalhe?: string;
}

const TOLERANCIA = 0.01;

const statusLabel: Record<StatusLinha, string> = {
  pronto: 'Pronto para marcar',
  valor_divergente: 'Valor divergente',
  sem_acordo: 'Sem acordo',
  sem_parcela_pendente: 'Sem parcela pendente',
  ja_pago: 'Já pago',
};

const statusVariant: Record<StatusLinha, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pronto: 'default',
  valor_divergente: 'secondary',
  sem_acordo: 'destructive',
  sem_parcela_pendente: 'outline',
  ja_pago: 'outline',
};

export function ImportarPagosDialog({ onImported }: { onImported?: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [linhas, setLinhas] = useState<LinhaAvaliada[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState<string>('');
  const [incluirDivergentes, setIncluirDivergentes] = useState(false);

  const reset = () => {
    setLinhas([]);
    setNomeArquivo('');
    setIncluirDivergentes(false);
  };

  async function avaliarLinhas(base: LinhaPagamentoImportada[]): Promise<LinhaAvaliada[]> {
    const cpfsUnicos = Array.from(new Set(base.map((l) => l.cpf)));
    if (cpfsUnicos.length === 0) return [];

    // Buscar acordos ativos/quebrados desses CPFs (em lotes)
    const acordosPorCpf = new Map<string, Array<{ id: string; criado_em: string; parcelas: number; status: string }>>();
    const CHUNK = 200;
    for (let i = 0; i < cpfsUnicos.length; i += CHUNK) {
      const lote = cpfsUnicos.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from('acordos')
        .select('id, cliente_cpf, criado_em, parcelas, status')
        .in('cliente_cpf', lote)
        .in('status', ['ativo', 'quebrado'])
        .order('criado_em', { ascending: false });
      if (error) throw error;
      for (const a of data ?? []) {
        const cpf = String((a as any).cliente_cpf ?? '').replace(/\D+/g, '').padStart(11, '0');
        const arr = acordosPorCpf.get(cpf) ?? [];
        arr.push({ id: a.id as string, criado_em: a.criado_em as string, parcelas: a.parcelas as number, status: a.status as string });
        acordosPorCpf.set(cpf, arr);
      }
    }

    // Buscar todos os pagamentos dos acordos relevantes
    const acordoIds = Array.from(new Set(Array.from(acordosPorCpf.values()).flat().map((a) => a.id)));
    const pagamentosPorAcordo = new Map<string, Array<{ id: string; numero_parcela: number; valor_parcela: number; status: string; data_prevista: string }>>();
    for (let i = 0; i < acordoIds.length; i += CHUNK) {
      const lote = acordoIds.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from('pagamentos')
        .select('id, acordo_id, numero_parcela, valor_parcela, status, data_prevista')
        .in('acordo_id', lote)
        .order('numero_parcela', { ascending: true });
      if (error) throw error;
      for (const p of data ?? []) {
        const arr = pagamentosPorAcordo.get(p.acordo_id as string) ?? [];
        arr.push({
          id: p.id as string,
          numero_parcela: p.numero_parcela as number,
          valor_parcela: Number(p.valor_parcela) || 0,
          status: p.status as string,
          data_prevista: p.data_prevista as string,
        });
        pagamentosPorAcordo.set(p.acordo_id as string, arr);
      }
    }

    // Marcar quais pagamentos já foram "reservados" nesta importação, para não
    // aplicar 2 linhas na mesma parcela quando o CPF tem vários pagamentos.
    const usados = new Set<string>();

    const result: LinhaAvaliada[] = base.map((linha) => {
      const acordos = acordosPorCpf.get(linha.cpf) ?? [];
      if (acordos.length === 0) {
        return { ...linha, status: 'sem_acordo' };
      }

      // Tenta cada acordo (mais recente primeiro) até achar uma parcela candidata
      for (const acordo of acordos) {
        const parcelas = pagamentosPorAcordo.get(acordo.id) ?? [];
        if (parcelas.length === 0) continue;

        // 1) Se a planilha traz o número da parcela, tenta bater exatamente
        let candidato = linha.parcela
          ? parcelas.find((p) => p.numero_parcela === linha.parcela && p.status === 'pendente' && !usados.has(p.id))
          : undefined;

        // 2) Senão, primeira pendente disponível em ordem
        if (!candidato) {
          candidato = parcelas.find((p) => p.status === 'pendente' && !usados.has(p.id));
        }

        if (!candidato) {
          // Verifica se a parcela específica já está paga
          if (linha.parcela) {
            const jaPago = parcelas.find((p) => p.numero_parcela === linha.parcela && p.status === 'pago');
            if (jaPago) return { ...linha, status: 'ja_pago', acordo_id: acordo.id, numero_parcela_sistema: jaPago.numero_parcela, valor_esperado: jaPago.valor_parcela };
          }
          continue;
        }

        usados.add(candidato.id);
        const diff = Math.abs(candidato.valor_parcela - linha.valorPago);
        const status: StatusLinha = diff <= TOLERANCIA ? 'pronto' : 'valor_divergente';
        return {
          ...linha,
          status,
          pagamento_id: candidato.id,
          acordo_id: acordo.id,
          numero_parcela_sistema: candidato.numero_parcela,
          valor_esperado: candidato.valor_parcela,
          data_prevista: candidato.data_prevista,
        };
      }

      // Nenhum dos acordos tinha parcela pendente
      return { ...linha, status: 'sem_parcela_pendente', acordo_id: acordos[0].id };
    });

    return result;
  }

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const base = await parsePagamentosCobmais(file);
      if (base.length === 0) {
        toast({ variant: 'destructive', title: 'Planilha vazia', description: 'A aba "Pagamentos" não tem linhas válidas.' });
        return;
      }
      const avaliadas = await avaliarLinhas(base);
      setLinhas(avaliadas);
      setNomeArquivo(file.name);
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Erro ao ler planilha', description: err?.message ?? 'Falha inesperada.' });
    } finally {
      setParsing(false);
    }
  };

  const resumo = linhas.reduce(
    (acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<StatusLinha, number>,
  );

  const aplicaveis = linhas.filter(
    (l) => l.pagamento_id && (l.status === 'pronto' || (l.status === 'valor_divergente' && incluirDivergentes)),
  );

  const handleConfirmar = async () => {
    if (aplicaveis.length === 0) return;
    setAplicando(true);
    let ok = 0;
    let erro = 0;
    try {
      // Update por linha (com data_paga específica). Em lotes lógicos de 20 requests concorrentes.
      const CHUNK = 20;
      for (let i = 0; i < aplicaveis.length; i += CHUNK) {
        const lote = aplicaveis.slice(i, i + CHUNK);
        const results = await Promise.all(
          lote.map((l) =>
            supabase
              .from('pagamentos')
              .update({ status: 'pago', data_paga: l.dataPagamento })
              .eq('id', l.pagamento_id as string),
          ),
        );
        for (const r of results) {
          if (r.error) {
            erro++;
            console.error('Erro update pagamento:', r.error);
          } else {
            ok++;
          }
        }
      }

      toast({
        title: 'Importação concluída',
        description: `${ok} parcela(s) marcada(s) como paga(s). ${erro > 0 ? `${erro} erro(s).` : ''}`,
      });
      onImported?.();
      setOpen(false);
      reset();
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Erro ao aplicar', description: err?.message ?? 'Falha inesperada.' });
    } finally {
      setAplicando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Importar pagos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar pagamentos da planilha</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-auto pr-1">
          <div className="flex items-center gap-3">
            <Input
              type="file"
              accept=".xlsx,.xls"
              disabled={parsing || aplicando}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {parsing && <Loader2 className="h-4 w-4 animate-spin" />}
            {nomeArquivo && !parsing && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" /> {nomeArquivo}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Lemos a aba <strong>Pagamentos</strong> — colunas <strong>B (CPF)</strong>, <strong>J (VALOR PAGO)</strong>, <strong>N (DATA)</strong> e <strong>Q (PARCELA)</strong>. O sistema procura em acordos ativos/quebrados do mesmo CPF a próxima parcela pendente (priorizando o número da parcela quando informado) e confere o valor.
          </p>

          {linhas.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                {(Object.keys(statusLabel) as StatusLinha[]).map((s) => (
                  <Badge key={s} variant={statusVariant[s]} className="gap-1">
                    {statusLabel[s]}: {resumo[s] ?? 0}
                  </Badge>
                ))}
                <Badge variant="outline">Total: {linhas.length}</Badge>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={incluirDivergentes}
                  onCheckedChange={(v) => setIncluirDivergentes(!!v)}
                />
                Marcar como pago mesmo quando o valor divergir (usa o valor da parcela do sistema)
              </label>

              <div className="border rounded overflow-auto max-h-[50vh]">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Linha</th>
                      <th className="p-2 text-left">CPF</th>
                      <th className="p-2 text-left">Cliente</th>
                      <th className="p-2 text-left">Parcela</th>
                      <th className="p-2 text-right">Valor planilha</th>
                      <th className="p-2 text-right">Valor sistema</th>
                      <th className="p-2 text-left">Data pgto</th>
                      <th className="p-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{l.linha}</td>
                        <td className="p-2 font-mono">{l.cpf}</td>
                        <td className="p-2">{l.cliente}</td>
                        <td className="p-2">
                          {l.parcela ?? '—'}
                          {l.numero_parcela_sistema && l.numero_parcela_sistema !== l.parcela ? (
                            <span className="text-muted-foreground"> (sist. {l.numero_parcela_sistema})</span>
                          ) : null}
                        </td>
                        <td className="p-2 text-right">{formatarMoeda(l.valorPago)}</td>
                        <td className="p-2 text-right">
                          {l.valor_esperado != null ? formatarMoeda(l.valor_esperado) : '—'}
                        </td>
                        <td className="p-2">{formatarData(l.dataPagamento)}</td>
                        <td className="p-2">
                          <Badge variant={statusVariant[l.status]}>{statusLabel[l.status]}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-3">
          <Button variant="ghost" onClick={() => { setOpen(false); reset(); }} disabled={aplicando}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={aplicando || aplicaveis.length === 0}
            className="gap-2"
          >
            {aplicando && <Loader2 className="h-4 w-4 animate-spin" />}
            Marcar {aplicaveis.length} parcela(s) como paga(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
