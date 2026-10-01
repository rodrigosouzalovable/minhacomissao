import { useState } from 'react';
import { Download, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { gerarTermoAcordoPdf } from '@/lib/termoAcordoPdf';
import { uploadInboxMedia } from '@/lib/inboxMediaUrl';
import { useToast } from '@/hooks/use-toast';

interface MetaOrigem { contatoId: string; instanciaId: string; telefone?: string | null; bsuid?: string | null }
interface Props {
  open: boolean;
  acordo: Tables<'acordos'>;
  pagamentos: Tables<'pagamentos'>[];
  metaOrigem?: MetaOrigem | null;
  entity?: 'acordos' | 'acordos_devedor';
  onComplete: () => void;
}

export function FormalizarTermoDialog({ open, acordo, pagamentos, metaOrigem, entity = 'acordos', onComplete }: Props) {
  const [working, setWorking] = useState<'download' | 'whatsapp' | null>(null);
  const { toast } = useToast();

  const concluir = async (metodo: 'download' | 'whatsapp') => {
    const { data: auth } = await supabase.auth.getUser();
    const table = entity === 'acordos_devedor' ? 'acordos_devedor' : 'acordos';
    const { error } = await supabase.from(table).update({
      termo_formalizacao_status: 'concluido',
      termo_formalizacao_metodo: metodo,
      termo_formalizado_em: new Date().toISOString(),
      termo_formalizado_por: auth.user?.id ?? null,
      termo_meta_contato_id: metodo === 'whatsapp' ? metaOrigem?.contatoId ?? null : null,
      termo_meta_instancia_id: metodo === 'whatsapp' ? metaOrigem?.instanciaId ?? null : null,
    }).eq('id', acordo.id);
    if (error) throw error;
  };

  const baixar = async () => {
    setWorking('download');
    try {
      gerarTermoAcordoPdf({ acordo, pagamentos, salvar: true });
      await concluir('download');
      toast({ title: 'Termo emitido', description: 'O download foi iniciado e o acordo foi formalizado.' });
      onComplete();
    } catch (error) {
      toast({ title: 'Não foi possível emitir o termo', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' });
    } finally { setWorking(null); }
  };

  const enviar = async () => {
    if (!metaOrigem) return;
    setWorking('whatsapp');
    try {
      const { doc, nomeArquivo } = gerarTermoAcordoPdf({ acordo, pagamentos, salvar: false });
      const blob = doc.output('blob');
      const destino = (metaOrigem.telefone || metaOrigem.bsuid || 'contato').replace(/\D/g, '');
      const path = `${metaOrigem.instanciaId}/${destino}/${Date.now()}-${nomeArquivo}`;
      const mediaUrl = await uploadInboxMedia(path, blob, 'application/pdf');
      const { data, error } = await supabase.functions.invoke('send-whatsapp-meta-media', { body: {
        instancia_id: metaOrigem.instanciaId,
        telefone: metaOrigem.telefone || undefined,
        bsuid: metaOrigem.bsuid || undefined,
        media_url: mediaUrl,
        type: 'document',
        file_name: nomeArquivo,
        caption: 'Termo do acordo',
      } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao enviar o termo.');
      await concluir('whatsapp');
      toast({ title: 'Termo enviado', description: 'O documento foi enviado na conversa da negociação.' });
      onComplete();
    } catch (error) {
      toast({ title: 'Não foi possível enviar', description: error instanceof Error ? error.message : 'Baixe o termo para concluir.', variant: 'destructive' });
    } finally { setWorking(null); }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-lg [&>button]:hidden" onEscapeKeyDown={(event) => event.preventDefault()} onPointerDownOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Emissão obrigatória do termo</DialogTitle>
          <DialogDescription>Para finalizar o lançamento, envie o termo na conversa da negociação ou faça o download.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {metaOrigem && (
            <Button onClick={enviar} disabled={working !== null} className="h-auto min-h-20 flex-col gap-2">
              {working === 'whatsapp' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              Enviar no WhatsApp Oficial
            </Button>
          )}
          <Button onClick={baixar} disabled={working !== null} variant={metaOrigem ? 'outline' : 'default'} className="h-auto min-h-20 flex-col gap-2">
            {working === 'download' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            Baixar termo em PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}