import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Heart, MessageCircle, Eye, Trash2, Plus, RefreshCw, PlayCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Emoji { id: string; emoji: string; ativo: boolean; ordem: number; }
interface Resposta { id: string; texto: string; ativo: boolean; }
interface Interacao {
  id: string;
  status_log_id: string;
  instancia_id: string;
  tipo: string;
  conteudo: string | null;
  agendado_para: string;
  executado_em: string | null;
  sucesso: boolean | null;
  erro: string | null;
  instance_name?: string;
}

export default function EngajamentoStatusTab() {
  const [habilitado, setHabilitado] = useState(true);
  const [emojis, setEmojis] = useState<Emoji[]>([]);
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [stats, setStats] = useState({ visualizado: 0, reacao: 0, resposta: 0, pendente: 0 });
  const [novoEmoji, setNovoEmoji] = useState('');
  const [novaResposta, setNovaResposta] = useState('');
  const [loading, setLoading] = useState(false);
  const [executando, setExecutando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    const [{ data: cfg }, { data: e }, { data: r }, { data: ints }, { data: hoje }, { data: pend }] =
      await Promise.all([
        supabase.from('whatsapp_aquecimento_config').select('valor').eq('chave', 'engajamento_status_auto').maybeSingle(),
        supabase.from('whatsapp_aquecimento_status_emojis_pool').select('*').order('ordem'),
        supabase.from('whatsapp_aquecimento_status_respostas_pool').select('*').order('texto'),
        supabase.from('whatsapp_aquecimento_status_interacoes')
          .select('*').order('agendado_para', { ascending: false }).limit(40),
        supabase.from('whatsapp_aquecimento_status_interacoes')
          .select('tipo').gte('executado_em', inicioDia.toISOString()).eq('sucesso', true),
        supabase.from('whatsapp_aquecimento_status_interacoes')
          .select('id', { count: 'exact', head: true }).is('executado_em', null),
      ]);

    setHabilitado(cfg?.valor === true || (cfg?.valor as any) === 'true' || cfg === null);
    setEmojis((e as any) || []);
    setRespostas((r as any) || []);

    const instIds = Array.from(new Set((ints || []).map((i: any) => i.instancia_id)));
    const { data: insts } = await supabase
      .from('user_whatsapp_instances')
      .select('id, nome')
      .in('id', instIds.length ? instIds : ['00000000-0000-0000-0000-000000000000']);
    const nameMap = new Map((insts || []).map((i: any) => [i.id, i.nome]));
    setInteracoes(((ints as any) || []).map((i: any) => ({
      ...i,
      instance_name: nameMap.get(i.instancia_id) || i.instancia_id.slice(0, 8),
    })));

    const counters = { visualizado: 0, reacao: 0, resposta: 0, pendente: (pend as any)?.length ?? 0 };
    for (const h of (hoje as any[]) || []) {
      if (h.tipo in counters) (counters as any)[h.tipo]++;
    }
    // pendente count via head/exact
    const { count } = await supabase
      .from('whatsapp_aquecimento_status_interacoes')
      .select('*', { count: 'exact', head: true })
      .is('executado_em', null);
    counters.pendente = count || 0;
    setStats(counters);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const toggleHabilitado = async (v: boolean) => {
    setHabilitado(v);
    const { error } = await supabase
      .from('whatsapp_aquecimento_config')
      .upsert({ chave: 'engajamento_status_auto', valor: v as any }, { onConflict: 'chave' });
    if (error) toast.error(error.message);
    else toast.success(v ? 'Engajamento ativado' : 'Engajamento pausado');
  };

  const adicionarEmoji = async () => {
    const t = novoEmoji.trim();
    if (!t) return;
    const { error } = await supabase
      .from('whatsapp_aquecimento_status_emojis_pool')
      .insert({ emoji: t, ordem: emojis.length + 1 });
    if (error) return toast.error(error.message);
    setNovoEmoji('');
    carregar();
  };

  const toggleEmoji = async (id: string, ativo: boolean) => {
    await supabase.from('whatsapp_aquecimento_status_emojis_pool').update({ ativo }).eq('id', id);
    carregar();
  };

  const removerEmoji = async (id: string) => {
    await supabase.from('whatsapp_aquecimento_status_emojis_pool').delete().eq('id', id);
    carregar();
  };

  const adicionarResposta = async () => {
    const t = novaResposta.trim();
    if (!t) return;
    const { error } = await supabase
      .from('whatsapp_aquecimento_status_respostas_pool')
      .insert({ texto: t });
    if (error) return toast.error(error.message);
    setNovaResposta('');
    carregar();
  };

  const toggleResposta = async (id: string, ativo: boolean) => {
    await supabase.from('whatsapp_aquecimento_status_respostas_pool').update({ ativo }).eq('id', id);
    carregar();
  };

  const removerResposta = async (id: string) => {
    await supabase.from('whatsapp_aquecimento_status_respostas_pool').delete().eq('id', id);
    carregar();
  };

  const executarAgora = async () => {
    setExecutando(true);
    try {
      const { data, error } = await supabase.functions.invoke('aquecimento-status-reagir', {
        body: { action: 'test' },
      });
      if (error) throw error;
      toast.success(`Processado: ${data?.processed ?? 0} interações`);
      carregar();
    } catch (e: any) {
      toast.error(e.message || 'Falha');
    } finally {
      setExecutando(false);
    }
  };

  const tipoIcon = (t: string) => {
    if (t === 'visualizado') return <Eye className="h-3 w-3" />;
    if (t === 'reacao') return <Heart className="h-3 w-3" />;
    return <MessageCircle className="h-3 w-3" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" /> Engajamento em Status
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="eng-toggle" className="text-sm">{habilitado ? 'Ativo' : 'Pausado'}</Label>
            <Switch id="eng-toggle" checked={habilitado} onCheckedChange={toggleHabilitado} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Quando uma instância posta um status, as outras instâncias ativas marcam como visualizado,
            reagem com emoji e respondem com mensagem privada — tudo com delays naturais (5min a 4h)
            durante 08h–21h BRT, exceto domingos. Limites: 8 reações + 3 respostas/dia por instância.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3"/> Visualizações hoje</div>
              <div className="text-2xl font-bold">{stats.visualizado}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1"><Heart className="h-3 w-3"/> Reações hoje</div>
              <div className="text-2xl font-bold">{stats.reacao}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1"><MessageCircle className="h-3 w-3"/> Respostas hoje</div>
              <div className="text-2xl font-bold">{stats.resposta}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Pendentes</div>
              <div className="text-2xl font-bold">{stats.pendente}</div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={carregar} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
            <Button onClick={executarAgora} size="sm" disabled={executando}>
              <PlayCircle className="h-4 w-4 mr-1" /> Executar pendentes agora
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Heart className="h-4 w-4"/> Pool de Emojis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Novo emoji (ex: 🔥)"
                value={novoEmoji}
                onChange={(e) => setNovoEmoji(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && adicionarEmoji()}
                maxLength={10}
              />
              <Button onClick={adicionarEmoji} size="sm"><Plus className="h-4 w-4"/></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {emojis.map((e) => (
                <div key={e.id} className={`flex items-center gap-1 rounded-full border px-2 py-1 text-lg ${e.ativo ? '' : 'opacity-40'}`}>
                  <button onClick={() => toggleEmoji(e.id, !e.ativo)} title={e.ativo ? 'Desativar' : 'Ativar'}>
                    {e.emoji}
                  </button>
                  <button onClick={() => removerEmoji(e.id)} className="text-xs text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3"/>
                  </button>
                </div>
              ))}
              {emojis.length === 0 && <span className="text-xs text-muted-foreground">Nenhum emoji cadastrado.</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><MessageCircle className="h-4 w-4"/> Pool de Respostas Privadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Textarea
                placeholder="Nova frase curta..."
                value={novaResposta}
                onChange={(e) => setNovaResposta(e.target.value)}
                rows={2}
                maxLength={200}
              />
              <Button onClick={adicionarResposta} size="sm"><Plus className="h-4 w-4"/></Button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {respostas.map((r) => (
                <div key={r.id} className={`flex items-center justify-between gap-2 rounded border px-2 py-1 text-sm ${r.ativo ? '' : 'opacity-40'}`}>
                  <span className="truncate flex-1">{r.texto}</span>
                  <Switch checked={r.ativo} onCheckedChange={(v) => toggleResposta(r.id, v)} />
                  <Button variant="ghost" size="icon" onClick={() => removerResposta(r.id)}>
                    <Trash2 className="h-3 w-3"/>
                  </Button>
                </div>
              ))}
              {respostas.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma resposta cadastrada.</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas 40 Interações</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Instância</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Conteúdo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interacoes.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="text-xs">
                    {format(new Date(i.executado_em || i.agendado_para), 'dd/MM HH:mm')}
                  </TableCell>
                  <TableCell className="text-xs">{i.instance_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">{tipoIcon(i.tipo)}{i.tipo}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{i.conteudo || '—'}</TableCell>
                  <TableCell>
                    {i.executado_em == null ? (
                      <Badge variant="secondary">pendente</Badge>
                    ) : i.sucesso ? (
                      <Badge>ok</Badge>
                    ) : (
                      <Badge variant="destructive" title={i.erro || ''}>erro</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {interacoes.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm">Nenhuma interação ainda.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
