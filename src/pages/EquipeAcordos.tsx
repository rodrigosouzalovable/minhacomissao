import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatarMoeda, formatarData, calcularPercentualComissaoEmpresa } from '@/lib/comissao';
import { Search, FileText, Users, DollarSign, Clock, Building2, Eye, EyeOff, Download, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportarParaExcel } from '@/lib/exportExcel';
import { useToast } from '@/hooks/use-toast';
import { DateRangePicker } from '@/components/DateRangePicker';
interface AcordoComFuncionario {
  id: string;
  cliente_nome: string;
  cliente_cpf?: string;
  valor_total: number;
  valor_parcela: number;
  parcelas: number;
  dias_atraso: number;
  comissao_total: number;
  status: string;
  criado_em: string;
  user_id: string;
  funcionario_nome?: string;
}

interface TeamMember {
  funcionario_id: string;
  nome: string;
  email: string;
}

export default function EquipeAcordos() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const [acordos, setAcordos] = useState<AcordoComFuncionario[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [memberFilter, setMemberFilter] = useState<string>('todos');
  const [showEmpresaCards, setShowEmpresaCards] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [pagamentosEquipe, setPagamentosEquipe] = useState<Array<{
    comissao_parcela: number;
    valor_parcela: number;
    acordo_id: string;
  }>>([]);
  const [enviandoRelatorio, setEnviandoRelatorio] = useState(false);

  const handleEnviarRelatorio = async () => {
    try {
      setEnviandoRelatorio(true);
      
      const { data, error } = await supabase.functions.invoke('daily-report-whatsapp');
      
      if (error) throw error;
      
      if (data?.success) {
        toast({
          title: 'Relatório enviado!',
          description: 'O relatório diário foi enviado para o WhatsApp.',
        });
      } else {
        throw new Error(data?.error || 'Erro ao enviar relatório');
      }
    } catch (error) {
      console.error('Erro ao enviar relatório:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar',
        description: error instanceof Error ? error.message : 'Não foi possível enviar o relatório.',
      });
    } finally {
      setEnviandoRelatorio(false);
    }
  };

  const handleExportarAcordosPagos = async () => {
    try {
      const acordoIds = filteredAcordos.map(a => a.id);
      
      if (acordoIds.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nenhum acordo encontrado',
          description: 'Não há acordos no período selecionado para exportar.',
        });
        return;
      }

      // Buscar TODAS as parcelas pagas
      const { data: parcelasPagas, error } = await supabase
        .from('pagamentos')
        .select('numero_parcela, valor_parcela, comissao_parcela, acordo_id')
        .in('acordo_id', acordoIds)
        .eq('status', 'pago');

      if (error) throw error;

      if (!parcelasPagas || parcelasPagas.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nenhuma parcela paga',
          description: 'Não há parcelas pagas para exportar.',
        });
        return;
      }

      // Combinar com dados do acordo e calcular comissão do escritório
      const dadosExport = parcelasPagas.map(parcela => {
        const acordo = acordos.find(a => a.id === parcela.acordo_id);
        const percentualEmpresa = calcularPercentualComissaoEmpresa(acordo?.dias_atraso || 0);
        const comissaoEscritorio = Number(parcela.valor_parcela) * percentualEmpresa / 100;

        return {
          cpf: acordo?.cliente_cpf || '',
          cliente: acordo?.cliente_nome || '',
          valor_total: acordo?.valor_total || 0,
          valor_parcela: parcela.valor_parcela,
          numero_parcela: parcela.numero_parcela,
          comissao_funcionario: parcela.comissao_parcela,
          comissao_escritorio: Math.round(comissaoEscritorio * 100) / 100,
          dias_atraso: acordo?.dias_atraso || 0,
        };
      });

      const colunas = [
        { chave: 'cpf' as const, titulo: 'CPF' },
        { chave: 'cliente' as const, titulo: 'Cliente' },
        { chave: 'valor_total' as const, titulo: 'Valor Total' },
        { chave: 'valor_parcela' as const, titulo: 'Valor Parcela' },
        { chave: 'numero_parcela' as const, titulo: 'Nº Parcela' },
        { chave: 'comissao_funcionario' as const, titulo: 'Comissão Funcionário' },
        { chave: 'comissao_escritorio' as const, titulo: 'Comissão Escritório' },
        { chave: 'dias_atraso' as const, titulo: 'Dias Atraso' },
      ];

      exportarParaExcel(dadosExport, colunas, 'parcelas-pagas-equipe');

      toast({
        title: 'Download iniciado!',
        description: `Exportando ${dadosExport.length} parcela(s) paga(s).`,
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao exportar',
        description: 'Ocorreu um erro ao gerar o arquivo.',
      });
    }
  };

  useEffect(() => {
    async function loadTeamData() {
      if (!user) return;

      try {
        let funcionarioIds: string[] = [];
        let validMembers: TeamMember[] = [];

        if (isAdmin) {
          // Admin vê todos os funcionários e seus acordos
          const { data: allRoles, error: rolesError } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'funcionario');

          if (rolesError) throw rolesError;

          funcionarioIds = (allRoles || []).map(r => r.user_id);

          if (funcionarioIds.length > 0) {
            const { data: profiles, error: profilesError } = await supabase
              .from('profiles')
              .select('id, nome, email');

            if (profilesError) throw profilesError;

            validMembers = (profiles || [])
              .filter(p => funcionarioIds.includes(p.id))
              .map(p => ({
                funcionario_id: p.id,
                nome: p.nome,
                email: p.email
              }));
          }
        } else {
          // Gestor vê apenas membros da sua equipe
          const { data: members, error: membersError } = await supabase
            .from('team_members')
            .select('funcionario_id')
            .eq('gestor_id', user.id);

          if (membersError) throw membersError;
          
          if (!members || members.length === 0) {
            setAcordos([]);
            setTeamMembers([]);
            setLoading(false);
            return;
          }

          funcionarioIds = members.map(m => m.funcionario_id);

          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, nome, email')
            .in('id', funcionarioIds);

          if (profilesError) throw profilesError;

          validMembers = (profiles || []).map(p => ({
            funcionario_id: p.id,
            nome: p.nome,
            email: p.email
          }));
        }

        setTeamMembers(validMembers);

        if (funcionarioIds.length === 0) {
          setAcordos([]);
          setLoading(false);
          return;
        }

        // Buscar acordos de todos os funcionários
        const { data: acordosData, error: acordosError } = await supabase
          .from('acordos')
          .select('*')
          .in('user_id', funcionarioIds)
          .order('criado_em', { ascending: false });

        if (acordosError) throw acordosError;

        // Mapear acordos com nomes dos funcionários
        const acordosComNome = (acordosData || []).map(acordo => {
          const member = validMembers.find(m => m.funcionario_id === acordo.user_id);
          return {
            ...acordo,
            funcionario_nome: member?.nome || 'Desconhecido'
          };
        });

        setAcordos(acordosComNome);

        // Buscar pagamentos pagos dos acordos da equipe
        const acordoIds = (acordosData || []).map(a => a.id);
        if (acordoIds.length > 0) {
          const { data: pagamentosPagos, error: pagamentosError } = await supabase
            .from('pagamentos')
            .select('comissao_parcela, valor_parcela, acordo_id')
            .in('acordo_id', acordoIds)
            .eq('status', 'pago');

          if (!pagamentosError && pagamentosPagos) {
            setPagamentosEquipe(pagamentosPagos);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados da equipe:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTeamData();
  }, [user, isAdmin]);

  const filteredAcordos = acordos.filter(acordo => {
    const matchesSearch = 
      acordo.cliente_nome.toLowerCase().includes(search.toLowerCase()) ||
      acordo.funcionario_nome?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || acordo.status === statusFilter;
    const matchesMember = memberFilter === 'todos' || acordo.user_id === memberFilter;
    
    // Filtro por data de criação
    let matchesDate = true;
    if (startDate || endDate) {
      const acordoDate = new Date(acordo.criado_em);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && acordoDate >= start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && acordoDate <= end;
      }
    }
    
    return matchesSearch && matchesStatus && matchesMember && matchesDate;
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ativo': return 'default';
      case 'concluido': return 'secondary';
      case 'cancelado': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ativo': return 'Ativo';
      case 'concluido': return 'Concluído';
      case 'cancelado': return 'Cancelado';
      default: return status;
    }
  };

  // Calcular estatísticas baseadas nos acordos filtrados
  const totalAcordos = filteredAcordos.length;
  const acordosAtivos = filteredAcordos.filter(a => a.status === 'ativo').length;
  const comissaoTotal = filteredAcordos.reduce((sum, a) => sum + Number(a.comissao_total), 0);

  // Calcular comissões filtradas dinamicamente
  const filteredAcordoIds = filteredAcordos.map(a => a.id);

  const comissaoPaga = pagamentosEquipe
    .filter(p => filteredAcordoIds.includes(p.acordo_id))
    .reduce((sum, p) => sum + Number(p.comissao_parcela), 0);

  const comissaoEmpresaTotal = filteredAcordos.reduce((sum, acordo) => {
    const percentualEmpresa = calcularPercentualComissaoEmpresa(acordo.dias_atraso);
    return sum + (Number(acordo.valor_total) * percentualEmpresa / 100);
  }, 0);

  const comissaoEmpresaPaga = pagamentosEquipe
    .filter(p => filteredAcordoIds.includes(p.acordo_id))
    .reduce((sum, pag) => {
      const acordo = filteredAcordos.find(a => a.id === pag.acordo_id);
      if (acordo) {
        const percentualEmpresa = calcularPercentualComissaoEmpresa(acordo.dias_atraso);
        return sum + (Number(pag.valor_parcela) * percentualEmpresa / 100);
      }
      return sum;
    }, 0);

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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Acordos da Equipe</h1>
            <p className="text-muted-foreground">
              {teamMembers.length} funcionário(s) na sua equipe
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportarAcordosPagos}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar Pagos
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnviarRelatorio}
                disabled={enviandoRelatorio}
                className="gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                {enviandoRelatorio ? 'Enviando...' : 'Enviar Relatório'}
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmpresaCards(!showEmpresaCards)}
                className="gap-2"
              >
                {showEmpresaCards ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showEmpresaCards ? 'Ocultar Empresa' : 'Ver Empresa'}
              </Button>
            )}
          </div>
        </div>

        {/* Cards de resumo */}
        <div className={`grid gap-4 md:grid-cols-2 ${isAdmin && showEmpresaCards ? 'lg:grid-cols-7' : 'lg:grid-cols-5'}`}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Membros da Equipe
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teamMembers.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Acordos
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAcordos}</div>
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
              <div className="text-2xl font-bold">{acordosAtivos}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Comissão Total
              </CardTitle>
              <DollarSign className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className={`${isAdmin && showEmpresaCards ? 'text-lg' : 'text-2xl'} font-bold text-secondary`}>
                {formatarMoeda(comissaoTotal)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Comissões Pagas
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className={`${isAdmin && showEmpresaCards ? 'text-lg' : 'text-2xl'} font-bold text-green-500`}>
                {formatarMoeda(comissaoPaga)}
              </div>
            </CardContent>
          </Card>

          {isAdmin && showEmpresaCards && (
            <>
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    Empresa (Total)
                  </CardTitle>
                  <Building2 className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold text-blue-500">
                    {formatarMoeda(comissaoEmpresaTotal)}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    Empresa (Paga)
                  </CardTitle>
                  <Building2 className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold text-emerald-500">
                    {formatarMoeda(comissaoEmpresaPaga)}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-col gap-4">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou funcionário..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          <Select value={memberFilter} onValueChange={setMemberFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Funcionário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os funcionários</SelectItem>
              {teamMembers.map((member) => (
                <SelectItem key={member.funcionario_id} value={member.funcionario_id}>
                  {member.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="concluido">Concluídos</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
          </div>
        </div>

        {/* Lista de acordos */}
        {teamMembers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum funcionário na equipe</h3>
              <p className="text-muted-foreground text-center">
                Peça ao administrador para associar funcionários à sua equipe.
              </p>
            </CardContent>
          </Card>
        ) : filteredAcordos.length > 0 ? (
          <div className="grid gap-4">
            {filteredAcordos.map((acordo) => (
              <Link key={acordo.id} to={`/acordos/${acordo.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{acordo.cliente_nome}</h3>
                          <p className="text-sm text-primary font-medium">
                            {acordo.funcionario_nome}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {acordo.parcelas}x de {formatarMoeda(acordo.valor_parcela)} • {acordo.dias_atraso} dias em atraso
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Criado em {formatarData(acordo.criado_em)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:items-end gap-2">
                        <Badge variant={getStatusVariant(acordo.status)}>
                          {getStatusLabel(acordo.status)}
                        </Badge>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Valor Total</p>
                          <p className="font-semibold">{formatarMoeda(acordo.valor_total)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Comissão</p>
                          <p className="font-semibold text-secondary">{formatarMoeda(acordo.comissao_total)}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum acordo encontrado</h3>
              <p className="text-muted-foreground text-center">
                {search || statusFilter !== 'todos' || memberFilter !== 'todos'
                  ? 'Tente ajustar os filtros'
                  : 'Sua equipe ainda não possui acordos cadastrados'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
