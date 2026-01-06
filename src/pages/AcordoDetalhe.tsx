import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import successSound from '@/assets/success-sound.mp3';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { formatarMoeda, formatarData } from '@/lib/comissao';
import { ArrowLeft, Check, Clock, Calendar, User, DollarSign, Phone, Pencil, X, Send } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type Acordo = Tables<'acordos'>;
type Pagamento = Tables<'pagamentos'>;

export default function AcordoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [acordo, setAcordo] = useState<Acordo | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [funcionarioNome, setFuncionarioNome] = useState<string | null>(null);
  const [editandoDataPagamento, setEditandoDataPagamento] = useState<string | null>(null);
  const [novaDataPagamento, setNovaDataPagamento] = useState<string>('');
  const [editandoComissao, setEditandoComissao] = useState<string | null>(null);
  const [novaComissao, setNovaComissao] = useState<string>('');

  // Verifica se o usuário logado é o dono do acordo
  const isOwner = acordo?.user_id === user?.id;

  useEffect(() => {
    async function loadAcordo() {
      if (!user || !id) return;

      try {
        // RLS cuida do acesso - gestores/admins podem ver acordos da equipe
        const { data: acordoData, error: acordoError } = await supabase
          .from('acordos')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (acordoError) throw acordoError;
        if (!acordoData) {
          navigate('/acordos');
          return;
        }
        setAcordo(acordoData);

        // Se não for o dono, buscar nome do funcionário
        if (acordoData.user_id !== user.id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('nome')
            .eq('id', acordoData.user_id)
            .maybeSingle();
          
          if (profileData) {
            setFuncionarioNome(profileData.nome);
          }
        }

        const { data: pagamentosData, error: pagamentosError } = await supabase
          .from('pagamentos')
          .select('*')
          .eq('acordo_id', id)
          .order('numero_parcela', { ascending: true });

        if (pagamentosError) throw pagamentosError;
        setPagamentos(pagamentosData || []);
      } catch (error) {
        console.error('Erro ao carregar acordo:', error);
        navigate('/acordos');
      } finally {
        setLoading(false);
      }
    }

    loadAcordo();
  }, [user, id, navigate]);

  const marcarBoletoEnviado = async () => {
    if (!acordo) return;
    
    try {
      const novoStatus = !acordo.boleto_enviado;
      
      const { error } = await supabase
        .from('acordos')
        .update({ boleto_enviado: novoStatus })
        .eq('id', acordo.id);

      if (error) throw error;

      setAcordo({ ...acordo, boleto_enviado: novoStatus });
      
      toast({
        title: novoStatus ? 'Boleto marcado como enviado!' : 'Status do boleto atualizado',
        description: novoStatus 
          ? 'O cliente foi notificado sobre o boleto.' 
          : 'O boleto foi desmarcado.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar o status do boleto.',
      });
    }
  };

  const marcarComoPago = async (pagamentoId: string) => {
    try {
      const dataHoje = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('pagamentos')
        .update({ status: 'pago', data_paga: dataHoje })
        .eq('id', pagamentoId);

      if (error) throw error;

      // Reproduzir som de sucesso
      const audio = new Audio(successSound);
      audio.play().catch(err => console.log('Erro ao reproduzir som:', err));

      setPagamentos(prev =>
        prev.map(p =>
          p.id === pagamentoId
            ? { ...p, status: 'pago', data_paga: dataHoje }
            : p
        )
      );

      // Verificar se todas as parcelas foram pagas
      const todasPagas = pagamentos.every(p => p.id === pagamentoId || p.status === 'pago');
      if (todasPagas && acordo) {
        await supabase
          .from('acordos')
          .update({ status: 'concluido' })
          .eq('id', acordo.id);
        
        setAcordo({ ...acordo, status: 'concluido' });
      }

      toast({
        title: 'Parcela marcada como paga!',
        description: 'A comissão foi liberada.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar a parcela.',
      });
    }
  };

  const desmarcarComoPago = async (pagamentoId: string) => {
    try {
      const { error } = await supabase
        .from('pagamentos')
        .update({ status: 'pendente', data_paga: null })
        .eq('id', pagamentoId);

      if (error) throw error;

      setPagamentos(prev =>
        prev.map(p =>
          p.id === pagamentoId
            ? { ...p, status: 'pendente', data_paga: null }
            : p
        )
      );

      // Se o acordo estava concluído, voltar para ativo
      if (acordo?.status === 'concluido') {
        await supabase
          .from('acordos')
          .update({ status: 'ativo' })
          .eq('id', acordo.id);
        
        setAcordo({ ...acordo, status: 'ativo' });
      }

      toast({
        title: 'Parcela desmarcada',
        description: 'O pagamento foi revertido para pendente.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível desmarcar a parcela.',
      });
    }
  };

  const atualizarDataPagamento = async (pagamentoId: string, novaData: string) => {
    try {
      const { error } = await supabase
        .from('pagamentos')
        .update({ data_paga: novaData })
        .eq('id', pagamentoId);

      if (error) throw error;

      setPagamentos(prev =>
        prev.map(p =>
          p.id === pagamentoId ? { ...p, data_paga: novaData } : p
        )
      );

      setEditandoDataPagamento(null);
      setNovaDataPagamento('');

      toast({
        title: 'Data atualizada!',
        description: 'A data de pagamento foi corrigida.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar a data.',
      });
    }
  };

  const atualizarComissaoParcela = async (pagamentoId: string, novoValor: number) => {
    try {
      const { error } = await supabase
        .from('pagamentos')
        .update({ comissao_parcela: novoValor })
        .eq('id', pagamentoId);

      if (error) throw error;

      setPagamentos(prev =>
        prev.map(p =>
          p.id === pagamentoId ? { ...p, comissao_parcela: novoValor } : p
        )
      );

      setEditandoComissao(null);
      setNovaComissao('');

      toast({
        title: 'Comissão atualizada!',
        description: `Novo valor: ${formatarMoeda(novoValor)}`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar a comissão.',
      });
    }
  };

  if (loading || !acordo) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </AppLayout>
    );
  }

  const parcelasPagas = pagamentos.filter(p => p.status === 'pago').length;
  const comissaoRecebida = pagamentos
    .filter(p => p.status === 'pago')
    .reduce((sum, p) => sum + Number(p.comissao_parcela), 0);
  const comissaoPendente = pagamentos
    .filter(p => p.status === 'pendente')
    .reduce((sum, p) => sum + Number(p.comissao_parcela), 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(isOwner ? '/acordos' : '/equipe/acordos')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{acordo.cliente_nome}</h1>
            <p className="text-muted-foreground">
              {funcionarioNome && <span className="text-primary font-medium">{funcionarioNome} • </span>}
              Acordo criado em {formatarData(acordo.criado_em)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && acordo.status === 'ativo' && (
              <>
                <Button
                  variant={acordo.boleto_enviado ? "secondary" : "outline"}
                  size="sm"
                  onClick={marcarBoletoEnviado}
                >
                  {acordo.boleto_enviado ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Boleto Enviado
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      Boleto Enviado
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/acordos/${acordo.id}/editar`)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Editar
                </Button>
              </>
            )}
            {/* Admin pode editar qualquer acordo */}
            {!isOwner && isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/acordos/${acordo.id}/editar`)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
            )}
            {!isOwner && !isAdmin && (
              <Badge variant="outline" className="text-sm">
                Somente Leitura
              </Badge>
            )}
            <Badge
              variant={
                acordo.status === 'ativo' ? 'default' :
                acordo.status === 'concluido' ? 'secondary' : 'destructive'
              }
              className="text-sm"
            >
              {acordo.status === 'ativo' ? 'Ativo' :
               acordo.status === 'concluido' ? 'Concluído' : 'Cancelado'}
            </Badge>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-xl font-bold">{formatarMoeda(acordo.valor_total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Parcelas</p>
                  <p className="text-xl font-bold">{parcelasPagas} / {acordo.parcelas}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Check className="h-8 w-8 text-secondary" />
                <div>
                  <p className="text-sm text-muted-foreground">Comissão Recebida</p>
                  <p className="text-xl font-bold text-secondary">{formatarMoeda(comissaoRecebida)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-warning" />
                <div>
                  <p className="text-sm text-muted-foreground">Comissão Pendente</p>
                  <p className="text-xl font-bold text-warning">{formatarMoeda(comissaoPendente)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detalhes do acordo */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhes do Acordo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Dias em Atraso</p>
                <p className="font-medium">{acordo.dias_atraso} dias</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Percentual de Comissão</p>
                <p className="font-medium">{acordo.percentual_comissao}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor por Parcela</p>
                <p className="font-medium">{formatarMoeda(acordo.valor_parcela)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Comissão por Parcela</p>
                <p className="font-medium">{formatarMoeda(acordo.comissao_total / acordo.parcelas)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Primeiro Pagamento</p>
                <p className="font-medium">{formatarData(acordo.data_primeiro_pagamento)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Comissão Total</p>
                <p className="font-medium text-secondary">{formatarMoeda(acordo.comissao_total)}</p>
              </div>
            </div>
            {(acordo.cliente_cpf || acordo.cliente_telefone) && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium mb-2">Dados do Cliente</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {acordo.cliente_cpf && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">CPF</p>
                        <p className="font-medium">{acordo.cliente_cpf}</p>
                      </div>
                    </div>
                  )}
                  {acordo.cliente_telefone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Telefone</p>
                        <p className="font-medium">{acordo.cliente_telefone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {acordo.observacoes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">Observações</p>
                <p className="mt-1">{acordo.observacoes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de parcelas */}
        <Card>
          <CardHeader>
            <CardTitle>Parcelas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pagamentos.map((pagamento) => (
                <div
                  key={pagamento.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    pagamento.status === 'pago' ? 'bg-secondary/5 border-secondary/20' : 'bg-card'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${
                      pagamento.status === 'pago' ? 'bg-secondary/20' : 'bg-muted'
                    }`}>
                      {pagamento.status === 'pago' ? (
                        <Check className="h-4 w-4 text-secondary" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">Parcela {pagamento.numero_parcela}</p>
                      <div className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                        <span>Vencimento: {formatarData(pagamento.data_prevista)}</span>
                        {pagamento.status === 'pago' && pagamento.data_paga && (
                          <>
                            <span>•</span>
                            {editandoDataPagamento === pagamento.id ? (
                              <span className="flex items-center gap-1">
                                <span>Pago em:</span>
                                <Input
                                  type="date"
                                  value={novaDataPagamento}
                                  onChange={(e) => setNovaDataPagamento(e.target.value)}
                                  className="h-7 w-36 text-sm"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-secondary hover:text-secondary"
                                  onClick={() => atualizarDataPagamento(pagamento.id, novaDataPagamento)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => {
                                    setEditandoDataPagamento(null);
                                    setNovaDataPagamento('');
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <span>Pago em: {formatarData(pagamento.data_paga)}</span>
                                {isOwner && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0"
                                    onClick={() => {
                                      setEditandoDataPagamento(pagamento.id);
                                      setNovaDataPagamento(pagamento.data_paga || '');
                                    }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium">{formatarMoeda(pagamento.valor_parcela)}</p>
                      {editandoComissao === pagamento.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-sm text-muted-foreground">R$</span>
                          <Input
                            type="text"
                            value={novaComissao}
                            onChange={(e) => setNovaComissao(e.target.value)}
                            className="h-6 w-20 text-sm text-right"
                            placeholder="0,00"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-secondary hover:text-secondary"
                            onClick={() => {
                              const valor = parseFloat(novaComissao.replace(',', '.'));
                              if (!isNaN(valor)) {
                                atualizarComissaoParcela(pagamento.id, valor);
                              }
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              setEditandoComissao(null);
                              setNovaComissao('');
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-secondary flex items-center gap-1 justify-end">
                          Comissão: {formatarMoeda(pagamento.comissao_parcela)}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => {
                                setEditandoComissao(pagamento.id);
                                setNovaComissao(String(pagamento.comissao_parcela).replace('.', ','));
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </p>
                      )}
                    </div>
                    {pagamento.status === 'pendente' && isOwner && (
                      <Button
                        size="sm"
                        onClick={() => marcarComoPago(pagamento.id)}
                      >
                        Marcar Pago
                      </Button>
                    )}
                    {pagamento.status === 'pago' && isOwner && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => desmarcarComoPago(pagamento.id)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Desmarcar
                      </Button>
                    )}
                    {pagamento.status === 'pago' && !isOwner && (
                      <Badge variant="secondary">Pago</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
