import { useEffect, useState } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatarMoeda, formatarData, calcularPercentualComissaoEmpresa, calcularComissaoParcelaPorEmpresa } from '@/lib/comissao';
import { getEmpresaLabel } from '@/lib/empresaLabels';
import { Search, FileText, Users, DollarSign, Clock, Building2, Eye, EyeOff, Download, MessageCircle, AlertTriangle, Calendar as CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { exportarParaExcel } from '@/lib/exportExcel';
import { useToast } from '@/hooks/use-toast';
import { DateRangePicker } from '@/components/DateRangePicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
interface AcordoComFuncionario {
  id: string;
  cliente_nome: string;
  cliente_cpf?: string;
  cliente_telefone?: string;
  valor_total: number;
  valor_parcela: number;
  parcelas: number;
  dias_atraso: number;
  comissao_total: number;
  status: string;
  criado_em: string;
  user_id: string;
  funcionario_nome?: string;
  empresa?: string;
}

interface TeamMember {
  funcionario_id: string;
  nome: string;
  email: string;
}

export default function EquipeAcordos() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { acordosCompartilhados, isLoading: permLoading } = useUserPermissions();
  const verComoAdmin = isAdmin || acordosCompartilhados;
  const { toast } = useToast();
  // Persistência de filtros (sessionStorage)
  const FILTERS_KEY = 'equipe-acordos:filters:v1';
  const loadFilters = (): any => {
    try {
      const raw = sessionStorage.getItem(FILTERS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  };
  const initial = loadFilters();
  const parseDate = (v: any): Date | undefined => {
    if (!v) return undefined;
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d;
  };

  const [acordos, setAcordos] = useState<AcordoComFuncionario[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState<string>(initial.search ?? '');
  const [statusFilter, setStatusFilter] = useState<string>(initial.statusFilter ?? 'todos');
  const [memberFilter, setMemberFilter] = useState<string>(initial.memberFilter ?? 'todos');
  const [showEmpresaCards, setShowEmpresaCards] = useState<boolean>(initial.showEmpresaCards ?? false);
  const [startDate, setStartDate] = useState<Date | undefined>(parseDate(initial.startDate));
  const [endDate, setEndDate] = useState<Date | undefined>(parseDate(initial.endDate));
  const [pagamentosEquipe, setPagamentosEquipe] = useState<Array<{
    comissao_parcela: number;
    valor_parcela: number;
    acordo_id: string;
    data_paga: string | null;
    data_prevista: string | null;
    numero_parcela: number;
  }>>([]);
  const [enviandoRelatorio, setEnviandoRelatorio] = useState(false);
  const [acordosComQuebraAcordo, setAcordosComQuebraAcordo] = useState<Set<string>>(new Set());
  const [viewFilter, setViewFilter] = useState<'todos' | 'com_pagos' | 'quebra_acordo'>(initial.viewFilter ?? 'todos');
  const [filtroDataVencimento, setFiltroDataVencimento] = useState<Date | undefined>(parseDate(initial.filtroDataVencimento));
  const [todasDatasPorAcordo, setTodasDatasPorAcordo] = useState<Map<string, string[]>>(new Map());

  // Salvar filtros sempre que mudarem
  useEffect(() => {
    try {
      sessionStorage.setItem(FILTERS_KEY, JSON.stringify({
        search, statusFilter, memberFilter, showEmpresaCards, viewFilter,
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
        filtroDataVencimento: filtroDataVencimento ? filtroDataVencimento.toISOString() : null,
      }));
    } catch {}
  }, [search, statusFilter, memberFilter, showEmpresaCards, viewFilter, startDate, endDate, filtroDataVencimento]);

  // Restaurar / salvar scroll
  useEffect(() => {
    if (loading) return;
    const y = Number(sessionStorage.getItem('equipe-acordos:scrollY') || '0');
    if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
  }, [loading]);
  useEffect(() => {
    const save = () => sessionStorage.setItem('equipe-acordos:scrollY', String(window.scrollY));
    window.addEventListener('beforeunload', save);
    return () => { save(); window.removeEventListener('beforeunload', save); };
  }, []);


  const handleEnviarRelatorio = async () => {
    try {
      setEnviandoRelatorio(true);
      
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke('daily-report-whatsapp', {
        body: { user_id: currentUser?.id }
      });
      
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

  // Helpers de data local YYYY-MM-DD
  const startLocalStr = startDate
    ? `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
    : null;
  const endLocalStr = endDate
    ? `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
    : null;

  const dataNoPeriodo = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    const d = dateStr.split('T')[0];
    if (startLocalStr && d < startLocalStr) return false;
    if (endLocalStr && d > endLocalStr) return false;
    return true;
  };

  // Filtrar pagamentos pagos por data de PAGAMENTO (data_paga) da parcela.
  // Se não há filtro de data, incluir TODOS os pagamentos pagos.
  const pagamentosFiltradosPorPeriodo = (startDate || endDate)
    ? pagamentosEquipe.filter(pag => pag.status === 'pago' && dataNoPeriodo(pag.data_paga))
    : pagamentosEquipe;

  // IDs de acordos que possuem pelo menos uma parcela paga
  const acordosComParcelasPagas = new Set(
    pagamentosEquipe.map(p => p.acordo_id)
  );

  // Mapa: acordo_id -> última parcela paga (maior numero_parcela)
  const ultimaParcelaPagaPorAcordo = new Map<string, { numero: number; data_paga: string }>();
  pagamentosEquipe.forEach(p => {
    if (p.numero_parcela == null || !p.data_paga) return;
    const atual = ultimaParcelaPagaPorAcordo.get(p.acordo_id);
    if (!atual || p.numero_parcela > atual.numero) {
      ultimaParcelaPagaPorAcordo.set(p.acordo_id, { numero: p.numero_parcela, data_paga: p.data_paga });
    }
  });

  // IDs de acordos que possuem pelo menos uma parcela paga
  // dentro do período filtrado (por data de pagamento).
  const acordosComPagamentoNoPeriodo = new Set<string>(
    pagamentosFiltradosPorPeriodo.map(p => p.acordo_id)
  );

  const handleExportar = (acordosParaExportar: AcordoComFuncionario[]) => {
    if (acordosParaExportar.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum acordo encontrado',
        description: 'Não há acordos para exportar com os filtros atuais.',
      });
      return;
    }

    // Criar mapa de acordos para busca rápida
    const acordosMap = new Map(acordosParaExportar.map(a => [a.id, a]));
    
    // Filtrar pagamentos que pertencem aos acordos filtrados e estão no período
    const pagamentosDosAcordos = pagamentosFiltradosPorPeriodo.filter(
      pag => acordosMap.has(pag.acordo_id)
    );
    
    // Gerar linhas de exportação: uma linha por parcela paga
    const dadosExportParcelas = pagamentosDosAcordos.map(pag => {
      const acordo = acordosMap.get(pag.acordo_id)!;
      const percentualEmpresa = calcularPercentualComissaoEmpresa(acordo.dias_atraso);
      const comissaoEscritorio = Number(pag.valor_parcela) * percentualEmpresa / 100;

      // Recálculo de comissão do funcionário conforme nova regra (apenas admin)
      // - UME | INADIMPLENTES (ume_novo_mundo): 35% fixo
      // - UME | APORTE (mundo_da_moda): tabela de Honorário por faixa de atraso
      let comissaoFuncionario: number = Number(pag.comissao_parcela) || 0;
      if (isAdmin) {
        const recalc = calcularComissaoParcelaPorEmpresa(
          acordo.empresa,
          Number(pag.valor_parcela) || 0,
          acordo.dias_atraso,
        );
        comissaoFuncionario = recalc.valor;
      }

      return {
        cpf: acordo.cliente_cpf || '',
        cliente: acordo.cliente_nome,
        funcionario: acordo.funcionario_nome || '',
        empresa: getEmpresaLabel(acordo.empresa),
        parcela: `${pag.numero_parcela}/${acordo.parcelas}`,
        valor_parcela: pag.valor_parcela,
        data_pagamento: pag.data_paga ? formatarData(pag.data_paga) : '',
        comissao_funcionario: comissaoFuncionario,
        comissao_escritorio: Math.round(comissaoEscritorio * 100) / 100,
        valor_total_acordo: acordo.valor_total,
        dias_atraso: acordo.dias_atraso,
        status_acordo: getStatusLabel(acordo.status),
      };
    });

    // Se não houver parcelas pagas, exportar acordos normalmente
    if (dadosExportParcelas.length === 0) {
      const dadosAcordos = acordosParaExportar.map(acordo => ({
        cpf: acordo.cliente_cpf || '',
        cliente: acordo.cliente_nome,
        funcionario: acordo.funcionario_nome || '',
        empresa: getEmpresaLabel(acordo.empresa),
        valor_total: acordo.valor_total,
        parcelas: acordo.parcelas,
        valor_parcela: acordo.valor_parcela,
        dias_atraso: acordo.dias_atraso,
        status: getStatusLabel(acordo.status),
        criado_em: formatarData(acordo.criado_em),
      }));

      const colunasAcordos = [
        { chave: 'cpf' as const, titulo: 'CPF' },
        { chave: 'cliente' as const, titulo: 'Cliente' },
        { chave: 'funcionario' as const, titulo: 'Funcionário' },
        { chave: 'empresa' as const, titulo: 'Empresa' },
        { chave: 'valor_total' as const, titulo: 'Valor Total' },
        { chave: 'parcelas' as const, titulo: 'Parcelas' },
        { chave: 'valor_parcela' as const, titulo: 'Valor Parcela' },
        { chave: 'dias_atraso' as const, titulo: 'Dias Atraso' },
        { chave: 'status' as const, titulo: 'Status' },
        { chave: 'criado_em' as const, titulo: 'Criado em' },
      ];

      exportarParaExcel(dadosAcordos, colunasAcordos, 'acordos-equipe');
      toast({
        title: 'Download iniciado!',
        description: `Exportando ${dadosAcordos.length} acordo(s) (sem parcelas pagas no período).`,
      });
      return;
    }

    const colunasParcelas = [
      { chave: 'cpf' as const, titulo: 'CPF' },
      { chave: 'cliente' as const, titulo: 'Cliente' },
      { chave: 'funcionario' as const, titulo: 'Funcionário' },
      { chave: 'empresa' as const, titulo: 'Empresa' },
      { chave: 'parcela' as const, titulo: 'Parcela' },
      { chave: 'valor_parcela' as const, titulo: 'Valor Parcela' },
      { chave: 'data_pagamento' as const, titulo: 'Data Pagamento' },
      { chave: 'comissao_funcionario' as const, titulo: isAdmin ? 'Comissão Funcionário (Recalc.)' : 'Comissão Funcionário' },
      { chave: 'comissao_escritorio' as const, titulo: 'Comissão Escritório' },
      { chave: 'valor_total_acordo' as const, titulo: 'Valor Total Acordo' },
      { chave: 'dias_atraso' as const, titulo: 'Dias Atraso' },
      { chave: 'status_acordo' as const, titulo: 'Status Acordo' },
    ];

    exportarParaExcel(dadosExportParcelas, colunasParcelas, 'parcelas-pagas-equipe');

    toast({
      title: 'Download iniciado!',
      description: `Exportando ${dadosExportParcelas.length} parcela(s) paga(s).`,
    });
  };

  useEffect(() => {
    async function loadTeamData() {
      if (!user || roleLoading || permLoading) return;

      try {
        let funcionarioIds: string[] = [];
        let validMembers: TeamMember[] = [];

        if (verComoAdmin) {
          // Admin (ou funcionário com Acordos Compartilhados) vê TODOS os acordos do sistema
          const { data: allProfiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, nome, email');

          if (profilesError) throw profilesError;

          validMembers = (allProfiles || []).map(p => ({
            funcionario_id: p.id,
            nome: p.nome,
            email: p.email
          }));

          funcionarioIds = validMembers.map(m => m.funcionario_id);
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

        // Buscar acordos de todos os funcionários (paginado para evitar limite de 1000)
        let allAcordos: any[] = [];
        const PAGE_SIZE = 1000;
        let from = 0;
        let hasMore = true;
        
        while (hasMore) {
          const { data: batch, error: batchError } = await supabase
            .from('acordos')
            .select('*')
            .in('user_id', funcionarioIds)
            .order('criado_em', { ascending: false })
            .range(from, from + PAGE_SIZE - 1);

          if (batchError) throw batchError;
          
          if (batch && batch.length > 0) {
            allAcordos = [...allAcordos, ...batch];
            from += PAGE_SIZE;
            hasMore = batch.length === PAGE_SIZE;
          } else {
            hasMore = false;
          }
        }

        const acordosData = allAcordos;

        // Mapear acordos com nomes dos funcionários
        const acordosComNome = (acordosData || []).map(acordo => {
          const member = validMembers.find(m => m.funcionario_id === acordo.user_id);
          return {
            ...acordo,
            funcionario_nome: member?.nome || 'Desconhecido'
          };
        });

        setAcordos(acordosComNome);

        // Buscar pagamentos pagos via join com acordos (evita URL longa com muitos IDs)
        if (funcionarioIds.length > 0) {
          const { data: pagamentosPagos, error: pagamentosError } = await supabase
            .from('pagamentos')
            .select('comissao_parcela, valor_parcela, acordo_id, data_paga, data_prevista, numero_parcela, acordos!inner(user_id)')
            .in('acordos.user_id', funcionarioIds)
            .eq('status', 'pago')
            .range(0, 9999);

          if (pagamentosError) {
            console.error('Erro ao buscar pagamentos pagos:', pagamentosError);
            toast({
              variant: 'destructive',
              title: 'Erro ao carregar pagamentos',
              description: 'Não foi possível carregar os pagamentos pagos. Tente novamente.',
            });
          } else if (pagamentosPagos) {
            // Normalizar dados removendo o objeto acordos aninhado
            const pagamentosNormalizados = pagamentosPagos.map(p => ({
              comissao_parcela: p.comissao_parcela,
              valor_parcela: p.valor_parcela,
              acordo_id: p.acordo_id,
              data_paga: p.data_paga,
              data_prevista: p.data_prevista,
              numero_parcela: p.numero_parcela,
            }));
            setPagamentosEquipe(pagamentosNormalizados);
          }

          // Buscar IDs de acordos com QUEBRA DE ACORDO via join
          const { data: todasParcelasPendentes, error: quebraError } = await supabase
            .from('pagamentos')
            .select('acordo_id, data_prevista, acordos!inner(user_id)')
            .in('acordos.user_id', funcionarioIds)
            .eq('status', 'pendente')
            .range(0, 9999);
          
          if (quebraError) {
            console.error('Erro ao buscar parcelas pendentes:', quebraError);
          } else if (todasParcelasPendentes) {
            const hoje = new Date();
            const dezDiasAtras = new Date(hoje);
            dezDiasAtras.setDate(dezDiasAtras.getDate() - 10);
            const dezDiasAtrasStr = dezDiasAtras.toISOString().split('T')[0];
            
            // Acordos com status 'quebrado' já são quebra de acordo
            const idsComQuebra = new Set<string>();
            (acordosData || []).forEach(a => {
              if (a.status === 'quebrado') {
                idsComQuebra.add(a.id);
              }
            });
            
            // Agrupar por acordo_id e pegar a MAX data_prevista de cada (para quebra)
            // E também construir mapa com TODAS as datas (pendentes + pagas) para filtro
            const ultimaParcelaPorAcordo = new Map<string, string>();
            const allDatesMap = new Map<string, string[]>();
            todasParcelasPendentes.forEach(p => {
              const atual = ultimaParcelaPorAcordo.get(p.acordo_id);
              if (!atual || p.data_prevista > atual) {
                ultimaParcelaPorAcordo.set(p.acordo_id, p.data_prevista);
              }
              const arr = allDatesMap.get(p.acordo_id) || [];
              arr.push(p.data_prevista);
              allDatesMap.set(p.acordo_id, arr);
            });
            // Incluir datas das parcelas pagas
            (pagamentosPagos || []).forEach((p: any) => {
              if (!p.data_prevista) return;
              const arr = allDatesMap.get(p.acordo_id) || [];
              arr.push(p.data_prevista);
              allDatesMap.set(p.acordo_id, arr);
            });
            setTodasDatasPorAcordo(allDatesMap);
            
            // Filtrar acordos cuja última parcela pendente está vencida há mais de 10 dias
            ultimaParcelaPorAcordo.forEach((ultimaData, acordoId) => {
              if (ultimaData < dezDiasAtrasStr) {
                idsComQuebra.add(acordoId);
              }
            });
            setAcordosComQuebraAcordo(idsComQuebra);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados da equipe:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTeamData();
  }, [user, isAdmin, roleLoading, permLoading, verComoAdmin]);

  const filteredAcordos = acordos.filter(acordo => {
    const termo = search.trim().toLowerCase();
    const digitos = search.replace(/\D/g, '');
    const nome = acordo.cliente_nome?.trim().toLowerCase() ?? '';
    const funcionario = acordo.funcionario_nome?.trim().toLowerCase() ?? '';
    const cpfDigits = acordo.cliente_cpf?.replace(/\D/g, '') ?? '';
    const telDigits = acordo.cliente_telefone?.replace(/\D/g, '') ?? '';
    const matchesSearch =
      !termo ||
      nome.includes(termo) ||
      funcionario.includes(termo) ||
      (digitos.length >= 3 && (cpfDigits.includes(digitos) || telDigits.includes(digitos)));
    let matchesStatus: boolean;
    if (statusFilter === 'todos') {
      matchesStatus = true;
    } else if (statusFilter === 'duplicados') {
      const c = (acordo.cliente_cpf || '').replace(/\D/g, '');
      matchesStatus = c.length === 11 && cpfDuplicadosMap.has(c);
    } else {
      matchesStatus = acordo.status === statusFilter;
    }
    const matchesMember = memberFilter === 'todos' || acordo.user_id === memberFilter;
    
    // Filtro por data de pagamento das parcelas
    let matchesDate = true;
    if (startDate || endDate) {
      // Se há filtro de data, incluir apenas acordos que possuem
      // pelo menos uma parcela paga dentro do período
      matchesDate = acordosComPagamentoNoPeriodo.has(acordo.id);
    }

    // Filtro de visualização (todos vs com parcelas pagas)
    const matchesViewFilter = 
      viewFilter === 'todos' || 
      (viewFilter === 'com_pagos' && acordosComParcelasPagas.has(acordo.id)) ||
      (viewFilter === 'quebra_acordo' && acordosComQuebraAcordo.has(acordo.id));
    
    // Filtro por data de vencimento de boleto
    let matchesVencimento = true;
    if (filtroDataVencimento) {
      const datas = todasDatasPorAcordo.get(acordo.id) || [];
      const selectedStr = format(filtroDataVencimento, 'yyyy-MM-dd');
      matchesVencimento = datas.some(d => d === selectedStr);
    }
    
    return matchesSearch && matchesStatus && matchesMember && matchesDate && matchesViewFilter && matchesVencimento;
  });

  // Mapa: cpf normalizado -> lista de acordos com esse CPF (apenas duplicados)
  const cpfDuplicadosMap = (() => {
    const map = new Map<string, AcordoComFuncionario[]>();
    acordos.forEach(a => {
      const c = (a.cliente_cpf || '').replace(/\D/g, '');
      if (c.length === 11) {
        if (!map.has(c)) map.set(c, []);
        map.get(c)!.push(a);
      }
    });
    const dup = new Map<string, AcordoComFuncionario[]>();
    map.forEach((arr, k) => { if (arr.length > 1) dup.set(k, arr); });
    return dup;
  })();

  const getCpfDuplicadoOutros = (acordo: AcordoComFuncionario) => {
    const c = (acordo.cliente_cpf || '').replace(/\D/g, '');
    if (c.length !== 11) return [];
    const lista = cpfDuplicadosMap.get(c);
    if (!lista) return [];
    return lista.filter(a => a.id !== acordo.id).map(a => ({ id: a.id, cliente_nome: a.cliente_nome }));
  };

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
      case 'quebrado': return 'Quebrado';
      default: return status;
    }
  };

  // Calcular estatísticas baseadas nos acordos filtrados
  const totalAcordos = filteredAcordos.length;
  const acordosAtivos = filteredAcordos.filter(a => a.status === 'ativo').length;

  // Calcular soma das parcelas pagas no período (usando pagamentosFiltradosPorPeriodo)
  const totalParcelasPagasPeriodo = pagamentosFiltradosPorPeriodo.reduce(
    (sum, p) => sum + Number(p.valor_parcela), 
    0
  );

  // Calcular comissão empresa baseada no período
  const comissaoEmpresaPagaPeriodo = pagamentosFiltradosPorPeriodo.reduce((sum, pag) => {
    const acordo = acordos.find(a => a.id === pag.acordo_id);
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
          <div className="flex flex-wrap gap-2">
            <Button
              variant={viewFilter === 'todos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewFilter('todos')}
            >
              Todos os Acordos
            </Button>
            <Button
              variant={viewFilter === 'com_pagos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewFilter('com_pagos')}
            >
              Com Parcelas Pagas
            </Button>
            <Button
              variant={viewFilter === 'quebra_acordo' ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setViewFilter('quebra_acordo')}
            >
              Quebra de Acordo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportar(filteredAcordos)}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar
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
        <div className={`grid gap-4 md:grid-cols-2 ${isAdmin && showEmpresaCards ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
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
                Total Parcelas Pagas
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className={`${isAdmin && showEmpresaCards ? 'text-lg' : 'text-2xl'} font-bold text-green-500`}>
                {formatarMoeda(totalParcelasPagasPeriodo)}
              </div>
            </CardContent>
          </Card>

          {isAdmin && showEmpresaCards && (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Empresa (Paga)
                </CardTitle>
                <Building2 className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-blue-500">
                  {formatarMoeda(comissaoEmpresaPagaPeriodo)}
                </div>
              </CardContent>
            </Card>
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
            {/* Filtro: Data de Vencimento do Boleto */}
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[210px] justify-start text-left font-normal",
                      !filtroDataVencimento && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filtroDataVencimento ? `Vencimento: ${format(filtroDataVencimento, "dd/MM/yyyy")}` : "Filtrar por vencimento"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filtroDataVencimento}
                    onSelect={setFiltroDataVencimento}
                    locale={ptBR}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {filtroDataVencimento && (
                <Button variant="ghost" size="icon" onClick={() => setFiltroDataVencimento(undefined)} title="Limpar filtro de vencimento">
                  <X className="h-4 w-4" />
                </Button>
              )}
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
              <SelectItem value="quebrado">Quebrados</SelectItem>
              <SelectItem value="duplicados">Duplicados (CPF)</SelectItem>
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
                          <h3 className="font-semibold flex items-center gap-1 flex-wrap">
                            {acordo.cliente_nome}
                            <CopyButton value={acordo.cliente_nome} label="Nome" preserveText />
                            {(() => {
                              const outros = getCpfDuplicadoOutros(acordo);
                              if (outros.length === 0) return null;
                              return (
                                <TooltipProvider delayDuration={150}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className="border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/30 gap-1 cursor-help"
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                      >
                                        <AlertTriangle className="h-3 w-3" />
                                        CPF já lançado em outro acordo ({outros.length + 1}x)
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <p className="font-semibold mb-1">Outros acordos com este CPF:</p>
                                      <ul className="text-xs space-y-0.5">
                                        {outros.slice(0, 5).map(o => (
                                          <li key={o.id}>• {o.cliente_nome}</li>
                                        ))}
                                        {outros.length > 5 && (
                                          <li className="italic">+ {outros.length - 5} outro(s)</li>
                                        )}
                                      </ul>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                          </h3>
                          <p className="text-sm text-primary font-medium">
                            {acordo.funcionario_nome}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {acordo.parcelas}x de {formatarMoeda(acordo.valor_parcela)} • {acordo.dias_atraso} dias em atraso
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Criado em {formatarData(acordo.criado_em)}
                          </p>
                          {(() => {
                            const ultima = ultimaParcelaPagaPorAcordo.get(acordo.id);
                            return ultima ? (
                              <p className="text-xs text-secondary mt-1">
                                Última parcela paga: Parcela {ultima.numero} em {formatarData(ultima.data_paga)}
                              </p>
                            ) : null;
                          })()}
                        </div>
                      </div>
                      <div className="flex flex-col sm:items-end gap-2">
                        <div className="flex flex-wrap gap-2">
                          {acordosComQuebraAcordo.has(acordo.id) && (
                            <Badge variant="destructive" className="bg-red-600 text-white font-bold">
                              QUEBRA DE ACORDO
                            </Badge>
                          )}
                          <Badge variant={getStatusVariant(acordo.status)}>
                            {getStatusLabel(acordo.status)}
                          </Badge>
                        </div>
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
