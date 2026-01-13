import { useEffect, useState, useCallback } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatarMoeda, formatarData } from '@/lib/comissao';
import { PlusCircle, Search, FileText, Trash2, Phone, User, Download, Clock, Send, MessageCircle, Loader2 } from 'lucide-react';
import { exportarParaExcel } from '@/lib/exportExcel';
import { Tables } from '@/integrations/supabase/types';

type Acordo = Tables<'acordos'>;

const gerarMensagemWhatsApp = (nomeCliente: string) => 
  `Olá tudo bem ${nomeCliente}? Meu nome é Rodrigo e sou do departamento de confirmação de acordos das Lojas Novo Mundo. Caso tenha alguma dúvida, temos também este canal para comunicação, ok? Salve nosso contato, por gentileza.`;

// Componente para exibir cada card de acordo
function AcordoCard({ 
  acordo, 
  onDelete,
  onEnviarWhatsApp,
  enviandoWhatsApp,
  getStatusVariant, 
  getStatusLabel,
  isNegociado = false,
  isVencido = false
}: { 
  acordo: Acordo;
  onDelete: () => void;
  onEnviarWhatsApp: (acordo: Acordo) => void;
  enviandoWhatsApp: string | null;
  getStatusVariant: (status: string) => "default" | "secondary" | "destructive" | "outline";
  getStatusLabel: (status: string) => string;
  isNegociado?: boolean;
  isVencido?: boolean;
}) {
  const isEnviando = enviandoWhatsApp === acordo.id;
  return (
    <Link to={`/acordos/${acordo.id}`}>
      <Card className={cn(
        "hover:border-primary/50 transition-all cursor-pointer",
        // VERMELHO - Parcela vencida (prioridade máxima)
        isNegociado && isVencido && 
          "border-destructive bg-gradient-to-r from-red-50 to-rose-50 ring-2 ring-destructive/60 shadow-lg shadow-red-200/50 animate-pulse dark:from-red-950/30 dark:to-rose-950/30 dark:border-destructive dark:ring-destructive/50 dark:shadow-red-500/20",
        // LARANJA - Aguardando boleto (apenas se não vencido)
        isNegociado && !isVencido && !acordo.boleto_enviado && 
          "border-orange-400 bg-gradient-to-r from-orange-50 to-amber-50 ring-2 ring-orange-300 shadow-lg shadow-orange-200/50 animate-pulse dark:from-orange-950/30 dark:to-amber-950/30 dark:border-orange-500 dark:ring-orange-400/50 dark:shadow-orange-500/20"
      )}>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{acordo.cliente_nome}</h3>
                {(acordo.cliente_cpf || acordo.cliente_telefone) && (
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
                    {acordo.cliente_cpf && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {acordo.cliente_cpf}
                        <CopyButton value={acordo.cliente_cpf} label="CPF" />
                      </span>
                    )}
                    {acordo.cliente_telefone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {acordo.cliente_telefone}
                        <CopyButton value={acordo.cliente_telefone} label="Telefone" />
                      </span>
                    )}
                  </div>
                )}
                <p className="text-sm text-muted-foreground mt-1">
                  {acordo.parcelas}x de {formatarMoeda(acordo.valor_parcela)} • {acordo.dias_atraso} dias em atraso
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Criado em {formatarData(acordo.criado_em)}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:items-end gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {/* Badge de Parcela Vencida - prioridade máxima */}
                {isNegociado && isVencido && (
                  <Badge 
                    variant="outline"
                    className="bg-destructive/20 text-destructive border-destructive/30"
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Parcela Vencida
                  </Badge>
                )}
                {/* Flag de status do boleto - apenas para acordos negociados não vencidos */}
                {isNegociado && !isVencido && (
                  <Badge 
                    variant="outline"
                    className={acordo.boleto_enviado 
                      ? "bg-secondary/20 text-secondary border-secondary/30" 
                      : "bg-warning/20 text-warning border-warning/30"
                    }
                  >
                    {acordo.boleto_enviado ? (
                      <>
                        <Send className="h-3 w-3 mr-1" />
                        Boleto Enviado
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3 mr-1" />
                        Aguardando envio do boleto
                      </>
                    )}
                  </Badge>
                )}
                <Badge variant={getStatusVariant(acordo.status)}>
                  {getStatusLabel(acordo.status)}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEnviarWhatsApp(acordo);
                  }}
                  disabled={isEnviando || !acordo.cliente_telefone}
                  title={acordo.cliente_telefone ? "Enviar WhatsApp" : "Telefone não cadastrado"}
                >
                  {isEnviando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageCircle className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
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
  );
}

// Componente para estado vazio
function EmptyState({ 
  search, 
  statusFilter, 
  message = "Nenhum acordo encontrado" 
}: { 
  search: string; 
  statusFilter: string; 
  message?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">{message}</h3>
        <p className="text-muted-foreground text-center mb-4">
          {search || statusFilter !== 'todos'
            ? 'Tente ajustar os filtros'
            : 'Comece cadastrando seu primeiro acordo'}
        </p>
        {!search && statusFilter === 'todos' && (
          <Button asChild>
            <Link to="/acordos/novo">
              <PlusCircle className="h-4 w-4 mr-2" />
              Novo Acordo
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function Acordos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [acordos, setAcordos] = useState<Acordo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [acordoParaExcluir, setAcordoParaExcluir] = useState<Acordo | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'pagos' | 'negociados' | 'proximas' | 'vencidos'>('negociados');
  const [acordosComPagamentosPagos, setAcordosComPagamentosPagos] = useState<Set<string>>(new Set());
  const [acordosComParcelasVencidas, setAcordosComParcelasVencidas] = useState<Set<string>>(new Set());
  const [acordosComParcelasProximas, setAcordosComParcelasProximas] = useState<Set<string>>(new Set());
  const [enviandoWhatsApp, setEnviandoWhatsApp] = useState<string | null>(null);

  const handleEnviarWhatsApp = useCallback(async (acordo: Acordo) => {
    if (!acordo.cliente_telefone) {
      toast({
        variant: 'destructive',
        title: 'Telefone não cadastrado',
        description: 'Este cliente não possui telefone cadastrado.',
      });
      return;
    }

    setEnviandoWhatsApp(acordo.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          telefone: acordo.cliente_telefone,
          mensagem: gerarMensagemWhatsApp(acordo.cliente_nome)
        }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao enviar mensagem');
      }

      toast({
        title: 'Mensagem enviada!',
        description: `WhatsApp enviado para ${acordo.cliente_nome}`,
      });
    } catch (error) {
      console.error('Erro ao enviar WhatsApp:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar a mensagem via WhatsApp.',
      });
    } finally {
      setEnviandoWhatsApp(null);
    }
  }, [toast]);

  useEffect(() => {
    async function loadAcordos() {
      if (!user) return;

      try {
        // Carregar acordos
        const { data: acordosData, error: acordosError } = await supabase
          .from('acordos')
          .select('*')
          .eq('user_id', user.id)
          .order('criado_em', { ascending: false });

        if (acordosError) throw acordosError;
        setAcordos(acordosData || []);

        // Carregar IDs de acordos que têm parcelas pagas
        const { data: pagamentosPagos, error: pagamentosError } = await supabase
          .from('pagamentos')
          .select('acordo_id')
          .eq('status', 'pago');

        if (pagamentosError) throw pagamentosError;
        
        const idsComPagamentos = new Set(pagamentosPagos?.map(p => p.acordo_id) || []);
        setAcordosComPagamentosPagos(idsComPagamentos);

        // Carregar IDs de acordos que têm parcelas vencidas (pendentes com data_prevista < hoje)
        const hoje = new Date();
        const hojeStr = hoje.toISOString().split('T')[0];
        const { data: pagamentosPendentes, error: pendentesError } = await supabase
          .from('pagamentos')
          .select('acordo_id, data_prevista')
          .eq('status', 'pendente')
          .lt('data_prevista', hojeStr);

        if (pendentesError) throw pendentesError;

        const idsComVencidas = new Set(pagamentosPendentes?.map(p => p.acordo_id) || []);
        setAcordosComParcelasVencidas(idsComVencidas);

        // Carregar IDs de acordos que têm parcelas próximas ao vencimento (hoje até +3 dias)
        const tresDias = new Date(hoje);
        tresDias.setDate(tresDias.getDate() + 3);
        const tresDiasStr = tresDias.toISOString().split('T')[0];

        const { data: parcelasProximas, error: proximasError } = await supabase
          .from('pagamentos')
          .select('acordo_id, data_prevista')
          .eq('status', 'pendente')
          .gte('data_prevista', hojeStr)
          .lte('data_prevista', tresDiasStr);

        if (proximasError) throw proximasError;

        const idsComProximas = new Set(parcelasProximas?.map(p => p.acordo_id) || []);
        setAcordosComParcelasProximas(idsComProximas);
      } catch (error) {
        console.error('Erro ao carregar acordos:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAcordos();
  }, [user]);

  const handleDelete = async (acordoId: string) => {
    try {
      // Primeiro, deletar os pagamentos associados
      const { error: pagamentosError } = await supabase
        .from('pagamentos')
        .delete()
        .eq('acordo_id', acordoId);

      if (pagamentosError) throw pagamentosError;

      // Depois, deletar o acordo
      const { error: acordoError } = await supabase
        .from('acordos')
        .delete()
        .eq('id', acordoId);

      if (acordoError) throw acordoError;

      // Atualizar lista local
      setAcordos(prev => prev.filter(a => a.id !== acordoId));

      toast({
        title: 'Acordo excluído',
        description: 'O acordo foi removido com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao excluir acordo:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o acordo.',
      });
    }
  };

  const handleExportarExcel = (acordosParaExportar: Acordo[]) => {
    const dadosParaExportar = acordosParaExportar.map(acordo => ({
      cliente_nome: acordo.cliente_nome,
      cliente_cpf: acordo.cliente_cpf || '-',
      cliente_telefone: acordo.cliente_telefone || '-',
      parcelas: acordo.parcelas,
      valor_parcela: acordo.valor_parcela,
      valor_total: acordo.valor_total,
      comissao_total: acordo.comissao_total,
      percentual_comissao: `${acordo.percentual_comissao}%`,
      dias_atraso: acordo.dias_atraso,
      status: getStatusLabel(acordo.status),
      data_primeiro_pagamento: formatarData(acordo.data_primeiro_pagamento),
      criado_em: formatarData(acordo.criado_em),
      observacoes: acordo.observacoes || '-'
    }));

    const colunas: { chave: keyof typeof dadosParaExportar[0]; titulo: string }[] = [
      { chave: 'cliente_nome', titulo: 'Cliente' },
      { chave: 'cliente_cpf', titulo: 'CPF' },
      { chave: 'cliente_telefone', titulo: 'Telefone' },
      { chave: 'parcelas', titulo: 'Parcelas' },
      { chave: 'valor_parcela', titulo: 'Valor Parcela (R$)' },
      { chave: 'valor_total', titulo: 'Valor Total (R$)' },
      { chave: 'comissao_total', titulo: 'Comissão Total (R$)' },
      { chave: 'percentual_comissao', titulo: '% Comissão' },
      { chave: 'dias_atraso', titulo: 'Dias em Atraso' },
      { chave: 'status', titulo: 'Status' },
      { chave: 'data_primeiro_pagamento', titulo: 'Primeiro Pagamento' },
      { chave: 'criado_em', titulo: 'Data Criação' },
      { chave: 'observacoes', titulo: 'Observações' }
    ];

    const nomeArquivo = 
      abaAtiva === 'pagos' ? 'acordos_pagos' : 
      abaAtiva === 'proximas' ? 'parcelas_proximas_vencimento' :
      abaAtiva === 'vencidos' ? 'parcelas_vencidas' : 
      'acordos_negociados';
    exportarParaExcel(dadosParaExportar, colunas, nomeArquivo);

    toast({
      title: 'Exportação concluída',
      description: `${acordosParaExportar.length} acordo(s) exportado(s) para Excel.`,
    });
  };

  const filteredAcordos = acordos.filter(acordo => {
    const matchesSearch = acordo.cliente_nome.toLowerCase().includes(search.toLowerCase()) ||
      (acordo.cliente_cpf && acordo.cliente_cpf.includes(search));
    const matchesStatus = statusFilter === 'todos' || acordo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Acordos Pagos: têm pelo menos 1 parcela paga E NÃO têm parcela vencida
  const acordosPagos = filteredAcordos.filter(acordo => 
    acordosComPagamentosPagos.has(acordo.id) && 
    !acordosComParcelasVencidas.has(acordo.id)
  );

  // Acordos Negociados: não têm nenhuma parcela paga E não têm parcela vencida
  // Ordenados: 1º Aguardando boleto (laranja), 2º Boleto enviado
  const acordosNegociados = filteredAcordos
    .filter(acordo => 
      !acordosComPagamentosPagos.has(acordo.id) && 
      !acordosComParcelasVencidas.has(acordo.id)
    )
    .sort((a, b) => {
      // 1º: Aguardando envio do boleto vem primeiro (laranja)
      if (!a.boleto_enviado && b.boleto_enviado) return -1;
      if (a.boleto_enviado && !b.boleto_enviado) return 1;
      return 0;
    });

  // Acordos com Parcelas Vencidas: têm pelo menos 1 parcela pendente com data_prevista < hoje
  const acordosVencidos = filteredAcordos.filter(acordo => 
    acordosComParcelasVencidas.has(acordo.id)
  );

  // Acordos com Parcelas Próximas ao Vencimento: têm parcelas pendentes vencendo em 0-3 dias
  const acordosProximos = filteredAcordos.filter(acordo => 
    acordosComParcelasProximas.has(acordo.id)
  );

  const acordosExibidos = 
    abaAtiva === 'pagos' ? acordosPagos : 
    abaAtiva === 'proximas' ? acordosProximos :
    abaAtiva === 'vencidos' ? acordosVencidos : 
    acordosNegociados;

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
          <h1 className="text-2xl font-bold">Meus Acordos</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExportarExcel(acordosExibidos)} disabled={acordosExibidos.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
            <Button asChild>
              <Link to="/acordos/novo">
                <PlusCircle className="h-4 w-4 mr-2" />
                Novo Acordo
              </Link>
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
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

        {/* Abas de acordos */}
        <Tabs value={abaAtiva} onValueChange={(v) => setAbaAtiva(v as 'pagos' | 'negociados' | 'proximas' | 'vencidos')}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="negociados">
              Negociados ({acordosNegociados.length})
            </TabsTrigger>
            <TabsTrigger value="pagos">
              Pagos ({acordosPagos.length})
            </TabsTrigger>
            <TabsTrigger value="proximas">
              Próximas ao Vencimento ({acordosProximos.length})
            </TabsTrigger>
            <TabsTrigger value="vencidos">
              Vencidas ({acordosVencidos.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="negociados">
            {acordosNegociados.length > 0 ? (
              <div className="grid gap-4">
                {acordosNegociados.map((acordo) => (
                  <AcordoCard 
                    key={acordo.id} 
                    acordo={acordo} 
                    onDelete={() => setAcordoParaExcluir(acordo)}
                    onEnviarWhatsApp={handleEnviarWhatsApp}
                    enviandoWhatsApp={enviandoWhatsApp}
                    getStatusVariant={getStatusVariant}
                    getStatusLabel={getStatusLabel}
                    isNegociado={true}
                  />
                ))}
              </div>
            ) : (
              <EmptyState search={search} statusFilter={statusFilter} />
            )}
          </TabsContent>

          <TabsContent value="pagos">
            {acordosPagos.length > 0 ? (
              <div className="grid gap-4">
                {acordosPagos.map((acordo) => (
                  <AcordoCard 
                    key={acordo.id} 
                    acordo={acordo} 
                    onDelete={() => setAcordoParaExcluir(acordo)}
                    onEnviarWhatsApp={handleEnviarWhatsApp}
                    enviandoWhatsApp={enviandoWhatsApp}
                    getStatusVariant={getStatusVariant}
                    getStatusLabel={getStatusLabel}
                  />
                ))}
              </div>
            ) : (
              <EmptyState search={search} statusFilter={statusFilter} message="Nenhum acordo com pagamentos realizados" />
            )}
          </TabsContent>

          <TabsContent value="proximas">
            {acordosProximos.length > 0 ? (
              <div className="grid gap-4">
                {acordosProximos.map((acordo) => (
                  <AcordoCard 
                    key={acordo.id} 
                    acordo={acordo} 
                    onDelete={() => setAcordoParaExcluir(acordo)}
                    onEnviarWhatsApp={handleEnviarWhatsApp}
                    enviandoWhatsApp={enviandoWhatsApp}
                    getStatusVariant={getStatusVariant}
                    getStatusLabel={getStatusLabel}
                  />
                ))}
              </div>
            ) : (
              <EmptyState search={search} statusFilter={statusFilter} message="Nenhuma parcela próxima ao vencimento" />
            )}
          </TabsContent>

          <TabsContent value="vencidos">
            {acordosVencidos.length > 0 ? (
              <div className="grid gap-4">
                {acordosVencidos.map((acordo) => (
                  <AcordoCard 
                    key={acordo.id} 
                    acordo={acordo} 
                    onDelete={() => setAcordoParaExcluir(acordo)}
                    onEnviarWhatsApp={handleEnviarWhatsApp}
                    enviandoWhatsApp={enviandoWhatsApp}
                    getStatusVariant={getStatusVariant}
                    getStatusLabel={getStatusLabel}
                  />
                ))}
              </div>
            ) : (
              <EmptyState search={search} statusFilter={statusFilter} message="Nenhuma parcela vencida encontrada" />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!acordoParaExcluir} onOpenChange={(open) => !open && setAcordoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir acordo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O acordo com <strong>{acordoParaExcluir?.cliente_nome}</strong> e todas as suas parcelas serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAcordoParaExcluir(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (acordoParaExcluir) {
                  handleDelete(acordoParaExcluir.id);
                  setAcordoParaExcluir(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}