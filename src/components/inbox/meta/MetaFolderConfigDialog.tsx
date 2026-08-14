import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/** Sentinela usada para representar a caixa Padrão (folder_id IS NULL). */
export const CAIXA_PADRAO_ID = '00000000-0000-0000-0000-000000000000';

interface Credor {
  id: string;
  nome: string;
  ativo: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folderId: string | null;
  folderNome: string;
  qualificacaoAtiva: boolean;
  onChanged: () => void;
}

export function MetaFolderConfigDialog({
  open, onOpenChange, folderId, folderNome, qualificacaoAtiva, onChanged,
}: Props) {
  const { toast } = useToast();
  const [ativo, setAtivo] = useState(qualificacaoAtiva);
  const [salvando, setSalvando] = useState(false);

  const alvo = folderId ?? CAIXA_PADRAO_ID;
  const [credores, setCredores] = useState<Credor[]>([]);
  const [novoCredor, setNovoCredor] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setAtivo(qualificacaoAtiva); }, [open, qualificacaoAtiva]);

  const carregarCredores = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('meta_inbox_folder_credores')
      .select('id, nome, ativo')
      .eq('folder_id', alvo)
      .order('nome');
    if (error) {
      toast({ title: 'Erro ao carregar credores', description: error.message, variant: 'destructive' });
      return;
    }
    setCredores((data || []) as Credor[]);
  }, [alvo, toast]);

  useEffect(() => { if (open) carregarCredores(); }, [open, carregarCredores]);

  const salvar = async (valor: boolean) => {
    setAtivo(valor);
    setSalvando(true);
    const { error } = await (supabase as any).from('meta_qualificacao_caixa').upsert(
      { folder_id: alvo, ativo: valor, updated_at: new Date().toISOString() },
      { onConflict: 'folder_id' },
    );
    setSalvando(false);
    if (error) {
      setAtivo(!valor);
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    onChanged();
  };

  const adicionarCredor = async () => {
    const nome = novoCredor.trim();
    if (!nome) return;
    setBusy(true);
    const { error } = await (supabase as any)
      .from('meta_inbox_folder_credores')
      .insert({ folder_id: alvo, nome, ativo: false });
    setBusy(false);
    if (error) {
      toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' });
      return;
    }
    setNovoCredor('');
    carregarCredores();
  };

  const alternarCredor = async (credor: Credor, valor: boolean) => {
    setBusy(true);
    if (valor) {
      const outros = credores.filter(c => c.id !== credor.id && c.ativo).map(c => c.id);
      if (outros.length) {
        const { error: errOff } = await (supabase as any)
          .from('meta_inbox_folder_credores')
          .update({ ativo: false })
          .in('id', outros);
        if (errOff) {
          setBusy(false);
          toast({ title: 'Erro', description: errOff.message, variant: 'destructive' });
          return;
        }
      }
    }
    const { error } = await (supabase as any)
      .from('meta_inbox_folder_credores')
      .update({ ativo: valor })
      .eq('id', credor.id);
    setBusy(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    carregarCredores();
  };

  const excluirCredor = async (credor: Credor) => {
    setBusy(true);
    const { error } = await (supabase as any)
      .from('meta_inbox_folder_credores')
      .delete()
      .eq('id', credor.id);
    setBusy(false);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    carregarCredores();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar caixa · {folderNome}</DialogTitle>
          <DialogDescription>Ajustes específicos desta caixa de mensagens.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div className="space-y-0.5">
            <Label className="text-sm">Qualificação de conversas</Label>
            <p className="text-xs text-muted-foreground">
              Exibe o botão "Qualificação" nas conversas e destaca em azul as ainda não qualificadas.
            </p>
          </div>
          <Switch checked={ativo} disabled={salvando} onCheckedChange={salvar} />
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <div className="space-y-0.5">
            <Label className="text-sm">Credor da caixa</Label>
            <p className="text-xs text-muted-foreground">
              O credor ativo é o que o IAGO informa ao cliente quando ele pergunta de qual débito se trata.
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              value={novoCredor}
              onChange={(e) => setNovoCredor(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarCredor(); } }}
              placeholder="Nome do credor (ex.: Novo Mundo)"
              className="h-9"
            />
            <Button size="sm" className="h-9" disabled={busy || !novoCredor.trim()} onClick={adicionarCredor}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>

          {credores.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum credor cadastrado nesta caixa.</p>
          ) : (
            <div className="space-y-2">
              {credores.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <span className={`text-sm truncate ${c.ativo ? 'font-medium' : 'text-muted-foreground'}`}>
                    {c.nome}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={c.ativo}
                      disabled={busy}
                      onCheckedChange={(v) => alternarCredor(c, v)}
                      aria-label="Ativar credor"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      disabled={busy}
                      onClick={() => excluirCredor(c)}
                      aria-label="Excluir credor"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
