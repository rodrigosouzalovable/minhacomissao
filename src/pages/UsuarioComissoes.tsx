import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { DateRangePicker } from '@/components/DateRangePicker';
import { ArrowLeft, DollarSign, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { formatarMoeda, formatarData } from '@/lib/comissao';

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

export default function UsuarioComissoes() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<'todas' | 'pagas'>('todas');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  // Buscar perfil do usuário
  const { data: profile } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Buscar acordos do usuário
  const { data: acordos } = useQuery({
    queryKey: ['user-acordos', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acordos')
        .select('*')
        .eq('user_id', userId)
        .order('criado_em', { ascending: false });

      if (error) throw error;
      return data as Acordo[];
    },
    enabled: !!userId,
  });

  // Buscar pagamentos de todos os acordos
  const { data: pagamentos } = useQuery({
    queryKey: ['user-pagamentos', acordos?.map(a => a.id)],
    queryFn: async () => {
      if (!acordos || acordos.length === 0) return [];
      
      const acordoIds = acordos.map(a => a.id);
      const { data, error } = await supabase
        .from('pagamentos')
        .select('*')
        .in('acordo_id', acordoIds)
        .order('numero_parcela', { ascending: true });

      if (error) throw error;
      return data as Pagamento[];
    },
    enabled: !!acordos && acordos.length > 0,
  });

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

  // Calcular totais (considerando o filtro de período)
  const pagamentosPagosNoPeriodo = pagamentosFiltradosPorPeriodo?.filter(p => p.status === 'pago') || [];
  const comissaoTotal = pagamentosFiltradosPorPeriodo?.reduce((acc, p) => acc + Number(p.comissao_parcela), 0) ?? 0;
  const comissaoPaga = pagamentosPagosNoPeriodo.reduce((acc, p) => acc + Number(p.comissao_parcela), 0);
  const comissaoPendente = comissaoTotal - comissaoPaga;
  const percentualRecebido = comissaoTotal > 0 
    ? (comissaoPaga / comissaoTotal) * 100 
    : 0;

  // Agrupar acordos por CPF
  const acordosPorCpf = acordos?.reduce((acc, acordo) => {
    const cpf = acordo.cliente_cpf || 'Sem CPF';
    if (!acc[cpf]) {
      acc[cpf] = [];
    }
    acc[cpf].push(acordo);
    return acc;
  }, {} as Record<string, Acordo[]>) ?? {};

  // Filtrar pagamentos por status
  const getPagamentosDoAcordo = (acordoId: string) => {
    const pagamentosAcordo = pagamentosFiltradosPorPeriodo?.filter(p => p.acordo_id === acordoId) ?? [];
    if (filtro === 'pagas') {
      return pagamentosAcordo.filter(p => p.status === 'pago');
    }
    return pagamentosAcordo;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/usuarios')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Comissões - {profile?.nome ?? 'Carregando...'}
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualização detalhada de comissões por acordo
            </p>
          </div>
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

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Comissão Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatarMoeda(comissaoTotal)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Comissão Paga</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatarMoeda(comissaoPaga)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Comissão Pendente</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{formatarMoeda(comissaoPendente)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">% Recebido</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{percentualRecebido.toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtro */}
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as 'todas' | 'pagas')}>
          <TabsList>
            <TabsTrigger value="todas">Todas as Parcelas</TabsTrigger>
            <TabsTrigger value="pagas">Somente Pagas</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Lista de Acordos por CPF */}
        <div className="space-y-4">
          {Object.entries(acordosPorCpf).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhum acordo encontrado para este usuário.
              </CardContent>
            </Card>
          ) : (
            Object.entries(acordosPorCpf).map(([cpf, acordosCpf]) => (
              <Card key={cpf}>
                <CardHeader>
                  <CardTitle className="text-lg">CPF: {cpf}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="w-full">
                    {acordosCpf.map((acordo) => {
                      const pagamentosAcordo = getPagamentosDoAcordo(acordo.id);
                      const comissaoAcordo = pagamentosAcordo.reduce((acc, p) => acc + Number(p.comissao_parcela), 0);
                      
                      if (filtro === 'pagas' && pagamentosAcordo.length === 0) {
                        return null;
                      }
                      
                      return (
                        <AccordionItem key={acordo.id} value={acordo.id}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex flex-col md:flex-row md:items-center gap-2 text-left w-full pr-4">
                              <span className="font-medium">{acordo.cliente_nome}</span>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">
                                  {acordo.parcelas} parcelas
                                </Badge>
                                <Badge variant="secondary">
                                  Total: {formatarMoeda(acordo.valor_total)}
                                </Badge>
                                <Badge variant="default">
                                  Comissão: {formatarMoeda(comissaoAcordo)}
                                </Badge>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            {pagamentosAcordo.length === 0 ? (
                              <p className="text-muted-foreground text-center py-4">
                                Nenhuma parcela {filtro === 'pagas' ? 'paga' : ''} encontrada.
                              </p>
                            ) : (
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
                                      <TableCell>
                                        {pagamento.numero_parcela}/{acordo.parcelas}
                                      </TableCell>
                                      <TableCell>{formatarMoeda(pagamento.valor_parcela)}</TableCell>
                                      <TableCell>{formatarMoeda(pagamento.comissao_parcela)}</TableCell>
                                      <TableCell>{formatarData(pagamento.data_prevista)}</TableCell>
                                      <TableCell>
                                        {pagamento.data_paga ? formatarData(pagamento.data_paga) : '-'}
                                      </TableCell>
                                      <TableCell>
                                        <Badge 
                                          variant={pagamento.status === 'pago' ? 'default' : 'secondary'}
                                        >
                                          {pagamento.status === 'pago' ? 'Pago' : 'Pendente'}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
