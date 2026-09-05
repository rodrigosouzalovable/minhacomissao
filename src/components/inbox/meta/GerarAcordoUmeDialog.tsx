import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Bot, CheckCircle2, Play, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';

const soDigitos = (v: string) => (v || '').replace(/\D/g, '');
const formatCpf = (d: string) =>
  d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d;

const round2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number | null) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const numeroBR = (v: string) => {
  const limpo = (v || '').replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
};

const isDataBR = (v: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(v || '');

function somaDias(dataBR: string, dias: number) {
  if (!isDataBR(dataBR)) return '';
  const [d, m, y] = dataBR.split('/').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(dt.getUTCDate())}/${p(dt.getUTCMonth() + 1)}/${dt.getUTCFullYear()}`;
}

export function GerarAcordoUmeDialog({
  open,
  onOpenChange,
  cpfInicial,
  telefone,
  conversaId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cpfInicial?: string | null;
  telefone?: string | null;
  conversaId?: string | null;
}) {
  const { isAdmin } = useUserRole();

  const [cpf, setCpf] = useState('');
  const [totalDivida, setTotalDivida] = useState('');
  const [valorParcela, setValorParcela] = useState('');
  const [parcelas, setParcelas] = useState('10');
  const [dataEntrada, setDataEntrada] = useState('');

  const [carregandoDivida, setCarregandoDivida] = useState(false);
  const [sessao, setSessao] = useState<{ logado: boolean; mensagem?: string } | null>(null);
  const [roboIndisponivel, setRoboIndisponivel] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const [efetivando, setEfetivando] = useState(false);
  const [simulacao, setSimulacao] = useState<any>(null);
  const [efetivado, setEfetivado] = useState(false);
  const [erro, setErro] = useState('');

  const [configOpen, setConfigOpen] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [token, setToken] = useState('');
  const [ativo, setAtivo] = useState(false);
  const [temToken, setTemToken] = useState(false);
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const chamar = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('ume-backoffice-acordo', { body: payload });
    if (error) throw error;
    if ((data as any)?.error === 'robo_nao_configurado') {
      setRoboIndisponivel(true);
      throw new Error('O robô da UME ainda não está ligado/configurado.');
    }
    if ((data as any)?.error === 'layout_ume_mudou') {
      throw new Error('O layout do backoffice da UME mudou. O administrador já foi avisado.');
    }
    if (!(data as any)?.success) throw new Error((data as any)?.error || 'Falha na comunicação com o robô');
    return data as any;
  };

  useEffect(() => {
    if (!open) return;
    setCpf(soDigitos(cpfInicial || ''));
    setSimulacao(null);
    setEfetivado(false);
    setErro('');
    setRoboIndisponivel(false);
    void verificarSessao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cpfInicial]);

  const verificarSessao = async () => {
    try {
      const r = await chamar({ acao: 'sessao_status' });
      setSessao({ logado: !!r.logado, mensagem: r.message });
    } catch (e) {
      setSessao(null);
      setErro(String((e as Error)?.message || e));
    }
  };

  const carregarDivida = async () => {
    const d = soDigitos(cpf);
    if (d.length !== 11) { toast.error('Informe um CPF com 11 dígitos'); return; }
    setCarregandoDivida(true);
    setErro('');
    try {
      const r = await chamar({ acao: 'divida', cpf: d });
      const total = Number(r?.totalDivida ?? r?.total ?? 0);
      if (total > 0) {
        setTotalDivida(total.toFixed(2).replace('.', ','));
        toast.success('Total da dívida lido na UME');
      } else {
        toast.info('O robô não encontrou o total da dívida — informe manualmente');
      }
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setCarregandoDivida(false);
    }
  };

  const abrirLogin = async () => {
    try {
      await chamar({ acao: 'abrir_login' });
      toast.success('Janela de login aberta no computador do robô. Entre com sua conta Google.');
    } catch (e) {
      toast.error(String((e as Error)?.message || e));
    }
  };

  const carregarConfig = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('ume-backoffice-acordo', { body: { acao: 'config_get' } });
      if (error) throw error;
      const c = (data as any)?.config;
      if (c) { setServerUrl(c.server_url || ''); setAtivo(!!c.ativo); setTemToken(!!c.tem_token); }
    } catch (e) {
      toast.error(String((e as Error)?.message || e));
    }
  };

  const salvarConfig = async () => {
    setSalvandoConfig(true);
    try {
      const { data, error } = await supabase.functions.invoke('ume-backoffice-acordo', {
        body: { acao: 'config_salvar', server_url: serverUrl, token, ativo },
      });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || 'Falha ao salvar');
      toast.success('Robô configurado');
      setToken('');
      setTemToken(true);
      setRoboIndisponivel(false);
      setConfigOpen(false);
      void verificarSessao();
    } catch (e) {
      toast.error(String((e as Error)?.message || e));
    } finally {
      setSalvandoConfig(false);
    }
  };

  const nParcelas = Math.max(0, Math.round(numeroBR(parcelas)));
  const vParcela = numeroBR(valorParcela);
  const vDivida = numeroBR(totalDivida);
  const totalAcordo = round2(vParcela * nParcelas);
  const desconto = round2(vDivida - totalAcordo);
  const vctoParcela = somaDias(dataEntrada, 30);

  const podeSimular =
    soDigitos(cpf).length === 11 && nParcelas >= 1 && nParcelas <= 24 &&
    vParcela > 0 && vDivida > 0 && isDataBR(dataEntrada) && desconto >= 0;

  const executar = async (acao: 'simular' | 'efetivar') => {
    const setter = acao === 'simular' ? setSimulando : setEfetivando;
    setter(true);
    setErro('');
    try {
      const r = await chamar({
        acao,
        cpf: soDigitos(cpf),
        parcelas: nParcelas,
        valorParcela: vParcela,
        totalDivida: vDivida,
        dataEntrada,
        telefone: telefone || null,
        conversaId: conversaId || null,
      });
      if (acao === 'simular') {
        setSimulacao(r.robo ?? {});
        toast.success('Simulação concluída — confira antes de efetivar');
      } else {
        setEfetivado(true);
        toast.success('Acordo efetivado na UME');
      }
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setter(false);
    }
  };

  const screenshot = simulacao?.screenshot as string | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Gerar acordo UME</span>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setConfigOpen((v) => !v); if (!configOpen) void carregarConfig(); }}
              >
                <Bot className="mr-2 h-4 w-4" /> Robô
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {isAdmin && configOpen && (
          <div className="space-y-3 rounded border p-3">
            <div className="space-y-1">
              <Label className="text-xs">Endereço do robô</Label>
              <Input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} placeholder="http://192.168.0.10:8899" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Token do robô {temToken && <span className="text-muted-foreground">(já salvo — preencha só para trocar)</span>}</Label>
              <Input value={token} onChange={(e) => setToken(e.target.value)} type="password" placeholder="••••••" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={ativo} onCheckedChange={setAtivo} id="robo-ativo" />
              <Label htmlFor="robo-ativo" className="text-sm">Robô ligado</Label>
            </div>
            <Button size="sm" onClick={() => void salvarConfig()} disabled={salvandoConfig}>
              {salvandoConfig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          {sessao?.logado ? (
            <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Sessão da UME ativa</Badge>
          ) : (
            <Badge variant="outline">Sem sessão da UME</Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => void verificarSessao()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Verificar
          </Button>
          <Button size="sm" variant="outline" onClick={() => void abrirLogin()}>
            <ExternalLink className="mr-2 h-3.5 w-3.5" /> Abrir janela de login
          </Button>
        </div>

        {roboIndisponivel && (
          <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            O robô da UME ainda não está ligado. {isAdmin ? 'Configure o endereço e o token no botão “Robô”.' : 'Peça ao administrador para configurar.'}
          </div>
        )}
        {erro && <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm">{erro}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">CPF do cliente</Label>
            <div className="flex gap-2">
              <Input
                value={formatCpf(soDigitos(cpf))}
                onChange={(e) => setCpf(soDigitos(e.target.value).slice(0, 11))}
                className="max-w-[190px]"
                placeholder="000.000.000-00"
              />
              <Button variant="outline" onClick={() => void carregarDivida()} disabled={carregandoDivida}>
                {carregandoDivida ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-2">Buscar dívida</span>
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Total da dívida (UME)</Label>
            <Input value={totalDivida} onChange={(e) => setTotalDivida(e.target.value)} placeholder="5.813,31" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor da parcela negociada</Label>
            <Input value={valorParcela} onChange={(e) => setValorParcela(e.target.value)} placeholder="110,88" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nº de parcelas</Label>
            <Input value={parcelas} onChange={(e) => setParcelas(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="10" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vencimento da 1ª parcela</Label>
            <Input value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} placeholder="20/09/2026" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded border p-3 text-sm sm:grid-cols-3">
          <div><div className="text-xs text-muted-foreground">Total do acordo</div><div className="font-medium">{fmt(totalAcordo || null)}</div></div>
          <div><div className="text-xs text-muted-foreground">Desconto</div><div className="font-medium">{fmt(Number.isFinite(desconto) ? desconto : null)}</div></div>
          <div><div className="text-xs text-muted-foreground">Entrada</div><div className="font-medium">{fmt(vParcela || null)}</div></div>
          <div><div className="text-xs text-muted-foreground">Data da entrada</div><div className="font-medium">{dataEntrada || '—'}</div></div>
          <div><div className="text-xs text-muted-foreground">Vcto parcela</div><div className="font-medium">{vctoParcela || '—'}</div></div>
          <div><div className="text-xs text-muted-foreground">Taxa de juros</div><div className="font-medium">0</div></div>
        </div>
        {desconto < 0 && (
          <p className="text-xs text-destructive">O acordo ficou maior que a dívida — confira os valores.</p>
        )}

        {simulacao && (
          <div className="space-y-2 rounded border p-3 text-sm">
            <div className="font-medium">Resultado da simulação</div>
            {simulacao.resumo && <div className="whitespace-pre-wrap text-muted-foreground">{String(simulacao.resumo)}</div>}
            {screenshot && (
              <img src={screenshot} alt="Print da simulação do acordo na UME" className="w-full rounded border" loading="lazy" />
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void executar('simular')} disabled={!podeSimular || simulando}>
            {simulando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />} Simular
          </Button>
          <Button
            variant="default"
            onClick={() => void executar('efetivar')}
            disabled={!simulacao || efetivando || efetivado}
          >
            {efetivando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            {efetivado ? 'Efetivado' : 'Efetivar'}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          O acordo só é efetivado depois da simulação e do seu clique em “Efetivar”. Cada acordo gerado fica registrado com seu usuário.
        </p>
      </DialogContent>
    </Dialog>
  );
}
