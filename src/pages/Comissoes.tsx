import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatarMoeda, formatarData } from '@/lib/comissao';
import { DollarSign, TrendingUp, Clock, CheckCircle } from 'lucide-react';

interface PagamentoComAcordo {
  id: string;
  numero_parcela: number;
  data_prevista: string;
  data_paga: string | null;
  valor_parcela: number;
  comissao_parcela: number;
  status: string;
  acordos: {
    cliente_nome: string;
  };
}

export default function Comissoes() {
  const { user } = useAuth();
  const [pagamentos, setPagamentos] = useState<PagamentoComAcordo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadComissoes() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('pagamentos')
          .select(`
            id,
            numero_parcela,
            data_prevista,
            data_paga,
            valor_parcela,
            comissao_parcela,
            status,
            acordos!inner (
              cliente_nome,
              user_id
            )
          `)
          .eq('acordos.user_id', user.id)
          .order('data_paga', { ascending: false, nullsFirst: false });

        if (error) throw error;
        
        // Type assertion after fetching
        const typedData = data as unknown as PagamentoComAcordo[];
        setPagamentos(typedData || []);
      } catch (error) {
        console.error('Erro ao carregar comissões:', error);
      } finally {
        setLoading(false);
      }
    }

    loadComissoes();
  }, [user]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </AppLayout>
    );
  }

  const pagamentosPagos = pagamentos.filter(p => p.status === 'pago');
  const pagamentosPendentes = pagamentos.filter(p => p.status === 'pendente');
  
  const totalRecebido = pagamentosPagos.reduce((sum, p) => sum + Number(p.comissao_parcela), 0);
  const totalPendente = pagamentosPendentes.reduce((sum, p) => sum + Number(p.comissao_parcela), 0);
  const totalGeral = totalRecebido + totalPendente;

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Minhas Comissões</h1>

        {/* Cards de resumo */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Geral</p>
                  <p className="text-2xl font-bold">{formatarMoeda(totalGeral)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-secondary" />
                <div>
                  <p className="text-sm text-muted-foreground">Recebido</p>
                  <p className="text-2xl font-bold text-secondary">{formatarMoeda(totalRecebido)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-warning" />
                <div>
                  <p className="text-sm text-muted-foreground">Pendente</p>
                  <p className="text-2xl font-bold text-warning">{formatarMoeda(totalPendente)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Histórico de comissões recebidas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-secondary" />
              Comissões Recebidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pagamentosPagos.length > 0 ? (
              <div className="space-y-3">
                {pagamentosPagos.map((pagamento) => (
                  <div
                    key={pagamento.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/5 border border-secondary/20"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-secondary/20 rounded-full">
                        <DollarSign className="h-4 w-4 text-secondary" />
                      </div>
                      <div>
                        <p className="font-medium">{pagamento.acordos.cliente_nome}</p>
                        <p className="text-sm text-muted-foreground">
                          Parcela {pagamento.numero_parcela} • Pago em {formatarData(pagamento.data_paga!)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-secondary">
                        {formatarMoeda(pagamento.comissao_parcela)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma comissão recebida ainda
              </p>
            )}
          </CardContent>
        </Card>

        {/* Comissões pendentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Comissões Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pagamentosPendentes.length > 0 ? (
              <div className="space-y-3">
                {pagamentosPendentes.slice(0, 10).map((pagamento) => (
                  <div
                    key={pagamento.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-muted rounded-full">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{pagamento.acordos.cliente_nome}</p>
                        <p className="text-sm text-muted-foreground">
                          Parcela {pagamento.numero_parcela} • Vencimento: {formatarData(pagamento.data_prevista)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-warning">
                        {formatarMoeda(pagamento.comissao_parcela)}
                      </p>
                      <Badge variant="outline">Pendente</Badge>
                    </div>
                  </div>
                ))}
                {pagamentosPendentes.length > 10 && (
                  <p className="text-center text-muted-foreground text-sm">
                    E mais {pagamentosPendentes.length - 10} parcelas pendentes...
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma comissão pendente
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
