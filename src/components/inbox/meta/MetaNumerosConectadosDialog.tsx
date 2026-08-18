import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw, Smartphone } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folderId: string | null;
  folderNome: string;
}

interface Linha {
  id: string;
  nome: string;
  display_phone: string | null;
  ativo: boolean;
  provider: string;
  uazapi_instance_id: string | null;
  uazapi?: {
    nome: string | null;
    telefone: string | null;
    ativo: boolean;
    robo: boolean;
    ia_responde: boolean;
  } | null;
}

function fmtTelefone(v?: string | null) {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length < 10) return v || '—';
  const semDdi = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  const ddd = semDdi.slice(0, 2);
  const resto = semDdi.slice(2);
  const meio = resto.length > 8 ? resto.slice(0, 5) : resto.slice(0, 4);
  const fim = resto.length > 8 ? resto.slice(5) : resto.slice(4);
  return `(${ddd}) ${meio}-${fim}`;
}

export function MetaNumerosConectadosDialog({ open, onOpenChange, folderId, folderNome }: Props) {
  const [loading, setLoading] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [recarregar, setRecarregar] = useState(0);

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-sync-numeros', {
        body: { folder_id: folderId },
      });
      if (error) throw error;
      toast.success(`Números atualizados (${(data as any)?.atualizados ?? 0} de ${(data as any)?.total ?? 0})`);
      setRecarregar((n) => n + 1);
    } catch (e) {
      toast.error('Não foi possível atualizar os números agora');
    } finally {
      setSincronizando(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      let query = supabase
        .from('meta_whatsapp_instances')
        .select('id, nome, display_phone, ativo, provider, uazapi_instance_id')
        .eq('provider', 'uazapi')
        .order('nome');
      query = folderId ? query.eq('folder_padrao_id', folderId) : query.is('folder_padrao_id', null);
      const { data } = await query;
      const base = (data || []) as Linha[];
      const ids = base.map(l => l.uazapi_instance_id).filter(Boolean) as string[];
      let mapa = new Map<string, Linha['uazapi']>();
      if (ids.length) {
        const { data: uz } = await supabase
          .from('user_whatsapp_instances')
          .select('id, nome, telefone, ativo, robo, ia_responde')
          .in('id', ids);
        mapa = new Map((uz || []).map((u: any) => [u.id, u]));
      }
      if (cancel) return;
      setLinhas(base.map(l => ({ ...l, uazapi: l.uazapi_instance_id ? mapa.get(l.uazapi_instance_id) ?? null : null })));
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [open, folderId, recarregar]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Números conectados — {folderNome}</DialogTitle>
          <DialogDescription>
            Números não oficiais (UAZAPI) vinculados a esta caixa de mensagens.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={sincronizar} disabled={sincronizando} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
            Atualizar números
          </Button>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : linhas.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground text-center">
            Nenhum número da UAZAPI vinculado a esta caixa.
          </p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {linhas.map(l => {
              const conectado = l.ativo && (l.uazapi?.ativo ?? true);
              return (
                <div key={l.id} className="flex items-center gap-3 rounded-md border p-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{l.uazapi?.nome || l.nome}</p>
                    <p className="text-xs text-muted-foreground">{fmtTelefone(l.display_phone || l.uazapi?.telefone)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {l.uazapi?.ia_responde && <Badge variant="outline" className="text-[10px]">IA</Badge>}
                    <Badge variant="secondary" className="text-[10px]">Não oficial</Badge>
                    <Badge variant={conectado ? 'default' : 'destructive'} className="text-[10px]">
                      {conectado ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-muted-foreground pt-1">{linhas.length} número(s) vinculado(s)</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
