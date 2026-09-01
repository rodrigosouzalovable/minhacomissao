import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface Status {
  configurado: boolean;
  origem: string;
  account_id: string;
  subdominio: string;
  token_preenchido: boolean;
  validado_em: string | null;
}

export function CloudflareConfigDialog({ open, onOpenChange }: Props) {
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [token, setToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [subdominio, setSubdominio] = useState('');

  const chamar = async (acao: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('site-cloudflare-config', {
      body: { acao, ...extra },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Falha na operação');
    return data;
  };

  useEffect(() => {
    if (!open) return;
    setCarregando(true);
    chamar('status')
      .then((d) => {
        setStatus(d as Status);
        setAccountId(d.account_id ?? '');
        setSubdominio(d.subdominio ?? '');
        setToken('');
      })
      .catch((e: any) => toast.error(e?.message ?? 'Erro ao carregar configuração'))
      .finally(() => setCarregando(false));
  }, [open]);

  const testar = async () => {
    setTestando(true);
    try {
      const d = await chamar('testar', { api_token: token, account_id: accountId });
      toast.success(`Conexão OK${d.conta ? ` — conta: ${d.conta}` : ''}${d.subdominio ? ` (${d.subdominio}.workers.dev)` : ''}`);
      if (!subdominio && d.subdominio) setSubdominio(d.subdominio);
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha no teste');
    }
    setTestando(false);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await chamar('salvar', { api_token: token, account_id: accountId, subdominio });
      toast.success('Credenciais da Cloudflare salvas e validadas');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao salvar');
    }
    setSalvando(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar Cloudflare</DialogTitle>
          <DialogDescription>
            Credenciais usadas para publicar e excluir os sites. O token nunca é exibido de volta.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {status?.configurado ? (
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3 w-3" /> Configurado ({status.origem === 'painel' ? 'pelo painel' : 'por segredo'})
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <ShieldAlert className="h-3 w-3" /> Não configurado
                </Badge>
              )}
              {status?.validado_em && (
                <span className="text-xs text-muted-foreground">
                  Validado em {new Date(status.validado_em).toLocaleString('pt-BR')}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <Label>API Token</Label>
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={status?.token_preenchido ? '•••••••• (manter o atual)' : 'Cole o token da Cloudflare'}
              />
              <p className="text-xs text-muted-foreground">
                Cloudflare → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers".
                Permissões: Account · Workers Scripts · Edit e User · User Details · Read.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Account ID</Label>
              <Input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="ID da conta Cloudflare" />
            </div>

            <div className="space-y-2">
              <Label>Subdomínio Workers (opcional)</Label>
              <Input value={subdominio} onChange={(e) => setSubdominio(e.target.value)} placeholder="ex.: oficialbrasil" />
              <p className="text-xs text-muted-foreground">Se ficar vazio, é detectado automaticamente na Cloudflare.</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={testar} disabled={testando || salvando || carregando}>
            {testando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Testar conexão
          </Button>
          <Button onClick={salvar} disabled={salvando || carregando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
