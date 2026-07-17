import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, Save, Send, Loader2, PlayCircle, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const TEMPLATE_NOME = 'lembrete_envio_boleto';

interface Instancia {
  id: string;
  nome: string;
  saude_quality: string | null;
  estado_pool: string | null;
  ativo: boolean;
}
interface Template {
  id: string;
  nome_template: string;
  idioma: string;
  categoria: string | null;
  status: string;
  body_text: string | null;
  instancia_id: string;
}

export default function LembreteMeta() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const [ativo, setAtivo] = useState(false);
  const [instanciaIds, setInstanciaIds] = useState<string[]>([]);
  const [minSeg, setMinSeg] = useState(30);
  const [maxSeg, setMaxSeg] = useState(60);
  const [horaInicio, setHoraInicio] = useState('08:30');
  const [telefones, setTelefones] = useState('62991672674');

  const { data: config } = useQuery({
    queryKey: ['meta-lembrete-config'],
    queryFn: async () => {
      const { data } = await supabase.from('meta_lembrete_config')
        .select('*').order('atualizado_em', { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  // Templates aprovados com o nome fixo — usado pra saber quais instâncias têm o template aprovado
  const { data: templatesAprovados } = useQuery<Template[]>({
    queryKey: ['meta-lembrete-templates-aprovados', TEMPLATE_NOME],
    queryFn: async () => {
      const { data } = await supabase.from('meta_whatsapp_templates')
        .select('id, nome_template, idioma, categoria, status, body_text, instancia_id')
        .eq('nome_template', TEMPLATE_NOME)
        .eq('status', 'approved');
      return (data || []) as Template[];
    },
  });

  const instanciaIdsAprovadas = useMemo(
    () => new Set((templatesAprovados || []).map(t => t.instancia_id)),
    [templatesAprovados]
  );

  const templatePreview = templatesAprovados?.[0] || null;

  const { data: instancias } = useQuery<Instancia[]>({
    queryKey: ['meta-lembrete-instancias', Array.from(instanciaIdsAprovadas).sort().join(',')],
    queryFn: async () => {
      if (instanciaIdsAprovadas.size === 0) return [];
      const { data } = await supabase.from('meta_whatsapp_instances')
        .select('id, nome, saude_quality, estado_pool, ativo')
        .in('id', Array.from(instanciaIdsAprovadas))
        .eq('ativo', true)
        .order('nome');
      return (data || []) as Instancia[];
    },
    enabled: !!templatesAprovados,
  });

  const { data: logs } = useQuery({
    queryKey: ['meta-lembrete-logs'],
    queryFn: async () => {
      const { data } = await supabase.from('meta_lembrete_log')
        .select('*').order('criado_em', { ascending: false }).limit(50);
      return data || [];
    },
    refetchInterval: running ? 5000 : false,
  });

  useEffect(() => {
    if (!config) return;
    setAtivo(!!config.ativo);
    setInstanciaIds(config.instancia_ids || []);
    setMinSeg(config.min_seg ?? 30);
    setMaxSeg(config.max_seg ?? 60);
    setHoraInicio(config.hora_inicio || '08:30');
    setTelefones((config.notificar_telefones || ['62991672674']).join(', '));
  }, [config]);

  async function salvar() {
    if (instanciaIds.length === 0) { toast.error('Selecione ao menos 1 instância'); return; }
    setSaving(true);
    try {
      const payload: any = {
        ativo,
        instancia_ids: instanciaIds,
        // Campos legados mantidos para compat; a função resolve o template pelo nome fixo.
        template_id_d3: null,
        template_id_d0: null,
        variaveis_map_d3: { '1': 'nome_cliente', '2': 'data_vencimento' },
        variaveis_map_d0: { '1': 'nome_cliente', '2': 'data_vencimento' },
        min_seg: Math.max(1, Number(minSeg) || 30),
        max_seg: Math.max(Math.max(1, Number(minSeg) || 30), Number(maxSeg) || 60),
        hora_inicio: horaInicio,
        notificar_telefones: telefones.split(',').map(s => s.trim()).filter(Boolean),
      };
      if (config?.id) {
        const { error } = await supabase.from('meta_lembrete_config').update(payload).eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('meta_lembrete_config').insert(payload);
        if (error) throw error;
      }
      toast.success('Configuração salva');
      qc.invalidateQueries({ queryKey: ['meta-lembrete-config'] });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  async function executarAgora(dryRun: boolean) {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-lembrete-tick', {
        body: { force: true, dryRun },
      });
      if (error) throw error;
      if (data?.ok === false) toast.error(data?.error || 'Falha');
      else toast.success(`Enviados: ${data?.enviados ?? 0} | Falhas: ${data?.falhas ?? 0} | Pulados: ${data?.pulados ?? 0}`);
      qc.invalidateQueries({ queryKey: ['meta-lembrete-logs'] });
    } catch (e: any) {
      toast.error(e.message || 'Erro');
    } finally { setRunning(false); }
  }

  function toggleInstancia(id: string) {
    setInstanciaIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Bell className="h-6 w-6"/> Lembrete Meta</h1>
            <p className="text-sm text-muted-foreground">Envio automático diário (08:30 BRT) de lembretes D-3 e D0 via API oficial.</p>
          </div>
          <div className="flex items-center gap-3 rounded-md border px-4 py-2 bg-card">
            <Label className="cursor-pointer" htmlFor="ativo-toggle">Envio automático</Label>
            <Switch id="ativo-toggle" checked={ativo} onCheckedChange={setAtivo}/>
            <Badge variant={ativo ? 'default' : 'secondary'}>{ativo ? 'ATIVO' : 'INATIVO'}</Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Template padrão
              <Badge variant="outline" className="font-mono text-xs">{TEMPLATE_NOME}</Badge>
              <Badge className="text-[10px]">Envia em D-3 e D0</Badge>
            </CardTitle>
            <CardDescription>
              Único template usado nos lembretes. Variáveis preenchidas automaticamente: <strong>{'{{1}}'}</strong> = nome do cliente, <strong>{'{{2}}'}</strong> = data de vencimento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {templatePreview ? (
              <div className="rounded bg-muted p-3 text-sm whitespace-pre-wrap">{templatePreview.body_text}</div>
            ) : (
              <div className="flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5"/>
                <span>Nenhuma instância com o template <code className="font-mono">{TEMPLATE_NOME}</code> aprovado ainda. Aprove o template na Meta para habilitar os envios.</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instâncias Meta elegíveis</CardTitle>
            <CardDescription>
              Só aparecem instâncias com o template <code className="font-mono">{TEMPLATE_NOME}</code> aprovado. Round-robin entre as marcadas; RED/YELLOW são puladas automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(instancias || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma instância elegível no momento.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {(instancias || []).map(i => {
                  const q = String(i.saude_quality || '').toUpperCase();
                  const bad = q === 'RED' || q === 'YELLOW';
                  return (
                    <label key={i.id} className={`flex items-center gap-2 rounded border p-2 cursor-pointer ${instanciaIds.includes(i.id) ? 'bg-primary/5 border-primary' : ''}`}>
                      <Checkbox checked={instanciaIds.includes(i.id)} onCheckedChange={() => toggleInstancia(i.id)}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{i.nome}</p>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant={bad ? 'destructive' : 'outline'} className="text-[10px]">{q || 'UNKNOWN'}</Badge>
                          <Badge variant="outline" className="text-[10px]">{i.estado_pool || '-'}</Badge>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Configurações de envio</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div><Label>Delay mínimo (s)</Label><Input type="number" min={1} value={minSeg} onChange={(e) => setMinSeg(Number(e.target.value))}/></div>
            <div><Label>Delay máximo (s)</Label><Input type="number" min={1} value={maxSeg} onChange={(e) => setMaxSeg(Number(e.target.value))}/></div>
            <div><Label>Horário início (BRT)</Label><Input value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} placeholder="08:30"/></div>
            <div className="md:col-span-4"><Label>Telefones para notificações (separados por vírgula)</Label><Input value={telefones} onChange={(e) => setTelefones(e.target.value)}/></div>
          </CardContent>
        </Card>

        <div className="flex gap-2 flex-wrap">
          <Button onClick={salvar} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>} Salvar configuração
          </Button>
          <Button variant="outline" onClick={() => executarAgora(true)} disabled={running}>
            <PlayCircle className="h-4 w-4"/> Simular (dry-run)
          </Button>
          <Button variant="secondary" onClick={() => executarAgora(false)} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>} Enviar agora
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Últimos envios</CardTitle>
            <CardDescription>{logs?.length || 0} registros</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Instância</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logs || []).map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{new Date(l.criado_em).toLocaleString('pt-BR')}</TableCell>
                    <TableCell><Badge variant="outline">{l.tipo}</Badge></TableCell>
                    <TableCell className="text-xs">{l.instancia_nome || '-'}</TableCell>
                    <TableCell className="text-xs">{l.telefone}</TableCell>
                    <TableCell>{l.sucesso
                      ? <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1"/>OK</Badge>
                      : <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1"/>Falha</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-red-600 max-w-[300px] truncate">{l.erro}</TableCell>
                  </TableRow>
                ))}
                {(logs || []).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-6">Nenhum envio ainda</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
