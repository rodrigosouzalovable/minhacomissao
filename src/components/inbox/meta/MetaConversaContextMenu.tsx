import { ReactNode, useState } from 'react';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSub,
  ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { MailOpen, Tag, Settings, Check, Pin, Trash2, Archive, ArchiveRestore, Lock } from 'lucide-react';
import { MetaEtiquetasDialog, MetaEtiqueta } from './MetaEtiquetasDialog';

interface Props {
  children: ReactNode;
  contatoId: string;
  etiquetas: MetaEtiqueta[];
  /** Lista completa (sem filtro por caixa) usada na janela de gerenciamento */
  etiquetasGerenciar?: MetaEtiqueta[];
  contatoEtiquetaIds: string[];
  etiquetasBloqueadas?: Set<string>;
  fixado: boolean;
  arquivado: boolean;
  onMarcarNaoLida: () => void;
  onExcluirConversa: (id: string) => void;
  onEtiquetaToggle: (cId: string, eId: string, ativo: boolean) => void;
  onEtiquetasChange: () => void;
  onFixarToggle: (id: string, fix: boolean) => void;
  onArquivarToggle: (id: string, arq: boolean) => void;
}

export function MetaConversaContextMenu({
  children, contatoId, etiquetas, etiquetasGerenciar, contatoEtiquetaIds, etiquetasBloqueadas,
  fixado, arquivado,
  onMarcarNaoLida, onExcluirConversa, onEtiquetaToggle, onEtiquetasChange, onFixarToggle, onArquivarToggle,
}: Props) {
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const [gerenciarOpen, setGerenciarOpen] = useState(false);

  const handleMarcarNaoLida = async () => {
    const { error } = await supabase.from('meta_whatsapp_contatos').update({ nao_lido: 1 }).eq('id', contatoId);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else onMarcarNaoLida();
  };

  const isAtendente = (nome: string) => /^atendente:/i.test(String(nome || '').trim());

  const handleToggleEtiqueta = async (etiquetaId: string) => {
    const ativo = contatoEtiquetaIds.includes(etiquetaId);
    const travada = !!etiquetasBloqueadas?.has(etiquetaId);
    if (ativo && travada && !isAdmin) {
      toast({
        title: 'Etiqueta bloqueada',
        description: 'Etiqueta do atendente — apenas admin pode remover.',
        variant: 'destructive',
      });
      return;
    }
    if (ativo) {
      const { error } = await supabase.from('meta_whatsapp_contato_etiquetas').delete()
        .eq('contato_id', contatoId).eq('etiqueta_id', etiquetaId);
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        return;
      }
      onEtiquetaToggle(contatoId, etiquetaId, false);
      return;
    }

    // Atendente é exclusivo: marcar um substitui o anterior (nunca soma).
    const alvo = etiquetas.find(e => e.id === etiquetaId);
    const antigos = isAtendente(alvo?.nome || '')
      ? etiquetas.filter(e => e.id !== etiquetaId && isAtendente(e.nome) && contatoEtiquetaIds.includes(e.id))
      : [];

    if (antigos.length > 0) {
      const algumTravado = antigos.some(e => etiquetasBloqueadas?.has(e.id));
      if (algumTravado && !isAdmin) {
        toast({
          title: 'Etiqueta bloqueada',
          description: 'Esta conversa já tem atendente definido automaticamente — apenas admin pode trocar.',
          variant: 'destructive',
        });
        return;
      }
      const { error: delErr } = await supabase.from('meta_whatsapp_contato_etiquetas').delete()
        .eq('contato_id', contatoId).in('etiqueta_id', antigos.map(e => e.id));
      if (delErr) {
        toast({ title: 'Erro', description: delErr.message, variant: 'destructive' });
        return;
      }
      antigos.forEach(e => onEtiquetaToggle(contatoId, e.id, false));
    }

    const { error } = await supabase.from('meta_whatsapp_contato_etiquetas')
      .insert({ contato_id: contatoId, etiqueta_id: etiquetaId });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    onEtiquetaToggle(contatoId, etiquetaId, true);
  };


  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={handleMarcarNaoLida}>
            <MailOpen className="h-4 w-4 mr-2" /> Marcar como não lida
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onFixarToggle(contatoId, !fixado)}>
            <Pin className="h-4 w-4 mr-2" /> {fixado ? 'Desafixar' : 'Fixar conversa'}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onArquivarToggle(contatoId, !arquivado)}>
            {arquivado ? <ArchiveRestore className="h-4 w-4 mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
            {arquivado ? 'Desarquivar' : 'Arquivar'}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onExcluirConversa(contatoId)} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" /> Excluir conversa
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger><Tag className="h-4 w-4 mr-2" />Etiquetas</ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-56">
              {etiquetas.length === 0 ? (
                <ContextMenuItem disabled className="text-xs text-muted-foreground">Nenhuma etiqueta</ContextMenuItem>
              ) : etiquetas.map(et => {
                const travada = !!etiquetasBloqueadas?.has(et.id) && contatoEtiquetaIds.includes(et.id);
                return (
                  <ContextMenuItem key={et.id} onSelect={(e) => { e.preventDefault(); handleToggleEtiqueta(et.id); }}>
                    <div className="flex items-center gap-2 w-full">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: et.cor }} />
                      <span className="flex-1 truncate">{et.nome}</span>
                      {travada && <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-label="Só admin remove" />}
                      {contatoEtiquetaIds.includes(et.id) && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  </ContextMenuItem>
                );
              })}
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => setGerenciarOpen(true)}>
                <Settings className="h-4 w-4 mr-2" /> Gerenciar etiquetas
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>
      <MetaEtiquetasDialog open={gerenciarOpen} onOpenChange={setGerenciarOpen} etiquetas={etiquetasGerenciar ?? etiquetas} onChange={onEtiquetasChange} />
    </>
  );
}
