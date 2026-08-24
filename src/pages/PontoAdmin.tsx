import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { exportarParaExcel } from '@/lib/exportExcel';
import { formatarDuracao } from '@/hooks/useAtividadeMonitor';
import { Clock, Download, FileText, Plus, Trash2, Wifi, Users, RefreshCw } from 'lucide-react';

const TZ = 'America/Sao_Paulo';

const hhmm = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '--:--';

const minutosDoDia = (iso: string) => {
  const s = new Date(iso).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

const fmtMin = (min: number) => {
  const sinal = min < 0 ? '-' : '';
  const abs = Math.abs(Math.round(min));
  return `${sinal}${String(Math.floor(abs / 60)).padStart(2, '0')}h${String(abs % 60).padStart(2, '0')}`;
};

const primeiroDiaMes = () => {
  const d = new Date();
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).format(d) + '-01';
};
const hojeISO = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

interface LinhaRelatorio {
  data: string;
  nome: string;
  entrada: string;
  saidaAlmoco: string;
  voltaAlmoco: string;
  saida: string;
  trabalhado: string;
  almoco: string;
  atraso: string;
  extra: string;
  inativo: string;
}

export default function PontoAdmin() {
  const queryClient = useQueryClient();
  const [inicio, setInicio] = useState(primeiroDiaMes());
  const [fim, setFim] = useState(hojeISO());
  const [funcionario, setFuncionario] = useState<string>('todos');
  const [novoCidr, setNovoCidr] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');

  const { data: perfis = [] } = useQuery({
    queryKey: ['ponto-perfis'],
    queryFn: async () => {
      const [permsRes, profsRes] = await Promise.all([
        (supabase.from('user_permissions') as any).select('user_id').eq('bate_ponto', true),
        (supabase.from('profiles') as any).select('id, nome, ativo').order('nome'),
      ]);
      const { data: perms, error: ePerm } = permsRes as any;
      const { data: profs, error: eProf } = profsRes as any;

      if (ePerm) throw ePerm;
      if (eProf) throw eProf;
      const obrigados = new Set((perms ?? []).map((p: any) => p.user_id));
      return (profs ?? []).filter((p: any) => obrigados.has(p.id));
    },
    staleTime: 5 * 60_000,
  });


  const nomePorId = useMemo(
    () => new Map(perfis.map((p: any) => [p.id, p.nome ?? p.id])),
    [perfis],
  );

  const { data: relatorio, isLoading: loadingRel, refetch: refetchRel } = useQuery({
    queryKey: ['ponto-relatorio', inicio, fim, funcionario],
    queryFn: async () => {
      let q = supabase
        .from('ponto_registros')
        .select('user_id, data, tipo, registrado_em, origem, ip')
        .gte('data', inicio)
        .lte('data', fim)
        .order('data', { ascending: false });
      if (funcionario !== 'todos') q = q.eq('user_id', funcionario);
      const { data: regs, error } = await q;
      if (error) throw error;

      let qi = supabase
        .from('atividade_inatividade')
        .select('user_id, data, duracao_seg')
        .gte('data', inicio)
        .lte('data', fim);
      if (funcionario !== 'todos') qi = qi.eq('user_id', funcionario);
      const { data: inat } = await qi;

      const { data: jornadas } = await supabase
        .from('ponto_jornada_config')
        .select('*');

      return { regs: regs ?? [], inat: inat ?? [], jornadas: jornadas ?? [] };
    },
    staleTime: 60_000,
  });

  const linhas: LinhaRelatorio[] = useMemo(() => {
    if (!relatorio) return [];
    const jornadaPorUser = new Map<string, any>(relatorio.jornadas.map((j: any) => [j.user_id, j]));
    const inatPorChave = new Map<string, number>();
    for (const i of relatorio.inat as any[]) {
      const k = `${i.user_id}|${i.data}`;
      inatPorChave.set(k, (inatPorChave.get(k) ?? 0) + (i.duracao_seg ?? 0));
    }

    const grupos = new Map<string, Record<string, string>>();
    for (const r of relatorio.regs as any[]) {
      const k = `${r.user_id}|${r.data}`;
      const g = grupos.get(k) ?? {};
      g[r.tipo] = r.registrado_em;
      grupos.set(k, g);
    }

    const out: LinhaRelatorio[] = [];
    for (const [k, g] of grupos) {
      const [userId, data] = k.split('|');
      const j = jornadaPorUser.get(userId);
      const entradaPrev = j?.entrada_prevista ? Number(j.entrada_prevista.slice(0, 2)) * 60 + Number(j.entrada_prevista.slice(3, 5)) : 8 * 60;
      const saidaPrev = j?.saida_prevista ? Number(j.saida_prevista.slice(0, 2)) * 60 + Number(j.saida_prevista.slice(3, 5)) : 18 * 60;
      const tolerancia = j?.tolerancia_min ?? 10;
      const previstoMin = saidaPrev - entradaPrev - (j?.minutos_almoco ?? 60);

      const eIn = g.entrada ? minutosDoDia(g.entrada) : null;
      const sAl = g.saida_almoco ? minutosDoDia(g.saida_almoco) : null;
      const vAl = g.volta_almoco ? minutosDoDia(g.volta_almoco) : null;
      const sFi = g.saida ? minutosDoDia(g.saida) : null;

      const almocoMin = sAl !== null && vAl !== null ? vAl - sAl : 0;
      const trabalhado = eIn !== null && sFi !== null ? sFi - eIn - almocoMin : 0;
      const atraso = eIn !== null ? Math.max(0, eIn - entradaPrev - tolerancia) : 0;
      const extra = trabalhado > previstoMin ? trabalhado - previstoMin : 0;

      out.push({
        data: data.split('-').reverse().join('/'),
        nome: String(nomePorId.get(userId) ?? userId),
        entrada: hhmm(g.entrada),
        saidaAlmoco: hhmm(g.saida_almoco),
        voltaAlmoco: hhmm(g.volta_almoco),
        saida: hhmm(g.saida),
        trabalhado: trabalhado > 0 ? fmtMin(trabalhado) : '--',
        almoco: almocoMin > 0 ? fmtMin(almocoMin) : '--',
        atraso: atraso > 0 ? fmtMin(atraso) : '--',
        extra: extra > 0 ? fmtMin(extra) : '--',
        inativo: formatarDuracao(inatPorChave.get(k) ?? 0),
      });
    }
    return out.sort((a, b) => (a.data === b.data ? a.nome.localeCompare(b.nome) : a.data < b.data ? 1 : -1));
  }, [relatorio, nomePorId]);

  const { data: presenca = [], refetch: refetchPresenca } = useQuery({
    queryKey: ['ponto-presenca'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('presenca_ao_vivo');
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: ips = [] } = useQuery({
    queryKey: ['ponto-ips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ponto_ips_autorizados')
        .select('*')
        .order('created_at');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: meuIp, isFetching: ipCarregando, refetch: recarregarIp } = useQuery({
    queryKey: ['ponto-meu-ip-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('ponto-ip-autorizar', { body: { acao: 'consultar' } });
      if (error) throw error;
      const res = data as { ip: string; autorizado: boolean };
      if (res?.ip) return { ...res, origem: 'servidor' as const };
      // Fallback: o servidor não conseguiu determinar o IP -> consulta pelo navegador
      try {
        const r = await fetch('https://api.ipify.org?format=json');
        const j = await r.json();
        if (j?.ip) return { ip: String(j.ip), autorizado: false, origem: 'navegador' as const };
      } catch { /* ignora */ }
      return { ip: '', autorizado: false, origem: 'desconhecido' as const };
    },
    retry: false,
  });

  const autorizarAtual = useMutation({
    mutationFn: async () => {
      if (!meuIp?.ip) throw new Error('IP não detectado. Clique em "Tentar de novo".');
      const { data, error } = await supabase.functions.invoke('ponto-ip-autorizar', {
        body: { acao: 'autorizar_atual', ip: meuIp.ip, descricao: 'Rede do escritório' },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success('IP atual autorizado');
      queryClient.invalidateQueries({ queryKey: ['ponto-ips'] });
      queryClient.invalidateQueries({ queryKey: ['ponto-meu-ip-admin'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const adicionarIp = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ponto-ip-autorizar', {
        body: { acao: 'adicionar', cidr: novoCidr.trim(), descricao: novaDescricao },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success('Rede adicionada');
      setNovoCidr('');
      setNovaDescricao('');
      queryClient.invalidateQueries({ queryKey: ['ponto-ips'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleIp = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('ponto_ips_autorizados').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ponto-ips'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removerIp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ponto_ips_autorizados').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rede removida');
      queryClient.invalidateQueries({ queryKey: ['ponto-ips'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarJornada = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from('ponto_jornada_config').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Jornada salva');
      queryClient.invalidateQueries({ queryKey: ['ponto-jornadas'] });
      queryClient.invalidateQueries({ queryKey: ['ponto-relatorio'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: jornadas = [] } = useQuery({
    queryKey: ['ponto-jornadas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ponto_jornada_config').select('*');
      if (error) throw error;
      return data ?? [];
    },
  });

  const exportarExcel = () =>
    exportarParaExcel(
      linhas,
      [
        { chave: 'data', titulo: 'Data' },
        { chave: 'nome', titulo: 'Funcionário' },
        { chave: 'entrada', titulo: 'Entrada' },
        { chave: 'saidaAlmoco', titulo: 'Saída almoço' },
        { chave: 'voltaAlmoco', titulo: 'Volta almoço' },
        { chave: 'saida', titulo: 'Saída' },
        { chave: 'trabalhado', titulo: 'Trabalhado' },
        { chave: 'almoco', titulo: 'Almoço' },
        { chave: 'atraso', titulo: 'Atraso' },
        { chave: 'extra', titulo: 'Hora extra' },
        { chave: 'inativo', titulo: 'Tempo inativo' },
      ],
      `espelho-ponto-${inicio}-a-${fim}`,
    );

  const exportarPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Espelho de Ponto', 14, 14);
    doc.setFontSize(9);
    doc.text(`Período: ${inicio.split('-').reverse().join('/')} a ${fim.split('-').reverse().join('/')}`, 14, 20);

    const cabecalho = ['Data', 'Funcionário', 'Ent.', 'S.Alm', 'V.Alm', 'Saída', 'Trab.', 'Almoço', 'Atraso', 'Extra', 'Inativo'];
    const larguras = [20, 55, 16, 16, 16, 16, 18, 18, 18, 18, 22];
    let y = 28;
    const linhaTexto = (cols: string[]) => {
      let x = 14;
      cols.forEach((c, i) => {
        doc.text(String(c).slice(0, 26), x, y);
        x += larguras[i];
      });
    };
    doc.setFont('helvetica', 'bold');
    linhaTexto(cabecalho);
    doc.setFont('helvetica', 'normal');
    y += 6;
    for (const l of linhas) {
      if (y > 195) {
        doc.addPage();
        y = 20;
      }
      linhaTexto([l.data, l.nome, l.entrada, l.saidaAlmoco, l.voltaAlmoco, l.saida, l.trabalhado, l.almoco, l.atraso, l.extra, l.inativo]);
      y += 5.5;
    }
    doc.save(`espelho-ponto-${inicio}-a-${fim}.pdf`);
  };

  const badgeStatus = (s: string) => {
    if (s === 'ativo') return <Badge className="bg-secondary text-secondary-foreground">Ativo</Badge>;
    if (s === 'inativo') return <Badge variant="outline" className="border-warning text-warning">Inativo</Badge>;
    if (s === 'almoco') return <Badge variant="outline">Almoço</Badge>;
    return <Badge variant="secondary">Offline</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Clock className="h-6 w-6" />
            Controle de Ponto
          </h1>
        </div>

        <Tabs defaultValue="relatorio">
          <TabsList>
            <TabsTrigger value="relatorio">Relatório</TabsTrigger>
            <TabsTrigger value="presenca">Presença ao vivo</TabsTrigger>
            <TabsTrigger value="redes">Redes autorizadas</TabsTrigger>
            <TabsTrigger value="jornadas">Jornadas</TabsTrigger>
          </TabsList>

          <TabsContent value="relatorio" className="space-y-4">
            <Card>
              <CardContent className="flex flex-wrap items-end gap-3 pt-6">
                <div className="space-y-1">
                  <Label>De</Label>
                  <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-40" />
                </div>
                <div className="space-y-1">
                  <Label>Até</Label>
                  <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-40" />
                </div>
                <div className="space-y-1">
                  <Label>Funcionário</Label>
                  <Select value={funcionario} onValueChange={setFuncionario}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {perfis.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome ?? p.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={() => refetchRel()}>
                  <RefreshCw className="mr-2 h-4 w-4" />Atualizar
                </Button>
                <Button variant="outline" onClick={exportarExcel} disabled={linhas.length === 0}>
                  <Download className="mr-2 h-4 w-4" />Excel
                </Button>
                <Button variant="outline" onClick={exportarPdf} disabled={linhas.length === 0}>
                  <FileText className="mr-2 h-4 w-4" />PDF
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="overflow-x-auto pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>S. almoço</TableHead>
                      <TableHead>V. almoço</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead>Trabalhado</TableHead>
                      <TableHead>Almoço</TableHead>
                      <TableHead>Atraso</TableHead>
                      <TableHead>Extra</TableHead>
                      <TableHead>Inativo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingRel && (
                      <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                    )}
                    {!loadingRel && linhas.length === 0 && (
                      <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">Nenhum registro no período</TableCell></TableRow>
                    )}
                    {linhas.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>{l.data}</TableCell>
                        <TableCell className="font-medium">{l.nome}</TableCell>
                        <TableCell className="font-mono">{l.entrada}</TableCell>
                        <TableCell className="font-mono">{l.saidaAlmoco}</TableCell>
                        <TableCell className="font-mono">{l.voltaAlmoco}</TableCell>
                        <TableCell className="font-mono">{l.saida}</TableCell>
                        <TableCell className="font-mono">{l.trabalhado}</TableCell>
                        <TableCell className="font-mono">{l.almoco}</TableCell>
                        <TableCell className={l.atraso !== '--' ? 'font-mono text-destructive' : 'font-mono'}>{l.atraso}</TableCell>
                        <TableCell className={l.extra !== '--' ? 'font-mono text-secondary' : 'font-mono'}>{l.extra}</TableCell>
                        <TableCell className="font-mono">{l.inativo}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="presenca">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />Quem está online agora
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => refetchPresenca()}>
                  <RefreshCw className="mr-2 h-4 w-4" />Atualizar
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Sem interagir há</TableHead>
                      <TableHead>Página</TableHead>
                      <TableHead>Último ponto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {presenca.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem dados de presença</TableCell></TableRow>
                    )}
                    {presenca.map((p: any) => (
                      <TableRow key={p.user_id}>
                        <TableCell className="font-medium">{p.nome}</TableCell>
                        <TableCell>{badgeStatus(p.status)}</TableCell>
                        <TableCell className="font-mono">{p.ultima_interacao ? formatarDuracao(p.inativo_seg ?? 0) : '--'}</TableCell>
                        <TableCell className="text-muted-foreground">{p.pagina ?? '--'}</TableCell>
                        <TableCell>
                          {p.ultimo_ponto ? `${p.ultimo_ponto} · ${hhmm(p.ultimo_ponto_em)}` : '--'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="redes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wifi className="h-4 w-4" />Redes que podem bater ponto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ips.filter((r: any) => r.ativo).length === 0 && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <p className="font-semibold text-destructive">Nenhuma rede autorizada — ninguém consegue bater ponto</p>
                    <p className="text-muted-foreground">
                      Enquanto não existir uma rede ativa aqui, todo funcionário recebe erro ao tentar registrar o ponto.
                      Estando em um computador do escritório, clique em "Autorizar o IP atual" abaixo.
                    </p>
                  </div>
                )}

                <div className="rounded-lg border p-3 text-sm">
                  <p className="text-muted-foreground">Seu IP atual</p>
                  <p className="font-mono text-lg font-semibold">
                    {ipCarregando ? 'Detectando...' : (meuIp?.ip || 'Não foi possível detectar')}
                  </p>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {ipCarregando
                      ? 'Buscando o IP público desta rede.'
                      : !meuIp?.ip
                        ? 'Verifique a conexão e tente novamente, ou cadastre o IP manualmente abaixo.'
                        : meuIp.autorizado
                          ? 'Esta rede já está autorizada.'
                          : 'Esta rede ainda não está autorizada.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => autorizarAtual.mutate()}
                      disabled={autorizarAtual.isPending || ipCarregando || !meuIp?.ip || meuIp?.autorizado}
                    >
                      <Plus className="mr-2 h-4 w-4" />Autorizar o IP atual
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => recarregarIp()} disabled={ipCarregando}>
                      <RefreshCw className={`mr-2 h-4 w-4 ${ipCarregando ? 'animate-spin' : ''}`} />Tentar de novo
                    </Button>
                  </div>
                </div>


                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label>IP ou faixa (CIDR)</Label>
                    <Input placeholder="189.45.12.33 ou 189.45.12.0/24" value={novoCidr} onChange={(e) => setNovoCidr(e.target.value)} className="w-64" />
                  </div>
                  <div className="space-y-1">
                    <Label>Descrição</Label>
                    <Input placeholder="Escritório - Vivo Fibra" value={novaDescricao} onChange={(e) => setNovaDescricao(e.target.value)} className="w-64" />
                  </div>
                  <Button variant="outline" onClick={() => adicionarIp.mutate()} disabled={!novoCidr.trim() || adicionarIp.isPending}>
                    <Plus className="mr-2 h-4 w-4" />Adicionar
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP / Faixa</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ips.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma rede cadastrada</TableCell></TableRow>
                    )}
                    {ips.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono">{r.cidr}</TableCell>
                        <TableCell>{r.descricao}</TableCell>
                        <TableCell>
                          <Switch checked={r.ativo} onCheckedChange={(v) => toggleIp.mutate({ id: r.id, ativo: v })} />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removerIp.mutate(r.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jornadas">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Regras de jornada por funcionário</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {perfis.filter((p: any) => p.ativo !== false).map((p: any) => {
                  const j = (jornadas as any[]).find((x) => x.user_id === p.id);
                  return (
                    <JornadaLinha
                      key={p.id}
                      nome={p.nome ?? p.id}
                      jornada={j}
                      onSalvar={(vals) => salvarJornada.mutate({ user_id: p.id, ...vals })}
                    />
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function JornadaLinha({
  nome,
  jornada,
  onSalvar,
}: {
  nome: string;
  jornada: any;
  onSalvar: (vals: any) => void;
}) {
  const [entrada, setEntrada] = useState(jornada?.entrada_prevista?.slice(0, 5) ?? '08:00');
  const [saida, setSaida] = useState(jornada?.saida_prevista?.slice(0, 5) ?? '18:00');
  const [almoco, setAlmoco] = useState(String(jornada?.minutos_almoco ?? 60));
  const [tolerancia, setTolerancia] = useState(String(jornada?.tolerancia_min ?? 10));
  const [obrigatorio, setObrigatorio] = useState(jornada?.ponto_obrigatorio !== false);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
      <div className="min-w-40 flex-1 font-medium">{nome}</div>
      <div className="space-y-1">
        <Label className="text-xs">Entrada</Label>
        <Input type="time" value={entrada} onChange={(e) => setEntrada(e.target.value)} className="w-28" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Saída</Label>
        <Input type="time" value={saida} onChange={(e) => setSaida(e.target.value)} className="w-28" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Almoço (min)</Label>
        <Input type="number" value={almoco} onChange={(e) => setAlmoco(e.target.value)} className="w-24" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Tolerância (min)</Label>
        <Input type="number" value={tolerancia} onChange={(e) => setTolerancia(e.target.value)} className="w-24" />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={obrigatorio} onCheckedChange={setObrigatorio} />
        <Label className="text-xs">Ponto obrigatório</Label>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          onSalvar({
            entrada_prevista: entrada,
            saida_prevista: saida,
            minutos_almoco: Number(almoco) || 60,
            tolerancia_min: Number(tolerancia) || 0,
            ponto_obrigatorio: obrigatorio,
          })
        }
      >
        Salvar
      </Button>
    </div>
  );
}
