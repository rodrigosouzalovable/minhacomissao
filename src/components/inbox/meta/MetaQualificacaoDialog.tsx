import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Settings, Trash2, Plus, Check, Loader2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MetaQualificacao {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  ativo: boolean;
}

const CORES = ['#16a34a', '#dc2626', '#0ea5e9', '#f59e0b', '#6b7280', '#6c5ce7', '#ea4c89', '#00b4d8'];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contatoId: string | null;
  contatoNome?: string;
  atuais: string[];
  qualificacoes: MetaQualificacao[];
  isAdmin: boolean;
  onQualificar: (contatoId: string, qualificacaoIds: string[]) => void;
  onQualificacoesChange: () => void;
}

export function MetaQualificacaoDialog({
  open, onOpenChange, contatoId, contatoNome, atuais, qualificacoes, isAdmin,
  onQualificar, onQualificacoesChange,
}: Props) {
  const { toast } = useToast();
  const [modoConfig, setModoConfig] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novaCor, setNovaCor] = useState(CORES[0]);

  useEffect(() => { if (!open) setModoConfig(false); }, [open]);

  const ativas = qualificacoes.filter(q => q.ativo);

  const marcar = async (qualificacaoId: string) => {
    if (!contatoId) return;
    const jaTem = atuais.includes(qualificacaoId);
    setSalvando(true);
    try {
      if (jaTem) {
        const { error } = await (supabase as any).from('meta_contato_qualificacao')
          .delete().eq('contato_id', contatoId).eq('qualificacao_id', qualificacaoId);
        if (error) throw error;
        onQualificar(contatoId, atuais.filter(id => id !== qualificacaoId));
      } else {
        const { data: sess } = await supabase.auth.getUser();
        const { error } = await (supabase as any).from('meta_contato_qualificacao')
          .upsert({
            contato_id: contatoId,
            qualificacao_id: qualificacaoId,
            user_id: sess?.user?.id ?? null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'contato_id,qualificacao_id' });
        if (error) throw error;
        onQualificar(contatoId, [...atuais, qualificacaoId]);
      }
    } catch (e: any) {
      toast({ title: 'Erro ao qualificar', description: e.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const criar = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    const ordem = (qualificacoes.reduce((m, q) => Math.max(m, q.ordem), 0) || 0) + 1;
    const { error } = await (supabase as any).from('meta_qualificacoes')
      .insert({ nome, cor: novaCor, ordem });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setNovoNome('');
    onQualificacoesChange();
  };

  const atualizar = async (id: string, patch: Partial<MetaQualificacao>) => {
    const { error } = await (supabase as any).from('meta_qualificacoes').update(patch).eq('id', id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    onQualificacoesChange();
  };

  const excluir = async (id: string) => {
    const { count } = await (supabase as any).from('meta_contato_qualificacao')
      .select('contato_id', { count: 'exact', head: true }).eq('qualificacao_id', id);
    if ((count ?? 0) > 0) {
      return toast({
        title: 'Não é possível excluir',
        description: `${count} conversa(s) usam esta qualificação. Inative em vez de excluir.`,
        variant: 'destructive',
      });
    }
    const { error } = await (supabase as any).from('meta_qualificacoes').delete().eq('id', id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    onQualificacoesChange();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {modoConfig && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setModoConfig(false)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {modoConfig ? 'Gerenciar qualificações' : 'Qualificação'}
          </DialogTitle>
          <DialogDescription>
            {modoConfig
              ? 'Crie, renomeie, ative/inative ou exclua os tipos de qualificação.'
              : contatoNome || 'Selecione uma ou mais qualificações para esta conversa.'}
          </DialogDescription>
        </DialogHeader>

        {!modoConfig ? (
          <div className="space-y-3">
            {ativas.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma qualificação ativa.</p>
            )}
            <div className="grid grid-cols-1 gap-2">
              {ativas.map(q => (
                <button
                  key={q.id}
                  disabled={salvando}
                  onClick={() => marcar(q.id)}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition hover:bg-accent',
                    atuais.includes(q.id) && 'border-primary bg-primary/10',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: q.cor }} />
                    {q.nome}
                  </span>
                  {atuais.includes(q.id) && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
            {salvando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <p className="text-xs text-muted-foreground">
              Você pode marcar várias qualificações. Clique em uma marcada para removê-la.
            </p>
            {isAdmin && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setModoConfig(true)}>
                <Settings className="h-4 w-4 mr-2" /> Gerenciar qualificações
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {qualificacoes.map(q => (
                <div key={q.id} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={q.cor}
                    onChange={(e) => atualizar(q.id, { cor: e.target.value })}
                    className="h-8 w-8 rounded border bg-transparent p-0.5"
                    aria-label={`Cor de ${q.nome}`}
                  />
                  <Input
                    defaultValue={q.nome}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== q.nome) atualizar(q.id, { nome: v });
                    }}
                    className="h-8 text-sm"
                  />
                  <Switch
                    checked={q.ativo}
                    onCheckedChange={(v) => atualizar(q.id, { ativo: v })}
                    aria-label="Ativa"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => excluir(q.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t pt-3">
              <input
                type="color"
                value={novaCor}
                onChange={(e) => setNovaCor(e.target.value)}
                className="h-8 w-8 rounded border bg-transparent p-0.5"
                aria-label="Cor da nova qualificação"
              />
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Nova qualificação"
                className="h-8 text-sm"
                onKeyDown={(e) => { if (e.key === 'Enter') criar(); }}
              />
              <Button size="sm" onClick={criar} disabled={!novoNome.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
