import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MessageCircle, Play, CheckCircle2, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WhatsAppInstance {
  id: string;
  nome: string;
  server_url: string;
  instance_token: string;
  ativo: boolean;
}

interface InstanceStats {
  instanceToken: string;
  nome: string;
  pendentes: number;
  enviados: number;
  erros: number;
}

interface LembreteStats {
  total: number;
  pendentes: number;
  enviados: number;
  erros: number;
  byInstance: InstanceStats[];
}

type LembreteStatus = 'idle' | 'loading' | 'sending' | 'done' | 'done_with_errors';

interface LembretesSectionProps {
  instances: WhatsAppInstance[];
  selectedLembreteInstanceId: string;
  handleSaveLembreteInstance: (value: string) => void;
  savingLembrete: boolean;
  connectionStatus: Record<string, string>;
}

export default function LembretesSection({
  instances,
  selectedLembreteInstanceId,
  handleSaveLembreteInstance,
  savingLembrete,
  connectionStatus,
}: LembretesSectionProps) {
  const [lembreteStatus, setLembreteStatus] = useState<LembreteStatus>('loading');
  const [stats, setStats] = useState<LembreteStats>({ total: 0, pendentes: 0, enviados: 0, erros: 0, byInstance: [] });
  const [starting, setStarting] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const fetchStats = useCallback(async () => {
    const hoje = new Date();
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('whatsapp_fila')
      .select('id, status, instance_token')
      .gte('criado_em', `${hojeStr}T00:00:00`)
      .lte('criado_em', `${hojeStr}T23:59:59`);

    if (error) {
      console.error('Erro ao buscar fila:', error);
      setLembreteStatus('idle');
      return;
    }

    if (!data || data.length === 0) {
      setStats({ total: 0, pendentes: 0, enviados: 0, erros: 0, byInstance: [] });
      setLembreteStatus('idle');
      return;
    }

    const total = data.length;
    const pendentes = data.filter(d => d.status === 'pendente').length;
    const enviados = data.filter(d => d.status === 'enviado').length;
    const erros = data.filter(d => d.status === 'erro').length;

    // Group by instance_token
    const tokenMap: Record<string, { pendentes: number; enviados: number; erros: number }> = {};
    for (const item of data) {
      const token = item.instance_token || 'global';
      if (!tokenMap[token]) tokenMap[token] = { pendentes: 0, enviados: 0, erros: 0 };
      if (item.status === 'pendente') tokenMap[token].pendentes++;
      else if (item.status === 'enviado') tokenMap[token].enviados++;
      else if (item.status === 'erro') tokenMap[token].erros++;
    }

    // Map tokens to instance names
    const byInstance: InstanceStats[] = Object.entries(tokenMap).map(([token, counts]) => {
      const inst = instances.find(i => i.instance_token === token);
      return {
        instanceToken: token,
        nome: inst?.nome || (token === 'global' ? 'Global' : token.substring(0, 8) + '...'),
        ...counts,
      };
    });

    setStats({ total, pendentes, enviados, erros, byInstance });

    if (pendentes > 0) {
      setLembreteStatus('sending');
    } else if (erros > 0) {
      setLembreteStatus('done_with_errors');
    } else {
      setLembreteStatus('done');
    }
  }, [instances]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Polling every 30s while sending
  useEffect(() => {
    if (lembreteStatus !== 'sending') return;
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [lembreteStatus, fetchStats]);

  const handleStartEnvios = async () => {
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-payment-reminders');
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
    setRetrying(true);
    try {
      const hoje = new Date();
      const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

      const { error } = await supabase
        .from('whatsapp_fila')
        .update({ status: 'pendente', erro_mensagem: null } as any)
        .eq('status', 'erro')
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

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold flex items-center gap-2">
        <MessageCircle className="h-4 w-4" />
        WhatsApp Principal para Lembretes
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

      {/* Status e Botão de Envio */}
      <div className="rounded-md border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Envios do dia</span>
          {lembreteStatus === 'loading' && (
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Verificando...
            </Badge>
          )}
          {lembreteStatus === 'idle' && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> Não iniciado
            </Badge>
          )}
          {lembreteStatus === 'sending' && (
            <Badge className="gap-1 bg-amber-500 hover:bg-amber-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Enviando...
            </Badge>
          )}
          {lembreteStatus === 'done' && (
            <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Concluído
            </Badge>
          )}
          {lembreteStatus === 'done_with_errors' && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Concluído com erros
            </Badge>
          )}
        </div>

        {(lembreteStatus === 'sending' || lembreteStatus === 'done' || lembreteStatus === 'done_with_errors') && stats.total > 0 && (
          <div className="space-y-3">
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stats.enviados} de {stats.total} enviados</span>
              {stats.erros > 0 && <span className="text-destructive">{stats.erros} erro(s)</span>}
              {stats.pendentes > 0 && <span>{stats.pendentes} pendente(s)</span>}
            </div>

            {/* Breakdown por instância */}
            {stats.byInstance.length > 0 && (
              <div className="border-t pt-2 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Detalhamento por telefone:</span>
                {stats.byInstance.map((inst) => {
                  const instTotal = inst.pendentes + inst.enviados + inst.erros;
                  return (
                    <div key={inst.instanceToken} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[140px]" title={inst.nome}>
                        📱 {inst.nome}
                      </span>
                      <div className="flex gap-2">
                        <span className="text-emerald-600">{inst.enviados}/{instTotal}</span>
                        {inst.pendentes > 0 && <span className="text-amber-500">{inst.pendentes} pend.</span>}
                        {inst.erros > 0 && <span className="text-destructive">{inst.erros} erro</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {lembreteStatus === 'idle' && (
          <Button
            onClick={handleStartEnvios}
            disabled={starting}
            className="w-full"
          >
            {starting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Iniciando...</>
            ) : (
              <><Play className="h-4 w-4 mr-2" /> Iniciar Envios de Lembretes</>
            )}
          </Button>
        )}

        {lembreteStatus === 'sending' && (
          <p className="text-xs text-muted-foreground text-center">
            Atualizando a cada 30 segundos...
          </p>
        )}

        {lembreteStatus === 'done_with_errors' && (
          <Button
            onClick={handleRetryErros}
            disabled={retrying}
            variant="destructive"
            className="w-full"
          >
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
