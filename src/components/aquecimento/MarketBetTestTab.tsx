import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Wallet, Sparkles, Loader2, RefreshCw, Plug } from 'lucide-react';

interface ProxyRow {
  id: string;
  proxy_string: string;
  host: string;
  porta: number;
  estado: string | null;
  cidade: string | null;
  tipo: string | null;
  aplicado_em_instancia: string | null;
  aplicado_em: string | null;
  criado_em: string;
}
interface InstancePick { id: string; nome: string; }

export default function MarketBetTestTab() {
  const [saldo, setSaldo] = useState<any>(null);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [estados, setEstados] = useState<{ name: string; code: string }[]>([]);
  const [estado, setEstado] = useState<string>('goias');
  const [qtd, setQtd] = useState<number>(5);
  const [gerando, setGerando] = useState(false);
  const [proxies, setProxies] = useState<ProxyRow[]>([]);
  const [instances, setInstances] = useState<InstancePick[]>([]);
  const [aplicando, setAplicando] = useState<string | null>(null);
  const [destino, setDestino] = useState<Record<string, string>>({});

  async function call(action: string, body: any = {}) {
    const { data, error } = await supabase.functions.invoke('marketbet-proxy-manager', {
      body: { action, ...body },
    });
    if (error) throw error;
    return data;
  }

  async function loadSaldo() {
    setLoadingSaldo(true);
    try {
      const r = await call('saldo');
      setSaldo(r?.data || r);
    } catch (e: any) { toast.error('Saldo: ' + e.message); }
    finally { setLoadingSaldo(false); }
  }
  async function loadEstados() {
    try {
      const r = await call('locais', { country: 'br' });
      if (Array.isArray(r?.data)) setEstados(r.data);
    } catch (e: any) { toast.error('Estados: ' + e.message); }
  }
  async function loadProxies() {
    const { data } = await supabase
      .from('marketbet_proxies_gerados')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(50);
    setProxies((data || []) as any);
  }
  async function loadInstances() {
    const { data } = await supabase
      .from('user_whatsapp_instances')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome');
    setInstances((data || []) as any);
  }

  useEffect(() => {
    loadEstados();
    loadProxies();
    loadInstances();
  }, []);

  async function gerar() {
    setGerando(true);
    try {
      const r = await call('gerar', { quantidade: qtd, tipo: 'fixo', country: 'br', state: estado });
      if (r?.success) toast.success(`${r?.data?.quantidade || qtd} proxies gerados`);
      else toast.error(r?.message || 'Falha ao gerar');
      await loadProxies();
    } catch (e: any) { toast.error(e.message); }
    finally { setGerando(false); }
  }
  async function aplicar(proxyId: string) {
    const instanceId = destino[proxyId];
    if (!instanceId) return toast.error('Selecione a instância destino');
    setAplicando(proxyId);
    try {
      const r = await call('aplicar', { proxy_id: proxyId, instance_id: instanceId });
      if (r?.ok) toast.success('Proxy aplicado');
      else toast.warning('Aplicado no banco, UAZAPI: ' + JSON.stringify(r?.uazapi || {}));
      await loadProxies();
    } catch (e: any) { toast.error(e.message); }
    finally { setAplicando(null); }
  }

  const naoAplicados = proxies.filter(p => !p.aplicado_em_instancia);
  const aplicados = proxies.filter(p => !!p.aplicado_em_instancia);
  const instById = (id: string) => instances.find(i => i.id === id)?.nome || id.slice(0, 8);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" /> Saldo MarketBet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={loadSaldo} disabled={loadingSaldo}>
              {loadingSaldo ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Consultar
            </Button>
            {saldo && (
              <div className="text-sm text-muted-foreground">
                Total: <b>{saldo.total_gb}</b> · Usado: <b>{saldo.used_gb}</b> · Disponível: <b className="text-foreground">{saldo.remaining_gb}</b>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" /> Gerar proxies de teste
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {estados.length === 0 && <SelectItem value="goias">Goiás (padrão)</SelectItem>}
                  {estados.map(e => <SelectItem key={e.code} value={e.code}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantidade</Label>
              <Input type="number" min={1} max={50} value={qtd} onChange={e => setQtd(parseInt(e.target.value) || 1)} className="w-24" />
            </div>
            <Button size="sm" onClick={gerar} disabled={gerando}>
              {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar
            </Button>
            <div className="text-xs text-muted-foreground ml-auto">Tipo: fixo · País: BR</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Proxies disponíveis ({naoAplicados.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proxy</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Aplicar em</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {naoAplicados.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.host}:{p.porta}</TableCell>
                  <TableCell><Badge variant="outline">{p.estado || '-'}</Badge></TableCell>
                  <TableCell>
                    <Select value={destino[p.id] || ''} onValueChange={v => setDestino(d => ({ ...d, [p.id]: v }))}>
                      <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Escolher instância" /></SelectTrigger>
                      <SelectContent>
                        {instances.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="secondary" disabled={aplicando === p.id} onClick={() => aplicar(p.id)}>
                      {aplicando === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plug className="h-3 w-3" />} Aplicar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {naoAplicados.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-6">Nenhum proxy disponível. Gere acima.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Aplicados ({aplicados.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instância</TableHead>
                <TableHead>Proxy</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Aplicado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aplicados.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-sm">{instById(p.aplicado_em_instancia!)}</TableCell>
                  <TableCell className="font-mono text-xs">{p.host}:{p.porta}</TableCell>
                  <TableCell><Badge variant="outline">{p.estado || '-'}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.aplicado_em ? new Date(p.aplicado_em).toLocaleString('pt-BR') : '-'}</TableCell>
                </TableRow>
              ))}
              {aplicados.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-6">Nenhum proxy aplicado ainda.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
