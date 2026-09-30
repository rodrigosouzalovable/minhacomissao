import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type Summary = { totalRows: number; totalParcels: number; repeated: number; conflicts: number; invalid: number };
type Phase = 'idle' | 'parsing' | 'uploading' | 'ready' | 'publishing' | 'done' | 'error';
type Result = { inseridos: number; atualizados: number; pagos: number; ausentes_baixados: number };

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'calculando…';
  if (seconds < 60) return `${Math.ceil(seconds)} s`;
  const minutes = Math.ceil(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

export default function CobmaisDailyImport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const workerRef = useRef<Worker | null>(null);
  const runRef = useRef<string | null>(null);
  const startedRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [displayFileName, setDisplayFileName] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [progress, setProgress] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [eta, setEta] = useState('calculando…');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const restoreLatestImport = async () => {
      const { data: run } = await (supabase as any)
        .from('cobmais_importacoes_diarias')
        .select('id,nome_arquivo,status,total_linhas,total_parcelas,linhas_repetidas,conflitos,iniciado_em')
        .eq('importado_por', user.id)
        .in('status', ['validando', 'enviando', 'publicando'])
        .order('iniciado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active || !run) return;

      runRef.current = run.id;
      setDisplayFileName(run.nome_arquivo);
      if (run.status === 'publicando') {
        setPhase('publishing');
        setProgress(50);
        setMessage('Atualizando a carteira do portal…');
        setEta('aguarde a conclusão');
        return;
      }

      const { count } = await (supabase as any)
        .from('cobmais_importacao_stage')
        .select('source_key', { count: 'exact', head: true })
        .eq('run_id', run.id);
      if (!active) return;
      const received = Number(count ?? 0);
      const total = Number(run.total_parcelas ?? 0);
      if (total > 0 && received === total) {
        setSummary({
          totalRows: Number(run.total_linhas),
          totalParcels: total,
          repeated: Number(run.linhas_repetidas),
          conflicts: Number(run.conflitos),
          invalid: Math.max(0, Number(run.total_linhas) - total - Number(run.linhas_repetidas)),
        });
        setProcessed(received);
        setProgress(100);
        setEta('validação concluída');
        setMessage('Validação concluída. Confira os totais antes de atualizar o portal.');
        setPhase('ready');
        return;
      }

      if (received > 0) {
        const uploadProgress = total > 0 ? 35 + Math.round((received / total) * 55) : 35;
        setProcessed(received);
        setProgress(Math.min(89, uploadProgress));
        setEta('interrompida');
        setMessage('A tentativa anterior foi interrompida. Selecione o mesmo arquivo para reiniciar com segurança.');
        setPhase('error');
      }
    };

    void restoreLatestImport();
    return () => { active = false; };
  }, [user]);

  const updateEta = (done: number, total: number) => {
    const elapsed = (Date.now() - startedRef.current) / 1000;
    setEta(formatDuration(done > 0 ? (elapsed / done) * Math.max(0, total - done) : 0));
  };

  const fail = async (error: string) => {
    setPhase('error');
    setMessage(error);
    if (runRef.current) await (supabase as any).from('cobmais_importacoes_diarias').update({ status: 'erro', erro_mensagem: error, concluido_em: new Date().toISOString() }).eq('id', runRef.current);
  };

  const selectFile = async (selected: File | null) => {
    if (!selected || !user) return;
    workerRef.current?.terminate();

    const previousRunId = runRef.current;
    if (previousRunId) {
      await (supabase as any).from('cobmais_importacao_stage').delete().eq('run_id', previousRunId);
      await (supabase as any).from('cobmais_importacoes_diarias').update({
        status: 'erro',
        erro_mensagem: 'Tentativa substituída por uma nova seleção do arquivo.',
        concluido_em: new Date().toISOString(),
      }).eq('id', previousRunId).neq('status', 'concluido');
      runRef.current = null;
    }

    setFile(selected);
    setDisplayFileName(selected.name);
    setSummary(null);
    setResult(null);
    setMessage('Lendo e validando 530 mil linhas sem travar a tela…');
    setPhase('parsing');
    setProgress(1);
    setProcessed(0);
    startedRef.current = Date.now();

    const { data: run, error } = await (supabase as any).from('cobmais_importacoes_diarias').insert({
      nome_arquivo: selected.name,
      tamanho_bytes: selected.size,
      importado_por: user.id,
      status: 'validando',
    }).select('id').single();
    if (error || !run) {
      await fail(error?.message || 'Não foi possível iniciar a validação.');
      return;
    }
    runRef.current = run.id;

    const worker = new Worker(new URL('../workers/cobmaisDailyWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = async (event) => {
      const payload = event.data;
      if (payload.type === 'parsing') {
        const value = Math.max(1, Math.round((payload.current / payload.total) * 35));
        setProgress(value);
        setProcessed(payload.current);
        updateEta(value, 100);
        return;
      }
      if (payload.type === 'summary') {
        const next: Summary = payload;
        setSummary(next);
        setPhase('uploading');
        setMessage('Enviando as parcelas validadas para uma área temporária segura…');
        await (supabase as any).from('cobmais_importacoes_diarias').update({
          status: 'enviando', total_linhas: next.totalRows, total_parcelas: next.totalParcels,
          linhas_repetidas: next.repeated, conflitos: next.conflicts,
        }).eq('id', run.id);
        return;
      }
      if (payload.type === 'batch') {
        const rows = payload.rows.map((row: Record<string, unknown>) => ({ ...row, run_id: run.id }));
        const { error: batchError } = await (supabase as any).from('cobmais_importacao_stage').insert(rows);
        if (batchError) {
          worker.terminate();
          await fail(batchError.message);
          return;
        }
        const done = Math.min((payload.index + 1) * 500, payload.total * 500);
        const value = 35 + Math.round(((payload.index + 1) / payload.total) * 55);
        setProcessed(done);
        setProgress(value);
        updateEta(value, 100);
        if ((payload.index + 1) % 50 === 0 || payload.index + 1 === payload.total) {
          await (supabase as any).from('cobmais_importacoes_diarias').update({ registros_processados: done }).eq('id', run.id);
        }
        worker.postMessage({ type: 'ack' });
        return;
      }
      if (payload.type === 'complete') {
        setPhase('ready');
        setProgress(100);
        setProcessed(summary?.totalParcels ?? payload.totalParcels ?? 0);
        setEta('validação concluída');
        setMessage('Validação concluída. Confira os totais antes de atualizar o portal.');
        worker.terminate();
        return;
      }
      if (payload.type === 'error') {
        worker.terminate();
        await fail(payload.message);
      }
    };
    worker.onerror = () => void fail('A leitura da planilha foi interrompida. Tente novamente.');
    worker.postMessage({ buffer: await selected.arrayBuffer() });
  };

  const publish = async () => {
    if (!runRef.current || !summary) return;
    setPhase('publishing');
    setProgress(50);
    setEta('aguarde a conclusão');
    setMessage('Atualizando vencimentos e pagamentos e trocando a carteira do portal…');
    const { data, error } = await (supabase as any).rpc('publicar_importacao_cobmais_diaria', { p_run_id: runRef.current });
    if (error) {
      await fail(error.message);
      return;
    }
    setResult(data as Result);
    setPhase('done');
    setProgress(100);
    setEta('concluído');
    setMessage('Carteira atualizada. As linhas temporárias e o arquivo anterior não ficaram armazenados.');
    toast({ title: 'Portal atualizado', description: `${summary.totalParcels.toLocaleString('pt-BR')} parcelas processadas com segurança.` });
  };

  const busy = ['parsing', 'uploading', 'publishing'].includes(phase);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Atualização diária Cobmais</CardTitle>
        <CardDescription>Importe a exportação completa. A carteira atual só é substituída depois da validação integral.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Input type="file" accept=".xlsx" disabled={busy} onChange={(event) => void selectFile(event.target.files?.[0] ?? null)} />

        {phase !== 'idle' && (
          <div className="space-y-2" aria-live="polite">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="flex items-center gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{message}</span>
              <strong>{progress}%</strong>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>{file?.name ?? displayFileName}</span>
              <span>
                {processed.toLocaleString('pt-BR')} registros
                {phase === 'ready' ? ' · validação concluída' : phase === 'publishing' ? ' · publicação em andamento' : ` · estimativa restante: ${eta}`}
              </span>
            </div>
          </div>
        )}

        {summary && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ['Linhas', summary.totalRows], ['Parcelas únicas', summary.totalParcels], ['Repetidas', summary.repeated],
              ['Conflitos resolvidos', summary.conflicts], ['Inválidas', summary.invalid],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold">{Number(value).toLocaleString('pt-BR')}</p></div>
            ))}
          </div>
        )}

        {summary && summary.conflicts > 0 && (
          <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Linhas repetidas tratadas</AlertTitle><AlertDescription>Para cada CPF/CNPJ + credor + contrato + parcela, prevaleceu a última linha válida da planilha.</AlertDescription></Alert>
        )}
        {phase === 'error' && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Importação interrompida</AlertTitle><AlertDescription>{message} A carteira atual não foi substituída.</AlertDescription></Alert>}
        {phase === 'ready' && (
          <div className="space-y-2">
            <Button size="lg" onClick={() => void publish()}><Upload className="mr-2 h-4 w-4" />Atualizar portal com esta planilha</Button>
            <p className="text-sm text-muted-foreground">A carteira atual ainda não foi alterada. A publicação começa somente após clicar neste botão.</p>
          </div>
        )}
        {phase === 'done' && result && (
          <Alert><Check className="h-4 w-4" /><AlertTitle>Atualização concluída</AlertTitle><AlertDescription>
            {result.inseridos.toLocaleString('pt-BR')} novas, {result.atualizados.toLocaleString('pt-BR')} atualizadas, {result.pagos.toLocaleString('pt-BR')} pagas e {result.ausentes_baixados.toLocaleString('pt-BR')} ausentes baixadas.
          </AlertDescription></Alert>
        )}
        {phase === 'ready' && <Badge variant="secondary">Nenhuma alteração foi publicada ainda</Badge>}
      </CardContent>
    </Card>
  );
}