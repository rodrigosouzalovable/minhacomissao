import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import { Bell, User, Phone, FileText, CalendarClock, MessageSquare } from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOverdueInstallments } from '@/hooks/useOverdueInstallments';
import successSound from '@/assets/success-sound.mp3';

interface RetornoAlerta {
  id: string;
  meta_contato_id: string | null;
  cliente_nome: string;
  cliente_cpf: string;
  cliente_telefone: string;
  observacao: string | null;
  data_retorno: string;
}

export function RetornoAlertChecker() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fila, setFila] = useState<RetornoAlerta[]>([]);
  const [abrindo, setAbrindo] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [erroConclusao, setErroConclusao] = useState('');
  const [avisoAbertura, setAvisoAbertura] = useState('');
  const [avisoAtrasosAberto, setAvisoAtrasosAberto] = useState(false);
  const notifiedIds = useRef<Set<string>>(new Set());
  const verificandoAvisoAtrasos = useRef(false);
  const avisosAtrasosExibidos = useRef<Set<string>>(new Set());
  const { data: parcelasAtrasadas = [], refetch: atualizarParcelasAtrasadas } = useOverdueInstallments();

  const alertaRetorno = fila[0] ?? null;
  const parcelasDoUsuario = parcelasAtrasadas.filter((parcela) => parcela.user_id === user?.id);

  const verificarHorarioAvisoAtrasos = useCallback(async () => {
    if (!user || document.visibilityState !== 'visible' || verificandoAvisoAtrasos.current) return;

    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value ?? '';
    const hora = Number(valor('hour'));
    const horario = hora >= 15 ? '15h' : hora >= 9 ? '9h' : null;
    if (!horario) return;

    const dataBrasilia = `${valor('year')}-${valor('month')}-${valor('day')}`;
    const chave = `parcelas-atrasadas-aviso:${user.id}:${dataBrasilia}:${horario}`;
    let jaExibido = avisosAtrasosExibidos.current.has(chave);
    try {
      jaExibido = jaExibido || localStorage.getItem(chave) === '1';
    } catch {
      // Se o armazenamento estiver indisponível, a trava em memória evita repetição nesta sessão.
    }
    if (jaExibido) return;

    verificandoAvisoAtrasos.current = true;
    try {
      const resultado = await atualizarParcelasAtrasadas();
      const atrasadasDoUsuario = (resultado.data ?? []).filter((parcela) => parcela.user_id === user.id);
      if (atrasadasDoUsuario.length === 0) {
        setAvisoAtrasosAberto(false);
        return;
      }

      avisosAtrasosExibidos.current.add(chave);
      try {
        localStorage.setItem(chave, '1');
      } catch {
        // O aviso ainda fica registrado em memória durante a sessão atual.
      }
      setAvisoAtrasosAberto(true);
      try {
        const audio = new Audio(successSound);
        void audio.play().catch(() => {});
      } catch {
        // O navegador pode bloquear áudio automático; o aviso visual continua disponível.
      }
    } finally {
      verificandoAvisoAtrasos.current = false;
    }
  }, [atualizarParcelasAtrasadas, user]);

  useEffect(() => {
    if (!user) return;

    void verificarHorarioAvisoAtrasos();
    const interval = window.setInterval(() => {
      void verificarHorarioAvisoAtrasos();
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void verificarHorarioAvisoAtrasos();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, verificarHorarioAvisoAtrasos]);

  const checkRetornos = useCallback(async () => {
    if (!user) return;

    const now = new Date();
    // data_retorno é gravado em UTC real — comparar direto, sem deslocar fuso.
    const past60Min = new Date(now.getTime() - 60 * 60 * 1000);
    const in2Min = new Date(now.getTime() + 2 * 60 * 1000);

    const { data, error } = await supabase
      .from('retornos')
      .select('id, meta_contato_id, cliente_nome, cliente_cpf, cliente_telefone, observacao, data_retorno')
      .eq('user_id', user.id)
      .eq('status', 'pendente')
      .lte('data_retorno', in2Min.toISOString())
      .gte('data_retorno', past60Min.toISOString())
      .order('data_retorno', { ascending: true });

    if (error || !data || data.length === 0) return;

    const novos = data.filter((r) => !notifiedIds.current.has(r.id));
    if (novos.length === 0) return;

    novos.forEach((r) => notifiedIds.current.add(r.id));
    setFila((prev) => [...prev, ...novos]);

    // Play sound
    try {
      const audio = new Audio(successSound);
      await audio.play();
      setTimeout(() => {
        const audio2 = new Audio(successSound);
        audio2.play().catch(() => {});
      }, 500);
    } catch {
      // O navegador pode bloquear áudio automático; o aviso visual continua disponível.
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Check immediately
    checkRetornos();

    // Poll every 2 minutes; pause when tab is hidden to save CPU/network.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') checkRetornos();
    }, 120000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') checkRetornos();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, checkRetornos]);

  const fechar = () => { setAvisoAbertura(''); setErroConclusao(''); setFila((prev) => prev.slice(1)); };

  const concluirRetorno = async () => {
    if (!alertaRetorno?.meta_contato_id || !user || concluindo) return;
    setConcluindo(true);
    setErroConclusao('');
    try {
      const { data, error } = await supabase.from('retornos')
        .update({ status: 'concluido' })
        .eq('id', alertaRetorno.id)
        .eq('user_id', user.id)
        .eq('status', 'pendente')
        .select('id')
        .maybeSingle();
      if (error || !data) throw error ?? new Error('O retorno não está mais pendente. Atualize a página e confira o histórico.');
      fechar();
    } catch {
      setErroConclusao('Não foi possível concluir o retorno. Tente novamente.');
    } finally {
      setConcluindo(false);
    }
  };

  const verRetorno = () => {
    if (!alertaRetorno) return;
    const id = alertaRetorno.id;
    fechar();
    navigate(`/retornos?retorno=${encodeURIComponent(id)}`);
  };

  const abrirConversa = async () => {
    if (!alertaRetorno || abrindo) return;
    setAbrindo(true);
    try {
      const contatoId = alertaRetorno.meta_contato_id;
      if (!contatoId) return verRetorno();
      const { data, error } = await supabase.from('meta_whatsapp_contatos')
        .select('id').eq('id', contatoId).maybeSingle();
      if (error) throw error;
      if (!data) {
        setAvisoAbertura('A conversa vinculada não está mais disponível ou você não tem acesso a esta caixa. Consulte os detalhes em Ver retorno.');
        return;
      }
      fechar();
      navigate(`/admin/inbox-meta?contato=${encodeURIComponent(contatoId)}`);
    } catch {
      setAvisoAbertura('Falha de conexão ao verificar a conversa. Tente novamente ou consulte Ver retorno.');
    } finally {
      setAbrindo(false);
    }
  };

  return (
    <>
    <AlertDialog open={!!alertaRetorno} onOpenChange={(open) => { if (!open) fechar(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            🔔 Retorno Agendado!
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p className="text-base font-medium text-foreground">
                Você precisa entrar em contato com este cliente agora:
              </p>
              <div className="space-y-2 rounded-lg bg-muted p-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{alertaRetorno?.cliente_nome}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarClock className="h-3 w-3 text-muted-foreground" />
                  <span>
                    {alertaRetorno
                      ? new Date(alertaRetorno.data_retorno).toLocaleString('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : ''}
                  </span>
                </div>
                {!!alertaRetorno?.cliente_cpf && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span>CPF: {alertaRetorno.cliente_cpf}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span>{alertaRetorno?.cliente_telefone}</span>
                  {alertaRetorno?.cliente_telefone && <CopyButton value={alertaRetorno.cliente_telefone} label="Telefone" />}
                </div>
                {alertaRetorno?.observacao && (
                  <p className="text-sm text-muted-foreground mt-2 border-t pt-2">
                    {alertaRetorno.observacao}
                  </p>
                )}
              </div>
              {!alertaRetorno?.meta_contato_id && (
                <p className="text-sm text-muted-foreground">Este retorno não registra uma conversa de origem. Consulte os detalhes em Ver retorno.</p>
              )}
              {avisoAbertura && <p role="alert" className="text-sm text-destructive">{avisoAbertura}</p>}
              {erroConclusao && <p role="alert" className="text-sm text-destructive">{erroConclusao}</p>}
              {fila.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  +{fila.length - 1} outro(s) retorno(s) aguardando.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {alertaRetorno?.meta_contato_id ? (
            <AlertDialogCancel disabled={concluindo} onClick={(event) => { event.preventDefault(); void concluirRetorno(); }}>
              {concluindo ? 'Concluindo...' : 'Concluído'}
            </AlertDialogCancel>
          ) : (
            <AlertDialogCancel onClick={fechar}>Entendido</AlertDialogCancel>
          )}
          <AlertDialogAction onClick={(event) => { event.preventDefault(); if (alertaRetorno?.meta_contato_id) void abrirConversa(); else verRetorno(); }} disabled={abrindo}>
            <MessageSquare className="mr-2 h-4 w-4" />{alertaRetorno?.meta_contato_id ? 'Abrir Conversa' : 'Ver retorno'}
          </AlertDialogAction>
          {alertaRetorno?.meta_contato_id && avisoAbertura && (
            <AlertDialogAction onClick={(event) => { event.preventDefault(); verRetorno(); }} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">Ver retorno</AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={!alertaRetorno && avisoAtrasosAberto && parcelasDoUsuario.length > 0} onOpenChange={setAvisoAtrasosAberto}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Bell className="h-5 w-5" />
            Parcelas atrasadas
          </AlertDialogTitle>
          <AlertDialogDescription>
            Estes clientes ainda possuem pagamentos pendentes. Este aviso aparece às 9h e às 15h.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {parcelasDoUsuario.map((parcela) => {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const vencimento = new Date(`${parcela.data_prevista}T00:00:00`);
            const dias = Math.max(1, Math.floor((hoje.getTime() - vencimento.getTime()) / 86400000));
            return (
              <Button
                key={parcela.id}
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start rounded border border-destructive/30 bg-destructive/10 p-3 text-left hover:bg-destructive/15"
                onClick={() => {
                  setAvisoAtrasosAberto(false);
                  navigate(`/acordos/${parcela.acordo_id}`);
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{parcela.cliente_nome}</span>
                    <Badge variant="destructive">{dias} {dias === 1 ? 'dia' : 'dias'} em atraso</Badge>
                  </div>
                  <p className="mt-1 whitespace-normal text-sm font-normal text-muted-foreground">
                    Parcela {parcela.numero_parcela} • Vencimento {vencimento.toLocaleDateString('pt-BR')} • {Number(parcela.valor_parcela).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              </Button>
            );
          })}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Fechar por enquanto</AlertDialogCancel>
          <Button onClick={() => { setAvisoAtrasosAberto(false); navigate('/retornos#parcelas-atrasadas'); }}>
            Ver parcelas atrasadas
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
