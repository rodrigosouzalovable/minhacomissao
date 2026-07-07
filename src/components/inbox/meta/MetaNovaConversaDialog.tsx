import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2 } from 'lucide-react';
import TemplateWhatsAppPreview from '@/components/meta/TemplateWhatsAppPreview';

interface MetaInst { id: string; nome: string | null; display_phone: string | null; }
interface Template { id: string; nome_template: string; idioma: string; categoria: string; body_text: string | null; variaveis: any; }

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
  const [carregandoTemplates, setCarregandoTemplates] = useState(false);
  const [erroTemplates, setErroTemplates] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { if (defaultInstancia) setInstId(defaultInstancia); }, [defaultInstancia]);

  useEffect(() => {
    if (!open || !instId) { setTemplates([]); setTemplateName(''); setErroTemplates(''); return; }
    let active = true;
    (async () => {
      setCarregandoTemplates(true);
      setErroTemplates('');
      setTemplates([]);
      setTemplateName('');
      const { data, error } = await supabase.from('meta_whatsapp_templates')
        .select('id, nome_template, idioma, categoria, body_text, variaveis')
        .eq('status', 'approved')
        .eq('categoria', 'UTILITY')
        .eq('instancia_id', instId)
        .order('nome_template');
      if (!active) return;
      if (error) {
        setErroTemplates(error.message);
        setTemplates([]);
      } else {
        setTemplates((data as Template[]) ?? []);
      }
      setCarregandoTemplates(false);
    })();
    return () => { active = false; };
  }, [open, instId]);

  const selectedTemplate = useMemo(
    () => templates.find(t => t.nome_template === templateName),
    [templates, templateName]
  );

  const enviar = async () => {
    if (!instId || !tel.trim() || !templateName) return;
    setEnviando(true);
    try {
      const tpl = templates.find(t => t.nome_template === templateName);
      if (!tpl) throw new Error('Template não encontrado');
      const { data, error } = await supabase.functions.invoke('send-whatsapp-meta', {
        body: {
          template_id: tpl.id,
          instancia_id: instId,
          cliente: { telefone: tel.replace(/\D/g, ''), nome: nome.trim() || undefined },
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

  const templatePlaceholder = !instId
    ? 'Selecione uma instância'
    : carregandoTemplates
      ? 'Carregando templates...'
      : erroTemplates
        ? 'Erro ao carregar templates'
        : templates.length === 0
          ? 'Nenhum template para esta instância'
          : 'Template de utilidade';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
          <Select value={templateName} onValueChange={setTemplateName} disabled={!instId || carregandoTemplates || templates.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder={templatePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => (
                <SelectItem key={t.id} value={t.nome_template}>
                  {t.nome_template} · <span className="text-xs text-muted-foreground">{t.categoria}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {carregandoTemplates && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Buscando templates aprovados desta instância...
            </div>
          )}
          {erroTemplates && (
            <p className="text-xs text-destructive">Não foi possível carregar os templates: {erroTemplates}</p>
          )}
          {selectedTemplate && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Pré-visualização</p>
              <TemplateWhatsAppPreview template={selectedTemplate} />
            </div>
          )}
          <Button onClick={enviar} disabled={!instId || !tel.trim() || !templateName || enviando} className="w-full">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Enviar template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
