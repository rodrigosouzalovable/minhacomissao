import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle, Save, Loader2, Plus, Trash2, RotateCcw } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TemplateRow {
  id?: string;
  tipo_lembrete: string;
  mensagem: string;
  ativo: boolean;
  ordem: number;
}

const TIPOS_LEMBRETE = [
  { key: '3_dias', label: 'D-3 (3 dias antes)', desc: 'Enviada 3 dias antes do vencimento' },
  { key: 'dia_vencimento', label: 'D-0 (Dia do vencimento)', desc: 'Enviada no dia do vencimento' },
  { key: 'vencido_d1', label: 'D+1 (1 dia após)', desc: 'Enviada 1 dia após o vencimento' },
  { key: 'vencido_d2', label: 'D+2 (2 dias após)', desc: 'Enviada 2 dias após o vencimento' },
  { key: 'vencido_d10', label: 'D+10 (10 dias após)', desc: 'Enviada 10 dias após o vencimento' },
  { key: 'vencido_d11', label: 'D+11 (11 dias após)', desc: 'Enviada 11 dias após o vencimento' },
  { key: 'vencido_d20', label: 'D+20 (20 dias após)', desc: 'Enviada 20 dias após o vencimento' },
  { key: 'vencido_d30', label: 'D+30 (30 dias após)', desc: 'Enviada 30 dias após o vencimento' },
];

const DEFAULT_MESSAGES: Record<string, string> = {
  '3_dias': 'Olá {nome_cliente}, aqui é {nome_operador}, do departamento de acordos das Lojas Novo Mundo e estou passando para lembrar que o vencimento da sua parcela no valor de {valor} é dia {data_vencimento}. Gostaria que enviasse o boleto para pagamento?',
  'dia_vencimento': 'Olá {nome_cliente}, aqui é {nome_operador}, do departamento de acordos das Lojas Novo Mundo e estou passando para lembrar que o vencimento da sua parcela no valor de {valor} vence HOJE. Gostaria que enviasse o boleto para pagamento?',
  'vencido_d1': 'Olá {nome_cliente}, aqui é {nome_operador}, do departamento de acordos das Lojas Novo Mundo. Sua parcela no valor de {valor} venceu ontem ({data_vencimento}). Caso tenha efetuado o pagamento, nos envie o comprovante por gentileza.',
  'vencido_d2': 'Olá {nome_cliente}, aqui é {nome_operador}, do departamento de acordos das Lojas Novo Mundo. Notamos que a parcela no valor de {valor} com vencimento em {data_vencimento} ainda consta em aberto. Caso tenha efetuado o pagamento, nos envie o comprovante por gentileza. Caso contrário, consegue regularizar hoje?',
  'vencido_d10': 'Olá {nome_cliente}, aqui é {nome_operador}, do departamento de acordos das Lojas Novo Mundo. Identificamos que sua parcela no valor de {valor}, vencida em {data_vencimento}, continua em aberto há 10 dias. É muito importante manter o acordo em dia. Caso tenha efetuado o pagamento, nos envie o comprovante por gentileza.',
  'vencido_d11': 'Olá {nome_cliente}, aqui é {nome_operador}, do departamento de acordos das Lojas Novo Mundo. Reforçamos que sua parcela de {valor} (vencimento {data_vencimento}) segue pendente há 11 dias. Por favor, regularize o quanto antes para evitar problemas com seu acordo. Caso tenha efetuado o pagamento, nos envie o comprovante por gentileza.',
  'vencido_d20': 'Olá {nome_cliente}, aqui é {nome_operador}, do departamento de acordos das Lojas Novo Mundo. Sua parcela de {valor} está em atraso há 20 dias (vencimento {data_vencimento}). Pedimos que regularize a situação o mais breve possível para evitar o descumprimento do acordo. Caso tenha efetuado o pagamento, nos envie o comprovante por gentileza.',
  'vencido_d30': 'Olá {nome_cliente}, aqui é {nome_operador}, do departamento de acordos das Lojas Novo Mundo. Este é o último aviso referente à parcela de {valor} vencida em {data_vencimento}, em atraso há 30 dias. Caso o pagamento não seja regularizado, o acordo poderá ser considerado descumprido. Caso tenha efetuado o pagamento, nos envie o comprovante por gentileza.',
};

export default function LembreteMensagensDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTipo, setActiveTipo] = useState(TIPOS_LEMBRETE[0].key);

  useEffect(() => {
    if (open && user) loadTemplates();
  }, [open, user]);

  const loadTemplates = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lembrete_mensagens_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('ordem', { ascending: true });
      if (error) throw error;

      // Merge with defaults - if no template exists for a type, use default
      const loaded: TemplateRow[] = [];
      for (const tipo of TIPOS_LEMBRETE) {
        const existing = (data || []).filter((d: any) => d.tipo_lembrete === tipo.key);
        if (existing.length > 0) {
          loaded.push(...existing.map((e: any) => ({
            id: e.id,
            tipo_lembrete: e.tipo_lembrete,
            mensagem: e.mensagem,
            ativo: e.ativo ?? true,
            ordem: e.ordem ?? 0,
          })));
        } else {
          loaded.push({
            tipo_lembrete: tipo.key,
            mensagem: DEFAULT_MESSAGES[tipo.key] || '',
            ativo: true,
            ordem: 0,
          });
        }
      }
      setTemplates(loaded);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Delete all existing then re-insert
      await supabase
        .from('lembrete_mensagens_templates')
        .delete()
        .eq('user_id', user.id);

      const rows = templates.map((t, idx) => ({
        user_id: user.id,
        tipo_lembrete: t.tipo_lembrete,
        mensagem: t.mensagem,
        ativo: t.ativo,
        ordem: t.ordem,
      }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from('lembrete_mensagens_templates')
          .insert(rows);
        if (error) throw error;
      }

      toast.success('Templates salvos com sucesso!');
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const tipoTemplates = templates.filter(t => t.tipo_lembrete === activeTipo);
  const tipoInfo = TIPOS_LEMBRETE.find(t => t.key === activeTipo)!;

  const updateTemplate = (index: number, field: keyof TemplateRow, value: any) => {
    setTemplates(prev => {
      const globalIndex = prev.findIndex(
        (t, i) => t.tipo_lembrete === activeTipo && prev.filter((x, j) => x.tipo_lembrete === activeTipo && j <= i).length === index + 1
      );
      // Simpler: find all of activeTipo, get the nth one
      let count = 0;
      const newArr = [...prev];
      for (let i = 0; i < newArr.length; i++) {
        if (newArr[i].tipo_lembrete === activeTipo) {
          if (count === index) {
            newArr[i] = { ...newArr[i], [field]: value };
            break;
          }
          count++;
        }
      }
      return newArr;
    });
  };

  const addTemplate = () => {
    const maxOrdem = Math.max(0, ...tipoTemplates.map(t => t.ordem));
    setTemplates(prev => [...prev, {
      tipo_lembrete: activeTipo,
      mensagem: DEFAULT_MESSAGES[activeTipo] || '',
      ativo: true,
      ordem: maxOrdem + 1,
    }]);
  };

  const removeTemplate = (index: number) => {
    if (tipoTemplates.length <= 1) {
      toast.error('É necessário manter pelo menos uma mensagem por tipo');
      return;
    }
    setTemplates(prev => {
      let count = 0;
      return prev.filter((t, i) => {
        if (t.tipo_lembrete === activeTipo) {
          if (count === index) { count++; return false; }
          count++;
        }
        return true;
      });
    });
  };

  const resetToDefault = (index: number) => {
    updateTemplate(index, 'mensagem', DEFAULT_MESSAGES[activeTipo] || '');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Mensagens de Lembrete
          </DialogTitle>
        </DialogHeader>

        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 space-y-1">
          <p className="font-medium">Variáveis disponíveis:</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">{'{nome_cliente}'} — Nome completo</Badge>
            <Badge variant="outline" className="text-xs">{'{primeiro_nome}'} — Ex: Rodrigo</Badge>
            <Badge variant="outline" className="text-xs">{'{nome_operador}'}</Badge>
            <Badge variant="outline" className="text-xs">{'{valor}'}</Badge>
            <Badge variant="outline" className="text-xs">{'{data_vencimento}'}</Badge>
            <Badge variant="outline" className="text-xs">{'{dias_atraso}'}</Badge>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex gap-4 flex-1 min-h-0">
            {/* Sidebar - tipo list */}
            <div className="w-48 shrink-0">
              <ScrollArea className="h-[400px]">
                <div className="space-y-1 pr-2">
                  {TIPOS_LEMBRETE.map(tipo => (
                    <button
                      key={tipo.key}
                      onClick={() => setActiveTipo(tipo.key)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        activeTipo === tipo.key
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tipo.label}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <Separator orientation="vertical" />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <ScrollArea className="h-[400px]">
                <div className="space-y-4 pr-2">
                  <div>
                    <p className="text-sm font-medium">{tipoInfo.label}</p>
                    <p className="text-xs text-muted-foreground">{tipoInfo.desc}</p>
                  </div>

                  {tipoTemplates.map((tmpl, idx) => (
                    <div key={`${tmpl.tipo_lembrete}-${tmpl.ordem}-${idx}`} className="space-y-2 border rounded-md p-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          Mensagem {tipoTemplates.length > 1 ? `#${idx + 1}` : ''}
                        </Label>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <Switch
                              checked={tmpl.ativo}
                              onCheckedChange={(v) => updateTemplate(idx, 'ativo', v)}
                            />
                            <span className="text-xs text-muted-foreground">
                              {tmpl.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => resetToDefault(idx)}
                            title="Restaurar padrão"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                          {tipoTemplates.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeTemplate(idx)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <Textarea
                        value={tmpl.mensagem}
                        onChange={(e) => updateTemplate(idx, 'mensagem', e.target.value)}
                        rows={5}
                        className="text-sm"
                      />
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addTemplate}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar mensagem alternativa
                  </Button>
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
