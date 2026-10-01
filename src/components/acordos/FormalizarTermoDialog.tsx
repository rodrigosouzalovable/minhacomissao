import { useEffect, useState } from 'react';
import { Download, Loader2, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { gerarTermoAcordoPdf } from '@/lib/termoAcordoPdf';
import { uploadInboxMedia } from '@/lib/inboxMediaUrl';
import { useToast } from '@/hooks/use-toast';

interface MetaOrigem {
  contatoId: string;
  instanciaId: string;
  telefone?: string | null;
  bsuid?: string | null;
  contatoNome?: string | null;
  instanciaNome?: string | null;
}
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
  const [procurandoConversa, setProcurandoConversa] = useState(false);
  const [erroBuscaConversa, setErroBuscaConversa] = useState<string | null>(null);
  const [conversas, setConversas] = useState<MetaOrigem[]>(metaOrigem ? [metaOrigem] : []);
  const [conversaSelecionadaId, setConversaSelecionadaId] = useState(metaOrigem?.contatoId ?? '');
  const { toast } = useToast();

  const conversaSelecionada = conversas.find((conversa) => conversa.contatoId === conversaSelecionadaId) ?? null;

  useEffect(() => {
    if (!open) return;

    if (metaOrigem) {
      setConversas([metaOrigem]);
      setConversaSelecionadaId(metaOrigem.contatoId);
      setErroBuscaConversa(null);
      setProcurandoConversa(false);
      return;
    }

    const telefone = String(acordo.cliente_telefone || '').replace(/\D/g, '');
    const sufixo = telefone.slice(-8);
    if (sufixo.length < 8) {
      setConversas([]);
      setConversaSelecionadaId('');
      setErroBuscaConversa(null);
      setProcurandoConversa(false);
      return;
    }

    let ativo = true;
    const localizarConversas = async () => {
      setProcurandoConversa(true);
      setErroBuscaConversa(null);
      const { data: contatos, error } = await (supabase as any)
        .rpc('localizar_conversas_meta_por_telefone', { _telefone: telefone });

      if (!ativo) return;
      if (error) {
        setConversas([]);
        setConversaSelecionadaId('');
        setErroBuscaConversa('Não foi possível consultar as conversas agora. Tente novamente antes de baixar o termo.');
        setProcurandoConversa(false);
        return;
      }

      const encontradas = (contatos || []).map((contato: any) => ({
        contatoId: contato.contato_id,
        instanciaId: contato.instancia_id,
        telefone: contato.telefone,
        bsuid: contato.bsuid,
        contatoNome: contato.contato_nome,
        instanciaNome: contato.instancia_nome || 'WhatsApp Oficial',
      }));
      setConversas(encontradas);
      setConversaSelecionadaId(encontradas[0]?.contatoId ?? '');
      setProcurandoConversa(false);
    };

    void localizarConversas();
    return () => { ativo = false; };
  }, [acordo.cliente_telefone, metaOrigem, open]);

  const concluir = async (metodo: 'download' | 'whatsapp') => {
    const { data: auth } = await supabase.auth.getUser();
    const table = entity === 'acordos_devedor' ? 'acordos_devedor' : 'acordos';
    const { error } = await supabase.from(table).update({
      termo_formalizacao_status: 'concluido',
      termo_formalizacao_metodo: metodo,
      termo_formalizado_em: new Date().toISOString(),
      termo_formalizado_por: auth.user?.id ?? null,
      termo_meta_contato_id: metodo === 'whatsapp' ? conversaSelecionada?.contatoId ?? null : null,
      termo_meta_instancia_id: metodo === 'whatsapp' ? conversaSelecionada?.instanciaId ?? null : null,
    }).eq('id', acordo.id);
    if (error) throw error;
  };

  const baixar = async () => {
    setWorking('download');
    try {
      await gerarTermoAcordoPdf({ acordo, pagamentos, salvar: true });
      await concluir('download');
      toast({ title: 'Termo emitido', description: 'O download foi iniciado e o acordo foi formalizado.' });
      onComplete();
    } catch (error) {
      toast({ title: 'Não foi possível emitir o termo', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' });
    } finally { setWorking(null); }
  };

  const enviar = async () => {
    if (!conversaSelecionada) return;
    setWorking('whatsapp');
    try {
      const { doc, nomeArquivo } = await gerarTermoAcordoPdf({ acordo, pagamentos, salvar: false });
      const blob = doc.output('blob');
      const destino = (conversaSelecionada.telefone || conversaSelecionada.bsuid || 'contato').replace(/\D/g, '');
      const path = `${conversaSelecionada.instanciaId}/${destino}/${Date.now()}-${nomeArquivo}`;
      const mediaUrl = await uploadInboxMedia(path, blob, 'application/pdf');
      const { data, error } = await supabase.functions.invoke('send-whatsapp-meta-media', { body: {
        instancia_id: conversaSelecionada.instanciaId,
        telefone: conversaSelecionada.telefone || undefined,
        bsuid: conversaSelecionada.bsuid || undefined,
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
        {procurandoConversa && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Procurando a conversa deste cliente...
          </div>
        )}
        {!procurandoConversa && conversas.length > 1 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Conversa para envio</label>
            <Select value={conversaSelecionadaId} onValueChange={setConversaSelecionadaId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha a conversa do cliente" />
              </SelectTrigger>
              <SelectContent>
                {conversas.map((conversa) => (
                  <SelectItem key={conversa.contatoId} value={conversa.contatoId}>
                    {conversa.instanciaNome || 'WhatsApp Oficial'}{conversa.contatoNome ? ` — ${conversa.contatoNome}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {!procurandoConversa && erroBuscaConversa && (
          <Alert variant="destructive">
            <MessageCircle className="h-4 w-4" />
            <AlertDescription>{erroBuscaConversa}</AlertDescription>
          </Alert>
        )}
        {!procurandoConversa && !erroBuscaConversa && conversas.length === 0 && (
          <Alert>
            <MessageCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhuma conversa acessível foi encontrada para este telefone. Faça o download do termo para concluir.
            </AlertDescription>
          </Alert>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {conversas.length > 0 && (
            <Button onClick={enviar} disabled={working !== null || !conversaSelecionada} className="h-auto min-h-20 flex-col gap-2">
              {working === 'whatsapp' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              Enviar no WhatsApp Oficial
            </Button>
          )}
          <Button onClick={baixar} disabled={working !== null} variant={conversas.length > 0 ? 'outline' : 'default'} className="h-auto min-h-20 flex-col gap-2">
            {working === 'download' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            Baixar termo em PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}