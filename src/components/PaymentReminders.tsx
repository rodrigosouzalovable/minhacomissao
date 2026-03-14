import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, AlertTriangle, AlertCircle, Check, History, RotateCcw, Phone, XCircle, Maximize2, Play, Loader2, Ban, RefreshCw } from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';
import { usePaymentReminders } from '@/hooks/usePaymentReminders';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WhatsAppInstance {
  id: string;
  nome: string | null;
  server_url: string;
  instance_token: string;
  ativo: boolean;
}

interface FilaItem {
  id: string;
  pagamento_id: string;
  telefone: string;
  status: string | null;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function WhatsAppStatusBadge({ status }: { status: string }) {
  if (status === 'enviado') return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-xs px-1.5 py-0">Enviado</Badge>;
  if (status === 'erro') return <Badge variant="destructive" className="text-xs px-1.5 py-0">Erro</Badge>;
  if (status === 'enviando') return <Badge className="bg-amber-500 hover:bg-amber-500 text-xs px-1.5 py-0 gap-1"><RefreshCw className="h-2.5 w-2.5 animate-spin" />Enviando</Badge>;
  if (status === 'pendente') return <Badge className="bg-amber-500 hover:bg-amber-500 text-xs px-1.5 py-0">Pendente</Badge>;
  return null;
}

export function PaymentReminders() {
  const { lembretesVencidos, lembretesHoje, lembretesTresDias, lembretesJaLidos, temLembretes, isLoading, marcarComoLido, desmarcarLido } = usePaymentReminders();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pendentes');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // WhatsApp sending state
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [filaItems, setFilaItems] = useState<FilaItem[]>([]);
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [currentSendingId, setCurrentSendingId] = useState<string | null>(null);
  const [localStatusOverride, setLocalStatusOverride] = useState<Record<string, 'enviado' | 'erro'>>({});
  const cancelSendRef = useRef(false);

  const selectedInstance = instances.find(i => i.id === selectedInstanceId);

  const totalLembretes = lembretesVencidos.length + lembretesHoje.length + lembretesTresDias.length;
  const allPendingReminders = [...lembretesVencidos, ...lembretesHoje, ...lembretesTresDias];

  // Fetch WhatsApp instances when dialog opens
  useEffect(() => {
    if (!dialogOpen || !user) return;
    (async () => {
      const { data } = await supabase
        .from('user_whatsapp_instances')
        .select('id, nome, server_url, instance_token, ativo')
        .eq('user_id', user.id)
        .eq('ativo', true);
      if (data) {
        setInstances(data);
        if (data.length === 1) setSelectedInstanceId(data[0].id);
      }
    })();
  }, [dialogOpen, user]);

  // Fetch fila items for selected instance
  const fetchFila = useCallback(async () => {
    if (!selectedInstance) { setFilaItems([]); return; }
    const hoje = new Date();
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    const { data } = await supabase
      .from('whatsapp_fila')
      .select('id, pagamento_id, telefone, status')
      .eq('instance_token', selectedInstance.instance_token)
      .gte('criado_em', `${hojeStr}T00:00:00`)
      .lte('criado_em', `${hojeStr}T23:59:59`);
    setFilaItems(data || []);
  }, [selectedInstance]);

  useEffect(() => { if (dialogOpen) fetchFila(); }, [dialogOpen, fetchFila]);

  // Get WhatsApp status for a reminder
  const getWhatsAppStatus = (reminderId: string, telefone?: string): string => {
    if (reminderId === currentSendingId) return 'enviando';
    if (localStatusOverride[reminderId]) return localStatusOverride[reminderId];
    const rPhone = normalizePhone(telefone || '');
    const match = filaItems.find(f => {
      if (f.pagamento_id === reminderId) return true;
      const fPhone = normalizePhone(f.telefone);
      return rPhone.length > 0 && (rPhone === fPhone || `55${rPhone}` === fPhone || rPhone === `55${fPhone}`);
    });
    if (match) {
      if (match.status === 'enviado') return 'enviado';
      if (match.status === 'erro') return 'erro';
      return 'pendente';
    }
    return 'nao_enviado';
  };

  // Compute progress
  const enviadosCount = allPendingReminders.filter(r => getWhatsAppStatus(r.id, r.cliente_telefone) === 'enviado').length;
  const errosCount = allPendingReminders.filter(r => getWhatsAppStatus(r.id, r.cliente_telefone) === 'erro').length;
  const naoEnviadosCount = allPendingReminders.filter(r => getWhatsAppStatus(r.id, r.cliente_telefone) === 'nao_enviado').length;
  const progressPercent = allPendingReminders.length > 0 ? Math.round(((enviadosCount + errosCount) / allPendingReminders.length) * 100) : 0;

  const handleStartEnvios = async () => {
    if (!selectedInstance || !user) return;
    setStarting(true);
    cancelSendRef.current = false;
    try {
      const { data, error } = await supabase.functions.invoke('check-payment-reminders', {
        body: {
          user_id: user.id,
          instance_token: selectedInstance.instance_token,
          server_url: selectedInstance.server_url,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');
      if (data.agendados === 0) {
        toast.info('Nenhuma parcela para notificar hoje.');
        setStarting(false);
        return;
      }
      toast.success(`${data.agendados} lembretes agendados! Iniciando envio...`);
      await fetchFila();
      setStarting(false);
      setSending(true);

      // Sequential send
      const processNext = async () => {
        while (!cancelSendRef.current) {
          const { data: nextItems } = await supabase
            .from('whatsapp_fila')
            .select('id, telefone, pagamento_id')
            .eq('status', 'pendente')
            .eq('instance_token', selectedInstance.instance_token)
            .order('agendado_para', { ascending: true })
            .limit(1);
          if (!nextItems || nextItems.length === 0) break;

          const item = nextItems[0];
          const matchedReminder = allPendingReminders.find(r => r.id === item.pagamento_id) 
            || allPendingReminders.find(r => {
              const rPhone = normalizePhone(r.cliente_telefone || '');
              const fPhone = normalizePhone(item.telefone);
              return rPhone.length > 0 && (rPhone === fPhone || `55${rPhone}` === fPhone || rPhone === `55${fPhone}`);
            });
          const reminderId = matchedReminder?.id || item.pagamento_id;
          setCurrentSendingId(reminderId);

          try {
            const { data: sendResult, error: sendErr } = await supabase.functions.invoke('process-whatsapp-queue', {});
            setCurrentSendingId(null);
            if (sendErr || !sendResult?.success) {
              setLocalStatusOverride(prev => ({ ...prev, [reminderId]: 'erro' }));
            } else if (sendResult?.enviado) {
              setLocalStatusOverride(prev => ({ ...prev, [reminderId]: 'enviado' }));
            } else {
              break;
            }
          } catch {
            setCurrentSendingId(null);
            setLocalStatusOverride(prev => ({ ...prev, [reminderId]: 'erro' }));
          }

          const delay = 5000 + Math.random() * 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
          await fetchFila();
        }
        setSending(false);
        setCurrentSendingId(null);
        if (cancelSendRef.current) {
          toast.info('Envio cancelado');
        } else {
          toast.success('Envio finalizado!');
        }
        await fetchFila();
      };
      processNext();
    } catch (err: any) {
      toast.error('Erro ao iniciar envios: ' + (err.message || 'Erro desconhecido'));
      setStarting(false);
    }
  };

  const handleCancelEnvios = async () => {
    if (!selectedInstance) return;
    cancelSendRef.current = true;
    const hojeDate = new Date();
    const hojeStr = `${hojeDate.getFullYear()}-${String(hojeDate.getMonth() + 1).padStart(2, '0')}-${String(hojeDate.getDate()).padStart(2, '0')}`;
    await supabase
      .from('whatsapp_fila')
      .delete()
      .eq('status', 'pendente')
      .eq('instance_token', selectedInstance.instance_token)
      .gte('criado_em', `${hojeStr}T00:00:00`)
      .lte('criado_em', `${hojeStr}T23:59:59`);
    toast.success('Envio cancelado');
    await fetchFila();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleMarcarLido = (e: React.MouseEvent, lembreteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    marcarComoLido(lembreteId);
  };

  const handleDesmarcarLido = (e: React.MouseEvent, lembreteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    desmarcarLido(lembreteId);
  };

  if (isLoading) {
    return (
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
      </Button>
    );
  }

  const renderLembreteItem = (lembrete: any, bgClass: string, hoverClass: string, inDialog = false) => {
    const isPagamento = lembrete.categoria === 'pagamento';
    const linkTo = isPagamento ? `/acordos/${lembrete.acordo_id}` : '/retornos';
    const whatsappStatus = inDialog ? getWhatsAppStatus(lembrete.id, lembrete.cliente_telefone) : '';

    return (
      <div
        key={lembrete.id}
        className={`flex items-center gap-2 p-2 rounded-lg ${bgClass} ${hoverClass} transition-colors`}
      >
        <Link
          to={linkTo}
          className="flex items-center justify-between flex-1 min-w-0"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {!isPagamento && <Phone className="h-3 w-3 text-primary shrink-0" />}
              <span className="font-medium text-foreground text-sm truncate flex items-center gap-1">
                {lembrete.cliente_nome}
                <CopyButton value={lembrete.cliente_nome} label="Nome" preserveText />
              </span>
            </div>
            {lembrete.cliente_telefone ? (
              <span className="text-muted-foreground text-xs flex items-center gap-1">
                <Phone className="h-3 w-3 shrink-0" />
                {lembrete.cliente_telefone}
                <CopyButton value={lembrete.cliente_telefone} label="Telefone" />
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">
                {isPagamento ? 'Sem telefone' : 'Retorno agendado'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {inDialog && whatsappStatus !== 'nao_enviado' && (
              <WhatsAppStatusBadge status={whatsappStatus} />
            )}
            {isPagamento && lembrete.valor_parcela && (
              <span className="font-semibold text-foreground text-sm">
                {formatCurrency(lembrete.valor_parcela)}
              </span>
            )}
          </div>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 hover:bg-accent hover:text-accent-foreground"
          onClick={(e) => handleMarcarLido(e, lembrete.id)}
          title="Marcar como visto"
        >
          <Check className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  const renderHistoricoItem = (lembrete: any) => {
    const isPagamento = lembrete.categoria === 'pagamento';
    const linkTo = isPagamento ? `/acordos/${lembrete.acordo_id}` : '/retornos';

    return (
      <div
        key={lembrete.id}
        className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
      >
        <Link
          to={linkTo}
          className="flex items-center justify-between flex-1 min-w-0"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {!isPagamento && <Phone className="h-3 w-3 text-primary shrink-0" />}
              <span className="font-medium text-foreground text-sm truncate flex items-center gap-1">
                {lembrete.cliente_nome}
                <CopyButton value={lembrete.cliente_nome} label="Nome" preserveText />
              </span>
            </div>
            {lembrete.cliente_telefone ? (
              <span className="text-muted-foreground text-xs flex items-center gap-1">
                <Phone className="h-3 w-3 shrink-0" />
                {lembrete.cliente_telefone}
                <CopyButton value={lembrete.cliente_telefone} label="Telefone" />
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">
                {isPagamento 
                  ? `${lembrete.tipo === 'vencido' ? 'Vencida' : lembrete.tipo === 'hoje' ? 'Vence hoje' : 'Vence em 3 dias'}`
                  : `Retorno • ${lembrete.tipo === 'hoje' ? 'Hoje' : 'Em 3 dias'}`
                }
              </span>
            )}
          </div>
          {isPagamento && lembrete.valor_parcela && (
            <span className="font-semibold text-foreground text-sm ml-2">
              {formatCurrency(lembrete.valor_parcela)}
            </span>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 hover:bg-accent hover:text-accent-foreground"
          onClick={(e) => handleDesmarcarLido(e, lembrete.id)}
          title="Mostrar novamente"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  const renderFullContent = (inDialog = false) => (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className={`w-full grid grid-cols-2 ${inDialog ? '' : 'rounded-none border-b'}`}>
        <TabsTrigger value="pendentes" className="gap-1.5">
          <Bell className="h-3.5 w-3.5" />
          Pendentes
          {totalLembretes > 0 && (
            <span className="ml-1 text-xs bg-destructive text-destructive-foreground rounded-full px-1.5">
              {totalLembretes}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="historico" className="gap-1.5">
          <History className="h-3.5 w-3.5" />
          Histórico
          {lembretesJaLidos.length > 0 && (
            <span className="ml-1 text-xs bg-muted-foreground/20 text-muted-foreground rounded-full px-1.5">
              {lembretesJaLidos.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="pendentes" className="mt-0">
        {!temLembretes ? (
          <div className="p-4 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum lembrete pendente</p>
          </div>
        ) : (
          <div className={inDialog ? 'max-h-[60vh] overflow-y-auto' : 'max-h-80 overflow-y-auto'}>
            {lembretesVencidos.length > 0 && (
              <div className="p-3 border-b border-border">
                <h4 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Parcelas Vencidas ({lembretesVencidos.length})
                  {!inDialog && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-auto"
                      title="Expandir lembretes"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPopoverOpen(false);
                        setDialogOpen(true);
                      }}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </h4>
                <div className="space-y-2">
                  {lembretesVencidos.map((lembrete) =>
                    renderLembreteItem(lembrete, 'bg-destructive/10', 'hover:bg-destructive/20', inDialog)
                  )}
                </div>
              </div>
            )}

            {lembretesHoje.length > 0 && (
              <div className="p-3 border-b border-border">
                <h4 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Vence hoje
                </h4>
                <div className="space-y-2">
                  {lembretesHoje.map((lembrete) =>
                    renderLembreteItem(lembrete, 'bg-destructive/10', 'hover:bg-destructive/20', inDialog)
                  )}
                </div>
              </div>
            )}

            {lembretesTresDias.length > 0 && (
              <div className="p-3">
                <h4 className="text-sm font-semibold text-warning mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Vence em 3 dias
                </h4>
                <div className="space-y-2">
                  {lembretesTresDias.map((lembrete) =>
                    renderLembreteItem(lembrete, 'bg-warning/10', 'hover:bg-warning/20', inDialog)
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </TabsContent>

      <TabsContent value="historico" className="mt-0">
        {lembretesJaLidos.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum lembrete no histórico</p>
          </div>
        ) : (
          <div className={`${inDialog ? 'max-h-[60vh]' : 'max-h-80'} overflow-y-auto p-3`}>
            <div className="space-y-2">
              {lembretesJaLidos.map((lembrete) => renderHistoricoItem(lembrete))}
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {totalLembretes > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {totalLembretes > 9 ? '9+' : totalLembretes}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          {renderFullContent(false)}
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setSending(false);
          cancelSendRef.current = true;
          setLocalStatusOverride({});
          setCurrentSendingId(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Lembretes
            </DialogTitle>
          </DialogHeader>

          {/* WhatsApp instance selector + send button */}
          <div className="flex items-center gap-2 border rounded-lg p-3 bg-muted/30">
            <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
              <SelectTrigger className="flex-1 h-9">
                <SelectValue placeholder="Selecione um WhatsApp..." />
              </SelectTrigger>
              <SelectContent>
                {instances.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.nome || inst.instance_token.slice(0, 12) + '...'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {sending ? (
              <Button variant="destructive" size="sm" onClick={handleCancelEnvios}>
                Cancelar
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={!selectedInstanceId || totalLembretes === 0 || starting}
                onClick={handleStartEnvios}
              >
                {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Enviar
              </Button>
            )}
          </div>

          {/* Progress bar during sending */}
          {(sending || enviadosCount > 0 || errosCount > 0) && selectedInstanceId && (
            <div className="space-y-1">
              <Progress value={progressPercent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{enviadosCount} enviado{enviadosCount !== 1 ? 's' : ''}</span>
                {errosCount > 0 && <span className="text-destructive">{errosCount} erro{errosCount !== 1 ? 's' : ''}</span>}
                <span>{naoEnviadosCount} restante{naoEnviadosCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}

          {renderFullContent(true)}
        </DialogContent>
      </Dialog>
    </>
  );
}
