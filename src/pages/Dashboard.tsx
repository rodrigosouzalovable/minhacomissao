import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatarMoeda, formatarData } from '@/lib/comissao';
import { PlusCircle, FileText, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { MetasMensal } from '@/components/MetasMensal';

interface DashboardData {
  totalAcordos: number;
  acordosAtivos: number;
  comissaoPendente: number;
  comissaoRecebida: number;
  ultimosAcordos: Array<{
    id: string;
    cliente_nome: string;
    valor_total: number;
    comissao_total: number;
    status: string;
    criado_em: string;
  }>;
  comissoesPorMes: Array<{ mes: string; valor: number }>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      if (!user) return;

      try {
        // Buscar acordos
        const { data: acordos } = await supabase
          .from('acordos')
          .select('*')
          .eq('user_id', user.id)
          .order('criado_em', { ascending: false });

        // Buscar pagamentos
        const { data: pagamentos } = await supabase
          .from('pagamentos')
          .select('*, acordos!inner(user_id)')
          .eq('acordos.user_id', user.id);

        if (!acordos) {
          setData({
            totalAcordos: 0,
            acordosAtivos: 0,
            comissaoPendente: 0,
            comissaoRecebida: 0,
            ultimosAcordos: [],
            comissoesPorMes: []
          });
          return;
        }

        const acordosAtivos = acordos.filter(a => a.status === 'ativo').length;
        
        // Calcular comissões baseado nos pagamentos
        const pagamentosPagos = pagamentos?.filter(p => p.status === 'pago') || [];
        const pagamentosPendentes = pagamentos?.filter(p => p.status === 'pendente') || [];
        
        const comissaoRecebida = pagamentosPagos.reduce((sum, p) => sum + Number(p.comissao_parcela), 0);
        const comissaoPendente = pagamentosPendentes.reduce((sum, p) => sum + Number(p.comissao_parcela), 0);

        // Agrupar comissões por mês
        const comissoesPorMes: Record<string, number> = {};
        pagamentosPagos.forEach(p => {
          if (p.data_paga) {
            const mes = new Date(p.data_paga).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
            comissoesPorMes[mes] = (comissoesPorMes[mes] || 0) + Number(p.comissao_parcela);
          }
        });

        setData({
          totalAcordos: acordos.length,
          acordosAtivos,
          comissaoPendente,
          comissaoRecebida,
          ultimosAcordos: acordos.slice(0, 5),
          comissoesPorMes: Object.entries(comissoesPorMes).map(([mes, valor]) => ({ mes, valor }))
        });
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <Button asChild>
            <Link to="/acordos/novo">
              <PlusCircle className="h-4 w-4 mr-2" />
              Novo Acordo
            </Link>
          </Button>
        </div>

        {/* Seção de Metas - Apenas para Admin */}
        {isAdmin && (
          <MetasMensal mesAno={format(new Date(), 'yyyy-MM')} />
        )}

        {/* Cards de resumo */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Acordos
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.totalAcordos || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Acordos Ativos
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.acordosAtivos || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Comissão Pendente
              </CardTitle>
              <DollarSign className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {formatarMoeda(data?.comissaoPendente || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Comissão Recebida
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-secondary">
                {formatarMoeda(data?.comissaoRecebida || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Gráfico de comissões */}
          <Card>
            <CardHeader>
              <CardTitle>Comissões por Mês</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.comissoesPorMes && data.comissoesPorMes.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.comissoesPorMes}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mes" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      formatter={(value: number) => formatarMoeda(value)}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="valor" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  Nenhuma comissão recebida ainda
                </div>
              )}
            </CardContent>
          </Card>

          {/* Últimos acordos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Últimos Acordos</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/acordos">Ver todos</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {data?.ultimosAcordos && data.ultimosAcordos.length > 0 ? (
                <div className="space-y-4">
                  {data.ultimosAcordos.map((acordo) => (
                    <Link
                      key={acordo.id}
                      to={`/acordos/${acordo.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <div>
                        <p className="font-medium">{acordo.cliente_nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatarData(acordo.criado_em)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatarMoeda(acordo.valor_total)}</p>
                        <Badge variant={acordo.status === 'ativo' ? 'default' : 'secondary'}>
                          {acordo.status === 'ativo' ? 'Ativo' : acordo.status === 'concluido' ? 'Concluído' : 'Cancelado'}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                  <p>Nenhum acordo cadastrado</p>
                  <Button className="mt-4" asChild>
                    <Link to="/acordos/novo">Criar primeiro acordo</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
