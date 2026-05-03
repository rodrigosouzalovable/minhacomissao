import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Loader2, Network, Save, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  instanceId: string;
}

export function ProxyInstanceSection({ instanceId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [data, setData] = useState({
    proxy_enabled: false,
    proxy_type: 'socks5',
    proxy_host: '',
    proxy_port: '' as number | '',
    proxy_username: '',
    proxy_password: '',
    proxy_aplicado_em: null as string | null,
    proxy_ultimo_erro: null as string | null,
  });

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data: row } = await supabase
        .from('user_whatsapp_instances' as any)
        .select('proxy_enabled, proxy_type, proxy_host, proxy_port, proxy_username, proxy_password, proxy_aplicado_em, proxy_ultimo_erro')
        .eq('id', instanceId)
        .maybeSingle();
      if (!cancel && row) {
        const r: any = row;
        setData({
          proxy_enabled: !!r.proxy_enabled,
          proxy_type: r.proxy_type || 'socks5',
          proxy_host: r.proxy_host || '',
          proxy_port: r.proxy_port ?? '',
          proxy_username: r.proxy_username || '',
          proxy_password: r.proxy_password || '',
          proxy_aplicado_em: r.proxy_aplicado_em || null,
          proxy_ultimo_erro: r.proxy_ultimo_erro || null,
        });
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [instanceId]);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('user_whatsapp_instances' as any).update({
      proxy_enabled: data.proxy_enabled,
      proxy_type: data.proxy_type,
      proxy_host: data.proxy_host || null,
      proxy_port: data.proxy_port === '' ? null : Number(data.proxy_port),
      proxy_username: data.proxy_username || null,
      proxy_password: data.proxy_password || null,
    } as any).eq('id', instanceId);
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return false; }
    toast.success('Proxy salvo');
    return true;
  }

  async function applyNow() {
    if (data.proxy_enabled && (!data.proxy_host || !data.proxy_port)) {
      toast.error('Host e porta obrigatórios');
      return;
    }
    const ok = await save();
    if (!ok) return;
    setApplying(true);
    const { data: res, error } = await supabase.functions.invoke('uazapi-set-proxy', { body: { instance_ids: [instanceId] } });
    setApplying(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    const r = (res as any)?.results?.[0];
    if (r?.ok) {
      toast.success('Proxy aplicado na UAZAPI');
      setData(d => ({ ...d, proxy_aplicado_em: new Date().toISOString(), proxy_ultimo_erro: null }));
    } else {
      toast.error(`Falha: ${r?.error || 'desconhecido'}`);
      setData(d => ({ ...d, proxy_ultimo_erro: r?.error || 'erro' }));
    }
  }

  const statusBadge = () => {
    if (!data.proxy_enabled) return <Badge variant="outline" className="text-[10px]">Desativado</Badge>;
    if (data.proxy_ultimo_erro) return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Erro</Badge>;
    if (data.proxy_aplicado_em) return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Aplicado</Badge>;
    return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[10px]">Pendente</Badge>;
  };

  if (loading) {
    return (
      <div className="rounded-md border p-3 bg-background flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-3 bg-background">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-semibold flex items-center gap-1.5">
          <Network className="h-4 w-4" />
          Proxy SOCKS5 / HTTP
        </h5>
        <div className="flex items-center gap-2">
          {statusBadge()}
          <Switch checked={data.proxy_enabled} onCheckedChange={(v) => setData(d => ({ ...d, proxy_enabled: v }))} />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px]">Tipo</Label>
          <select
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={data.proxy_type}
            onChange={(e) => setData(d => ({ ...d, proxy_type: e.target.value }))}
          >
            <option value="socks5">SOCKS5</option>
            <option value="http">HTTP</option>
          </select>
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-[10px]">Host</Label>
          <Input className="h-8 text-xs" placeholder="proxy.exemplo.com" value={data.proxy_host} onChange={(e) => setData(d => ({ ...d, proxy_host: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Porta</Label>
          <Input className="h-8 text-xs" type="number" placeholder="1080" value={data.proxy_port} onChange={(e) => setData(d => ({ ...d, proxy_port: e.target.value === '' ? '' : Number(e.target.value) }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Usuário</Label>
          <Input className="h-8 text-xs" value={data.proxy_username} onChange={(e) => setData(d => ({ ...d, proxy_username: e.target.value }))} />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Senha</Label>
        <div className="flex gap-1">
          <Input
            className="h-8 text-xs"
            type={showPwd ? 'text' : 'password'}
            value={data.proxy_password}
            onChange={(e) => setData(d => ({ ...d, proxy_password: e.target.value }))}
          />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPwd(s => !s)}>
            {showPwd ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {data.proxy_ultimo_erro && (
        <p className="text-[10px] text-destructive">Último erro: {data.proxy_ultimo_erro}</p>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
          Salvar
        </Button>
        <Button size="sm" className="h-8 text-xs flex-1" onClick={applyNow} disabled={applying || saving}>
          {applying ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
          Salvar e aplicar na UAZAPI
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        "Salvar" guarda no banco. "Salvar e aplicar" também envia para a UAZAPI imediatamente.
      </p>
    </div>
  );
}
