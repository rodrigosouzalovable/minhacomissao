import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, RefreshCw, ShoppingCart, Copy, X, Smartphone, Wallet, Webhook, CheckCircle2, AlertCircle } from 'lucide-react';

interface Pedido {
  id: string;
  order_id: string;
  servico: string;
  pais: string | null;
  numero: string | null;
  codigo: string | null;
  texto_sms?: string | null;
  status: string;
  custo: number | null;
  expira_em: string | null;
  created_at: string;
}

// Códigos do protocolo da VirtualSMS (handler_api)
const SERVICOS = [
  { code: 'wa', name: 'WhatsApp' },
  { code: 'tg', name: 'Telegram' },
  { code: 'go', name: 'Google' },
  { code: 'ig', name: 'Instagram' },
  { code: 'fb', name: 'Facebook' },
];

// IDs de país do protocolo (fallback; a lista real vem do provedor)
const PAISES_FALLBACK = [
  { id: '73', nome: 'Brasil' },
  { id: '187', nome: 'Estados Unidos' },
  { id: '117', nome: 'Portugal' },
  { id: '54', nome: 'México' },
  { id: '39', nome: 'Argentina' },
];

const statusLabel: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  aguardando: { label: 'Aguardando SMS', variant: 'outline' },
  recebido: { label: 'Código recebido', variant: 'default' },
  cancelado: { label: 'Cancelado', variant: 'secondary' },
  expirado: { label: 'Expirado', variant: 'destructive' },
  reembolsado: { label: 'Reembolsado', variant: 'secondary' },
};


const invoke = async (payload: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('virtualsms', { body: payload });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
};

const usd = (v: number | null | undefined) => `US$ ${(Number(v) || 0).toFixed(2)}`;

interface Props {
  onConectar?: (numero: string) => void;
}

export function NumerosVirtuaisPanel({ onConectar }: Props) {
  const qc = useQueryClient();
  const [servico, setServico] = useState('wa');
  const [pais, setPais] = useState('73');
  const [novoLimite, setNovoLimite] = useState('');
  const [abaAtiva, setAbaAtiva] = useState(true);
  const [mostrarSecret, setMostrarSecret] = useState(false);

  // Visibility guard: sem aba em foco, nenhuma consulta ao provedor (economia de custo)
  useEffect(() => {
    const onVis = () => setAbaAtiva(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const saldoQuery = useQuery({
    queryKey: ['virtualsms-saldo'],
    queryFn: () => invoke({ action: 'saldo' }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const webhookQuery = useQuery({
    queryKey: ['virtualsms-webhook'],
    queryFn: () => invoke({ action: 'webhook_info' }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const paisesQuery = useQuery({
    queryKey: ['virtualsms-paises'],
    queryFn: () => invoke({ action: 'paises' }),
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const paises: { id: string; nome: string }[] =
    paisesQuery.data?.paises?.length ? paisesQuery.data.paises : PAISES_FALLBACK;

  const pedidosQuery = useQuery({
    queryKey: ['virtualsms-pedidos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtualsms_pedidos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as Pedido[];
    },
    staleTime: 30_000,
  });

  const pedidos = pedidosQuery.data || [];

  // Pedido ativo = aguardando e ainda dentro da janela de 20 min
  const pedidoAtivo = useMemo(() => {
    return pedidos.find((p) => {
      if (p.status !== 'aguardando') return false;
      const limite = p.expira_em ? new Date(p.expira_em).getTime() : new Date(p.created_at).getTime() + 20 * 60 * 1000;
      return limite > Date.now();
    }) || null;
  }, [pedidos]);

  const ultimoRecebido = pedidos.find((p) => p.status === 'recebido' && p.codigo);
  const webhookAtivo = !!webhookQuery.data?.ultimo_evento_em;

  // Realtime: com o webhook configurado, o código chega por push (sem consultar o provedor)
  useEffect(() => {
    const canal = supabase
      .channel('virtualsms-pedidos-rt')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'virtualsms_pedidos' },
        (payload: any) => {
          qc.invalidateQueries({ queryKey: ['virtualsms-pedidos'] });
          if (payload?.new?.codigo && !payload?.old?.codigo) {
            toast.success(`Código recebido: ${payload.new.codigo}`);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [qc]);

  // Rede de segurança: verificação a cada 20s, só com pedido ativo e aba visível.
  // Desligada quando o webhook já recebeu eventos.
  useQuery({
    queryKey: ['virtualsms-status', pedidoAtivo?.order_id],
    queryFn: async () => {
      const res = await invoke({ action: 'status', order_id: pedidoAtivo!.order_id });
      qc.invalidateQueries({ queryKey: ['virtualsms-pedidos'] });
      if (res?.codigo) toast.success(`Código recebido: ${res.codigo}`);
      return res;
    },
    enabled: !!pedidoAtivo && abaAtiva && !webhookAtivo,
    refetchInterval: 20000,
    refetchOnWindowFocus: false,
    retry: false,
  });


  const comprar = useMutation({
    mutationFn: () => invoke({ action: 'comprar', servico, pais }),
    onSuccess: (res) => {
      toast.success(res?.pedido?.numero ? `Número comprado: ${res.pedido.numero}` : 'Número comprado');
      qc.invalidateQueries({ queryKey: ['virtualsms-pedidos'] });
      qc.invalidateQueries({ queryKey: ['virtualsms-saldo'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelar = useMutation({
    mutationFn: (orderId: string) => invoke({ action: 'cancelar', order_id: orderId }),
    onSuccess: () => {
      toast.success('Pedido cancelado — o provedor devolve o valor.');
      qc.invalidateQueries({ queryKey: ['virtualsms-pedidos'] });
      qc.invalidateQueries({ queryKey: ['virtualsms-saldo'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarLimite = useMutation({
    mutationFn: () => invoke({ action: 'salvar_limite', limite_mensal_usd: Number(novoLimite.replace(',', '.')) }),
    onSuccess: () => {
      toast.success('Limite mensal atualizado');
      setNovoLimite('');
      qc.invalidateQueries({ queryKey: ['virtualsms-saldo'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saldo = saldoQuery.data;
  const gasto = Number(saldo?.gasto_mes || 0);
  const limite = Number(saldo?.limite_mensal_usd || 0);
  const bloqueado = limite > 0 && gasto >= limite;

  const copiar = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success('Copiado');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          Números Virtuais (VirtualSMS)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Saldo e limite */}
        <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              Saldo:{' '}
              <strong>
                {saldoQuery.isLoading ? '...' : saldoQuery.isError ? '—' : usd(saldo?.saldo)}
              </strong>
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            Gasto no mês: <strong className="text-foreground">{usd(gasto)}</strong>
            {limite > 0 && <> de {usd(limite)}</>}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => saldoQuery.refetch()}
            disabled={saldoQuery.isFetching}
          >
            {saldoQuery.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Limite mensal (US$)</Label>
            <Input
              value={novoLimite}
              onChange={(e) => setNovoLimite(e.target.value)}
              placeholder={limite ? String(limite) : '20'}
              className="h-8 w-24"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => salvarLimite.mutate()}
              disabled={!novoLimite.trim() || salvarLimite.isPending}
            >
              Salvar
            </Button>
          </div>
        </div>

        {saldoQuery.isError && (
          <p className="text-xs text-destructive">{(saldoQuery.error as Error).message}</p>
        )}

        {/* Webhook: SMS em tempo real */}
        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Webhook className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Webhook (SMS em tempo real)</span>
            {webhookAtivo ? (
              <Badge variant="default" className="text-[10px] gap-1">
                <CheckCircle2 className="h-3 w-3" /> Ativo
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] gap-1">
                <AlertCircle className="h-3 w-3" /> Nunca recebeu evento
              </Badge>
            )}
            {webhookQuery.data?.ultimo_evento_em && (
              <span className="text-xs text-muted-foreground">
                Último evento: {new Date(webhookQuery.data.ultimo_evento_em).toLocaleString('pt-BR')}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => webhookQuery.refetch()}
              disabled={webhookQuery.isFetching}
            >
              {webhookQuery.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Webhook URL (recomendada — já com token)</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={webhookQuery.data?.webhook_url_token || webhookQuery.data?.webhook_url || ''}
                className="h-8 font-mono text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copiar(webhookQuery.data?.webhook_url_token || webhookQuery.data?.webhook_url || '')}
                disabled={!webhookQuery.data?.webhook_url}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Use esta URL no site: o token já autentica o evento, independente do formato de assinatura do provedor.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Secret Key</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                type={mostrarSecret ? 'text' : 'password'}
                value={webhookQuery.data?.secret || ''}
                className="h-8 font-mono text-xs"
              />
              <Button size="sm" variant="outline" onClick={() => setMostrarSecret((v) => !v)}>
                {mostrarSecret ? 'Ocultar' : 'Mostrar'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copiar(webhookQuery.data?.secret || '')}
                disabled={!webhookQuery.data?.secret}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {webhookQuery.data?.ultima_rejeicao_em && !webhookAtivo && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 space-y-1">
              <p className="text-xs font-medium text-destructive">
                Última tentativa recusada em {new Date(webhookQuery.data.ultima_rejeicao_em).toLocaleString('pt-BR')}
              </p>
              <p className="text-[11px] text-muted-foreground">{webhookQuery.data.ultima_rejeicao_motivo}</p>
              {webhookQuery.data.ultima_rejeicao_debug && (
                <p className="text-[10px] font-mono break-all text-muted-foreground/80">
                  {webhookQuery.data.ultima_rejeicao_debug}
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Em virtualsms.de → Dashboard → Webhook Configuration: cole a <strong>URL com token</strong> acima, cole a
            Secret Key no campo Secret Key, marque <strong>SMS Received</strong> e <strong>Status Changed</strong> e
            salve. Com isso o código chega na hora, mesmo com esta aba fechada.
          </p>

        </div>


        {/* Compra */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Serviço</Label>
            <Select value={servico} onValueChange={setServico}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICOS.map((s) => (
                  <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">País</Label>
            <Select value={pais} onValueChange={setPais}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {paises.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            size="sm"
            onClick={() => comprar.mutate()}
            disabled={comprar.isPending || bloqueado || !!pedidoAtivo}
            title={bloqueado ? 'Limite mensal atingido' : pedidoAtivo ? 'Finalize ou cancele o pedido atual' : undefined}
          >
            {comprar.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-1" />}
            Comprar número
          </Button>
          {bloqueado && (
            <span className="text-xs text-destructive">Limite mensal atingido — aumente o limite para comprar.</span>
          )}
        </div>

        {/* Pedido ativo / último código */}
        {(pedidoAtivo || ultimoRecebido) && (() => {
          const p = pedidoAtivo || ultimoRecebido!;
          const st = statusLabel[p.status] || { label: p.status, variant: 'outline' as const };
          return (
            <div className="rounded-md border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-semibold">{p.numero || 'Número não informado'}</span>
                {p.numero && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copiar(p.numero!)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                <span className="text-xs text-muted-foreground">{p.servico}{p.pais ? ` · ${p.pais}` : ''} · {usd(p.custo)}</span>
              </div>

              {p.codigo ? (
                <div className="flex items-center gap-2">
                  <code className="text-lg font-mono font-bold tracking-widest bg-background px-2 py-1 rounded border">
                    {p.codigo}
                  </code>
                  <Button variant="outline" size="sm" onClick={() => copiar(p.codigo!)}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copiar código
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Aguardando o SMS {abaAtiva ? '(verificando a cada 5s)' : '(pausado — volte para esta aba)'}
                </p>
              )}

              <div className="flex gap-2">
                {p.numero && onConectar && (
                  <Button size="sm" variant="secondary" onClick={() => onConectar(p.numero!)}>
                    Conectar na UAZAPI
                  </Button>
                )}
                {p.status === 'aguardando' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => cancelar.mutate(p.order_id)}
                    disabled={cancelar.isPending}
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Cancelar pedido
                  </Button>
                )}
              </div>
            </div>
          );
        })()}

        {/* Histórico */}
        {pedidos.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Histórico</Label>
            <div className="rounded-md border divide-y">
              {pedidos.map((p) => {
                const st = statusLabel[p.status] || { label: p.status, variant: 'outline' as const };
                return (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                    <span className="font-mono">{p.numero || '—'}</span>
                    <span className="text-muted-foreground">{p.servico}</span>
                    {p.codigo && <code className="font-mono font-semibold">{p.codigo}</code>}
                    <Badge variant={st.variant} className="text-[10px] px-1.5 py-0">{st.label}</Badge>
                    <span className="ml-auto text-muted-foreground">{usd(p.custo)}</span>
                    <span className="text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
