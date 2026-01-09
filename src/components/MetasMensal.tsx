import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Target, TrendingUp, Calendar, DollarSign, Users, Trophy, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { differenceInDays, endOfMonth, format, startOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';

interface MetasMensalProps {
  metaValor: number;
  mesAno: string; // formato "2026-01"
}

interface FuncionarioData {
  userId: string;
  nome: string;
  totalRecebido: number;
  metaIndividual: number;
  faltante: number;
  porDia: number;
  percentualEquipe: number;
}

interface EvolucaoDiaria {
  dia: string;
  acumulado: number;
  metaIdeal: number;
}

export function MetasMensal({ metaValor, mesAno }: MetasMensalProps) {
  const [loading, setLoading] = useState(true);
  const [totalRecebido, setTotalRecebido] = useState(0);
  const [funcionarios, setFuncionarios] = useState<FuncionarioData[]>([]);
  const [evolucaoDiaria, setEvolucaoDiaria] = useState<EvolucaoDiaria[]>([]);
  const [totalFuncionarios, setTotalFuncionarios] = useState(0);

  const dataInicio = startOfMonth(parseISO(`${mesAno}-01`));
  const dataFim = endOfMonth(dataInicio);
  const hoje = new Date();
  const diasRestantes = Math.max(1, differenceInDays(dataFim, hoje) + 1);
  const diasPassados = differenceInDays(hoje, dataInicio) + 1;
  const totalDiasMes = differenceInDays(dataFim, dataInicio) + 1;

  const valorFaltante = Math.max(0, metaValor - totalRecebido);
  const valorPorDia = valorFaltante / diasRestantes;
  const percentualAtingido = (totalRecebido / metaValor) * 100;
  const percentualTempo = (diasPassados / totalDiasMes) * 100;

  // Projeção baseada no ritmo atual
  const mediaDiaria = totalRecebido / diasPassados;
  const projecaoFechamento = mediaDiaria * totalDiasMes;

  // Ritmo: comparação entre percentual atingido e percentual do tempo
  const ritmo = percentualAtingido / percentualTempo;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      const dataInicioStr = format(dataInicio, 'yyyy-MM-dd');
      const dataFimStr = format(dataFim, 'yyyy-MM-dd');

      // Buscar total de funcionários ativos
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome');

      if (profilesError) {
        console.error('Erro ao buscar profiles:', profilesError);
        setLoading(false);
        return;
      }

      const profileMap: Record<string, string> = {};
      profiles?.forEach(p => {
        profileMap[p.id] = p.nome;
      });

      setTotalFuncionarios(profiles?.length || 0);

      // Buscar pagamentos do mês
      const { data: pagamentos, error: pagamentosError } = await supabase
        .from('pagamentos')
        .select('valor_parcela, acordo_id, data_paga')
        .eq('status', 'pago')
        .gte('data_paga', dataInicioStr)
        .lte('data_paga', dataFimStr);

      if (pagamentosError) {
        console.error('Erro ao buscar pagamentos:', pagamentosError);
        setLoading(false);
        return;
      }

      // Buscar acordos para mapear user_id
      const acordoIds = [...new Set(pagamentos?.map(p => p.acordo_id) || [])];
      
      let acordoUserMap: Record<string, string> = {};
      if (acordoIds.length > 0) {
        const { data: acordos } = await supabase
          .from('acordos')
          .select('id, user_id')
          .in('id', acordoIds);
        
        acordos?.forEach(a => {
          acordoUserMap[a.id] = a.user_id;
        });
      }

      // Calcular totais
      let total = 0;
      const valoresPorFuncionario: Record<string, number> = {};
      const valoresPorDia: Record<string, number> = {};

      pagamentos?.forEach(p => {
        const valor = Number(p.valor_parcela) || 0;
        total += valor;

        const userId = acordoUserMap[p.acordo_id];
        if (userId) {
          valoresPorFuncionario[userId] = (valoresPorFuncionario[userId] || 0) + valor;
        }

        if (p.data_paga) {
          valoresPorDia[p.data_paga] = (valoresPorDia[p.data_paga] || 0) + valor;
        }
      });

      setTotalRecebido(total);

      // Calcular dados por funcionário
      const metaIndividual = metaValor / (profiles?.length || 1);
      const funcionariosData: FuncionarioData[] = profiles?.map(p => {
        const recebido = valoresPorFuncionario[p.id] || 0;
        const faltante = Math.max(0, metaIndividual - recebido);
        return {
          userId: p.id,
          nome: p.nome,
          totalRecebido: recebido,
          metaIndividual,
          faltante,
          porDia: faltante / diasRestantes,
          percentualEquipe: total > 0 ? (recebido / total) * 100 : 0,
        };
      }).sort((a, b) => b.totalRecebido - a.totalRecebido) || [];

      setFuncionarios(funcionariosData);

      // Calcular evolução diária
      const evolucao: EvolucaoDiaria[] = [];
      let acumulado = 0;
      const metaDiaria = metaValor / totalDiasMes;

      for (let i = 0; i < diasPassados; i++) {
        const data = new Date(dataInicio);
        data.setDate(data.getDate() + i);
        const dataStr = format(data, 'yyyy-MM-dd');
        
        acumulado += valoresPorDia[dataStr] || 0;
        evolucao.push({
          dia: format(data, 'dd/MM'),
          acumulado,
          metaIdeal: metaDiaria * (i + 1),
        });
      }

      setEvolucaoDiaria(evolucao);
      setLoading(false);
    }

    fetchData();
  }, [mesAno, metaValor]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getProgressColor = () => {
    if (ritmo >= 1) return 'bg-green-500';
    if (ritmo >= 0.8) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getRitmoIcon = () => {
    if (ritmo >= 1) return <ArrowUp className="h-4 w-4 text-green-500" />;
    if (ritmo >= 0.8) return <Minus className="h-4 w-4 text-yellow-500" />;
    return <ArrowDown className="h-4 w-4 text-red-500" />;
  };

  const getRitmoText = () => {
    if (ritmo >= 1) return 'Acima da meta';
    if (ritmo >= 0.8) return 'Próximo da meta';
    return 'Abaixo da meta';
  };

  const getMedalIcon = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}.`;
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const mesNome = format(dataInicio, 'MMMM yyyy', { locale: ptBR });

  return (
    <div className="space-y-6 mb-8">
      {/* Header da Meta */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Target className="h-6 w-6 text-primary" />
            Meta do Mês - {mesNome.charAt(0).toUpperCase() + mesNome.slice(1)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{formatCurrency(totalRecebido)} de {formatCurrency(metaValor)}</span>
              <span className="flex items-center gap-1">
                {getRitmoIcon()}
                {getRitmoText()}
              </span>
            </div>
            <div className="relative">
              <Progress value={Math.min(100, percentualAtingido)} className="h-4" />
              <div 
                className={`absolute top-0 left-0 h-4 rounded-full transition-all ${getProgressColor()}`}
                style={{ width: `${Math.min(100, percentualAtingido)}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-foreground">
                {percentualAtingido.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Projeção de fechamento: <span className={projecaoFechamento >= metaValor ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
                  {formatCurrency(projecaoFechamento)}
                </span>
              </span>
              <span className="text-muted-foreground">
                {diasPassados} de {totalDiasMes} dias
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Já Recebido</p>
                <p className="text-xl font-bold text-green-500">{formatCurrency(totalRecebido)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Falta Receber</p>
                <p className="text-xl font-bold text-red-500">{formatCurrency(valorFaltante)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dias Restantes</p>
                <p className="text-xl font-bold text-blue-500">{diasRestantes} dias</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Target className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Necessário/Dia</p>
                <p className="text-xl font-bold text-purple-500">{formatCurrency(valorPorDia)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico e Ranking lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Evolução */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Evolução Diária
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ChartContainer
                config={{
                  acumulado: { label: 'Recebido', color: 'hsl(var(--primary))' },
                  metaIdeal: { label: 'Meta Ideal', color: 'hsl(var(--muted-foreground))' },
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolucaoDiaria}>
                    <XAxis 
                      dataKey="dia" 
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="metaIdeal" 
                      stroke="hsl(var(--muted-foreground))" 
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="acumulado" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
            <div className="flex justify-center gap-6 mt-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-primary" />
                <span className="text-muted-foreground">Recebido</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-muted-foreground border-dashed border-t-2" />
                <span className="text-muted-foreground">Meta Ideal</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ranking */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Ranking do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {funcionarios.map((func, index) => (
                <div 
                  key={func.userId} 
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    index < 3 ? 'bg-primary/5' : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg w-8">{getMedalIcon(index)}</span>
                    <div>
                      <p className="font-medium text-sm truncate max-w-[150px]">{func.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {func.percentualEquipe.toFixed(1)}% da equipe
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-green-500">
                      {formatCurrency(func.totalRecebido)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desempenho por Funcionário */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Desempenho Individual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {funcionarios.map((func) => {
              const percentualMeta = (func.totalRecebido / func.metaIndividual) * 100;
              return (
                <div key={func.userId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{func.nome}</span>
                    <span className="text-sm text-muted-foreground">
                      Meta: {formatCurrency(func.metaIndividual)}
                    </span>
                  </div>
                  <div className="relative">
                    <Progress value={Math.min(100, percentualMeta)} className="h-2" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Recebido: </span>
                      <span className="font-medium text-green-500">{formatCurrency(func.totalRecebido)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Falta: </span>
                      <span className="font-medium text-red-500">{formatCurrency(func.faltante)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Por dia: </span>
                      <span className="font-medium text-purple-500">{formatCurrency(func.porDia)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
