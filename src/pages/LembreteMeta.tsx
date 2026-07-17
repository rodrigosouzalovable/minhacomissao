import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, Save, Send, Loader2, PlayCircle, CheckCircle2, XCircle } from 'lucide-react';

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
  variaveis: any;
  instancia_id: string;
}

const FIELD_OPTIONS = [
  { value: 'nome_cliente', label: 'Nome do cliente' },
  { value: 'primeiro_nome', label: 'Primeiro nome' },
  { value: 'data_vencimento', label: 'Data de vencimento' },
  { value: 'numero_parcela', label: 'Número da parcela' },
  { value: 'valor_parcela', label: 'Valor da parcela' },
  { value: 'cpf', label: 'CPF' },
];

function extractPlaceholders(text: string | null): string[] {
  if (!text) return [];
  const positional = [...text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map(m => m[1]);
  const named = [...text.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)].map(m => m[1]);
  const all = [...new Set([...positional, ...named])];
  return all.sort((a, b) => {
    const an = Number(a), bn = Number(b);
    if (!isNaN(an) && !isNaN(bn)) return an - bn;
    return a.localeCompare(b);
  });
}

export default function LembreteMeta() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const [ativo, setAtivo] = useState(false);
  const [instanciaIds, setInstanciaIds] = useState<string[]>([]);
  const [templateD3, setTemplateD3] = useState<string>('');
  const [templateD0, setTemplateD0] = useState<string>('');
  const [varMapD3, setVarMapD3] = useState<Record<string, string>>({});
  const [varMapD0, setVarMapD0] = useState<Record<string, string>>({});
  const [minSeg, setMinSeg] = useState(30);
  const [maxSeg, setMaxSeg] = useState(60);
  const [horaInicio, setHoraInicio] = useState('08:30');
  const [telefones, setTelefones] = useState('62991672674, 62994300880');

  const { data: config } = useQuery({
    queryKey: ['meta-lembrete-config'],
    queryFn: async () => {
      const { data } = await supabase.from('meta_lembrete_config')
        .select('*').order('atualizado_em', { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const { data: instancias } = useQuery<Instancia[]>({
    queryKey: ['meta-lembrete-instancias'],
    queryFn: async () => {
      const { data } = await supabase.from('meta_whatsapp_instances')
        .select('id, nome, saude_quality, estado_pool, ativo')
        .eq('ativo', true).order('nome');
      return (data || []) as Instancia[];
    },
  });

  const { data: templates } = useQuery<Template[]>({
    queryKey: ['meta-lembrete-templates'],
    queryFn: async () => {
      const { data } = await supabase.from('meta_whatsapp_templates')
        .select('id, nome_template, idioma, categoria, status, body_text, variaveis, instancia_id')
        .eq('status', 'approved').order('nome_template');
      return (data || []) as Template[];
    },
  });

  const templatesUnicos = useMemo(() => {
    const map = new Map<string, Template>();
    for (const t of templates || []) {
      const key = `${t.nome_template}::${t.idioma}`;
      if (!map.has(key)) map.set(key, t);
    }
    return Array.from(map.values());
  }, [templates]);

  const tplD3 = templatesUnicos.find(t => t.id === templateD3);
  const tplD0 = templatesUnicos.find(t => t.id === templateD0);
  const placeholdersD3 = useMemo(() => extractPlaceholders(tplD3?.body_text || null), [tplD3]);
  const placeholdersD0 = useMemo(() => extractPlaceholders(tplD0?.body_text || null), [tplD0]);

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
    setTemplateD3(config.template_id_d3 || '');
    setTemplateD0(config.template_id_d0 || '');
    setVarMapD3((config.variaveis_map_d3 as Record<string, string>) || {});
    setVarMapD0((config.variaveis_map_d0 as Record<string, string>) || {});
    setMinSeg(config.min_seg ?? 30);
    setMaxSeg(config.max_seg ?? 60);
    setHoraInicio(config.hora_inicio || '08:30');
    setTelefones((config.notificar_telefones || []).join(', '));
  }, [config]);

  async function salvar() {
    if (instanciaIds.length === 0) { toast.error('Selecione ao menos 1 instância'); return; }
    if (!templateD3 && !templateD0) { toast.error('Selecione ao menos 1 template'); return; }
    setSaving(true);
    try {
      const payload: any = {
        ativo, instancia_ids: instanciaIds,
        template_id_d3: templateD3 || null,
        template_id_d0: templateD0 || null,
        variaveis_map_d3: varMapD3, variaveis_map_d0: varMapD0,
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

  function renderVarMap(placeholders: string[], map: Record<string,string>, setMap: (m: Record<string,string>) => void, label: string) {
    if (placeholders.length === 0) return <p className="text-xs text-muted-foreground">Este template não possui variáveis.</p>;
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {placeholders.map(ph => (
          <div key={ph} className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono min-w-[60px] justify-center">{`{{${ph}}}`}</Badge>
            <Select value={map[ph] || ''} onValueChange={(v) => setMap({ ...map, [ph]: v })}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione a informação..." /></SelectTrigger>
              <SelectContent>
                {FIELD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    );
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
            <CardTitle>Instâncias Meta</CardTitle>
            <CardDescription>Round-robin entre as instâncias marcadas. Instâncias RED/YELLOW são puladas automaticamente.</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Template D-3 (3 dias antes)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={templateD3} onValueChange={(v) => { setTemplateD3(v); setVarMapD3({}); }}>
                <SelectTrigger><SelectValue placeholder="Selecione um template..."/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Não enviar D-3 —</SelectItem>
                  {templatesUnicos.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.nome_template} · {t.idioma} · {t.categoria}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tplD3 && <div className="rounded bg-muted p-2 text-xs whitespace-pre-wrap">{tplD3.body_text}</div>}
              {tplD3 && renderVarMap(placeholdersD3, varMapD3, setVarMapD3, 'Mapeamento de variáveis')}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Template D0 (no dia do vencimento)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={templateD0} onValueChange={(v) => { setTemplateD0(v); setVarMapD0({}); }}>
                <SelectTrigger><SelectValue placeholder="Selecione um template..."/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Não enviar D0 —</SelectItem>
                  {templatesUnicos.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.nome_template} · {t.idioma} · {t.categoria}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tplD0 && <div className="rounded bg-muted p-2 text-xs whitespace-pre-wrap">{tplD0.body_text}</div>}
              {tplD0 && renderVarMap(placeholdersD0, varMapD0, setVarMapD0, 'Mapeamento de variáveis')}
            </CardContent>
          </Card>
        </div>

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
