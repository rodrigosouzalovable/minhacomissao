import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import TemplateWhatsAppPreview from '@/components/meta/TemplateWhatsAppPreview';

interface Template {
  id: string;
  nome_template: string;
  idioma: string;
  categoria: string;
  body_text: string | null;
  variaveis: any;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  instancia_id: string;
  telefone: string;
  contato_nome?: string;
  atendente_nome?: string;
  onSent?: () => void;
}

export function ReabrirComTemplateDialog({
  open, onOpenChange, instancia_id, telefone, contato_nome, atendente_nome, onSent,
}: Props) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [nomeVar, setNomeVar] = useState('');

  useEffect(() => {
    if (open) setNomeVar((contato_nome || '').trim().split(/\s+/)[0] || '');
  }, [open, contato_nome]);

  useEffect(() => {
    if (!open || !instancia_id) return;
    let active = true;
    (async () => {
      setCarregando(true);
      setErro('');
      setTemplates([]);
      setTemplateName('');
      const { data, error } = await supabase.from('meta_whatsapp_templates')
        .select('id, nome_template, idioma, categoria, body_text, variaveis')
        .eq('status', 'approved')
        .eq('categoria', 'UTILITY')
        .eq('instancia_id', instancia_id)
        .order('nome_template');
      if (!active) return;
      if (error) setErro(error.message);
      else setTemplates((data as Template[]) ?? []);
      setCarregando(false);
    })();
    return () => { active = false; };
  }, [open, instancia_id]);

  const selectedTemplate = useMemo(
    () => templates.find(t => t.nome_template === templateName),
    [templates, templateName],
  );

  const enviar = async () => {
    if (!selectedTemplate) return;
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-meta', {
        body: {
          template_id: selectedTemplate.id,
          instancia_id,
          cliente: { telefone: telefone.replace(/\D/g, ''), nome: nomeVar.trim() || contato_nome || undefined },
          atendente_nome: atendente_nome?.trim() || undefined,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success && (data?.instance_restricted || data?.pool_blocked || data?.pool_paused)) {
        toast({
          title: 'Instância indisponível',
          description: (data?.error || 'A instância está restringida pela Meta.'),
          variant: 'destructive',
          duration: 10000,
        });
        return;
      }
      if (!data?.success) throw new Error(data?.error || 'Falha ao enviar template');
      toast({ title: 'Template UTILITY enviado', description: 'A janela de 24h só reabre quando o cliente responder.' });
      onSent?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setEnviando(false);
    }
  };

  const placeholder = carregando
    ? 'Carregando templates...'
    : erro
      ? 'Erro ao carregar templates'
      : templates.length === 0
        ? 'Nenhum template UTILITY aprovado'
        : 'Selecione um template UTILITY';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Reabrir com template UTILITY
          </DialogTitle>
          <DialogDescription>
            A janela de 24h está fechada. Envie um template <strong>UTILITY aprovado</strong> — apenas UTILITY é permitido aqui para evitar cobrança de MARKETING.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome do cliente (para variável)</Label>
            <Input value={nomeVar} onChange={e => setNomeVar(e.target.value)} placeholder="Primeiro nome" />
          </div>

          <div>
            <Label className="text-xs">Template</Label>
            <Select value={templateName} onValueChange={setTemplateName} disabled={carregando || templates.length === 0}>
              <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.nome_template}>
                    {t.nome_template} · <span className="text-xs text-muted-foreground">{t.idioma}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {carregando && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando templates aprovados...
            </div>
          )}
          {erro && <p className="text-xs text-destructive">Erro: {erro}</p>}
          {!carregando && !erro && templates.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum template UTILITY aprovado nesta instância. Cadastre em <strong>Meta Templates</strong>.
            </p>
          )}

          {selectedTemplate && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Pré-visualização</p>
              <TemplateWhatsAppPreview template={selectedTemplate} sampleName={nomeVar} />
            </div>
          )}

          <div className="text-[11px] bg-amber-500/10 border border-amber-500/30 rounded p-2 text-amber-700 dark:text-amber-400 flex gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Enviar template UTILITY cobra ~US$ 0,008 e <strong>não reabre</strong> a janela de 24h — ela só reabre quando o cliente responder.
            </span>
          </div>

          <Button onClick={enviar} disabled={!selectedTemplate || enviando} className="w-full">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Enviar template UTILITY
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
