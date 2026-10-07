import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import TemplateWhatsAppPreview from '@/components/meta/TemplateWhatsAppPreview';
import { TemplateFavoriteSelect } from '@/components/meta/TemplateFavoriteSelect';
import { carregarTodosMetaTemplates } from '@/lib/carregarTodosMetaTemplates';
import { useMetaTemplateForm } from '@/hooks/useMetaTemplateForm';
import { MetaTemplateVariableFields } from './MetaTemplateVariableFields';

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
  folder_id?: string | null;
  onSent?: () => void;
}

export function ReabrirComTemplateDialog({
  open, onOpenChange, instancia_id, telefone, contato_nome, atendente_nome, folder_id, onSent,
}: Props) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open || !instancia_id) return;
    let active = true;
    (async () => {
      setCarregando(true);
      setErro('');
      setTemplates([]);
      setTemplateId('');
      try {
        const data = await carregarTodosMetaTemplates<Template>(
          'id, nome_template, idioma, categoria, body_text, variaveis',
          { status: 'approved', categoria: 'UTILITY', instanciaId: instancia_id },
        );
        if (!active) return;
        setTemplates(data);
      } catch (error) {
        if (!active) return;
        setErro(error instanceof Error ? error.message : 'Falha ao carregar templates');
      }
      if (!active) return;
      setCarregando(false);
    })();
    return () => { active = false; };
  }, [open, instancia_id]);

  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === templateId),
    [templates, templateId],
  );

  const form = useMetaTemplateForm(selectedTemplate, open, contato_nome);

  const enviar = async () => {
    if (!selectedTemplate || !form.filled || enviando) return;
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-meta', {
        body: {
          template_id: selectedTemplate.id,
          instancia_id,
          cliente: {
            telefone: telefone.replace(/\D/g, ''), nome: contato_nome || undefined,
            vars: form.bodyValues, header_vars: form.headerValues,
            ...(form.buttons.length ? { button_url: form.buttonUrl.trim() } : {}),
          },
          atendente_nome: atendente_nome?.trim() || undefined,
          folder_id: folder_id ?? null,
          manual_inbox: true,
          // Resposta manual a um cliente: qualidade YELLOW/RED não bloqueia.
          ignorar_pausa_qualidade: true,
        },
      });
       if (error) {
         const response = 'context' in error ? (error as { context?: Response }).context : undefined;
         const details = response ? await response.clone().json().catch(() => null) : null;
         throw new Error(details?.error || error.message);
       }
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
            <Label className="text-xs">Template</Label>
            <TemplateFavoriteSelect
              tipo="meta"
              value={templateId}
              onValueChange={setTemplateId}
              disabled={carregando || templates.length === 0 || enviando}
              placeholder={placeholder}
              options={templates.map(template => ({
                value: template.id,
                nome: template.nome_template,
                idioma: template.idioma,
                descricao: template.body_text?.trim() || 'Texto do template indisponível',
              }))}
            />
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

          {selectedTemplate && <MetaTemplateVariableFields form={form} disabled={enviando} />}

          {selectedTemplate && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Pré-visualização</p>
              <TemplateWhatsAppPreview template={selectedTemplate} sampleVariables={form.bodyValues} headerSampleVariables={form.headerValues} preserveEmptyPlaceholders />
            </div>
          )}

          <div className="text-[11px] bg-amber-500/10 border border-amber-500/30 rounded p-2 text-amber-700 dark:text-amber-400 flex gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Enviar template UTILITY cobra ~US$ 0,008 e <strong>não reabre</strong> a janela de 24h — ela só reabre quando o cliente responder.
            </span>
          </div>

          <Button onClick={enviar} disabled={!selectedTemplate || enviando || !form.filled} className="w-full">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Enviar template UTILITY
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
