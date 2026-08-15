import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Settings, Trash2, Plus, Check, Loader2, ArrowLeft, ListTree, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MetaQualificacao {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  ativo: boolean;
  parent_id?: string | null;
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
  /** id da primária cujos motivos estão sendo configurados (admin) */
  const [configMotivosDe, setConfigMotivosDe] = useState<string | null>(null);
  /** id da primária cujos motivos o atendente está escolhendo */
  const [escolhendoMotivosDe, setEscolhendoMotivosDe] = useState<string | null>(null);
  const [motivosSel, setMotivosSel] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novaCor, setNovaCor] = useState(CORES[0]);

  useEffect(() => {
    if (!open) {
      setModoConfig(false);
      setConfigMotivosDe(null);
      setEscolhendoMotivosDe(null);
      setMotivosSel([]);
      setNovoNome('');
    }
  }, [open]);

  const primarias = useMemo(() => qualificacoes.filter(q => !q.parent_id), [qualificacoes]);
  const motivosPorPai = useMemo(() => {
    const m: Record<string, MetaQualificacao[]> = {};
    qualificacoes.filter(q => q.parent_id).forEach(q => {
      const k = q.parent_id as string;
      if (!m[k]) m[k] = [];
      m[k].push(q);
    });
    return m;
  }, [qualificacoes]);

  const ativas = primarias.filter(q => q.ativo);
  const motivosAtivos = (paiId: string) => (motivosPorPai[paiId] ?? []).filter(m => m.ativo);
  const motivosMarcados = (paiId: string) =>
    (motivosPorPai[paiId] ?? []).filter(m => atuais.includes(m.id));

  /** Grava a primária + motivos escolhidos, removendo motivos desmarcados */
  const gravar = async (primariaId: string, motivoIds: string[]) => {
    if (!contatoId) return;
    setSalvando(true);
    try {
      const { data: sess } = await supabase.auth.getUser();
      const uid = sess?.user?.id ?? null;
      const inserir = [primariaId, ...motivoIds].map(id => ({
        contato_id: contatoId,
        qualificacao_id: id,
        user_id: uid,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await (supabase as any).from('meta_contato_qualificacao')
        .upsert(inserir, { onConflict: 'contato_id,qualificacao_id' });
      if (error) throw error;

      const remover = (motivosPorPai[primariaId] ?? [])
        .filter(m => atuais.includes(m.id) && !motivoIds.includes(m.id))
        .map(m => m.id);
      if (remover.length) {
        const { error: delErr } = await (supabase as any).from('meta_contato_qualificacao')
          .delete().eq('contato_id', contatoId).in('qualificacao_id', remover);
        if (delErr) throw delErr;
      }

      const proximo = Array.from(new Set([
        ...atuais.filter(id => !remover.includes(id)),
        primariaId,
        ...motivoIds,
      ]));
      onQualificar(contatoId, proximo);
      setEscolhendoMotivosDe(null);
      setMotivosSel([]);
    } catch (e: any) {
      toast({ title: 'Erro ao qualificar', description: e.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const desmarcar = async (primariaId: string) => {
    if (!contatoId) return;
    const ids = [primariaId, ...(motivosPorPai[primariaId] ?? []).map(m => m.id)];
    setSalvando(true);
    try {
      const { error } = await (supabase as any).from('meta_contato_qualificacao')
        .delete().eq('contato_id', contatoId).in('qualificacao_id', ids);
      if (error) throw error;
      onQualificar(contatoId, atuais.filter(id => !ids.includes(id)));
    } catch (e: any) {
      toast({ title: 'Erro ao qualificar', description: e.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const clicarPrimaria = (q: MetaQualificacao) => {
    if (!contatoId) return;
    if (atuais.includes(q.id)) return desmarcar(q.id);
    const motivos = motivosAtivos(q.id);
    if (motivos.length > 0) {
      setMotivosSel(motivosMarcados(q.id).map(m => m.id));
      setEscolhendoMotivosDe(q.id);
      return;
    }
    gravar(q.id, []);
  };

  const abrirEdicaoMotivos = (q: MetaQualificacao) => {
    setMotivosSel(motivosMarcados(q.id).map(m => m.id));
    setEscolhendoMotivosDe(q.id);
  };

  const criar = async (parentId: string | null) => {
    const nome = novoNome.trim();
    if (!nome) return;
    const irmaos = parentId ? (motivosPorPai[parentId] ?? []) : primarias;
    const ordem = (irmaos.reduce((m, q) => Math.max(m, q.ordem), 0) || 0) + 1;
    const { error } = await (supabase as any).from('meta_qualificacoes')
      .insert({ nome, cor: novaCor, ordem, parent_id: parentId });
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

  const paiConfig = configMotivosDe ? qualificacoes.find(q => q.id === configMotivosDe) : null;
  const paiEscolha = escolhendoMotivosDe ? qualificacoes.find(q => q.id === escolhendoMotivosDe) : null;

  const editorLista = (itens: MetaQualificacao[], parentId: string | null) => (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="space-y-2 flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1">
        {itens.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum item cadastrado ainda.</p>
        )}

        {itens.map(q => (
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
            {!parentId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Configurar motivos"
                onClick={() => setConfigMotivosDe(q.id)}
              >
                <ListTree className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => excluir(q.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t pt-3">
        <input
          type="color"
          value={novaCor}
          onChange={(e) => setNovaCor(e.target.value)}
          className="h-8 w-8 rounded border bg-transparent p-0.5"
          aria-label="Cor do novo item"
        />
        <Input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder={parentId ? 'Novo motivo' : 'Nova qualificação'}
          className="h-8 text-sm"
          onKeyDown={(e) => { if (e.key === 'Enter') criar(parentId); }}
        />
        <Button size="sm" onClick={() => criar(parentId)} disabled={!novoNome.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  let titulo = 'Qualificação';
  if (paiEscolha) titulo = `Motivo: ${paiEscolha.nome}`;
  else if (paiConfig) titulo = `Motivos de: ${paiConfig.nome}`;
  else if (modoConfig) titulo = 'Gerenciar qualificações';

  const voltar = () => {
    if (paiEscolha) { setEscolhendoMotivosDe(null); setMotivosSel([]); return; }
    if (paiConfig) { setConfigMotivosDe(null); setNovoNome(''); return; }
    setModoConfig(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85svh] flex flex-col overflow-hidden gap-3">
        <DialogHeader className="shrink-0">

          <DialogTitle className="flex items-center gap-2">
            {(modoConfig || paiConfig || paiEscolha) && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={voltar}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {titulo}
          </DialogTitle>
          <DialogDescription>
            {paiEscolha
              ? 'Selecione o motivo (pode marcar mais de um) para concluir a qualificação.'
              : paiConfig
                ? 'Crie, renomeie, ative/inative ou exclua os motivos desta qualificação.'
                : modoConfig
                  ? 'Clique no ícone de lista para configurar os motivos de cada qualificação.'
                  : contatoNome || 'Selecione uma ou mais qualificações para esta conversa.'}
          </DialogDescription>
        </DialogHeader>

        {paiEscolha ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="grid grid-cols-1 gap-2 flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1">

              {motivosAtivos(paiEscolha.id).map(m => {
                const on = motivosSel.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => setMotivosSel(prev => on ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm transition hover:bg-accent',
                      on && 'border-primary bg-primary/10',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: m.cor }} />
                      {m.nome}
                    </span>
                    {on && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
            <Button
              className="w-full shrink-0"

              size="sm"
              disabled={salvando || motivosSel.length === 0}
              onClick={() => gravar(paiEscolha.id, motivosSel)}
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar qualificação'}
            </Button>
            {motivosSel.length === 0 && (
              <p className="text-xs text-muted-foreground">Selecione o motivo para salvar.</p>
            )}
          </div>
        ) : paiConfig ? (
          editorLista(motivosPorPai[paiConfig.id] ?? [], paiConfig.id)
        ) : modoConfig ? (
          editorLista(primarias, null)
        ) : (
          <div className="space-y-3">
            {ativas.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma qualificação ativa.</p>
            )}
            <div className="grid grid-cols-1 gap-2">
              {ativas.map(q => {
                const marcada = atuais.includes(q.id);
                const mots = motivosMarcados(q.id);
                const temMotivos = motivosAtivos(q.id).length > 0;
                return (
                  <ContextMenu key={q.id}>
                    <ContextMenuTrigger asChild>
                      <div
                        className={cn(
                          'flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition hover:bg-accent cursor-pointer',
                          marcada && 'border-primary bg-primary/10',
                        )}
                        onClick={() => { if (!salvando) clicarPrimaria(q); }}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: q.cor }} />
                          <span className="truncate">
                            {q.nome}
                            {mots.length > 0 && (
                              <span className="text-muted-foreground"> ({mots.map(m => m.nome).join(', ')})</span>
                            )}
                          </span>
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          {marcada && temMotivos && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              title="Trocar motivo"
                              onClick={(e) => { e.stopPropagation(); abrirEdicaoMotivos(q); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {marcada && <Check className="h-4 w-4 text-primary" />}
                        </span>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      {isAdmin ? (
                        <ContextMenuItem onClick={() => { setModoConfig(true); setConfigMotivosDe(q.id); }}>
                          <Settings className="h-4 w-4 mr-2" /> Configurar motivos
                        </ContextMenuItem>
                      ) : (
                        <ContextMenuItem disabled className="text-xs text-muted-foreground">
                          {motivosAtivos(q.id).length > 0
                            ? `${motivosAtivos(q.id).length} motivo(s) configurado(s)`
                            : 'Sem motivos configurados'}
                        </ContextMenuItem>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </div>
            {salvando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <p className="text-xs text-muted-foreground">
              Você pode marcar várias qualificações. Clique em uma marcada para removê-la.
              {isAdmin && ' Clique com o botão direito para configurar os motivos.'}
            </p>
            {isAdmin && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setModoConfig(true)}>
                <Settings className="h-4 w-4 mr-2" /> Gerenciar qualificações
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
