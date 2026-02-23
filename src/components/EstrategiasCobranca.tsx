import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Download, Users, DollarSign, Clock, AlertTriangle, TrendingUp, CheckCircle } from 'lucide-react';
import { exportarParaExcel } from '@/lib/exportExcel';

interface AcordoComPagamentos {
  id: string;
  cliente_nome: string;
  cliente_cpf: string | null;
  valor_total: number;
  parcelas: number;
  dias_atraso: number;
  user_id: string;
  funcionario_nome: string;
  parcelas_pagas: number;
  parcelas_pendentes: number;
  valor_pago: number;
  valor_pendente: number;
  max_dias_atraso_parcela: number;
}

const CATEGORIAS = [
  { id: 'parciais', label: 'Pagadores Parciais', icon: TrendingUp, cor: 'text-emerald-600' },
  { id: 'unica', label: 'Parcela Única', icon: CheckCircle, cor: 'text-blue-600' },
  { id: 'recentes', label: 'Atraso < 30d', icon: Clock, cor: 'text-amber-600' },
  { id: 'moderados', label: 'Atraso 31-90d', icon: AlertTriangle, cor: 'text-orange-600' },
  { id: 'nunca', label: 'Nunca Pagaram', icon: AlertTriangle, cor: 'text-destructive' },
  { id: 'alto_valor', label: 'Alto Valor', icon: DollarSign, cor: 'text-primary' },
] as const;

type CategoriaId = typeof CATEGORIAS[number]['id'];

function calcularDiasAtrasoMaiorParcela(parcelas: { data_prevista: string; status: string }[]): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  let maxDias = 0;
  for (const p of parcelas) {
    if (p.status === 'pendente') {
      const vencimento = new Date(p.data_prevista + 'T00:00:00');
      const diff = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > maxDias) maxDias = diff;
    }
  }
  return maxDias;
}

function filtrarPorCategoria(acordos: AcordoComPagamentos[], categoria: CategoriaId): AcordoComPagamentos[] {
  switch (categoria) {
    case 'parciais':
      return acordos.filter(a => a.parcelas_pagas > 0 && a.parcelas_pendentes > 0);
    case 'unica':
      return acordos.filter(a => a.parcelas_pendentes === 1);
    case 'recentes':
      return acordos.filter(a => a.max_dias_atraso_parcela > 0 && a.max_dias_atraso_parcela <= 30);
    case 'moderados':
      return acordos.filter(a => a.max_dias_atraso_parcela > 30 && a.max_dias_atraso_parcela <= 90);
    case 'nunca':
      return acordos.filter(a => a.parcelas_pagas === 0);
    case 'alto_valor':
      return [...acordos].sort((a, b) => b.valor_pendente - a.valor_pendente).slice(0, 50);
    default:
      return [];
  }
}

const colunasExcel = [
  { chave: 'cliente_nome' as const, titulo: 'Cliente' },
  { chave: 'cliente_cpf' as const, titulo: 'CPF' },
  { chave: 'valor_total' as const, titulo: 'Valor Total' },
  { chave: 'parcelas_pagas' as const, titulo: 'Parcelas Pagas' },
  { chave: 'parcelas_pendentes' as const, titulo: 'Parcelas Pendentes' },
  { chave: 'valor_pago' as const, titulo: 'Valor Pago' },
  { chave: 'valor_pendente' as const, titulo: 'Valor Pendente' },
  { chave: 'max_dias_atraso_parcela' as const, titulo: 'Dias Atraso' },
  { chave: 'funcionario_nome' as const, titulo: 'Funcionário' },
];

export function EstrategiasCobranca() {
  const [tabAtiva, setTabAtiva] = useState<CategoriaId>('parciais');

  const { data: acordosProcessados, isLoading } = useQuery({
    queryKey: ['estrategias-cobranca'],
    queryFn: async () => {
      const { data: acordos, error: acordosError } = await supabase
        .from('acordos')
        .select('id, cliente_nome, cliente_cpf, valor_total, parcelas, dias_atraso, user_id')
        .eq('status', 'ativo');

      if (acordosError) throw acordosError;
      if (!acordos?.length) return [];

      const acordoIds = acordos.map(a => a.id);

      // Buscar pagamentos em lotes de 50 para evitar URL muito longa
      const BATCH_SIZE = 50;
      const batches: string[][] = [];
      for (let i = 0; i < acordoIds.length; i += BATCH_SIZE) {
        batches.push(acordoIds.slice(i, i + BATCH_SIZE));
      }

      const pagamentosResults = await Promise.all(
        batches.map(batch =>
          supabase
            .from('pagamentos')
            .select('acordo_id, status, valor_parcela, data_prevista')
            .in('acordo_id', batch)
        )
      );

      const pagamentos = pagamentosResults.flatMap(r => {
        if (r.error) throw r.error;
        return r.data ?? [];
      });

      const userIds = [...new Set(acordos.map(a => a.user_id))];
      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', userIds);

      if (profError) throw profError;

      const profileMap = new Map(profiles?.map(p => [p.id, p.nome]) ?? []);
      const pagamentosPorAcordo = new Map<string, typeof pagamentos>();
      for (const p of pagamentos ?? []) {
        if (!pagamentosPorAcordo.has(p.acordo_id)) pagamentosPorAcordo.set(p.acordo_id, []);
        pagamentosPorAcordo.get(p.acordo_id)!.push(p);
      }

      return acordos.map(a => {
        const pags = pagamentosPorAcordo.get(a.id) ?? [];
        const pagas = pags.filter(p => p.status === 'pago');
        const pendentes = pags.filter(p => p.status === 'pendente');
        return {
          id: a.id,
          cliente_nome: a.cliente_nome,
          cliente_cpf: a.cliente_cpf,
          valor_total: a.valor_total,
          parcelas: a.parcelas,
          dias_atraso: a.dias_atraso,
          user_id: a.user_id,
          funcionario_nome: profileMap.get(a.user_id) ?? 'N/A',
          parcelas_pagas: pagas.length,
          parcelas_pendentes: pendentes.length,
          valor_pago: pagas.reduce((s, p) => s + Number(p.valor_parcela), 0),
          valor_pendente: pendentes.reduce((s, p) => s + Number(p.valor_parcela), 0),
          max_dias_atraso_parcela: calcularDiasAtrasoMaiorParcela(pags),
        } satisfies AcordoComPagamentos;
      });
    },
  });

  const categoriasDados = useMemo(() => {
    if (!acordosProcessados) return {};
    const result: Record<CategoriaId, AcordoComPagamentos[]> = {} as any;
    for (const cat of CATEGORIAS) {
      result[cat.id] = filtrarPorCategoria(acordosProcessados, cat.id);
    }
    return result;
  }, [acordosProcessados]);

  const dadosAtivos = categoriasDados[tabAtiva] ?? [];
  const valorPendenteTotal = dadosAtivos.reduce((s, a) => s + a.valor_pendente, 0);

  const handleExport = () => {
    const catLabel = CATEGORIAS.find(c => c.id === tabAtiva)?.label ?? tabAtiva;
    exportarParaExcel(dadosAtivos, colunasExcel, `Estrategia_${catLabel}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Estratégias de Cobrança
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando dados da carteira...</div>
        ) : !acordosProcessados?.length ? (
          <div className="text-center py-8 text-muted-foreground">Nenhum acordo ativo encontrado.</div>
        ) : (
          <Tabs value={tabAtiva} onValueChange={(v) => setTabAtiva(v as CategoriaId)}>
            <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
              {CATEGORIAS.map(cat => (
                <TabsTrigger key={cat.id} value={cat.id} className="text-xs gap-1">
                  <cat.icon className="h-3 w-3" />
                  {cat.label}
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                    {(categoriasDados[cat.id] ?? []).length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {CATEGORIAS.map(cat => (
              <TabsContent key={cat.id} value={cat.id}>
                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="border rounded-lg p-3 flex items-center gap-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Clientes</p>
                      <p className="text-xl font-bold">{dadosAtivos.length}</p>
                    </div>
                  </div>
                  <div className="border rounded-lg p-3 flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Valor Pendente</p>
                      <p className="text-xl font-bold">
                        {valorPendenteTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Export button */}
                <div className="flex justify-end mb-2">
                  <Button size="sm" variant="outline" onClick={handleExport} disabled={!dadosAtivos.length}>
                    <Download className="h-4 w-4 mr-1" />
                    Exportar Excel
                  </Button>
                </div>

                {/* Table */}
                {dadosAtivos.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead className="text-center">Pagas/Total</TableHead>
                          <TableHead className="text-right">Valor Pendente</TableHead>
                          <TableHead className="text-center">Dias Atraso</TableHead>
                          <TableHead>Funcionário</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dadosAtivos.map(a => (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium">{a.cliente_nome}</TableCell>
                            <TableCell>{a.cliente_cpf ?? '-'}</TableCell>
                            <TableCell className="text-right">
                              {a.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </TableCell>
                            <TableCell className="text-center">
                              {a.parcelas_pagas}/{a.parcelas}
                            </TableCell>
                            <TableCell className="text-right">
                              {a.valor_pendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={a.max_dias_atraso_parcela > 30 ? 'destructive' : a.max_dias_atraso_parcela > 0 ? 'secondary' : 'outline'}>
                                {a.max_dias_atraso_parcela}
                              </Badge>
                            </TableCell>
                            <TableCell>{a.funcionario_nome}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente nesta categoria.</p>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
