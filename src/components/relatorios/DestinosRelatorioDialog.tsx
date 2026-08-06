import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Users, RefreshCw, Send, Trash2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type Instancia = { id: string; nome: string | null };
type Grupo = { jid: string; nome: string; participants_count?: number };
type Destino = {
  id: string;
  jid: string;
  nome: string | null;
  instancia_id: string | null;
  ativo: boolean;
};

export function DestinosRelatorioDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [instanciaId, setInstanciaId] = useState<string>('');
  const [filtro, setFiltro] = useState('');
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [destinos, setDestinos] = useState<Destino[]>([]);

  const carregar = useCallback(async () => {
    const [{ data: insts }, { data: dest }] = await Promise.all([
      supabase
        .from('user_whatsapp_instances')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome'),
      supabase
        .from('relatorio_destinos' as any)
        .select('*')
        .order('criado_em', { ascending: true }),
    ]);
    setInstancias((insts as Instancia[]) || []);
    setDestinos(((dest as any[]) || []) as Destino[]);
    if (!instanciaId) {
      const memu = (insts as Instancia[] | null)?.find((i) =>
        String(i.nome || '').toUpperCase().includes('MEMU 37'),
      );
      if (memu) setInstanciaId(memu.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (open) carregar(); }, [open, carregar]);

  const buscarGrupos = async () => {
    if (!instanciaId) { toast.error('Selecione a instância que participa do grupo'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-group-jid', {
        body: { instance_id: instanciaId, name_contains: filtro || undefined },
      });
      if (error) throw new Error(error.message);
      const r = data as any;
      if (!r?.ok) throw new Error(r?.reason === 'disconnected' ? 'Instância desconectada' : (r?.error || 'Não foi possível listar os grupos'));
      setGrupos(r.groups || []);
      toast.success(`${r.total} grupo(s) encontrado(s)`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const adicionar = async (g: Grupo) => {
    if (destinos.some((d) => d.jid === g.jid)) { toast.info('Este grupo já está na lista'); return; }
    const { data, error } = await supabase
      .from('relatorio_destinos' as any)
      .insert({ tipo: 'grupo', jid: g.jid, nome: g.nome, instancia_id: instanciaId, ativo: true })
      .select('*')
      .single();
    if (error) { toast.error('Não foi possível salvar o destino'); return; }
    setDestinos((p) => [...p, data as any as Destino]);
    toast.success(`“${g.nome}” receberá os relatórios`);
  };

  const toggleAtivo = async (d: Destino, ativo: boolean) => {
    setDestinos((p) => p.map((x) => (x.id === d.id ? { ...x, ativo } : x)));
    const { error } = await supabase.from('relatorio_destinos' as any).update({ ativo }).eq('id', d.id);
    if (error) toast.error('Não foi possível atualizar o destino');
  };

  const remover = async (d: Destino) => {
    const { error } = await supabase.from('relatorio_destinos' as any).delete().eq('id', d.id);
    if (error) { toast.error('Não foi possível remover'); return; }
    setDestinos((p) => p.filter((x) => x.id !== d.id));
  };

  const testar = async (d: Destino) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('relatorio-acionamentos-sync', {
        body: { action: 'testar_destino', jid: d.jid, instancia_id: d.instancia_id },
      });
      if (error) throw new Error(error.message);
      const r = data as any;
      if (r?.enviados > 0) toast.success('Mensagem de teste enviada ao grupo');
      else toast.error(`Falha no envio: ${(r?.erros || []).join(' | ') || 'sem detalhes'}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const nomeInstancia = (id: string | null) =>
    instancias.find((i) => i.id === id)?.nome || '—';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="h-4 w-4 mr-2" /> Destinos do relatório
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Destinos do relatório</DialogTitle>
          <DialogDescription>
            Além dos números fixos, o resumo parcial e o consolidado podem ser enviados direto em grupos de
            WhatsApp. O envio sai pela instância escolhida, que precisa participar do grupo.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 pb-2">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Grupos que recebem o relatório</Label>
              {destinos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum grupo cadastrado. Busque abaixo e clique em “Adicionar”.
                </p>
              ) : (
                <div className="rounded-md border divide-y">
                  {destinos.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 p-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{d.nome || d.jid}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          envia por {nomeInstancia(d.instancia_id)}
                        </p>
                      </div>
                      <Switch checked={d.ativo} onCheckedChange={(v) => toggleAtivo(d, v)} />
                      <Button variant="outline" size="sm" onClick={() => testar(d)} disabled={loading}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remover(d)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Buscar grupos</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={instanciaId} onValueChange={setInstanciaId}>
                  <SelectTrigger className="sm:w-56">
                    <SelectValue placeholder="Instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {instancias.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.nome || i.id.slice(0, 8)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Parte do nome do grupo (ex.: UME)"
                />
                <Button onClick={buscarGrupos} disabled={loading}>
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              {grupos.length > 0 && (
                <div className={cn('rounded-md border divide-y max-h-72 overflow-y-auto')}>
                  {grupos.map((g) => (
                    <div key={g.jid} className="flex items-center gap-3 p-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{g.nome || g.jid}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{g.jid}</p>
                      </div>
                      {!!g.participants_count && (
                        <Badge variant="secondary">{g.participants_count}</Badge>
                      )}
                      <Button size="sm" variant="outline" onClick={() => adicionar(g)}>Adicionar</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end border-t px-6 py-4">
          <Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
