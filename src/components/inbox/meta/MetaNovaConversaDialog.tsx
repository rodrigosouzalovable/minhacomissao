import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2 } from 'lucide-react';
import TemplateWhatsAppPreview from '@/components/meta/TemplateWhatsAppPreview';
import { TemplateFavoriteSelect } from '@/components/meta/TemplateFavoriteSelect';
import { carregarTodosMetaTemplates } from '@/lib/carregarTodosMetaTemplates';
import { useMetaTemplateForm } from '@/hooks/useMetaTemplateForm';
import { MetaTemplateVariableFields } from './MetaTemplateVariableFields';

interface MetaInst { id: string; nome: string | null; display_phone: string | null; }
interface Template { id: string; instancia_id: string; nome_template: string; idioma: string; categoria: string; body_text: string | null; variaveis: any; }
interface TemplateGroup { key: string; nome: string; idioma: string; sample: Template; rows: Template[]; }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  instancias: MetaInst[];
  defaultInstancia?: string;
  atendenteNome?: string;
  onSent: (instancia_id: string, telefone: string) => void;
  /** Caixa de mensagens ativa — a nova conversa nasce nela (null = Padrão) */
  folderId?: string | null;
  enforceInboxAccess?: boolean;
  initialTelefone?: string;
  initialNome?: string;
}

export function MetaNovaConversaDialog({ open, onOpenChange, instancias, defaultInstancia, atendenteNome, onSent, folderId, enforceInboxAccess = false, initialTelefone = '', initialNome = '' }: Props) {

  const { toast } = useToast();
  const [instId, setInstId] = useState<string>(defaultInstancia || '');
  const [tel, setTel] = useState('');
  const [nome, setNome] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateKey, setTemplateKey] = useState('');
  const [carregandoTemplates, setCarregandoTemplates] = useState(false);
  const [erroTemplates, setErroTemplates] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setInstId('');
    setTel(initialTelefone.replace(/\D/g, ''));
    setNome(initialNome);
    setTemplateKey('');
    if (instancias.length === 0) { setTemplates([]); setErroTemplates(''); return; }
    let active = true;
    (async () => {
      setCarregandoTemplates(true);
      setErroTemplates('');
      setTemplates([]);
      try {
        const data = await carregarTodosMetaTemplates<Template>(
          'id, instancia_id, nome_template, idioma, categoria, body_text, variaveis',
          {
            status: 'approved',
            categoria: 'UTILITY',
            instanciaIds: instancias.map(i => i.id),
          },
        );
        if (!active) return;
        setTemplates(data);
      } catch (error) {
        if (!active) return;
        setErroTemplates(error instanceof Error ? error.message : 'Falha ao carregar templates');
        setTemplates([]);
      }
      if (!active) return;
      setCarregandoTemplates(false);
    })();
    return () => { active = false; };
  }, [open, instancias, initialTelefone, initialNome]);

  const templateGroups = useMemo<TemplateGroup[]>(() => {
    const groups = new Map<string, TemplateGroup>();
    for (const template of templates) {
      const key = `${template.nome_template}::${template.idioma}`;
      const current = groups.get(key);
      if (current) current.rows.push(template);
      else groups.set(key, { key, nome: template.nome_template, idioma: template.idioma, sample: template, rows: [template] });
    }
    return Array.from(groups.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [templates]);

  const selectedGroup = useMemo(() => templateGroups.find(group => group.key === templateKey) ?? null, [templateGroups, templateKey]);
  const selectedTemplate = selectedGroup?.sample ?? null;
  const compatibleInstances = useMemo(() => {
    if (!selectedGroup) return [];
    const approvedIds = new Set(selectedGroup.rows.map(row => row.instancia_id));
    return instancias.filter(instance => approvedIds.has(instance.id));
  }, [selectedGroup, instancias]);

  useEffect(() => {
    if (!selectedGroup) { setInstId(''); return; }
    const defaultCompatible = defaultInstancia && selectedGroup.rows.some(row => row.instancia_id === defaultInstancia);
    setInstId(defaultCompatible ? defaultInstancia : '');
  }, [selectedGroup, defaultInstancia]);

  const form = useMetaTemplateForm(selectedTemplate, open, nome);

  const enviar = async () => {
    if (!instId || !tel.trim() || !selectedGroup || !form.filled || enviando) return;
    setEnviando(true);
    try {
      const tpl = selectedGroup.rows.find(row => row.instancia_id === instId);
      if (!tpl) throw new Error('Template não encontrado');
      const vars = Object.fromEntries(Object.entries(form.bodyValues).map(([key, value]) => [key, value.trim()]));
      const headerVars = Object.fromEntries(Object.entries(form.headerValues).map(([key, value]) => [key, value.trim()]));
      const { data, error } = await supabase.functions.invoke('send-whatsapp-meta', {
        body: {
          template_id: tpl.id,
          instancia_id: instId,
          cliente: {
            telefone: tel.replace(/\D/g, ''),
            nome: nome.trim() || undefined,
            ...(Object.keys(vars).length ? { vars } : {}),
            ...(Object.keys(headerVars).length ? { header_vars: headerVars } : {}),
            ...(form.buttons.length ? { button_url: form.buttonUrl.trim() } : {}),
          },
          atendente_nome: atendenteNome?.trim() || undefined,
          folder_id: folderId ?? null,
          manual_inbox: enforceInboxAccess,
        },
      });

       if (error) {
         const response = 'context' in error ? (error as { context?: Response }).context : undefined;
         const details = response ? await response.clone().json().catch(() => null) : null;
         throw new Error(details?.error || error.message);
       }

      // Instância bloqueada/pausada/restrita (síncrono)
      if (!data?.success && (data?.instance_restricted || data?.pool_blocked || data?.pool_paused)) {
        toast({
          title: 'Instância indisponível',
          description:
            (data?.error || 'A instância selecionada está restringida/banida pela Meta.') +
            ' Escolha outra instância ou avise o administrador.',
          variant: 'destructive',
          duration: 10000,
        });
        return;
      }

      if (!data?.success) throw new Error(data?.error || 'Falha ao enviar');

      toast({ title: 'Template enviado', description: 'Aguardando resposta para abrir a janela de 24h.' });
      const telFormat = tel.replace(/\D/g, '').startsWith('55') ? tel.replace(/\D/g, '') : '55' + tel.replace(/\D/g, '');
      const waId: string | undefined = data?.waId;
      onSent(instId, telFormat);
      onOpenChange(false);
      setTel(''); setNome(''); setTemplateKey(''); setInstId('');

      // Polling assíncrono: se o webhook da Meta reportar falha (ex. Business Account locked),
      // avisa o funcionário com toast destrutivo.
      if (waId) {
        (async () => {
          for (let i = 0; i < 4; i++) {
            await new Promise(r => setTimeout(r, 4000));
            const { data: msg } = await supabase
              .from('meta_whatsapp_mensagens')
              .select('status_envio, erro')
              .eq('wa_message_id', waId)
              .maybeSingle();
            if (msg?.status_envio === 'erro') {
              toast({
                title: 'Falha na entrega',
                description:
                  `A Meta rejeitou o envio: ${msg.erro || 'erro desconhecido'}.` +
                  ' A instância pode estar restringida/banida — verifique com o administrador.',
                variant: 'destructive',
                duration: 12000,
              });
              return;
            }
            if (msg && msg.status_envio !== 'enviada') return; // entregue/lida => sucesso
          }
        })();
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally { setEnviando(false); }
  };


  const templatePlaceholder = carregandoTemplates
      ? 'Carregando templates...'
      : erroTemplates
        ? 'Erro ao carregar templates'
        : templates.length === 0
          ? 'Nenhum template de utilidade aprovado'
          : 'Selecione um template';

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
          <div className="space-y-1.5">
            <Label>Template</Label>
            <TemplateFavoriteSelect
              tipo="meta"
              value={templateKey}
              onValueChange={setTemplateKey}
              disabled={carregandoTemplates || templateGroups.length === 0 || enviando}
              placeholder={templatePlaceholder}
              options={templateGroups.map(group => ({
                value: group.key,
                nome: group.nome,
                idioma: group.idioma,
                descricao: group.sample.body_text?.trim() || 'Texto do template indisponível',
                meta: <Badge variant="outline" className="text-[10px]">{group.rows.length} inst.</Badge>,
              }))}
            />
          </div>
          {carregandoTemplates && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Buscando templates aprovados...
            </div>
          )}
          {erroTemplates && (
            <p className="text-xs text-destructive">Não foi possível carregar os templates: {erroTemplates}</p>
          )}
          <div className="space-y-1.5">
            <Label>Número Meta</Label>
            <Select value={instId} onValueChange={setInstId} disabled={!selectedGroup || compatibleInstances.length === 0 || enviando}>
              <SelectTrigger><SelectValue placeholder={selectedGroup ? 'Selecione uma instância aprovada' : 'Escolha primeiro o template'} /></SelectTrigger>
              <SelectContent>
                {compatibleInstances.map(instance => (
                  <SelectItem key={instance.id} value={instance.id}>{instance.nome || instance.display_phone || instance.id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedGroup && compatibleInstances.length === 0 && <p className="text-xs text-destructive">Nenhuma instância disponível possui este template aprovado.</p>}
          </div>
          <Input placeholder="Telefone (DDI+DDD+número)" value={tel} onChange={e => setTel(e.target.value)} />
          <Input placeholder="Nome do contato (opcional)" value={nome} onChange={e => setNome(e.target.value)} />
          {selectedTemplate && <MetaTemplateVariableFields form={form} disabled={enviando} />}
          {selectedTemplate && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Pré-visualização</p>
              <TemplateWhatsAppPreview
                template={selectedTemplate}
                sampleName={nome}
                sampleVariables={form.bodyValues}
                headerSampleVariables={form.headerValues}
                preserveEmptyPlaceholders
              />
            </div>
          )}
          <Button onClick={enviar} disabled={!instId || !tel.trim() || !selectedGroup || enviando || !form.filled} className="w-full">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Enviar template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
