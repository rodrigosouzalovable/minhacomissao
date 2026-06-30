import { ReactNode, useState } from 'react';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSub,
  ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MailOpen, Tag, Settings, Check, Pin, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { MetaEtiquetasDialog, MetaEtiqueta } from './MetaEtiquetasDialog';

interface Props {
  children: ReactNode;
  contatoId: string;
  etiquetas: MetaEtiqueta[];
  contatoEtiquetaIds: string[];
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
  children, contatoId, etiquetas, contatoEtiquetaIds, fixado, arquivado,
  onMarcarNaoLida, onExcluirConversa, onEtiquetaToggle, onEtiquetasChange, onFixarToggle, onArquivarToggle,
}: Props) {
  const { toast } = useToast();
  const [gerenciarOpen, setGerenciarOpen] = useState(false);

  const handleMarcarNaoLida = async () => {
    const { error } = await supabase.from('meta_whatsapp_contatos').update({ nao_lido: 1 }).eq('id', contatoId);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else onMarcarNaoLida();
  };

  const handleToggleEtiqueta = async (etiquetaId: string) => {
    const ativo = contatoEtiquetaIds.includes(etiquetaId);
    if (ativo) {
      await supabase.from('meta_whatsapp_contato_etiquetas').delete()
        .eq('contato_id', contatoId).eq('etiqueta_id', etiquetaId);
    } else {
      await supabase.from('meta_whatsapp_contato_etiquetas').insert({ contato_id: contatoId, etiqueta_id: etiquetaId });
    }
    onEtiquetaToggle(contatoId, etiquetaId, !ativo);
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
            <ContextMenuSubContent className="w-48">
              {etiquetas.length === 0 ? (
                <ContextMenuItem disabled className="text-xs text-muted-foreground">Nenhuma etiqueta</ContextMenuItem>
              ) : etiquetas.map(et => (
                <ContextMenuItem key={et.id} onSelect={(e) => { e.preventDefault(); handleToggleEtiqueta(et.id); }}>
                  <div className="flex items-center gap-2 w-full">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: et.cor }} />
                    <span className="flex-1 truncate">{et.nome}</span>
                    {contatoEtiquetaIds.includes(et.id) && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </div>
                </ContextMenuItem>
              ))}
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => setGerenciarOpen(true)}>
                <Settings className="h-4 w-4 mr-2" /> Gerenciar etiquetas
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>
      <MetaEtiquetasDialog open={gerenciarOpen} onOpenChange={setGerenciarOpen} etiquetas={etiquetas} onChange={onEtiquetasChange} />
    </>
  );
}
