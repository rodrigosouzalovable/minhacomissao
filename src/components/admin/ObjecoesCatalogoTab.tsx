import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Loader2, Pin, Trash2, Save, RefreshCw } from 'lucide-react';
import { OBJECAO_LABEL } from '@/components/inbox/meta/SugestoesObjecaoPanel';

interface Item {
  id: string;
  objecao_chave: string;
  resposta: string;
  origem: string;
  credor: string | null;
  usos: number;
  conversoes: number;
  score: number;
  fixada: boolean;
  ativo: boolean;
}

export function ObjecoesCatalogoTab() {
  const [itens, setItens] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [rodando, setRodando] = useState(false);
  const [editando, setEditando] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data } = await supabase
      .from('objecao_catalogo')
      .select('*')
      .order('score', { ascending: false })
      .order('usos', { ascending: false })
      .limit(200);
    setItens((data as Item[]) ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const salvar = async (it: Item) => {
    const texto = editando[it.id] ?? it.resposta;
    const { error } = await supabase.from('objecao_catalogo')
      .update({ resposta: texto, origem: 'manual' }).eq('id', it.id);
    if (error) return toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    toast({ title: 'Resposta salva' });
    void carregar();
  };

  const alternar = async (it: Item, campo: 'ativo' | 'fixada', valor: boolean) => {
    const { error } = await supabase.from('objecao_catalogo').update({ [campo]: valor }).eq('id', it.id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setItens((prev) => prev.map((x) => (x.id === it.id ? { ...x, [campo]: valor } : x)));
  };

  const excluir = async (it: Item) => {
    const { error } = await supabase.from('objecao_catalogo').delete().eq('id', it.id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setItens((prev) => prev.filter((x) => x.id !== it.id));
  };

  const rodarAprendizado = async () => {
    setRodando(true);
    try {
      const { data, error } = await supabase.functions.invoke('objecao-aprender', { body: {} });
      if (error) throw error;
      toast({
        title: 'Aprendizado executado',
        description: `${data?.fechados ?? 0} negociações avaliadas · ${data?.aprendizados ?? 0} modelos consolidados`,
      });
      void carregar();
    } catch (e: any) {
      toast({ title: 'Erro no aprendizado', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setRodando(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Respostas que o copiloto sugere aos atendentes quando o cliente traz uma objeção.
          O sistema mede quantas viraram acordo e passa a sugerir as melhores primeiro.
        </p>
        <Button size="sm" variant="outline" onClick={() => void rodarAprendizado()} disabled={rodando}>
          {rodando ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          Recalcular
        </Button>
      </div>

      {carregando ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !itens.length ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nenhuma resposta no catálogo ainda. Ele é preenchido automaticamente conforme o copiloto é usado nos atendimentos.
        </p>
      ) : (
        <div className="space-y-2">
          {itens.map((it) => (
            <div key={it.id} className="rounded-md border p-2 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-[10px]">{OBJECAO_LABEL[it.objecao_chave] || it.objecao_chave}</Badge>
                {it.credor && <Badge variant="outline" className="text-[10px]">{it.credor}</Badge>}
                <Badge variant="outline" className="text-[10px]">{it.origem}</Badge>
                <span className="text-[11px] text-muted-foreground">
                  {it.conversoes}/{it.usos} conversões · score {Number(it.score).toFixed(0)}
                </span>
                <div className="ml-auto flex items-center gap-3">
                  <label className="flex items-center gap-1 text-[11px]">
                    <Pin className="h-3 w-3" />
                    <Switch checked={it.fixada} onCheckedChange={(v) => void alternar(it, 'fixada', v)} />
                  </label>
                  <label className="flex items-center gap-1 text-[11px]">
                    Ativa
                    <Switch checked={it.ativo} onCheckedChange={(v) => void alternar(it, 'ativo', v)} />
                  </label>
                </div>
              </div>
              <Textarea
                value={editando[it.id] ?? it.resposta}
                onChange={(e) => setEditando((p) => ({ ...p, [it.id]: e.target.value }))}
                rows={3}
                className="text-xs"
              />
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => void excluir(it)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                </Button>
                <Button size="sm" className="h-7" onClick={() => void salvar(it)}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Salvar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
