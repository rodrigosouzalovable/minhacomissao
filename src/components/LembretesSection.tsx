import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageCircle, Play, CheckCircle2, Clock, AlertTriangle, RefreshCw, Users, Phone, Ban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePaymentReminders } from '@/hooks/usePaymentReminders';

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
  tipo: 'vencido' | 'hoje' | 'tres_dias';
  whatsapp_status: 'enviado' | 'pendente' | 'erro' | 'nao_enviado';
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
      .select('id, status, telefone, cliente_nome, tipo_lembrete, instance_token')
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
    // Find matching fila item by phone
    const filaMatch = filaItems.find(f => normalizePhone(f.telefone) === rPhone && rPhone.length > 0);
    let whatsapp_status: UnifiedItem['whatsapp_status'] = 'nao_enviado';
    if (filaMatch) {
      if (filaMatch.status === 'enviado') whatsapp_status = 'enviado';
      else if (filaMatch.status === 'erro') whatsapp_status = 'erro';
      else whatsapp_status = 'pendente';
    }
    return {
      id: r.id,
      cliente_nome: r.cliente_nome,
      cliente_telefone: r.cliente_telefone || null,
      valor_parcela: r.valor_parcela,
      tipo: r.tipo,
      whatsapp_status,
    };
  });

  const vencidos = unifiedItems.filter(i => i.tipo === 'vencido');
  const hoje = unifiedItems.filter(i => i.tipo === 'hoje');
  const tresDias = unifiedItems.filter(i => i.tipo === 'tres_dias');
  const totalPendencias = unifiedItems.length;

  const handleStartEnvios = async () => {
    setStarting(true);
    try {
      const body: Record<string, string> = {};
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
      } else {
        toast.success(`${result.agendados} lembretes agendados com sucesso!`);
        await fetchStats();
      }
    } catch (err: any) {
      console.error('Erro ao iniciar envios:', err);
      toast.error('Erro ao iniciar envios: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setStarting(false);
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

  const progressPercent = stats.total > 0 ? Math.round(((stats.enviados + stats.erros) / stats.total) * 100) : 0;

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

        {stats.total > 0 && (
          <div className="space-y-2">
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stats.enviados} de {stats.total} mensagens enviadas</span>
              {stats.erros > 0 && <span className="text-destructive">{stats.erros} erro(s)</span>}
              {stats.pendentes > 0 && <span>{stats.pendentes} pendente(s)</span>}
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

        {/* Botão de iniciar envios - sempre visível quando há itens não enviados */}
        {naoEnviados > 0 && (
          <Button onClick={handleStartEnvios} disabled={starting || lembreteStatus === 'no_instance'} className="w-full">
            {starting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Iniciando...</>
            ) : (
              <><Play className="h-4 w-4 mr-2" /> Iniciar Envio ({naoEnviados} não enviado{naoEnviados > 1 ? 's' : ''})</>
            )}
          </Button>
        )}

        {lembreteStatus === 'sending' && (
          <p className="text-xs text-muted-foreground text-center">Atualizando a cada 30 segundos...</p>
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
