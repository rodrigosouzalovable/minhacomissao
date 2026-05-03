import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Network, Save, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface InstanceRow {
  id: string;
  nome: string | null;
  ativo: boolean;
  proxy_enabled: boolean;
  proxy_type: string | null;
  proxy_host: string | null;
  proxy_port: number | null;
  proxy_username: string | null;
  proxy_password: string | null;
  proxy_aplicado_em: string | null;
  proxy_ultimo_erro: string | null;
}

const SETTINGS_KEY = 'default_proxy';

export default function AquecimentoProxiesTab() {
  const [rows, setRows] = useState<InstanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({});
  const [onlyActive, setOnlyActive] = useState(true);

  // bulk apply form
  const [bulk, setBulk] = useState({ host: '', port: '', username: '', password: '', type: 'socks5' });
  const [pasteList, setPasteList] = useState('');

  // global default
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [globalProxy, setGlobalProxy] = useState({ host: '', port: '', username: '', password: '', type: 'socks5' });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('user_whatsapp_instances')
      .select('id, nome, ativo, proxy_enabled, proxy_type, proxy_host, proxy_port, proxy_username, proxy_password, proxy_aplicado_em, proxy_ultimo_erro')
      .order('nome', { ascending: true });
    setRows((data || []) as any);

    const { data: settings } = await supabase.from('system_settings' as any).select('value').eq('key', SETTINGS_KEY).maybeSingle();
    if (settings && (settings as any).value) {
      const v = (settings as any).value;
      setGlobalEnabled(!!v.enabled);
      setGlobalProxy({
        host: v.host || '', port: v.port?.toString() || '',
        username: v.username || '', password: v.password || '',
        type: v.type || 'socks5',
      });
    }
    setLoading(false);
  }

  function updateRow(id: string, patch: Partial<InstanceRow>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  async function saveRow(row: InstanceRow) {
    setSaving(s => ({ ...s, [row.id]: true }));
    const { error } = await supabase.from('user_whatsapp_instances').update({
      proxy_enabled: row.proxy_enabled,
      proxy_type: row.proxy_type || 'socks5',
      proxy_host: row.proxy_host || null,
      proxy_port: row.proxy_port || null,
      proxy_username: row.proxy_username || null,
      proxy_password: row.proxy_password || null,
    } as any).eq('id', row.id);
    setSaving(s => ({ ...s, [row.id]: false }));
    if (error) { toast.error('Erro ao salvar: ' + error.message); return false; }
    toast.success('Salvo');
    return true;
  }

  async function applyOne(row: InstanceRow) {
    const ok = await saveRow(row);
    if (!ok) return;
    setSaving(s => ({ ...s, [row.id]: true }));
    const { data, error } = await supabase.functions.invoke('uazapi-set-proxy', { body: { instance_id: row.id } });
    setSaving(s => ({ ...s, [row.id]: false }));
    if (error) { toast.error('Erro: ' + error.message); return; }
    const r = data?.results?.[0];
    if (r?.ok) toast.success(`Proxy aplicado em ${row.nome || row.id}`);
    else toast.error(`Falha: ${r?.error || 'desconhecido'}`);
    await load();
  }

  function toggleSelect(id: string) {
    setSelected(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const visible = rows.filter(r => onlyActive ? r.ativo : true);

  function toggleAll() {
    if (selected.size === visible.length) setSelected(new Set());
    else setSelected(new Set(visible.map(r => r.id)));
  }

  async function applyBulkProxyToSelected() {
    if (selected.size === 0) { toast.error('Selecione ao menos uma instância'); return; }
    if (!bulk.host || !bulk.port) { toast.error('Host e porta obrigatórios'); return; }
    const ids = Array.from(selected);
    // 1) salvar config nas linhas
    const port = parseInt(bulk.port, 10);
    const { error: upErr } = await supabase
      .from('user_whatsapp_instances')
      .update({
        proxy_enabled: true,
        proxy_type: bulk.type,
        proxy_host: bulk.host,
        proxy_port: port,
        proxy_username: bulk.username || null,
        proxy_password: bulk.password || null,
      } as any)
      .in('id', ids);
    if (upErr) { toast.error('Erro salvando: ' + upErr.message); return; }

    setApplying(true);
    setProgress({ done: 0, total: ids.length });

    // 2) aplicar em lotes (a edge function já faz delay 1-3s entre chamadas)
    // Para feedback de progresso mostramos por chunk de 5
    const CHUNK = 5;
    let done = 0;
    let okTotal = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { data, error } = await supabase.functions.invoke('uazapi-set-proxy', { body: { instance_ids: chunk } });
      if (!error && data) okTotal += data.ok || 0;
      done += chunk.length;
      setProgress({ done, total: ids.length });
    }
    setApplying(false);
    toast.success(`Concluído: ${okTotal}/${ids.length} aplicados`);
    setSelected(new Set());
    await load();
  }

  // Distribui uma lista colada (host:port:user:pass por linha) em round-robin nas selecionadas
  async function distributePastedList() {
    if (selected.size === 0) { toast.error('Selecione ao menos uma instância'); return; }
    const lines = pasteList.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const proxies = lines.map((l) => {
      const parts = l.split(':');
      if (parts.length < 2) return null;
      const [host, port, username = '', password = ''] = parts;
      const portNum = parseInt(port, 10);
      if (!host || !portNum) return null;
      return { host, port: portNum, username, password };
    }).filter(Boolean) as { host: string; port: number; username: string; password: string }[];

    if (proxies.length === 0) { toast.error('Nenhuma proxy válida. Use host:port:user:pass por linha'); return; }

    const ids = Array.from(selected);
    setApplying(true);
    setProgress({ done: 0, total: ids.length });

    // 1) salvar config round-robin
    await Promise.all(ids.map((id, i) => {
      const p = proxies[i % proxies.length];
      return supabase.from('user_whatsapp_instances').update({
        proxy_enabled: true,
        proxy_type: 'socks5',
        proxy_host: p.host,
        proxy_port: p.port,
        proxy_username: p.username || null,
        proxy_password: p.password || null,
      } as any).eq('id', id);
    }));

    // 2) aplicar na UAZAPI em chunks
    const CHUNK = 5;
    let done = 0;
    let okTotal = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { data, error } = await supabase.functions.invoke('uazapi-set-proxy', { body: { instance_ids: chunk } });
      if (!error && data) okTotal += data.ok || 0;
      done += chunk.length;
      setProgress({ done, total: ids.length });
    }
    setApplying(false);
    toast.success(`Distribuído ${proxies.length} proxies em ${ids.length} instâncias. Aplicados: ${okTotal}`);
    setSelected(new Set());
    await load();
  }

  async function saveGlobalDefault() {
    const value = {
      enabled: globalEnabled,
      type: globalProxy.type,
      host: globalProxy.host,
      port: parseInt(globalProxy.port, 10) || null,
      username: globalProxy.username,
      password: globalProxy.password,
    };
    const { error } = await supabase.from('system_settings' as any).upsert({
      key: SETTINGS_KEY, value, updated_at: new Date().toISOString(),
    } as any, { onConflict: 'key' });
    if (error) toast.error('Erro: ' + error.message);
    else toast.success('Proxy padrão salvo. Será aplicado em novas instâncias.');
  }

  function statusBadge(r: InstanceRow) {
    if (!r.proxy_enabled) return <Badge variant="outline">Desativado</Badge>;
    if (r.proxy_ultimo_erro) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><AlertTriangle className="h-3 w-3 mr-1" />Erro</Badge>;
    if (r.proxy_aplicado_em) return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Aplicado</Badge>;
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Network className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Proxies SOCKS5 / HTTP</h2>
      </div>

      {/* Aplicar em massa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Aplicar mesmo proxy nas instâncias selecionadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-5">
            <div>
              <Label className="text-xs">Tipo</Label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={bulk.type} onChange={e => setBulk({ ...bulk, type: e.target.value })}>
                <option value="socks5">SOCKS5</option>
                <option value="http">HTTP</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Host</Label>
              <Input value={bulk.host} onChange={e => setBulk({ ...bulk, host: e.target.value })} placeholder="proxy.exemplo.com" />
            </div>
            <div>
              <Label className="text-xs">Porta</Label>
              <Input value={bulk.port} onChange={e => setBulk({ ...bulk, port: e.target.value })} placeholder="1080" />
            </div>
            <div>
              <Label className="text-xs">Usuário</Label>
              <Input value={bulk.username} onChange={e => setBulk({ ...bulk, username: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3 items-end">
            <div>
              <Label className="text-xs">Senha</Label>
              <Input type="password" value={bulk.password} onChange={e => setBulk({ ...bulk, password: e.target.value })} />
            </div>
            <div className="text-xs text-muted-foreground">
              Selecionadas: <strong>{selected.size}</strong> de {visible.length} visíveis
            </div>
            <Button onClick={applyBulkProxyToSelected} disabled={applying || selected.size === 0} className="gap-2">
              <Zap className="h-4 w-4" />
              {applying ? `Aplicando ${progress.done}/${progress.total}...` : 'Aplicar nas selecionadas'}
            </Button>
          </div>
          {applying && <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />}
        </CardContent>
      </Card>

      {/* Distribuir lista colada (round-robin) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Distribuir lista de proxies (round-robin)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Cole uma proxy por linha no formato <code className="font-mono">host:port:user:pass</code>. Cada proxy será distribuída entre as instâncias selecionadas (round-robin se houver menos proxies que instâncias).
          </div>
          <textarea
            className="w-full min-h-[120px] rounded-md border border-input bg-background p-2 text-sm font-mono"
            placeholder={'144.225.3.4:12323:user:pass\n144.225.3.49:12323:user:pass'}
            value={pasteList}
            onChange={(e) => setPasteList(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {pasteList.split(/\r?\n/).filter(l => l.trim()).length} linhas · {selected.size} instâncias selecionadas
            </div>
            <Button onClick={distributePastedList} disabled={applying || selected.size === 0 || !pasteList.trim()} className="gap-2">
              <Zap className="h-4 w-4" />
              {applying ? `Aplicando ${progress.done}/${progress.total}...` : 'Distribuir e aplicar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Proxy padrão global */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Proxy padrão para novas instâncias
            <Switch checked={globalEnabled} onCheckedChange={setGlobalEnabled} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-5">
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={globalProxy.type} onChange={e => setGlobalProxy({ ...globalProxy, type: e.target.value })}>
              <option value="socks5">SOCKS5</option>
              <option value="http">HTTP</option>
            </select>
            <Input className="md:col-span-2" placeholder="host" value={globalProxy.host} onChange={e => setGlobalProxy({ ...globalProxy, host: e.target.value })} />
            <Input placeholder="porta" value={globalProxy.port} onChange={e => setGlobalProxy({ ...globalProxy, port: e.target.value })} />
            <Input placeholder="usuário" value={globalProxy.username} onChange={e => setGlobalProxy({ ...globalProxy, username: e.target.value })} />
          </div>
          <div className="grid gap-2 md:grid-cols-3 items-end">
            <Input type="password" placeholder="senha" value={globalProxy.password} onChange={e => setGlobalProxy({ ...globalProxy, password: e.target.value })} />
            <div className="text-xs text-muted-foreground">Quando ligado, novas instâncias conectadas via QR já recebem este proxy.</div>
            <Button variant="outline" onClick={saveGlobalDefault}><Save className="h-4 w-4 mr-2" />Salvar padrão</Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Instâncias ({visible.length})</CardTitle>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={onlyActive} onCheckedChange={(v) => setOnlyActive(!!v)} /> Apenas ativas
            </label>
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {selected.size === visible.length ? 'Limpar' : 'Selecionar todas'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Instância</TableHead>
                    <TableHead className="w-20">Tipo</TableHead>
                    <TableHead>Host</TableHead>
                    <TableHead className="w-20">Porta</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Senha</TableHead>
                    <TableHead className="w-16">Ativo</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-32">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map(r => (
                    <TableRow key={r.id} className={selected.has(r.id) ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} />
                      </TableCell>
                      <TableCell className="font-medium text-sm">{r.nome || r.id.slice(0, 8)}</TableCell>
                      <TableCell>
                        <select className="h-8 w-full rounded-md border border-input bg-background px-1 text-xs"
                          value={r.proxy_type || 'socks5'}
                          onChange={e => updateRow(r.id, { proxy_type: e.target.value })}>
                          <option value="socks5">SOCKS5</option>
                          <option value="http">HTTP</option>
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 text-xs" value={r.proxy_host || ''} onChange={e => updateRow(r.id, { proxy_host: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 text-xs" type="number" value={r.proxy_port || ''} onChange={e => updateRow(r.id, { proxy_port: parseInt(e.target.value) || null })} />
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 text-xs" value={r.proxy_username || ''} onChange={e => updateRow(r.id, { proxy_username: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input className="h-8 text-xs" type={showPwd[r.id] ? 'text' : 'password'} value={r.proxy_password || ''} onChange={e => updateRow(r.id, { proxy_password: e.target.value })} />
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPwd(s => ({ ...s, [r.id]: !s[r.id] }))}>
                            {showPwd[r.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch checked={r.proxy_enabled} onCheckedChange={(v) => updateRow(r.id, { proxy_enabled: v })} />
                      </TableCell>
                      <TableCell>
                        {statusBadge(r)}
                        {r.proxy_ultimo_erro && <div className="text-[10px] text-red-400 mt-1 truncate max-w-[140px]" title={r.proxy_ultimo_erro}>{r.proxy_ultimo_erro}</div>}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" disabled={saving[r.id]} onClick={() => applyOne(r)} className="h-8 text-xs">
                          {saving[r.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Aplicar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
