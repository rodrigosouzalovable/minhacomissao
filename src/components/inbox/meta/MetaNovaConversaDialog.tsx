import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2 } from 'lucide-react';

interface MetaInst { id: string; nome: string | null; display_phone: string | null; }
interface Template { id: string; nome_template: string; idioma: string; categoria: string; }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  instancias: MetaInst[];
  defaultInstancia?: string;
  onSent: (instancia_id: string, telefone: string) => void;
}

export function MetaNovaConversaDialog({ open, onOpenChange, instancias, defaultInstancia, onSent }: Props) {
  const { toast } = useToast();
  const [instId, setInstId] = useState<string>(defaultInstancia || '');
  const [tel, setTel] = useState('');
  const [nome, setNome] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { if (defaultInstancia) setInstId(defaultInstancia); }, [defaultInstancia]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('meta_whatsapp_templates')
        .select('id, nome_template, idioma, categoria')
        .eq('status', 'approved')
        .eq('categoria', 'UTILITY')
        .order('nome_template');
      setTemplates((data as Template[]) ?? []);
    })();
  }, [open]);

  const enviar = async () => {
    if (!instId || !tel.trim() || !templateName) return;
    setEnviando(true);
    try {
      const tpl = templates.find(t => t.nome_template === templateName);
      const { data, error } = await supabase.functions.invoke('send-whatsapp-meta', {
        body: {
          instancia_id: instId,
          recipient: { telefone: tel.replace(/\D/g, ''), nome: nome.trim() || null },
          template_name: templateName,
          template_language: tpl?.idioma || 'pt_BR',
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Falha ao enviar');
      toast({ title: 'Template enviado', description: 'Aguardando resposta para abrir a janela de 24h.' });
      const telFormat = tel.replace(/\D/g, '').startsWith('55') ? tel.replace(/\D/g, '') : '55' + tel.replace(/\D/g, '');
      onSent(instId, telFormat);
      onOpenChange(false);
      setTel(''); setNome(''); setTemplateName('');
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally { setEnviando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa Meta</DialogTitle>
          <DialogDescription>
            Para iniciar uma nova conversa é necessário enviar um template de utilidade aprovado. Após o cliente responder, abre a janela de 24h para texto livre.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={instId} onValueChange={setInstId}>
            <SelectTrigger><SelectValue placeholder="Número Meta" /></SelectTrigger>
            <SelectContent>
              {instancias.map(i => (
                <SelectItem key={i.id} value={i.id}>{i.nome || i.display_phone || i.id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Telefone (DDI+DDD+número)" value={tel} onChange={e => setTel(e.target.value)} />
          <Input placeholder="Nome (opcional, para {{name}})" value={nome} onChange={e => setNome(e.target.value)} />
          <Select value={templateName} onValueChange={setTemplateName}>
            <SelectTrigger><SelectValue placeholder="Template de utilidade" /></SelectTrigger>
            <SelectContent>
              {templates.map(t => (
                <SelectItem key={t.id} value={t.nome_template}>
                  {t.nome_template} · <span className="text-xs text-muted-foreground">{t.categoria}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={enviar} disabled={!instId || !tel.trim() || !templateName || enviando} className="w-full">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Enviar template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
