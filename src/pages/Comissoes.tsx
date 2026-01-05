import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/DateRangePicker';
import { formatarMoeda, formatarData } from '@/lib/comissao';
import { exportarParaExcel } from '@/lib/exportExcel';
import { Clock, CheckCircle, Download, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface Acordo {
  id: string;
  cliente_nome: string;
  cliente_cpf: string | null;
  valor_total: number;
  comissao_total: number;
  parcelas: number;
  status: string;
}

interface Pagamento {
  id: string;
  acordo_id: string;
  numero_parcela: number;
  valor_parcela: number;
  comissao_parcela: number;
  data_prevista: string;
  data_paga: string | null;
  status: string;
}

export default function Comissoes() {
  const { user } = useAuth();
  const [filtro, setFiltro] = useState<'todas' | 'pagas'>('todas');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const { data: acordos, isLoading: loadingAcordos } = useQuery({
    queryKey: ['meus-acordos', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acordos')
        .select('id, cliente_nome, cliente_cpf, valor_total, comissao_total, parcelas, status')
        .eq('user_id', user!.id)
        .order('criado_em', { ascending: false });

      if (error) throw error;
      return data as Acordo[];
    },
    enabled: !!user,
  });

  const { data: pagamentos, isLoading: loadingPagamentos } = useQuery({
    queryKey: ['meus-pagamentos', acordos?.map(a => a.id)],
    queryFn: async () => {
      if (!acordos || acordos.length === 0) return [];
      
      const { data, error } = await supabase
        .from('pagamentos')
        .select('id, acordo_id, numero_parcela, valor_parcela, comissao_parcela, data_prevista, data_paga, status')
        .in('acordo_id', acordos.map(a => a.id))
        .order('numero_parcela', { ascending: true });

      if (error) throw error;
      return data as Pagamento[];
    },
    enabled: !!acordos && acordos.length > 0,
  });

  const loading = loadingAcordos || loadingPagamentos;

  // Filtrar pagamentos por período (usando data_paga)
  const pagamentosFiltradosPorPeriodo = pagamentos?.filter(p => {
    // Só filtra por período se houver data de pagamento
    if (!p.data_paga) return true; // Pendentes passam (serão filtrados depois se necessário)
    
    const dataPaga = new Date(p.data_paga + 'T00:00:00');
    
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (dataPaga < start) return false;
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (dataPaga > end) return false;
    }
    
    return true;
  });

  // Calcular totais (apenas parcelas pagas no período)
  const pagamentosPagosNoPeriodo = pagamentosFiltradosPorPeriodo?.filter(p => p.status === 'pago') || [];
  const totalPaga = pagamentosPagosNoPeriodo.reduce((sum, p) => sum + Number(p.comissao_parcela), 0);
  const totalValorParcelasPagas = pagamentosPagosNoPeriodo.reduce((sum, p) => sum + Number(p.valor_parcela), 0);

  // Agrupar acordos por CPF
  const acordosPorCpf = acordos?.reduce((acc, acordo) => {
    const cpf = acordo.cliente_cpf || 'Sem CPF';
    if (!acc[cpf]) {
      acc[cpf] = [];
    }
    acc[cpf].push(acordo);
    return acc;
  }, {} as Record<string, Acordo[]>) || {};

  // Filtrar pagamentos por status (todas/pagas)
  const pagamentosFiltrados = filtro === 'pagas' 
    ? pagamentosFiltradosPorPeriodo?.filter(p => p.status === 'pago') 
    : pagamentosFiltradosPorPeriodo;

  const getPagamentosDoAcordo = (acordoId: string) => {
    return pagamentosFiltrados?.filter(p => p.acordo_id === acordoId) || [];
  };

  const handleExportarExcel = () => {
    if (!pagamentosFiltrados || !acordos || pagamentosFiltrados.length === 0) {
      toast.error('Não há dados para exportar');
      return;
    }

    const dadosExport = pagamentosFiltrados.map(p => {
      const acordo = acordos.find(a => a.id === p.acordo_id);
      return {
        cliente_nome: acordo?.cliente_nome || '',
        cliente_cpf: acordo?.cliente_cpf || 'Sem CPF',
        parcela: `${p.numero_parcela}/${acordo?.parcelas || 0}`,
        valor_parcela: formatarMoeda(p.valor_parcela),
        comissao: formatarMoeda(p.comissao_parcela),
        vencimento: formatarData(p.data_prevista),
        pagamento: p.data_paga ? formatarData(p.data_paga) : '-',
        status: p.status === 'pago' ? 'Pago' : 'Pendente',
      };
    });

    exportarParaExcel(
      dadosExport,
      [
        { chave: 'cliente_nome', titulo: 'Cliente' },
        { chave: 'cliente_cpf', titulo: 'CPF' },
        { chave: 'parcela', titulo: 'Parcela' },
        { chave: 'valor_parcela', titulo: 'Valor' },
        { chave: 'comissao', titulo: 'Comissão' },
        { chave: 'vencimento', titulo: 'Vencimento' },
        { chave: 'pagamento', titulo: 'Pagamento' },
        { chave: 'status', titulo: 'Status' },
      ],
      'minhas-comissoes'
    );

    toast.success('Relatório exportado com sucesso!');
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Minhas Comissões</h1>
          <Button onClick={handleExportarExcel} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>

        {/* Filtro por período */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-muted-foreground">Filtrar por data de pagamento:</p>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
              />
            </div>
          </CardContent>
        </Card>

        {/* Cards de resumo */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-secondary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Parcelas Pagas</p>
                  <p className="text-2xl font-bold text-secondary">{formatarMoeda(totalValorParcelasPagas)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Comissão Parcelas Pagas</p>
                  <p className="text-2xl font-bold text-green-500">{formatarMoeda(totalPaga)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de filtro */}
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as 'todas' | 'pagas')}>
          <TabsList>
            <TabsTrigger value="todas">Todas as Parcelas</TabsTrigger>
            <TabsTrigger value="pagas">Somente Pagas</TabsTrigger>
          </TabsList>

          <TabsContent value={filtro} className="mt-4">
            {Object.keys(acordosPorCpf).length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">
                    Nenhum acordo encontrado
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {Object.entries(acordosPorCpf).map(([cpf, acordosDoCpf]) => (
                  <Card key={cpf}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">
                        CPF: {cpf}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="multiple" className="w-full">
                        {acordosDoCpf.map((acordo) => {
                          const pagamentosAcordo = getPagamentosDoAcordo(acordo.id);
                          const comissaoAcordo = pagamentosAcordo.reduce((sum, p) => sum + Number(p.comissao_parcela), 0);
                          
                          if (filtro === 'pagas' && pagamentosAcordo.length === 0) {
                            return null;
                          }

                          return (
                            <AccordionItem key={acordo.id} value={acordo.id}>
                              <AccordionTrigger className="hover:no-underline">
                                <div className="flex flex-wrap items-center gap-2 text-left">
                                  <span className="font-semibold">{acordo.cliente_nome}</span>
                                  <Badge variant="outline">{acordo.parcelas} parcelas</Badge>
                                  <Badge variant="secondary">Total: {formatarMoeda(acordo.valor_total)}</Badge>
                                  <Badge>Comissão: {formatarMoeda(acordo.comissao_total)}</Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                {pagamentosAcordo.length > 0 ? (
                                  <div className="space-y-4">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Parcela</TableHead>
                                          <TableHead>Valor</TableHead>
                                          <TableHead>Comissão</TableHead>
                                          <TableHead>Vencimento</TableHead>
                                          <TableHead>Pagamento</TableHead>
                                          <TableHead>Status</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {pagamentosAcordo.map((pagamento) => (
                                          <TableRow key={pagamento.id}>
                                            <TableCell>{pagamento.numero_parcela}/{acordo.parcelas}</TableCell>
                                            <TableCell>{formatarMoeda(pagamento.valor_parcela)}</TableCell>
                                            <TableCell className="font-medium">{formatarMoeda(pagamento.comissao_parcela)}</TableCell>
                                            <TableCell>{formatarData(pagamento.data_prevista)}</TableCell>
                                            <TableCell>
                                              {pagamento.data_paga ? formatarData(pagamento.data_paga) : '-'}
                                            </TableCell>
                                            <TableCell>
                                              {pagamento.status === 'pago' ? (
                                                <Badge className="bg-secondary text-secondary-foreground">
                                                  <CheckCircle className="h-3 w-3 mr-1" />
                                                  Pago
                                                </Badge>
                                              ) : (
                                                <Badge variant="outline">
                                                  <Clock className="h-3 w-3 mr-1" />
                                                  Pendente
                                                </Badge>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                    <div className="flex justify-end">
                                      <div className="text-right">
                                        <p className="text-sm text-muted-foreground">Comissão do acordo</p>
                                        <p className="text-lg font-bold">{formatarMoeda(comissaoAcordo)}</p>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-muted-foreground text-center py-4">
                                    {filtro === 'pagas' 
                                      ? 'Nenhuma parcela paga neste acordo'
                                      : 'Nenhuma parcela encontrada'}
                                  </p>
                                )}
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
