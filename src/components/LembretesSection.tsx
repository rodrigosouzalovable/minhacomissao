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

interface LembreteStats {
  total: number;
  pendentes: number;
  enviados: number;
  erros: number;
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
  const [stats, setStats] = useState<LembreteStats>({ total: 0, pendentes: 0, enviados: 0, erros: 0 });
  const [starting, setStarting] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const fetchStats = useCallback(async () => {
    const hoje = new Date();
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('whatsapp_fila')
      .select('id, status')
      .gte('criado_em', `${hojeStr}T00:00:00`)
      .lte('criado_em', `${hojeStr}T23:59:59`);

    if (error) {
      console.error('Erro ao buscar fila:', error);
      setLembreteStatus('idle');
      return;
    }

    if (!data || data.length === 0) {
      setStats({ total: 0, pendentes: 0, enviados: 0, erros: 0 });
      setLembreteStatus('idle');
      return;
    }

    const total = data.length;
    const pendentes = data.filter(d => d.status === 'pendente').length;
    const enviados = data.filter(d => d.status === 'enviado').length;
    const erros = data.filter(d => d.status === 'erro').length;

    setStats({ total, pendentes, enviados, erros });

    if (pendentes > 0) {
      setLembreteStatus('sending');
    } else {
      setLembreteStatus('done');
    }
  }, []);

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
        </div>

        {(lembreteStatus === 'sending' || lembreteStatus === 'done') && stats.total > 0 && (
          <div className="space-y-2">
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stats.enviados} de {stats.total} enviados</span>
              {stats.erros > 0 && <span className="text-destructive">{stats.erros} erro(s)</span>}
              {stats.pendentes > 0 && <span>{stats.pendentes} pendente(s)</span>}
            </div>
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
      </div>
    </div>
  );
}
