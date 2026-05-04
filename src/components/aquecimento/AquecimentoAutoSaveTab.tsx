import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Upload, Trash2, RefreshCw, Phone, CheckCircle2, Activity, Settings, AlertCircle, Anchor, Users } from 'lucide-react';

interface Contato {
  id: string; numero: string; nome: string | null; ativo: boolean;
  total_usos: number; total_respostas: number; ultimo_uso_em: string | null;
}

interface Envio {
  id: string;
  enviado_em: string;
  instancia_id: string;
  numero_destino: string | null;
  mensagem_enviada: string;
  status: string;
  erro_detalhe: string | null;
  origem: string | null;
}

interface Config {
  ancora_probability: number;
  ativo: boolean;
}

const PAGE_SIZE = 50;

function normalizarNumero(raw: any): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return null;
  return digits.startsWith('55') ? digits : `55${digits}`;
}

export default function AquecimentoAutoSaveTab() {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [instancias, setInstancias] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [importando, setImportando] = useState(false);
  const [filtro, setFiltro] = useState<'todos' | 'ativos' | 'inativos'>('ativos');
  const [filtroEnvios, setFiltroEnvios] = useState<'todos' | 'enviado' | 'erro' | 'ancora' | 'pool'>('todos');
  const [busca, setBusca] = useState('');
  const [enviosHoje, setEnviosHoje] = useState(0);
  const [stats24h, setStats24h] = useState({ ancora: 0, pool: 0, erros: 0, total: 0 });
  const [silenciosos, setSilenciosos] = useState<Array<{ instancia_id: string; mensagens_sem_resposta: number; status: string; pausado_por_silencio: boolean }>>([]);
  const [config, setConfig] = useState<Config>({ ancora_probability: 0.7, ativo: true });
  const [configDirty, setConfigDirty] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('aquecimento_contatos_autosave' as any).select('*').order('ultimo_uso_em', { ascending: true, nullsFirst: true }).limit(500);
    if (filtro === 'ativos') q = q.eq('ativo', true);
    if (filtro === 'inativos') q = q.eq('ativo', false);
    const { data, error } = await q;
    if (error) toast.error('Erro ao carregar contatos: ' + error.message);
    else setContatos((data as any) || []);
    setLoading(false);
  }, [filtro]);

  const carregarConfig = useCallback(async () => {
    const { data } = await supabase.from('aquecimento_autosave_config' as any).select('ancora_probability, ativo').eq('id', 1).maybeSingle();
    if (data) {
      setConfig({ ancora_probability: Number((data as any).ancora_probability) || 0.7, ativo: (data as any).ativo ?? true });
      setConfigDirty(false);
    }
  }, []);

  const carregarInstancias = useCallback(async () => {
    const { data } = await supabase.from('user_whatsapp_instances').select('id, nome');
    if (data) setInstancias(new Map(data.map((i: any) => [i.id, i.nome])));
  }, []);

  const carregarEnvios = useCallback(async () => {
    let q = supabase.from('aquecimento_envios_autosave' as any).select('*').order('enviado_em', { ascending: false }).limit(50);
    if (filtroEnvios === 'enviado') q = q.eq('status', 'enviado');
    if (filtroEnvios === 'erro') q = q.in('status', ['erro', 'exception']);
    if (filtroEnvios === 'ancora') q = q.eq('origem', 'ancora');
    if (filtroEnvios === 'pool') q = q.eq('origem', 'pool');
    const { data } = await q;
    if (data) setEnvios(data as any);
  }, [filtroEnvios]);

  const carregarStats = useCallback(async () => {
    const corte24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);

    const [{ count: hoje }, { data: stats }] = await Promise.all([
      supabase.from('aquecimento_envios_autosave' as any).select('id', { count: 'exact', head: true }).eq('status', 'enviado').gte('enviado_em', inicioDia.toISOString()),
      supabase.from('aquecimento_envios_autosave' as any).select('status, origem').gte('enviado_em', corte24h),
    ]);

    setEnviosHoje(hoje || 0);

    const arr = (stats as any) || [];
    setStats24h({
      ancora: arr.filter((e: any) => e.status === 'enviado' && e.origem === 'ancora').length,
      pool: arr.filter((e: any) => e.status === 'enviado' && e.origem === 'pool').length,
      erros: arr.filter((e: any) => e.status === 'erro' || e.status === 'exception').length,
      total: arr.filter((e: any) => e.status === 'enviado').length,
    });
  }, []);

  const carregarSilenciosos = useCallback(async () => {
    const { data } = await supabase
      .from('whatsapp_aquecimento_instancias' as any)
      .select('instancia_id, mensagens_sem_resposta, status, pausado_por_silencio')
      .order('mensagens_sem_resposta', { ascending: false })
      .limit(10);
    if (data) setSilenciosos(data as any);
  }, []);

  useEffect(() => { carregarEnvios(); }, [carregarEnvios]);
  useEffect(() => { carregarConfig(); carregarInstancias(); carregarStats(); carregarSilenciosos(); }, [carregarConfig, carregarInstancias, carregarStats, carregarSilenciosos]);

  // Polling 30s para envios, stats e silenciosos
  useEffect(() => {
    const t = setInterval(() => { carregarEnvios(); carregarStats(); carregarSilenciosos(); }, 30000);
    return () => clearInterval(t);
  }, [carregarEnvios, carregarStats, carregarSilenciosos]);

  const salvarConfig = async () => {
    setSavingConfig(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('aquecimento_autosave_config' as any).update({
      ancora_probability: config.ancora_probability,
      ativo: config.ativo,
      atualizado_em: new Date().toISOString(),
      atualizado_por: user?.id,
    } as any).eq('id', 1);
    setSavingConfig(false);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Configuração salva. Vale a partir do próximo ciclo.'); setConfigDirty(false); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportando(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const allRows: any[] = [];
      for (const sn of wb.SheetNames) allRows.push(...XLSX.utils.sheet_to_json<any>(wb.Sheets[sn], { defval: '', raw: false }));
      const novos: { numero: string; nome: string | null }[] = [];
      const vistos = new Set<string>();
      for (const row of allRows) {
        let numeroRaw: any = null, nomeRaw: any = null;
        for (const k of Object.keys(row)) {
          const lk = k.toLowerCase();
          if (!numeroRaw && (lk.includes('tel') || lk.includes('cel') || lk.includes('phone') || lk.includes('numero') || lk.includes('número') || lk.includes('whats'))) numeroRaw = row[k];
          if (!nomeRaw && (lk.includes('nome') || lk.includes('name') || lk.includes('contato'))) nomeRaw = row[k];
        }
        if (!numeroRaw) for (const k of Object.keys(row)) { const v = String(row[k] || '').replace(/\D/g, ''); if (v.length >= 10) { numeroRaw = row[k]; break; } }
        const norm = normalizarNumero(numeroRaw);
        if (!norm || vistos.has(norm)) continue;
        vistos.add(norm); novos.push({ numero: norm, nome: nomeRaw ? String(nomeRaw).trim().slice(0, 100) : null });
      }
      if (!novos.length) { toast.error('Nenhum número válido.'); return; }
      let inseridos = 0, duplicados = 0;
      for (let i = 0; i < novos.length; i += 200) {
        const lote = novos.slice(i, i + 200);
        const { error, count } = await supabase.from('aquecimento_contatos_autosave' as any).upsert(lote, { onConflict: 'numero', ignoreDuplicates: true, count: 'exact' });
        if (error) toast.error('Erro: ' + error.message);
        else { inseridos += count || 0; duplicados += lote.length - (count || 0); }
      }
      toast.success(`${inseridos} novos, ${duplicados} duplicados`);
      await carregar();
    } catch (err: any) { toast.error('Erro: ' + err.message); }
    finally { setImportando(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const toggleAtivo = async (c: Contato) => {
    const { error } = await supabase.from('aquecimento_contatos_autosave' as any).update({ ativo: !c.ativo } as any).eq('id', c.id);
    if (error) toast.error(error.message); else { toast.success(c.ativo ? 'Desativado' : 'Ativado'); carregar(); }
  };

  const excluir = async (c: Contato) => {
    if (!confirm(`Excluir ${c.numero}?`)) return;
    const { error } = await supabase.from('aquecimento_contatos_autosave' as any).delete().eq('id', c.id);
    if (error) toast.error(error.message); else { toast.success('Excluído'); carregar(); }
  };

  const dispararCiclo = async () => {
    toast.info('Disparando ciclo manual...');
    const { data, error } = await supabase.functions.invoke('aquecimento-envio-autosave', { body: {} });
    if (error) toast.error(error.message);
    else {
      const d = data as any;
      toast.success(`Ciclo: ${d?.enviados || 0} enviados (${d?.enviadosAncora || 0} âncora, ${d?.enviadosPool || 0} pool, ${d?.erros || 0} erros)`);
      carregarStats(); carregarEnvios();
    }
  };

  const totalAtivos = contatos.filter(c => c.ativo).length;
  const totalRespostas = contatos.reduce((s, c) => s + (c.total_respostas || 0), 0);
  const totalUsos = contatos.reduce((s, c) => s + (c.total_usos || 0), 0);
  const taxaResposta = totalUsos > 0 ? ((totalRespostas / totalUsos) * 100).toFixed(1) : '0.0';
  const taxaSucesso = (stats24h.total + stats24h.erros) > 0 ? ((stats24h.total / (stats24h.total + stats24h.erros)) * 100).toFixed(1) : '100';
  const filtrados = contatos.filter(c => !busca || c.numero.includes(busca.replace(/\D/g, '')) || (c.nome || '').toLowerCase().includes(busca.toLowerCase())).slice(0, PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Cards principais */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total na pool</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold flex items-center gap-2"><Phone className="h-5 w-5 text-primary" />{contatos.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ativos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{totalAtivos}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Taxa de Resposta</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />{taxaResposta}%</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Envios Hoje</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold flex items-center gap-2"><Activity className="h-5 w-5 text-accent-foreground" />{enviosHoje}</div></CardContent></Card>
      </div>

      {/* Cards estatísticas 24h */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="border-primary/30"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Anchor className="h-4 w-4" />Âncoras 24h</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats24h.ancora}</div></CardContent></Card>
        <Card className="border-primary/30"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Users className="h-4 w-4" />Pool 24h</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats24h.pool}</div></CardContent></Card>
        <Card className="border-destructive/30"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><AlertCircle className="h-4 w-4" />Falhas 24h</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{stats24h.erros}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Taxa Sucesso 24h</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{taxaSucesso}%</div></CardContent></Card>
      </div>

      {/* Top 10 chips silenciosos (Unanswered Counter) */}
      <Card className="border-amber-500/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            Top 10 Chips Silenciosos
            <Badge variant="outline" className="ml-2 text-xs">Unanswered Counter</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">Chips sem resposta acumulada. ≥8: limite reduzido. ≥20: pausa automática.</p>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Instância</TableHead><TableHead className="text-right">Sem resposta</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {silenciosos.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Nenhum dado.</TableCell></TableRow>}
                {silenciosos.map(s => (
                  <TableRow key={s.instancia_id}>
                    <TableCell className="text-xs">{instancias.get(s.instancia_id) || s.instancia_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={s.mensagens_sem_resposta >= 20 ? 'destructive' : s.mensagens_sem_resposta >= 8 ? 'secondary' : 'outline'}>
                        {s.mensagens_sem_resposta}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.pausado_por_silencio ? <Badge variant="destructive">Pausado por silêncio</Badge> : <span className="text-muted-foreground">{s.status}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" />Configuração do Auto-Save</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/30">
            <div>
              <div className="font-medium text-sm">Auto-Save Ativo</div>
              <div className="text-xs text-muted-foreground">Kill-switch global. Desativar pausa todos os envios automáticos.</div>
            </div>
            <Switch checked={config.ativo} onCheckedChange={(v) => { setConfig(c => ({ ...c, ativo: v })); setConfigDirty(true); }} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">Proporção Âncora vs Pool</label>
              <Badge variant="outline">{Math.round(config.ancora_probability * 100)}% âncora / {Math.round((1 - config.ancora_probability) * 100)}% pool</Badge>
            </div>
            <Slider
              value={[config.ancora_probability * 100]}
              onValueChange={([v]) => { setConfig(c => ({ ...c, ancora_probability: v / 100 })); setConfigDirty(true); }}
              min={0} max={100} step={5}
            />
            <div className="text-xs text-muted-foreground">100% = só âncoras (chips pessoais). 0% = só pool externa. Recomendado: 70%.</div>
          </div>

          {configDirty && (
            <Button onClick={salvarConfig} disabled={savingConfig} size="sm">
              {savingConfig ? 'Salvando...' : 'Salvar configuração'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Pool de contatos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contatos Auto-Save</CardTitle>
          <p className="text-xs text-muted-foreground">Pool de números externos. Cada contato é reutilizado por uma instância no máximo a cada 30 dias.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={importando} className="gap-1"><Upload className="h-4 w-4" />{importando ? 'Importando...' : 'Importar Planilha'}</Button>
            <Button size="sm" variant="outline" onClick={() => { carregar(); carregarStats(); }} className="gap-1"><RefreshCw className="h-4 w-4" />Atualizar</Button>
            <Button size="sm" variant="secondary" onClick={dispararCiclo} className="gap-1"><Activity className="h-4 w-4" />Disparar ciclo agora</Button>
            <div className="ml-auto flex gap-2 items-center">
              <Input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} className="w-48 h-8" />
              <select value={filtro} onChange={e => setFiltro(e.target.value as any)} className="h-8 text-sm border rounded px-2 bg-background">
                <option value="ativos">Só ativos</option><option value="inativos">Só inativos</option><option value="todos">Todos</option>
              </select>
            </div>
          </div>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Nome</TableHead><TableHead className="text-right">Usos</TableHead><TableHead className="text-right">Respostas</TableHead><TableHead className="text-right">Taxa</TableHead><TableHead>Último uso</TableHead><TableHead className="text-center">Ativo</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>}
                {!loading && filtrados.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhum contato.</TableCell></TableRow>}
                {filtrados.map(c => {
                  const taxa = c.total_usos > 0 ? ((c.total_respostas / c.total_usos) * 100).toFixed(0) : '-';
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.numero}</TableCell>
                      <TableCell className="text-sm">{c.nome || '-'}</TableCell>
                      <TableCell className="text-right text-sm">{c.total_usos}</TableCell>
                      <TableCell className="text-right text-sm">{c.total_respostas}</TableCell>
                      <TableCell className="text-right text-sm">{taxa === '-' ? '-' : <Badge variant={Number(taxa) >= 50 ? 'default' : 'secondary'}>{taxa}%</Badge>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.ultimo_uso_em ? new Date(c.ultimo_uso_em).toLocaleString('pt-BR') : 'Nunca'}</TableCell>
                      <TableCell className="text-center"><Switch checked={c.ativo} onCheckedChange={() => toggleAtivo(c)} /></TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => excluir(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {contatos.length > PAGE_SIZE && <p className="text-xs text-muted-foreground">Exibindo {filtrados.length} de {contatos.length}.</p>}
        </CardContent>
      </Card>

      {/* Últimos 50 envios */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Últimos 50 Envios</CardTitle>
            <p className="text-xs text-muted-foreground">Atualiza automaticamente a cada 30s. Inclui sucessos e falhas.</p>
          </div>
          <select value={filtroEnvios} onChange={e => setFiltroEnvios(e.target.value as any)} className="h-8 text-sm border rounded px-2 bg-background">
            <option value="todos">Todos</option>
            <option value="enviado">Só enviados</option>
            <option value="erro">Só erros</option>
            <option value="ancora">Só âncora</option>
            <option value="pool">Só pool</option>
          </select>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Instância</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {envios.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum envio ainda.</TableCell></TableRow>}
                {envios.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(e.enviado_em).toLocaleTimeString('pt-BR')}</TableCell>
                    <TableCell className="text-xs">{instancias.get(e.instancia_id) || e.instancia_id.slice(0, 8)}</TableCell>
                    <TableCell className="font-mono text-xs">{e.numero_destino || '-'}</TableCell>
                    <TableCell>{e.origem === 'ancora' ? <Badge variant="default" className="gap-1"><Anchor className="h-3 w-3" />Âncora</Badge> : e.origem === 'pool' ? <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" />Pool</Badge> : <span className="text-xs text-muted-foreground">-</span>}</TableCell>
                    <TableCell>{e.status === 'enviado' ? <Badge variant="default" className="bg-green-600">Enviado</Badge> : <Badge variant="destructive">{e.status}</Badge>}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={e.mensagem_enviada}>{e.mensagem_enviada}</TableCell>
                    <TableCell className="text-xs text-destructive max-w-[250px] truncate" title={e.erro_detalhe || ''}>{e.erro_detalhe || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
