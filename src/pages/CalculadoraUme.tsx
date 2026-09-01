import { useCallback, useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Upload,
  XCircle,
} from 'lucide-react';

interface Lote {
  id: string;
  nome_arquivo: string;
  total: number;
  processados: number;
  encontrados: number;
  nao_localizados: number;
  erros: number;
  status: string;
  erro: string | null;
  forcar: boolean;
  created_at: string;
}

interface Item {
  cpf: string;
  valor_sem_juros: number | null;
  valor_com_juros: number | null;
  nome: string | null;
  telefone: string | null;
  dias_atraso: number | null;
  fase: string | null;
  limite_total: number | null;
  status: string;
  erro: string | null;
}

const db = supabase as any;
const LOTES_PAGE_SIZE = 50;
const ITEMS_PAGE_SIZE = 1000;

function formatarMoeda(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '';
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function statusLabel(status: string) {
  if (status === 'concluido') return 'Concluído';
  if (status === 'processando') return 'Processando';
  if (status === 'pausado') return 'Pausado';
  if (status === 'cancelado') return 'Cancelado';
  return 'Pendente';
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'concluido') return 'default';
  if (status === 'processando') return 'secondary';
  if (status === 'pausado' || status === 'cancelado') return 'destructive';
  return 'outline';
}

function extrairCpf(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

export default function CalculadoraUme() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState('');
  const [cpfs, setCpfs] = useState<string[]>([]);
  const [totalLido, setTotalLido] = useState(0);
  const [invalidos, setInvalidos] = useState(0);
  const [duplicados, setDuplicados] = useState(0);
  const [forcar, setForcar] = useState(false);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loteAtivo, setLoteAtivo] = useState<Lote | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [baixando, setBaixando] = useState(false);

  const carregarLotes = useCallback(async () => {
    const { data, error } = await db
      .from('ume_lotes')
      .select('id, nome_arquivo, total, processados, encontrados, nao_localizados, erros, status, erro, forcar, created_at')
      .order('created_at', { ascending: false })
      .limit(LOTES_PAGE_SIZE);
    if (error) {
      console.error('[Calculadora UME] histórico', error);
      return;
    }
    const historico = (data ?? []) as Lote[];
    setLotes(historico);
    setLoteAtivo((atual) => {
      if (atual) return historico.find((lote) => lote.id === atual.id) ?? atual;
      return historico.find((lote) => lote.status === 'processando' || lote.status === 'pausado') ?? null;
    });
  }, []);

  const atualizarLote = useCallback(async (id: string) => {
    const { data, error } = await db
      .from('ume_lotes')
      .select('id, nome_arquivo, total, processados, encontrados, nao_localizados, erros, status, erro, forcar, created_at')
      .eq('id', id)
      .maybeSingle();
    if (!error && data) setLoteAtivo(data as Lote);
    return data as Lote | null;
  }, []);

  useEffect(() => {
    carregarLotes();
  }, [carregarLotes]);

  useEffect(() => {
    if (!loteAtivo || loteAtivo.status !== 'processando') return;
    let ativo = true;
    const atualizar = async () => {
      if (!document.hidden && ativo) {
        await atualizarLote(loteAtivo.id);
        await carregarLotes();
      }
    };
    const timer = window.setInterval(atualizar, 5000);
    const onVisibility = () => { if (!document.hidden) void atualizar(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      ativo = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loteAtivo?.id, loteAtivo?.status, atualizarLote, carregarLotes]);

  async function lerPlanilha(file: File) {
    setCarregando(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('Planilha vazia');
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as unknown[][];
      if (rows.length === 0) throw new Error('Planilha vazia');

      const primeiraLinha = rows[0] ?? [];
      const indiceComCabecalho = primeiraLinha.findIndex((valor) => /cpf|documento|cadastro/i.test(String(valor)));
      const indice = indiceComCabecalho >= 0 ? indiceComCabecalho : 0;
      const inicio = indiceComCabecalho >= 0 ? 1 : 0;
      const vistos = new Set<string>();
      const validos: string[] = [];
      let total = 0;
      let invalidosCount = 0;
      let duplicadosCount = 0;

      for (const row of rows.slice(inicio)) {
        total += 1;
        const cpf = extrairCpf(row[indice]);
        if (cpf.length !== 11) {
          invalidosCount += 1;
        } else if (vistos.has(cpf)) {
          duplicadosCount += 1;
        } else {
          vistos.add(cpf);
          validos.push(cpf);
        }
      }

      if (validos.length === 0) throw new Error('Nenhum CPF válido foi encontrado na planilha');
      if (validos.length > 50000) throw new Error('O limite é de 50.000 CPFs por lote');
      setArquivo(file.name);
      setCpfs(validos);
      setTotalLido(total);
      setInvalidos(invalidosCount);
      setDuplicados(duplicadosCount);
      toast.success(`${validos.length.toLocaleString('pt-BR')} CPFs prontos para consulta`);
    } catch (error) {
      toast.error(String((error as Error)?.message || 'Não foi possível ler a planilha'));
    } finally {
      setCarregando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function iniciarLote() {
    if (cpfs.length === 0) return;
    setCarregando(true);
    const { data, error } = await supabase.functions.invoke('ume-lote-iniciar', {
      body: { cpfs, nomeArquivo: arquivo, forcar },
    });
    setCarregando(false);
    if (error || !data?.success) {
      toast.error(data?.error || error?.message || 'Não foi possível iniciar o lote');
      return;
    }
    setCpfs([]);
    setArquivo('');
    setTotalLido(0);
    setInvalidos(0);
    setDuplicados(0);
    await carregarLotes();
    await atualizarLote(data.loteId);
    toast.success('Consulta iniciada em segundo plano');
  }

  async function retomarLote(lote: Lote) {
    const { data, error } = await supabase.functions.invoke('ume-lote-tick', { body: { loteId: lote.id } });
    if (error || data?.ok === false) {
      toast.error(data?.error || error?.message || 'Não foi possível retomar o lote');
      return;
    }
    await atualizarLote(lote.id);
    await carregarLotes();
    toast.success('Processamento retomado');
  }

  async function buscarItens(loteId: string) {
    const todos: Item[] = [];
    for (let inicio = 0; ; inicio += ITEMS_PAGE_SIZE) {
      const { data, error } = await db
        .from('ume_lote_itens')
        .select('cpf, valor_sem_juros, valor_com_juros, nome, telefone, dias_atraso, fase, limite_total, status, erro')
        .eq('lote_id', loteId)
        .order('created_at', { ascending: true })
        .range(inicio, inicio + ITEMS_PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const pagina = (data ?? []) as Item[];
      todos.push(...pagina);
      if (pagina.length < ITEMS_PAGE_SIZE) return todos;
    }
  }

  async function baixarExcel(lote: Lote) {
    setBaixando(true);
    try {
      const XLSX = await import('xlsx');
      const itens = await buscarItens(lote.id);
      const linhas = itens.map((item) => ({
        CPF: item.cpf,
        'Valor sem juros': item.valor_sem_juros == null ? '' : item.valor_sem_juros,
        Nome: item.nome ?? '',
        Telefone: item.telefone ?? '',
        'Dias de atraso': item.dias_atraso ?? '',
        Fase: item.fase ?? '',
        'Limite total': item.limite_total == null ? '' : item.limite_total,
        'Valor com juros': item.valor_com_juros == null ? '' : item.valor_com_juros,
        Situação: item.status === 'encontrado' ? 'Encontrado' : item.status === 'nao_localizado' ? 'Não localizado' : item.status === 'erro' ? `Erro: ${item.erro ?? ''}` : 'Pendente',
      }));
      const sheet = XLSX.utils.json_to_sheet(linhas);
      sheet['!cols'] = [
        { wch: 16 }, { wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 16 },
        { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 28 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Consultas UME');
      XLSX.writeFile(workbook, `calculadora-ume-${new Date(lote.created_at).toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${itens.length.toLocaleString('pt-BR')} linhas exportadas`);
    } catch (error) {
      toast.error(String((error as Error)?.message || 'Não foi possível gerar o Excel'));
    } finally {
      setBaixando(false);
    }
  }

  const percentual = loteAtivo && loteAtivo.total > 0 ? (loteAtivo.processados / loteAtivo.total) * 100 : 0;
  const podeBaixar = !!loteAtivo && loteAtivo.processados > 0;

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" /> UME / Consultas em lote
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Calculadora UME</h1>
            <p className="mt-1 text-sm text-muted-foreground">Importe CPFs, consulte os valores da UME e exporte os resultados em Excel.</p>
          </div>
          <Button variant="outline" onClick={() => void carregarLotes()} disabled={carregando}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar histórico
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Upload className="h-5 w-5" /> Nova consulta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="planilha-ume">Planilha de CPFs</Label>
                <Input
                  ref={inputRef}
                  id="planilha-ume"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void lerPlanilha(file);
                  }}
                  disabled={carregando}
                />
                <p className="text-xs text-muted-foreground">A coluna pode se chamar CPF ou ser a primeira coluna. Aceita XLSX, XLS e CSV.</p>
              </div>
              <div className="flex items-center gap-3 rounded-md border p-3">
                <Switch id="forcar-ume" checked={forcar} onCheckedChange={setForcar} />
                <Label htmlFor="forcar-ume" className="cursor-pointer text-sm">Forçar consulta nova</Label>
              </div>
            </div>

            {arquivo && (
              <div className="space-y-4 rounded-md bg-muted/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{arquivo}</p>
                    <p className="text-sm text-muted-foreground">{cpfs.length.toLocaleString('pt-BR')} CPFs únicos e válidos prontos</p>
                  </div>
                  <Button onClick={() => void iniciarLote()} disabled={carregando || cpfs.length === 0}>
                    {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Iniciar consultas
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <Stat label="Lidos" value={totalLido} />
                  <Stat label="Válidos" value={cpfs.length} tone="success" />
                  <Stat label="Inválidos" value={invalidos} tone={invalidos ? 'danger' : undefined} />
                  <Stat label="Duplicados" value={duplicados} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {loteAtivo && (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg"><Clock3 className="h-5 w-5" /> Lote em acompanhamento</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{loteAtivo.nome_arquivo} · iniciado em {formatarData(loteAtivo.created_at)}</p>
              </div>
              <Badge variant={statusVariant(loteAtivo.status)}>{loteAtivo.status === 'processando' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}{statusLabel(loteAtivo.status)}</Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span>{loteAtivo.processados.toLocaleString('pt-BR')} de {loteAtivo.total.toLocaleString('pt-BR')} processados</span><span>{Math.round(percentual)}%</span></div>
                <Progress value={percentual} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Encontrados" value={loteAtivo.encontrados} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
                <Stat label="Não localizados" value={loteAtivo.nao_localizados} icon={<XCircle className="h-4 w-4" />} />
                <Stat label="Erros" value={loteAtivo.erros} tone={loteAtivo.erros ? 'danger' : undefined} icon={<XCircle className="h-4 w-4" />} />
              </div>
              {loteAtivo.erro && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{loteAtivo.erro === 'layout_ume_mudou' ? 'A consulta foi pausada porque o layout do relatório UME mudou.' : loteAtivo.erro}</p>}
              <div className="flex flex-wrap gap-2">
                {(loteAtivo.status === 'pausado' || loteAtivo.status === 'processando') && <Button variant="outline" onClick={() => void retomarLote(loteAtivo)}><RotateCcw className="mr-2 h-4 w-4" /> Retomar</Button>}
                <Button onClick={() => void baixarExcel(loteAtivo)} disabled={!podeBaixar || baixando}>
                  {baixando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Baixar Excel parcial
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><History className="h-5 w-5" /> Histórico de lotes</CardTitle>
          </CardHeader>
          <CardContent>
            {lotes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma consulta em lote foi criada ainda.</p>
            ) : (
              <div className="space-y-3">
                {lotes.map((lote, index) => (
                  <div key={lote.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{lote.nome_arquivo}</p>
                      <p className="text-sm text-muted-foreground">{formatarData(lote.created_at)} · {lote.processados.toLocaleString('pt-BR')} / {lote.total.toLocaleString('pt-BR')} processados</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(lote.status)}>{statusLabel(lote.status)}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => setLoteAtivo(lote)}>Acompanhar</Button>
                      <Button size="icon" variant="outline" title="Baixar Excel" aria-label={`Baixar Excel de ${lote.nome_arquivo}`} onClick={() => void baixarExcel(lote)} disabled={lote.processados === 0 || baixando}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                    {index < lotes.length - 1 && <Separator className="hidden" />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function Stat({ label, value, tone, icon }: { label: string; value: number; tone?: 'success' | 'danger'; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</div>
      <p className={`mt-1 text-lg font-semibold ${tone === 'success' ? 'text-primary' : tone === 'danger' ? 'text-destructive' : ''}`}>{value.toLocaleString('pt-BR')}</p>
    </div>
  );
}
