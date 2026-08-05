import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Trash2, Plus, Pencil, Check, X, Tag, Search, UserRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CORES = ['#25D366', '#FF6B6B', '#4ECDC4', '#FFD93D', '#6C5CE7', '#FF8A5C', '#EA4C89', '#00B4D8'];

export interface MetaEtiqueta { id: string; nome: string; cor: string; ativa?: boolean }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  etiquetas: MetaEtiqueta[];
  onChange: () => void;
  /** Quando true, exibe os controles de ativar/desativar etiquetas (somente admin). */
  isAdmin?: boolean;
  /** Modo configuração: foco em editar nome/cor e visibilidade das etiquetas existentes. */
  modoConfig?: boolean;
}

const isAtendente = (nome: string) => /^atendente:/i.test(String(nome || '').trim());

function Paleta({ valor, onSelect, size = 'md' }: { valor: string; onSelect: (c: string) => void; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {CORES.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onSelect(c)}
          aria-label={`Cor ${c}`}
          className={`${dim} rounded-full border-2 transition-transform shrink-0`}
          style={{
            backgroundColor: c,
            borderColor: valor === c ? 'hsl(var(--foreground))' : 'transparent',
            transform: valor === c ? 'scale(1.15)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  );
}

export function MetaEtiquetasDialog({ open, onOpenChange, etiquetas, onChange, isAdmin = false, modoConfig = false }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(CORES[0]);
  const [busca, setBusca] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCor, setEditCor] = useState(CORES[0]);

  const alternarAtiva = async (et: MetaEtiqueta) => {
    const novo = et.ativa === false;
    const { data, error } = await supabase
      .from('meta_whatsapp_etiquetas')
      .update({ ativa: novo } as any)
      .eq('id', et.id)
      .select('id');
    if (error || !data || data.length === 0) {
      toast({
        title: 'Não foi possível alterar',
        description: error?.message || 'Apenas o administrador pode ativar/desativar etiquetas.',
        variant: 'destructive',
      });
      return;
    }
    onChange();
  };


  const criar = async () => {
    if (!nome.trim() || !user) return;
    const { error } = await supabase.from('meta_whatsapp_etiquetas').insert({
      user_id: user.id, nome: nome.trim(), cor,
    });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setNome(''); setCor(CORES[0]); setCriando(false); onChange();
  };

  const excluir = async (id: string) => {
    const { error } = await supabase.from('meta_whatsapp_etiquetas').delete().eq('id', id);
    if (error) {
      toast({
        title: 'Não é possível remover',
        description: 'Etiquetas de atendente aplicadas automaticamente só podem ser removidas por um administrador.',
        variant: 'destructive',
      });
      return;
    }
    onChange();
  };

  const iniciarEdicao = (et: MetaEtiqueta) => {
    setEditandoId(et.id);
    setEditNome(et.nome);
    setEditCor(et.cor);
  };
  const cancelarEdicao = () => { setEditandoId(null); setEditNome(''); };

  const salvarEdicao = async (id: string) => {
    if (!editNome.trim()) return;
    const { data, error } = await supabase
      .from('meta_whatsapp_etiquetas')
      .update({ nome: editNome.trim(), cor: editCor })
      .eq('id', id)
      .select('id');
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    if (!data || data.length === 0) {
      toast({
        title: 'Sem permissão',
        description: 'Esta etiqueta foi criada por outro usuário. Apenas o administrador pode editá-la.',
        variant: 'destructive',
      });
      return;
    }
    cancelarEdicao();
    onChange();
  };

  const { atendentes, gerais } = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const lista = t
      ? etiquetas.filter(e => String(e.nome || '').toLowerCase().includes(t))
      : etiquetas;
    const ordena = (a: MetaEtiqueta, b: MetaEtiqueta) => a.nome.localeCompare(b.nome, 'pt-BR');
    return {
      atendentes: lista.filter(e => isAtendente(e.nome)).sort(ordena),
      gerais: lista.filter(e => !isAtendente(e.nome)).sort(ordena),
    };
  }, [etiquetas, busca]);

  const renderLinha = (et: MetaEtiqueta) => {
    if (editandoId === et.id) {
      return (
        <div key={et.id} className="rounded-md border border-border bg-background p-2 space-y-2">
          <Input
            value={editNome}
            onChange={e => setEditNome(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') salvarEdicao(et.id);
              if (e.key === 'Escape') cancelarEdicao();
            }}
            className="h-8"
            autoFocus
          />
          <div className="flex items-center justify-between gap-2">
            <Paleta valor={editCor} onSelect={setEditCor} size="sm" />
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" className="h-7 w-7" onClick={() => salvarEdicao(et.id)} disabled={!editNome.trim()} title="Salvar">
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelarEdicao} title="Cancelar">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      );
    }
    const inativa = et.ativa === false;
    return (
      <div
        key={et.id}
        className={`group flex items-center gap-2 h-9 pl-2 pr-1 rounded-md bg-background hover:bg-accent/40 transition-colors ${inativa ? 'opacity-50' : ''}`}
      >
        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: et.cor }} />
        <span className={`text-sm truncate flex-1 min-w-0 ${inativa ? 'line-through' : ''}`}>{et.nome}</span>
        <div className="flex items-center gap-1 shrink-0">
          {isAdmin && (
            <div className="flex items-center gap-1">
              {inativa
                ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                : <Eye className="h-3.5 w-3.5 text-emerald-500" />}
              <Switch
                checked={!inativa}
                onCheckedChange={() => alternarAtiva(et)}
                className="scale-[0.8]"
                aria-label={inativa ? 'Ativar etiqueta' : 'Desativar etiqueta'}
              />
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => iniciarEdicao(et)} title="Editar nome e cor">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => excluir(et.id)} title="Excluir">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>
    );
  };

  const grupo = (titulo: string, icone: React.ReactNode, itens: MetaEtiqueta[]) => (
    itens.length === 0 ? null : (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 px-0.5">
          {icone}
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</span>
          <span className="text-[11px] text-muted-foreground">({itens.length})</span>
        </div>
        <div className="space-y-1">{itens.map(renderLinha)}</div>
      </div>
    )
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4" /> Etiquetas Meta
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {etiquetas.length} {etiquetas.length === 1 ? 'etiqueta' : 'etiquetas'}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 py-3 space-y-2 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 h-8"
                placeholder="Buscar etiqueta..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
            <Button size="sm" className="h-8 shrink-0" variant={criando ? 'secondary' : 'default'} onClick={() => setCriando(v => !v)}>
              {criando ? <X className="h-4 w-4" /> : <><Plus className="h-4 w-4 mr-1" /> Nova</>}
            </Button>
          </div>

          {criando && (
            <div className="rounded-md border bg-muted/30 p-2 space-y-2">
              <Input
                className="h-8"
                placeholder="Nome da etiqueta..."
                value={nome}
                onChange={e => setNome(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && criar()}
                autoFocus
              />
              <div className="flex items-center justify-between gap-2">
                <Paleta valor={cor} onSelect={setCor} size="sm" />
                <Button size="sm" className="h-7 shrink-0" onClick={criar} disabled={!nome.trim()}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Criar
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
          {atendentes.length === 0 && gerais.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              {busca.trim() ? 'Nenhuma etiqueta encontrada.' : 'Nenhuma etiqueta criada ainda.'}
            </p>
          ) : (
            <>
              {grupo('Atendentes', <UserRound className="h-3.5 w-3.5 text-muted-foreground" />, atendentes)}
              {grupo('Etiquetas gerais', <Tag className="h-3.5 w-3.5 text-muted-foreground" />, gerais)}
            </>
          )}
        </div>

        <DialogFooter className="px-4 py-3 border-t shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
