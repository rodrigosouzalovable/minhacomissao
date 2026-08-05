import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Phone, RefreshCw, PlugZap, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

type Campanha = { id: number; nome: string; pausada?: boolean };
type Qual = { id: string; qualificacao_id: number; nome: string; cor: string | null; classificacao: string };

const CLASSES: Array<{ v: string; label: string }> = [
  { v: 'ignorar', label: 'Ignorar' },
  { v: 'cpc', label: 'CPC' },
  { v: 'cpca', label: 'CPC-A' },
];

export function Config3CPlusDialog({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cfgId, setCfgId] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('https://app.3c.fluxoti.com.br/api/v1');
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const [quals, setQuals] = useState<Qual[]>([]);
  const [ultimoSync, setUltimoSync] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [{ data: cfg }, { data: q }] = await Promise.all([
      supabase.from('tresc_config' as any).select('*').limit(1).maybeSingle(),
      supabase.from('tresc_qualificacoes' as any).select('*').order('nome'),
    ]);
    const c = cfg as any;
    if (c) {
      setCfgId(c.id);
      setBaseUrl(c.base_url);
      setSelecionadas(Array.isArray(c.campanhas) ? c.campanhas : []);
      setUltimoSync(c.ultimo_sync);
    }
    setQuals((q as any[]) || []);
  }, []);

  useEffect(() => { if (open) carregar(); }, [open, carregar]);

  const chamar = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('relatorio-3c-sync', {
      body: { action, base_url: baseUrl, ...extra },
    });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const salvarConfig = async (patch: Record<string, unknown>) => {
    if (cfgId) {
      const { error } = await supabase.from('tresc_config' as any).update(patch).eq('id', cfgId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('tresc_config' as any)
        .insert({ base_url: baseUrl, ...patch })
        .select('id')
        .single();
      if (error) throw error;
      setCfgId((data as any).id);
    }
  };

  const testar = async () => {
    setLoading(true);
    try {
      const r = await chamar('testar');
      setCampanhas(r.campanhas || []);
      await salvarConfig({ base_url: baseUrl });
      toast.success(`Conexão OK — ${r.campanhas?.length || 0} campanha(s) encontrada(s)`);
    } catch (e: any) {
      toast.error(`Falha na conexão: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const importarQuals = async () => {
    setLoading(true);
    try {
      const r = await chamar('qualificacoes');
      setQuals(r.qualificacoes || []);
      toast.success(`${r.total} qualificação(ões) sincronizada(s)`);
    } catch (e: any) {
      toast.error(`Erro ao importar qualificações: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sincronizar = async () => {
    setLoading(true);
    try {
      const r = await chamar('sync');
      setUltimoSync(new Date().toISOString());
      toast.success(`${r.total} ligação(ões) importada(s) do dia`);
      onDone?.();
    } catch (e: any) {
      toast.error(`Erro na sincronização: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleCampanha = async (id: number) => {
    const novas = selecionadas.includes(id) ? selecionadas.filter((c) => c !== id) : [...selecionadas, id];
    setSelecionadas(novas);
    try { await salvarConfig({ campanhas: novas }); } catch { toast.error('Não foi possível salvar as campanhas'); }
  };

  const setClasse = async (qid: string, classificacao: string) => {
    setQuals((prev) => prev.map((q) => (q.id === qid ? { ...q, classificacao } : q)));
    const { error } = await supabase.from('tresc_qualificacoes' as any).update({ classificacao }).eq('id', qid);
    if (error) toast.error('Não foi possível salvar a classificação');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Phone className="h-4 w-4 mr-2" /> 3C Plus
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Integração 3C Plus</DialogTitle>
          <DialogDescription>
            Conecte o discador para alimentar automaticamente as colunas de ligações, alô, CPC e CPC-A.
            {ultimoSync && (
              <> Última sincronização: {new Date(ultimoSync).toLocaleString('pt-BR')}.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Endereço da API</Label>
              <div className="flex gap-2">
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://app.3c.fluxoti.com.br/api/v1" />
                <Button onClick={testar} disabled={loading}>
                  <PlugZap className="h-4 w-4 mr-2" /> Testar conexão
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O token de gestor fica guardado com segurança no servidor e nunca aparece na tela.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Campanhas incluídas no relatório</Label>
                <Badge variant="secondary">{selecionadas.length || 'todas'}</Badge>
              </div>
              {campanhas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Clique em “Testar conexão” para carregar as campanhas. Sem nenhuma marcada, todas entram no relatório.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {campanhas.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                      <Checkbox
                        checked={selecionadas.includes(c.id)}
                        onCheckedChange={() => toggleCampanha(c.id)}
                      />
                      <span className="truncate">{c.nome}</span>
                      {c.pausada && <Badge variant="outline" className="ml-auto">pausada</Badge>}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Qualificações → CPC / CPC-A</Label>
                <Button variant="outline" size="sm" onClick={importarQuals} disabled={loading}>
                  <Download className="h-4 w-4 mr-2" /> Importar da 3C
                </Button>
              </div>
              {quals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma qualificação cadastrada ainda. Importe da 3C e depois marque quais contam como CPC e CPC-A.
                </p>
              ) : (
                <div className="rounded-md border divide-y">
                  {quals.map((q) => (
                    <div key={q.id} className="flex items-center gap-3 p-2">
                      <span
                        className="h-3 w-3 rounded-full border shrink-0"
                        style={q.cor ? { backgroundColor: q.cor } : undefined}
                      />
                      <span className="text-sm flex-1 truncate">{q.nome}</span>
                      <div className="flex gap-1">
                        {CLASSES.map((c) => (
                          <Button
                            key={c.v}
                            size="sm"
                            variant={q.classificacao === c.v ? 'default' : 'outline'}
                            className={cn('h-7 px-2 text-xs')}
                            onClick={() => setClasse(q.id, c.v)}
                          >
                            {c.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
          <Button onClick={sincronizar} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} /> Sincronizar ligações de hoje
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
