import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageCircle, Play, CheckCircle2, Clock, AlertTriangle, RefreshCw, Users, Phone, Ban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePaymentReminders } from '@/hooks/usePaymentReminders';
import { useAuth } from '@/hooks/useAuth';

interface WhatsAppInstance {
  id: string;
  nome: string;
  server_url: string;
  instance_token: string;
  ativo: boolean;
}

interface LembreteStats {
  total: number;
  pendentes: number;
  enviados: number;
  erros: number;
  contatosUnicos: number;
}

interface FilaItem {
  id: string;
  pagamento_id: string;
  telefone: string;
  status: string | null;
  cliente_nome: string | null;
  tipo_lembrete: string;
}

interface UnifiedItem {
  id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  valor_parcela?: number;
  data_prevista?: string;
  tipo_lembrete_label: string;
  tipo: 'vencido' | 'hoje' | 'tres_dias';
  whatsapp_status: 'enviado' | 'pendente' | 'erro' | 'nao_enviado' | 'enviando';
}

type LembreteStatus = 'idle' | 'loading' | 'sending' | 'done' | 'done_with_errors' | 'no_instance';

interface LembretesSectionProps {
  instances: WhatsAppInstance[];
  selectedLembreteInstanceId: string;
  handleSaveLembreteInstance: (value: string) => void;
  savingLembrete: boolean;
  connectionStatus: Record<string, string>;
}

const tipoLembreteLabel: Record<string, string> = {
  '3_dias': '3 dias',
  'dia_vencimento': 'Vence hoje',
};

function getTipoLabel(tipo: string): string {
  if (tipoLembreteLabel[tipo]) return tipoLembreteLabel[tipo];
  const match = tipo.match(/^vencido_d(\d+)$/);
  if (match) return `D+${match[1]}`;
  return tipo;
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 13) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return phone;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function WhatsAppStatusBadge({ status }: { status: UnifiedItem['whatsapp_status'] }) {
  if (status === 'enviado') {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-xs px-1.5 py-0">Enviado</Badge>;
  }
  if (status === 'erro') {
    return <Badge variant="destructive" className="text-xs px-1.5 py-0">Erro</Badge>;
  }
  if (status === 'enviando') {
    return <Badge className="bg-amber-500 hover:bg-amber-500 text-xs px-1.5 py-0 gap-1"><RefreshCw className="h-2.5 w-2.5 animate-spin" />Enviando</Badge>;
  }
  if (status === 'pendente') {
    return <Badge className="bg-amber-500 hover:bg-amber-500 text-xs px-1.5 py-0">Pendente</Badge>;
  }
  return <Badge variant="outline" className="text-xs px-1.5 py-0 gap-1"><Ban className="h-2.5 w-2.5" />Não enviado</Badge>;
}

function tipoLabel(tipo: 'vencido' | 'hoje' | 'tres_dias'): string {
  if (tipo === 'vencido') return 'Vencida';
  if (tipo === 'hoje') return 'Vence hoje';
  return 'Vence em 3 dias';
}

export default function LembretesSection({
  instances,
  selectedLembreteInstanceId,
  handleSaveLembreteInstance,
  savingLembrete,
  connectionStatus,
}: LembretesSectionProps) {
  const [lembreteStatus, setLembreteStatus] = useState<LembreteStatus>('loading');
  const [stats, setStats] = useState<LembreteStats>({ total: 0, pendentes: 0, enviados: 0, erros: 0, contatosUnicos: 0 });
  const [filaItems, setFilaItems] = useState<FilaItem[]>([]);
  const [starting, setStarting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [localStatusOverride, setLocalStatusOverride] = useState<Record<string, 'enviado' | 'erro'>>({});
  const [sequentialSending, setSequentialSending] = useState(false);
  const [currentSendingId, setCurrentSendingId] = useState<string | null>(null);
  const cancelSendRef = useRef(false);

  const { user } = useAuth();
  const { reminders, lembretesVencidos, lembretesHoje, lembretesTresDias, lembretesJaLidos, isLoading: isLoadingReminders } = usePaymentReminders();

  const selectedInstance = instances.find(i => i.id === selectedLembreteInstanceId);
  const selectedToken = selectedInstance?.instance_token || null;
  const selectedServerUrl = selectedInstance?.server_url || null;

  const fetchStats = useCallback(async () => {
    if (!selectedToken) {
      setStats({ total: 0, pendentes: 0, enviados: 0, erros: 0, contatosUnicos: 0 });
      setFilaItems([]);
      setLembreteStatus('no_instance');
      return;
    }

    const hoje = new Date();
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('whatsapp_fila')
      .select('id, status, telefone, cliente_nome, tipo_lembrete, instance_token, pagamento_id')
      .eq('instance_token', selectedToken)
      .gte('criado_em', `${hojeStr}T00:00:00`)
      .lte('criado_em', `${hojeStr}T23:59:59`);

    if (error) {
      console.error('Erro ao buscar fila:', error);
      setLembreteStatus('idle');
      return;
    }

    if (!data || data.length === 0) {
      setStats({ total: 0, pendentes: 0, enviados: 0, erros: 0, contatosUnicos: 0 });
      setFilaItems([]);
      setLembreteStatus('idle');
      return;
    }

    const total = data.length;
    const pendentes = data.filter(d => d.status === 'pendente').length;
    const enviados = data.filter(d => d.status === 'enviado').length;
    const erros = data.filter(d => d.status === 'erro').length;
    const contatosUnicos = new Set(data.map(d => d.telefone)).size;

    setStats({ total, pendentes, enviados, erros, contatosUnicos });
    setFilaItems(data.map(d => ({
      id: d.id,
      pagamento_id: d.pagamento_id,
      telefone: d.telefone,
      status: d.status,
      cliente_nome: d.cliente_nome,
      tipo_lembrete: d.tipo_lembrete,
    })));

    if (pendentes > 0) {
      setLembreteStatus('sending');
    } else if (erros > 0) {
      setLembreteStatus('done_with_errors');
    } else if (total > 0) {
      setLembreteStatus('done');
    } else {
      setLembreteStatus('idle');
    }
  }, [selectedToken]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    if (lembreteStatus !== 'sending') return;
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [lembreteStatus, fetchStats]);

  // Build unified list from all reminders (sino) + whatsapp_fila status
  const allReminders = [...lembretesVencidos, ...lembretesHoje, ...lembretesTresDias, ...lembretesJaLidos];

  const unifiedItems: UnifiedItem[] = allReminders.map((r) => {
    const rPhone = normalizePhone(r.cliente_telefone || '');
    const filaMatch = filaItems.find(f => {
      // Match by pagamento_id (most reliable)
      if (f.pagamento_id === r.id) return true;
      // Fallback to phone matching with 55 prefix handling
      const fPhone = normalizePhone(f.telefone);
      return rPhone.length > 0 && (rPhone === fPhone || `55${rPhone}` === fPhone || rPhone === `55${fPhone}`);
    });
    let whatsapp_status: UnifiedItem['whatsapp_status'] = 'nao_enviado';

    // currentSendingId takes highest priority (real-time "enviando" indicator)
    if (r.id === currentSendingId) {
      whatsapp_status = 'enviando';
    } else if (localStatusOverride[r.id]) {
      whatsapp_status = localStatusOverride[r.id];
    } else if (filaMatch) {
      if (filaMatch.status === 'enviado') whatsapp_status = 'enviado';
      else if (filaMatch.status === 'erro') whatsapp_status = 'erro';
      else whatsapp_status = 'pendente';
    }

    // Compute tipo_lembrete_label based on data_prevista vs today
    let tipo_lembrete_label = '';
    if (r.data_prevista) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const venc = new Date(r.data_prevista + 'T00:00:00');
      const diffDays = Math.round((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) tipo_lembrete_label = 'D-0';
      else if (diffDays < 0) tipo_lembrete_label = `D${diffDays}`;
      else tipo_lembrete_label = `D+${diffDays}`;
    }

    return {
      id: r.id,
      cliente_nome: r.cliente_nome,
      cliente_telefone: r.cliente_telefone || null,
      valor_parcela: r.valor_parcela,
      data_prevista: r.data_prevista,
      tipo_lembrete_label,
      tipo: r.tipo,
      whatsapp_status,
    };
  });

  const statusPriority: Record<string, number> = { enviado: 0, enviando: 1, pendente: 2, nao_enviado: 3, erro: 4 };
  const sortByStatus = (a: UnifiedItem, b: UnifiedItem) => (statusPriority[a.whatsapp_status] ?? 5) - (statusPriority[b.whatsapp_status] ?? 5);

  const vencidos = unifiedItems.filter(i => i.tipo === 'vencido').sort(sortByStatus);
  const hoje = unifiedItems.filter(i => i.tipo === 'hoje').sort(sortByStatus);
  const tresDias = unifiedItems.filter(i => i.tipo === 'tres_dias').sort(sortByStatus);
  const totalPendencias = unifiedItems.length;
  const naoEnviados = unifiedItems.filter(i => i.whatsapp_status === 'nao_enviado').length;

  const handleStartEnvios = async () => {
    setStarting(true);
    cancelSendRef.current = false;
    try {
      // Step 1: Schedule all reminders via edge function
      const body: Record<string, string> = {};
      if (user?.id) {
        body.user_id = user.id;
      }
      if (selectedToken && selectedServerUrl) {
        body.instance_token = selectedToken;
        body.server_url = selectedServerUrl;
      }
      const { data, error } = await supabase.functions.invoke('check-payment-reminders', { body });
      if (error) throw error;
      const result = data as { success: boolean; agendados?: number; error?: string };
      if (!result.success) throw new Error(result.error || 'Erro desconhecido');
      if (result.agendados === 0) {
        toast.info('Nenhuma parcela para notificar hoje.');
        setLembreteStatus('idle');
        setStarting(false);
        return;
      }

      toast.success(`${result.agendados} lembretes agendados! Iniciando envio sequencial...`);
      await fetchStats();
      setStarting(false);
      setSequentialSending(true);
      setLembreteStatus('sending');

      // Step 2: Process queue sequentially - one by one
      const processNext = async () => {
        while (!cancelSendRef.current) {
          // Fetch next pending message from whatsapp_fila
          const { data: nextItems, error: fetchErr } = await supabase
            .from('whatsapp_fila')
            .select('id, telefone, cliente_nome, pagamento_id')
            .eq('status', 'pendente')
            .eq('instance_token', selectedToken!)
            .order('agendado_para', { ascending: true })
            .limit(1);

          if (fetchErr || !nextItems || nextItems.length === 0) break;

          const item = nextItems[0];
          // Find matching unified item by pagamento_id (most reliable) or by phone
          const matchedReminder = allReminders.find(r => r.id === item.pagamento_id) 
            || allReminders.find(r => {
              const rPhone = normalizePhone(r.cliente_telefone || '');
              const fPhone = normalizePhone(item.telefone);
              // Handle 55 prefix difference
              return rPhone.length > 0 && (rPhone === fPhone || `55${rPhone}` === fPhone || rPhone === `55${fPhone}`);
            });
          const reminderId = matchedReminder?.id || item.pagamento_id || item.id;

          // Set "enviando" status
          setLocalStatusOverride(prev => ({ ...prev, [reminderId]: 'enviando' }));

          try {
            // Invoke process-whatsapp-queue to send this specific message
            const { data: sendResult, error: sendErr } = await supabase.functions.invoke('process-whatsapp-queue', {});
            
            if (sendErr || !sendResult?.success) {
              setLocalStatusOverride(prev => ({ ...prev, [reminderId]: 'erro' }));
            } else if (sendResult?.enviado) {
              setLocalStatusOverride(prev => ({ ...prev, [reminderId]: 'enviado' }));
            } else {
              // No message was sent (maybe already processed)
              break;
            }
          } catch {
            setLocalStatusOverride(prev => ({ ...prev, [reminderId]: 'erro' }));
          }

          // Small delay between sends (5-7 seconds)
          const delay = 5000 + Math.random() * 2000;
          await new Promise(resolve => setTimeout(resolve, delay));

          // Refresh stats
          await fetchStats();
        }

        setSequentialSending(false);
        if (cancelSendRef.current) {
          toast.info('Envio cancelado');
        } else {
          toast.success('Envio sequencial finalizado!');
        }
        setLembreteStatus('idle');
        await fetchStats();
      };

      processNext();
    } catch (err: any) {
      console.error('Erro ao iniciar envios:', err);
      toast.error('Erro ao iniciar envios: ' + (err.message || 'Erro desconhecido'));
      setStarting(false);
    }
  };

  const [cancelling, setCancelling] = useState(false);

  const handleCancelEnvios = async () => {
    if (!selectedToken) return;
    cancelSendRef.current = true;
    setCancelling(true);
    try {
      const hojeDate = new Date();
      const hojeStr = `${hojeDate.getFullYear()}-${String(hojeDate.getMonth() + 1).padStart(2, '0')}-${String(hojeDate.getDate()).padStart(2, '0')}`;
      const { data, error } = await supabase
        .from('whatsapp_fila')
        .delete()
        .eq('status', 'pendente')
        .eq('instance_token', selectedToken)
        .gte('criado_em', `${hojeStr}T00:00:00`)
        .lte('criado_em', `${hojeStr}T23:59:59`)
        .select('id');
      if (error) throw error;
      const count = data?.length || 0;
      toast.success(`${count} envio${count !== 1 ? 's' : ''} cancelado${count !== 1 ? 's' : ''}`);
      await fetchStats();
    } catch (err: any) {
      console.error('Erro ao cancelar envios:', err);
      toast.error('Erro ao cancelar: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setCancelling(false);
    }
  };

  const handleRetryErros = async () => {
    if (!selectedToken) return;
    setRetrying(true);
    try {
      const hojeDate = new Date();
      const hojeStr = `${hojeDate.getFullYear()}-${String(hojeDate.getMonth() + 1).padStart(2, '0')}-${String(hojeDate.getDate()).padStart(2, '0')}`;
      const { error } = await supabase
        .from('whatsapp_fila')
        .update({ status: 'pendente', erro_mensagem: null } as any)
        .eq('status', 'erro')
        .eq('instance_token', selectedToken)
        .gte('criado_em', `${hojeStr}T00:00:00`)
        .lte('criado_em', `${hojeStr}T23:59:59`);
      if (error) throw error;
      toast.success('Mensagens com erro foram reagendadas para reenvio!');
      await fetchStats();
    } catch (err: any) {
      console.error('Erro ao reagendar:', err);
      toast.error('Erro ao reagendar: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setRetrying(false);
    }
  };

  // Compute counts from the unified list for consistent display
  const unifiedEnviados = unifiedItems.filter(i => i.whatsapp_status === 'enviado').length;
  const unifiedErros = unifiedItems.filter(i => i.whatsapp_status === 'erro').length;
  const unifiedPendentes = unifiedItems.filter(i => i.whatsapp_status === 'pendente' || i.whatsapp_status === 'enviando').length;
  const unifiedTotal = unifiedItems.length;
  const progressPercent = unifiedTotal > 0 ? Math.round(((unifiedEnviados + unifiedErros) / unifiedTotal) * 100) : 0;

  const renderSection = (title: string, items: UnifiedItem[], badgeColor: string) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">{title}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{items.length}</Badge>
        </div>
        <div className="divide-y border rounded-md">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.cliente_nome || 'Sem nome'}</p>
                {item.cliente_telefone && (
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3 shrink-0" />
                    {formatPhone(item.cliente_telefone)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {item.data_prevista && (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(item.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </span>
                )}
                {item.tipo_lembrete_label && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.tipo_lembrete_label}</Badge>
                )}
                {item.valor_parcela != null && (
                  <span className="text-[10px] text-muted-foreground">
                    R$ {item.valor_parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                )}
                <WhatsAppStatusBadge status={item.whatsapp_status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold flex items-center gap-2">
        <MessageCircle className="h-4 w-4" />
        WhatsApp Principal para Lembretes
        {totalPendencias > 0 && (
          <Badge variant="secondary" className="text-xs">{totalPendencias} pendência(s)</Badge>
        )}
      </h3>
      <p className="text-sm text-muted-foreground">
        Selecione qual instância será responsável pelo envio de lembretes de pagamento.
      </p>
      <Select
        value={selectedLembreteInstanceId.includes('|||') ? 'none' : selectedLembreteInstanceId}
        onValueChange={handleSaveLembreteInstance}
        disabled={savingLembrete}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione uma instância" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nenhuma (usar global)</SelectItem>
          {instances.filter(i => i.ativo).map((inst) => (
            <SelectItem key={inst.id} value={inst.id}>
              {inst.nome || inst.server_url} {connectionStatus[inst.id] === 'connected' ? '✅' : connectionStatus[inst.id] === 'disconnected' ? '❌' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {savingLembrete && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
        </p>
      )}

      <div className="rounded-md border p-3 space-y-3">
        {selectedInstance && (
          <p className="text-xs text-muted-foreground">
            📱 Monitorando: <strong>{selectedInstance.nome || selectedInstance.server_url}</strong>
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Envios do dia</span>
          {lembreteStatus === 'loading' && (
            <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Verificando...</Badge>
          )}
          {lembreteStatus === 'no_instance' && (
            <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Selecione uma instância</Badge>
          )}
          {lembreteStatus === 'idle' && (
            <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Não iniciado</Badge>
          )}
          {lembreteStatus === 'sending' && (
            <Badge className="gap-1 bg-amber-500 hover:bg-amber-500"><Loader2 className="h-3 w-3 animate-spin" /> Enviando...</Badge>
          )}
          {lembreteStatus === 'done' && (
            <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3" /> Concluído</Badge>
          )}
          {lembreteStatus === 'done_with_errors' && (
            <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Concluído com erros</Badge>
          )}
        </div>

        {unifiedTotal > 0 && (
          <div className="space-y-2">
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{unifiedEnviados} de {unifiedTotal} mensagens enviadas</span>
              {unifiedErros > 0 && <span className="text-destructive">{unifiedErros} erro(s)</span>}
              {unifiedPendentes > 0 && <span>{unifiedPendentes} pendente(s)</span>}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{stats.contatosUnicos} contato(s) único(s)</span>
            </div>
          </div>
        )}

        {/* Lista unificada de pendências */}
        {isLoadingReminders ? (
          <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Carregando pendências...
          </div>
        ) : totalPendencias > 0 ? (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3 pr-3">
              {renderSection('🔴 Parcelas Vencidas', vencidos, 'destructive')}
              {renderSection('🟡 Vence Hoje', hoje, 'warning')}
              {renderSection('🔵 Vence em 3 dias', tresDias, 'info')}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhuma pendência encontrada.</p>
        )}

        {/* Botão de iniciar envios - visível quando há itens não enviados e não está enviando */}
        {naoEnviados > 0 && !sequentialSending && (
          <Button onClick={handleStartEnvios} disabled={starting || sequentialSending || lembreteStatus === 'no_instance'} className="w-full">
            {starting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Iniciando...</>
            ) : (
              <><Play className="h-4 w-4 mr-2" /> Iniciar Envio ({naoEnviados} não enviado{naoEnviados > 1 ? 's' : ''})</>
            )}
          </Button>
        )}

        {(sequentialSending || lembreteStatus === 'sending') && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">
              {sequentialSending ? 'Enviando sequencialmente...' : 'Atualizando a cada 30 segundos...'}
            </p>
            <Button onClick={handleCancelEnvios} disabled={cancelling} variant="destructive" className="w-full">
              {cancelling ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cancelando...</>
              ) : (
                <><Ban className="h-4 w-4 mr-2" /> Cancelar Envio</>
              )}
            </Button>
          </div>
        )}

        {lembreteStatus === 'done_with_errors' && (
          <Button onClick={handleRetryErros} disabled={retrying} variant="destructive" className="w-full">
            {retrying ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Reagendando...</>
            ) : (
              <><RefreshCw className="h-4 w-4 mr-2" /> Reenviar {stats.erros} com Erro</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
