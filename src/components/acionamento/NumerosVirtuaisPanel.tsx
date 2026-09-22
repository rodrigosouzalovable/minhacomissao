import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast } from 'sonner';
import { Loader2, RefreshCw, ShoppingCart, Copy, X, Smartphone, Wallet, Webhook, CheckCircle2, AlertCircle, Ban } from 'lucide-react';

interface Pedido {
  id: string;
  order_id: string;
  provider?: string | null;
  servico: string;
  pais: string | null;
  ddd?: string | null;
  numero: string | null;
  codigo: string | null;
  texto_sms?: string | null;
  status: string;
  custo: number | null;
  banido_em?: string | null;
  expira_em: string | null;
  created_at: string;
}

// Códigos do protocolo handler_api (VirtualSMS e SMS24H)
const SERVICOS = [
  { code: 'wa', name: 'WhatsApp' },
  { code: 'tg', name: 'Telegram' },
  { code: 'go', name: 'Google' },
  { code: 'ig', name: 'Instagram' },
  { code: 'fb', name: 'Facebook' },
];

const PROVEDORES = [
  { id: 'virtualsms', label: 'VirtualSMS (US$, preço variável)', moeda: 'US$', ddd: false },
  { id: 'sms24h', label: 'SMS24H (R$, escolhe DDD)', moeda: 'R$', ddd: true },
];

// DDDs brasileiros válidos
const DDDS = [
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
];

// IDs de país do protocolo (fallback; a lista real vem do provedor)
const PAISES_FALLBACK = [
  { id: '73', nome: 'Brasil' },
  { id: '187', nome: 'Estados Unidos' },
  { id: '117', nome: 'Portugal' },
  { id: '54', nome: 'México' },
  { id: '39', nome: 'Argentina' },
];

const CODIGOS_DDI = new Set([
  '1', '7', '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49',
  '51', '52', '53', '54', '55', '56', '57', '58', '60', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86', '90',
  '91', '92', '93', '94', '95', '98', '211', '212', '213', '216', '218', '220', '221', '222', '223', '224', '225',
  '226', '227', '228', '229', '230', '231', '232', '233', '234', '235', '236', '237', '238', '239', '240',
  '241', '242', '243', '244', '245', '246', '248', '249', '250', '251', '252', '253', '254', '255', '256',
  '257', '258', '260', '261', '262', '263', '264', '265', '266', '267', '268', '269', '290', '291', '297',
  '298', '299', '350', '351', '352', '353', '354', '355', '356', '357', '358', '359', '370', '371', '372',
  '373', '374', '375', '376', '377', '378', '379', '380', '381', '382', '383', '385', '386', '387', '389',
  '420', '421', '423', '500', '501', '502', '503', '504', '505', '506', '507', '508', '509', '590', '591',
  '592', '593', '594', '595', '596', '597', '598', '599', '670', '672', '673', '674', '675', '676',
  '677', '678', '679', '680', '681', '682', '683', '685', '686', '687', '688', '689', '690', '691',
  '692', '850', '852', '853', '855', '856', '880', '886', '960', '961', '962', '963', '964', '965',
  '966', '967', '968', '970', '971', '972', '973', '974', '975', '976', '977', '992', '993', '994',
  '995', '996', '998',
]);

const dadosNumero = (pedido: Pedido) => {
  const completo = String(pedido.numero || '').replace(/\D/g, '');
  if (!completo) return { completo: '', ddi: '', exibicao: 'Número não informado' };
  const ddi = pedido.pais === '73'
    ? '55'
    : [3, 2, 1].map((tamanho) => completo.slice(0, tamanho)).find((codigo) => CODIGOS_DDI.has(codigo)) || '';
  const nacional = ddi && completo.startsWith(ddi) ? completo.slice(ddi.length) : completo;
  const exibicao = ddi ? `+${ddi} ${nacional}` : `+${completo}`;
  return { completo, ddi, exibicao };
};

const statusLabel: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  aguardando: { label: 'Aguardando SMS', variant: 'outline' },
  recebido: { label: 'Código recebido', variant: 'default' },
  cancelado: { label: 'Cancelado', variant: 'secondary' },
  expirado: { label: 'Expirado', variant: 'destructive' },
  reembolsado: { label: 'Reembolsado', variant: 'secondary' },
};



const invoke = async (payload: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('virtualsms', { body: payload });
  if (error) {
    // Erros de negócio vêm com status 4xx: extrai a mensagem real do corpo
    let msg = error.message;
    try {
      const ctx = (error as any).context;
      const body = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
      if (body?.error) msg = body.error;
    } catch { /* mantém mensagem original */ }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
};


const usd = (v: number | null | undefined) => `US$ ${(Number(v) || 0).toFixed(2)}`;

interface Props {
  onConectar?: (numero: string) => void;
}

export function NumerosVirtuaisPanel({ onConectar }: Props) {
  const qc = useQueryClient();
  const [provider, setProvider] = useState('virtualsms');
  const [servico, setServico] = useState('wa');
  const [tipoNumero, setTipoNumero] = useState<'brasil' | 'internacional'>('brasil');
  const [pais, setPais] = useState('73');
  const [paisAleatorio, setPaisAleatorio] = useState(false);
  const [ddd, setDdd] = useState('62');
  const [novoLimite, setNovoLimite] = useState('');
  const [novoTeto, setNovoTeto] = useState('');
  const [abaAtiva, setAbaAtiva] = useState(true);
  const [mostrarSecret, setMostrarSecret] = useState(false);

  const provInfo = PROVEDORES.find((p) => p.id === provider) || PROVEDORES[0];
  const moeda = (v: number | null | undefined) => `${provInfo.moeda} ${(Number(v) || 0).toFixed(2)}`;
  const suportaDdd = provInfo.ddd && pais === '73';

  // Visibility guard: sem aba em foco, nenhuma consulta ao provedor (economia de custo)
  useEffect(() => {
    const onVis = () => setAbaAtiva(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const saldoQuery = useQuery({
    queryKey: ['virtualsms-saldo', provider],
    queryFn: () => invoke({ action: 'saldo', provider }),

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
    queryKey: ['virtualsms-paises', provider],
    queryFn: () => invoke({ action: 'paises', provider }),
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const paises: { id: string; nome: string }[] = useMemo(
    () => paisesQuery.data?.paises?.length ? paisesQuery.data.paises : PAISES_FALLBACK,
    [paisesQuery.data?.paises],
  );
  const paisesInternacionais = useMemo(() => paises.filter((item) => item.id !== '73'), [paises]);
  const paisSelecionado = paises.find((item) => item.id === pais);

  useEffect(() => {
    if (tipoNumero === 'brasil') {
      if (pais !== '73') setPais('73');
      return;
    }

    if (!paisAleatorio && (pais === '73' || !paises.some((item) => item.id === pais))) {
      const primeiroInternacional = paisesInternacionais[0];
      if (primeiroInternacional) setPais(primeiroInternacional.id);
    }
  }, [pais, paisAleatorio, paises, paisesInternacionais, tipoNumero]);

  // Preço mínimo disponível — mostra a variação antes de comprar
  const precoQuery = useQuery({
    queryKey: ['virtualsms-preco', provider, servico, pais, paisAleatorio],
    queryFn: () => invoke(paisAleatorio && tipoNumero === 'internacional'
      ? { action: 'melhor_pais', provider, servico, max_preco: novoTeto.trim() ? Number(novoTeto.replace(',', '.')) : undefined }
      : { action: 'precos', provider, servico, pais }),
    enabled: abaAtiva && !!servico && (tipoNumero === 'brasil' || paisAleatorio || pais !== '73'),
    // O estoque muda rapidamente; uma cotação antiga pode acabar antes da compra.
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: false,
  });


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
      if (p.status !== 'aguardando' || p.banido_em) return false;
      const limite = p.expira_em ? new Date(p.expira_em).getTime() : new Date(p.created_at).getTime() + 20 * 60 * 1000;
      return limite > Date.now();
    }) || null;
  }, [pedidos]);

  const cancelamentosPendentes = useMemo(() => pedidos.filter((p) => {
    if (p.status !== 'aguardando' || !p.banido_em || p.codigo) return false;
    const limite = p.expira_em ? new Date(p.expira_em).getTime() : new Date(p.created_at).getTime() + 20 * 60 * 1000;
    return limite > Date.now();
  }), [pedidos]);

  const ultimoRecebido = pedidos.find((p) => p.status === 'recebido' && p.codigo);
  const webhookAtivo = !!webhookQuery.data?.ultimo_evento_em;

  // Relógio para liberar o cancelamento (provedor só aceita após 5 min da compra)
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    if (!pedidoAtivo && cancelamentosPendentes.length === 0) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pedidoAtivo, cancelamentosPendentes.length]);
  const segundosParaCancelar = (p: Pedido) => Math.max(0, Math.ceil((new Date(p.created_at).getTime() + 5 * 60 * 1000 - agora) / 1000));


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
      if (!pedidoAtivo) return null;
      const res = await invoke({
        action: 'status',
        provider: pedidoAtivo.provider || 'virtualsms',
        order_id: pedidoAtivo.order_id,
      });
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
    mutationFn: async () => {
      const paisCompra = paisAleatorio && tipoNumero === 'internacional' ? String(precoQuery.data?.pais || '') : pais;
      if (!paisCompra) throw new Error(precoQuery.data?.mensagem || 'Nenhum país internacional disponível dentro do teto configurado.');
      const resultado = await invoke({
        action: 'comprar',
        provider,
        servico,
        pais: paisCompra,
        ddd: suportaDdd ? ddd : undefined,
        max_preco: novoTeto.trim() ? Number(novoTeto.replace(',', '.')) : undefined,
      });
      if (resultado?.ok === false || !resultado?.pedido) {
        throw new Error(resultado?.mensagem || 'O número ficou indisponível antes da compra. Tente novamente.');
      }
      return resultado;
    },
    onSuccess: (res) => {
      const numero = res?.pedido ? dadosNumero(res.pedido as Pedido).exibicao : '';
      toast.success(numero ? `Número comprado: ${numero}` : 'Número comprado');
      qc.invalidateQueries({ queryKey: ['virtualsms-pedidos'] });
      qc.invalidateQueries({ queryKey: ['virtualsms-saldo'] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: ['virtualsms-preco'] });
    },
  });

  const cancelar = useMutation({
    mutationFn: (p: Pedido) =>
      invoke({ action: 'cancelar', provider: p.provider || 'virtualsms', order_id: p.order_id }),
    onSuccess: () => {
      toast.success('Pedido cancelado — o provedor devolve o valor.');
      qc.invalidateQueries({ queryKey: ['virtualsms-pedidos'] });
      qc.invalidateQueries({ queryKey: ['virtualsms-saldo'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const marcarBanido = useMutation({
    mutationFn: (p: Pedido) =>
      invoke({ action: 'marcar_banido', order_id: p.order_id, banido: !p.banido_em }),
    onSuccess: (_r, p) => {
      toast.success(p.banido_em ? 'Marcação de banido removida' : 'Número marcado como banido');
      qc.invalidateQueries({ queryKey: ['virtualsms-pedidos'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Cancelamento automático: pedido ativo marcado como banido é cancelado assim que o provedor libera (5 min)
  const autoCanceladoRef = useRef(new Set<string>());
  useEffect(() => {
    for (const pendente of cancelamentosPendentes) {
      if (segundosParaCancelar(pendente) > 0 || autoCanceladoRef.current.has(pendente.order_id)) continue;
      autoCanceladoRef.current.add(pendente.order_id);
      toast.info('Número banido — solicitando o cancelamento automático...');
      cancelar.mutate(pendente);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora, cancelamentosPendentes]);

  const salvarLimite = useMutation({
    mutationFn: () => invoke({ action: 'salvar_limite', limite_mensal_usd: Number(novoLimite.replace(',', '.')) }),
    onSuccess: () => {
      toast.success('Limite mensal atualizado');
      setNovoLimite('');
      qc.invalidateQueries({ queryKey: ['virtualsms-saldo'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarTeto = useMutation({
    mutationFn: () => invoke({ action: 'salvar_limite', preco_max_usd: Number(novoTeto.replace(',', '.')) }),
    onSuccess: () => {
      toast.success('Preço máximo por número atualizado');
      qc.invalidateQueries({ queryKey: ['virtualsms-saldo'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saldo = saldoQuery.data;
  const gasto = Number(saldo?.gasto_mes || 0);
  const limite = Number(saldo?.limite_mensal_usd || 0);
  const tetoAtual = Number(saldo?.preco_max_usd ?? 0.9);
  const bloqueado = limite > 0 && gasto >= limite;
  const menorPreco = precoQuery.data?.menor_preco as number | null | undefined;


  const copiar = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success('Copiado');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          Números Virtuais (VirtualSMS / SMS24H)
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
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Origem do número</Label>
            <ToggleGroup
              type="single"
              value={tipoNumero}
              onValueChange={(value) => {
                if (value === 'brasil' || value === 'internacional') {
                  setTipoNumero(value);
                  if (value === 'brasil') setPaisAleatorio(false);
                }
              }}
              className="w-fit rounded-md border p-1"
            >
              <ToggleGroupItem value="brasil" aria-label="Escolher número brasileiro" className="h-8 px-4">
                Brasil
              </ToggleGroupItem>
              <ToggleGroupItem value="internacional" aria-label="Escolher número internacional" className="h-8 px-4">
                Internacional
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Provedor</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVEDORES.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          {tipoNumero === 'brasil' ? (
            <div className="space-y-1">
              <Label className="text-xs">País</Label>
              <div className="flex h-9 w-44 items-center rounded-md border bg-muted/40 px-3 text-sm">Brasil</div>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">País internacional</Label>
              <Select
                value={paisAleatorio ? '__mais_barato__' : pais === '73' ? '' : pais}
                onValueChange={(value) => {
                  if (value === '__mais_barato__') {
                    setPaisAleatorio(true);
                    return;
                  }
                  setPaisAleatorio(false);
                  setPais(value);
                }}
                disabled={!paisesInternacionais.length}
              >
                <SelectTrigger className="h-9 w-52">
                  <SelectValue placeholder={paisesQuery.isLoading ? 'Carregando países...' : 'Selecione um país'} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__mais_barato__">País aleatório — mais barato</SelectItem>
                  {paisesInternacionais.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {suportaDdd && (
            <div className="space-y-1">
              <Label className="text-xs">DDD</Label>
              <Select value={ddd} onValueChange={setDdd}>
                <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {DDDS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Preço máx. por número</Label>
            <div className="flex gap-1">
              <Input
                value={novoTeto}
                onChange={(e) => setNovoTeto(e.target.value)}
                placeholder={tetoAtual.toFixed(2)}
                className="h-9 w-24"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-9"
                onClick={() => salvarTeto.mutate()}
                disabled={!novoTeto.trim() || salvarTeto.isPending}
                title="Salva este teto como padrão para as próximas compras"
              >
                Salvar
              </Button>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => comprar.mutate()}
            disabled={comprar.isPending || bloqueado || !!pedidoAtivo || (tipoNumero === 'internacional' && !paisAleatorio && pais === '73') || (paisAleatorio && (precoQuery.isFetching || !precoQuery.data?.pais))}
            title={bloqueado ? 'Limite mensal atingido' : pedidoAtivo ? 'Finalize ou cancele o pedido atual' : undefined}
          >
            {comprar.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-1" />}
            Comprar número
          </Button>
          {bloqueado && (
            <span className="text-xs text-destructive">Limite mensal atingido — aumente o limite para comprar.</span>
          )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            {tipoNumero === 'brasil' ? 'Brasil' : paisAleatorio ? 'País aleatório — mais barato' : paisSelecionado?.nome || 'País não selecionado'}
          </Badge>
          {precoQuery.isFetching ? (
            <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Consultando disponibilidade...</span>
          ) : menorPreco != null ? (
            <span>Disponível agora a partir de <strong className="text-foreground">{moeda(menorPreco)}</strong>.</span>
          ) : precoQuery.isError ? (
            <span className="text-destructive">Não foi possível consultar a disponibilidade. Tente novamente.</span>
          ) : precoQuery.data?.mensagem ? (
            <span>{precoQuery.data.mensagem}</span>
          ) : (
            <span>Nenhum preço disponível para esta seleção neste momento.</span>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          O preço do provedor é dinâmico — a compra é bloqueada acima do teto de <strong>{provInfo.moeda} {(novoTeto.trim() ? Number(novoTeto.replace(',', '.')) : tetoAtual).toFixed(2)}</strong>.
          {tipoNumero === 'brasil' && provInfo.ddd
            ? ' O SMS24H permite escolher o DDD do número.'
            : tipoNumero === 'brasil'
              ? ' A VirtualSMS não permite escolher o DDD — use o SMS24H para isso.'
               : paisAleatorio
                 ? ' O país será escolhido automaticamente pelo menor preço disponível dentro do teto.'
                 : ' Números internacionais não possuem seleção de DDD brasileiro.'}
        </p>

        {cancelamentosPendentes.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Cancelamento pendente</Label>
            {cancelamentosPendentes.map((p) => {
              const numero = dadosNumero(p);
              const segundos = segundosParaCancelar(p);
              const nomePais = paises.find((item) => item.id === p.pais)?.nome || 'Internacional';
              return (
                <div key={p.id} className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Ban className="h-4 w-4 text-destructive" />
                    <strong className="text-sm">{nomePais}</strong>
                    <Badge variant="destructive" className="text-[10px]">Banido</Badge>
                    <span className="font-mono text-xs">{numero.exibicao}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {segundos > 0
                      ? `Cancelamento automático quando o fornecedor liberar, em ${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}. Você já pode comprar outro número.`
                      : 'Solicitando o cancelamento automático ao fornecedor...'}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Pedido ativo / último código */}
        {(pedidoAtivo || ultimoRecebido) && (() => {
          const p = pedidoAtivo || ultimoRecebido!;
          const st = statusLabel[p.status] || { label: p.status, variant: 'outline' as const };
          const numero = dadosNumero(p);
          const nomePais = paises.find((item) => item.id === p.pais)?.nome || (p.pais === '73' ? 'Brasil' : 'Internacional');
          return (
            <div className="rounded-md border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{nomePais}</span>
                <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                <span className="text-xs text-muted-foreground">{p.servico} · {usd(p.custo)}</span>
              </div>

              {numero.completo && (
                <div className="grid gap-2 sm:grid-cols-[minmax(90px,auto)_1fr]">
                  <div className="rounded-md border bg-background p-2">
                    <span className="block text-[10px] text-muted-foreground">DDI</span>
                    <div className="flex items-center justify-between gap-2">
                      <strong className="font-mono">{numero.ddi ? `+${numero.ddi}` : 'Não identificado'}</strong>
                      {numero.ddi && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copiar(numero.ddi)} title="Copiar DDI"><Copy className="h-3.5 w-3.5" /></Button>}
                    </div>
                  </div>
                  <div className="rounded-md border bg-background p-2">
                    <span className="block text-[10px] text-muted-foreground">Número completo para WhatsApp</span>
                    <div className="flex items-center justify-between gap-2">
                      <strong className="font-mono">{numero.exibicao}</strong>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copiar(numero.completo)} title="Copiar número completo"><Copy className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </div>
              )}

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
                  <Button size="sm" variant="secondary" onClick={() => onConectar(`+${numero.completo}`)}>
                    Conectar na UAZAPI
                  </Button>
                )}
                {p.status === 'aguardando' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => cancelar.mutate(p)}
                    disabled={cancelar.isPending || segundosParaCancelar(p) > 0}
                    title={segundosParaCancelar(p) > 0 ? 'O provedor só permite cancelar 5 minutos após a compra' : undefined}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    {segundosParaCancelar(p) > 0
                      ? `Cancelar em ${Math.floor(segundosParaCancelar(p) / 60)}:${String(segundosParaCancelar(p) % 60).padStart(2, '0')}`
                      : 'Cancelar pedido'}
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
                const prov = PROVEDORES.find((x) => x.id === (p.provider || 'virtualsms'));
                const numero = dadosNumero(p);
                const nomePais = paises.find((item) => item.id === p.pais)?.nome || (p.pais === '73' ? 'Brasil' : 'Internacional');
                return (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                    <span className="font-mono">{numero.exibicao}</span>
                    <span className="text-muted-foreground">{nomePais}{numero.ddi ? ` · DDI +${numero.ddi}` : ''}</span>
                    <span className="text-muted-foreground">{p.servico}</span>
                    <span className="text-muted-foreground">{p.provider === 'sms24h' ? 'SMS24H' : 'VirtualSMS'}</span>
                    {p.codigo && <code className="font-mono font-semibold">{p.codigo}</code>}
                    <Badge variant={st.variant} className="text-[10px] px-1.5 py-0">{st.label}</Badge>
                    {p.banido_em && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-1">
                        <Ban className="h-2.5 w-2.5" /> Banido
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => marcarBanido.mutate(p)}
                      disabled={marcarBanido.isPending}
                      title="Registra que este número já veio banido no WhatsApp"
                    >
                      {p.banido_em ? 'Desmarcar' : 'Marcar banido'}
                    </Button>
                    <span className="ml-auto text-muted-foreground">
                      {`${prov?.moeda || 'US$'} ${(Number(p.custo) || 0).toFixed(2)}`}
                    </span>
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
