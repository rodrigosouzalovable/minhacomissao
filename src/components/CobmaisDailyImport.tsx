import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Clock3, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
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
type Phase = 'idle' | 'uploading' | 'processing' | 'ready' | 'publishing' | 'done' | 'error';
type Result = { inseridos: number; atualizados: number; pagos: number; ausentes_baixados: number };
type ImportRun = {
  id: string; nome_arquivo: string; status: string; fase: string | null; progresso: number | null;
  total_linhas: number; total_parcelas: number; linhas_repetidas: number; conflitos: number;
  registros_processados: number; inseridos: number; atualizados: number; pagos: number;
  ausentes_baixados: number; iniciado_em: string; concluido_em: string | null; erro_mensagem: string | null;
};

export default function CobmaisDailyImport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const runRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [displayFileName, setDisplayFileName] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [progress, setProgress] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [eta, setEta] = useState('calculando…');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<ImportRun[]>([]);

  const applyRun = useCallback((run: ImportRun) => {
    runRef.current = run.id;
    setDisplayFileName(run.nome_arquivo);
    setProcessed(Number(run.registros_processados ?? 0));
    setProgress(Number(run.progresso ?? 0));
    if (run.total_parcelas > 0) setSummary({
      totalRows: run.total_linhas, totalParcels: run.total_parcelas,
      repeated: run.linhas_repetidas, conflicts: run.conflitos,
      invalid: Math.max(0, run.total_linhas - run.total_parcelas - run.linhas_repetidas),
    });
    if (run.status === 'concluido') {
      setPhase('done'); setProgress(100); setEta('concluído');
      setMessage('Portal atualizado com sucesso.');
      setResult({ inseridos: run.inseridos, atualizados: run.atualizados, pagos: run.pagos, ausentes_baixados: run.ausentes_baixados });
    } else if (run.status === 'erro') {
      setPhase('error'); setMessage(run.erro_mensagem || 'A importação foi interrompida.');
    } else if (run.status === 'publicando' || run.fase === 'publicando') {
      setPhase('publishing'); setMessage('Atualizando a carteira do portal no servidor…'); setEta('processando no servidor');
    } else if (run.fase === 'pronta' || (run.total_parcelas > 0 && run.registros_processados >= run.total_parcelas)) {
      setPhase('ready'); setProgress(100); setEta('validação concluída');
      setMessage('Validação concluída — portal ainda não atualizado.');
    } else {
      setPhase('processing');
      setMessage(run.fase === 'gravando' ? 'Gravando as parcelas validadas no servidor…' : 'Validando a planilha no servidor…');
      setEta('processando no servidor');
    }
  }, []);

  const refreshRuns = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any).from('cobmais_importacoes_diarias')
      .select('id,nome_arquivo,status,fase,progresso,total_linhas,total_parcelas,linhas_repetidas,conflitos,registros_processados,inseridos,atualizados,pagos,ausentes_baixados,iniciado_em,concluido_em,erro_mensagem')
      .eq('importado_por', user.id).order('iniciado_em', { ascending: false }).limit(5);
    const runs = (data ?? []) as ImportRun[];
    setHistory(runs);
    if (runs[0]) applyRun(runs[0]);
  }, [applyRun, user]);

  useEffect(() => {
    void refreshRuns();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && ['processing', 'publishing'].includes(phase)) void refreshRuns();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [phase, refreshRuns]);

  const fail = async (error: string) => {
    setPhase('error');
    setMessage(error);
    if (runRef.current) await (supabase as any).from('cobmais_importacoes_diarias').update({ status: 'erro', erro_mensagem: error, concluido_em: new Date().toISOString() }).eq('id', runRef.current);
  };

  const selectFile = async (selected: File | null) => {
    if (!selected || !user) return;
    setFile(selected);
    setDisplayFileName(selected.name);
    setSummary(null);
    setResult(null);
    setMessage('Enviando o arquivo para processamento seguro…');
    setPhase('uploading');
    setProgress(1);
    setProcessed(0);

    const path = `${user.id}/${crypto.randomUUID()}-${selected.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage.from('cobmais-importacoes').upload(path, selected, { upsert: false, contentType: selected.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    if (uploadError) { await fail(uploadError.message); return; }
    setProgress(10);
    const { data: run, error } = await (supabase as any).from('cobmais_importacoes_diarias').insert({
      nome_arquivo: selected.name,
      tamanho_bytes: selected.size,
      importado_por: user.id,
      status: 'validando',
      fase: 'arquivo_recebido', progresso: 10, storage_path: path,
    }).select('id').single();
    if (error || !run) {
      await supabase.storage.from('cobmais-importacoes').remove([path]);
      await fail(error?.message || 'Não foi possível iniciar a validação.');
      return;
    }
    runRef.current = run.id;
    const { data, error: invokeError } = await supabase.functions.invoke('cobmais-importacao-processar', { body: { runId: run.id, action: 'process' } });
    if (invokeError || data?.message) { await fail(data?.message || invokeError?.message || 'Não foi possível iniciar o processamento.'); return; }
    setPhase('processing'); setProgress(10); setEta('processando no servidor');
    setMessage('Arquivo recebido. A validação continuará mesmo se você sair desta página.');
    await refreshRuns();
  };

  const publish = async () => {
    if (!runRef.current || !summary) return;
    setPhase('publishing');
    setProgress(100);
    setEta('processando no servidor');
    setMessage('Atualizando vencimentos e pagamentos no servidor…');
    const { data, error } = await supabase.functions.invoke('cobmais-importacao-processar', { body: { runId: runRef.current, action: 'publish' } });
    if (error || data?.message) {
      await fail(data?.message || error?.message || 'Não foi possível iniciar a publicação.');
      return;
    }
    toast({ title: 'Atualização iniciada', description: 'O processo continuará no servidor mesmo se você sair desta página.' });
    await refreshRuns();
  };

  const busy = ['uploading', 'processing', 'publishing'].includes(phase);

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
                {phase === 'ready' ? ' · validação concluída' : phase === 'publishing' ? ' · publicação em andamento' : ` · ${eta}`}
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
        {history.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <p className="flex items-center gap-2 text-sm font-medium"><Clock3 className="h-4 w-4" />Últimas importações</p>
            {history.map((run) => (
              <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="truncate">{run.nome_arquivo}</span>
                <Badge variant={run.status === 'concluido' ? 'default' : run.status === 'erro' ? 'destructive' : 'secondary'}>
                  {run.status === 'concluido' ? 'Portal atualizado' : run.fase === 'pronta' ? 'Validada — aguardando publicação' : run.status === 'erro' ? 'Erro' : 'Em processamento'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}