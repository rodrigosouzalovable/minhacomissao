import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { parseOdresCpfs } from '@/lib/odresCpfImport';

type Preview = ReturnType<typeof parseOdresCpfs>;
type Current = { nome_arquivo: string; total_esperado: number; publicado_em: string | null };

export default function OdresCpfImportCard() {
  const { toast } = useToast();
  const [current, setCurrent] = useState<Current | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const refresh = async () => {
    const { data, error } = await supabase.from('portal_odres_listas').select('nome_arquivo,total_esperado,publicado_em').eq('ativo', true).maybeSingle();
    if (error) throw error;
    setCurrent(data);
  };
  useEffect(() => { void refresh().catch(() => setMessage('Não foi possível carregar a lista vigente.')); }, []);
  const readFile = async (next: File | null) => {
    setFile(next); setPreview(null); setMessage(''); setProgress(0);
    if (!next) return;
    setBusy(true);
    try {
      const wb = XLSX.read(await next.arrayBuffer(), { type: 'array' });
      const name = wb.SheetNames.find(n => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === 'cobranca') ?? wb.SheetNames[0];
      const sheet = wb.Sheets[name];
      if (!sheet) throw new Error('Nenhuma aba encontrada.');
      const parsed = parseOdresCpfs(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }));
      setPreview(parsed);
      if (parsed.cpfs.length === 0) throw new Error('Nenhum CPF válido encontrado na primeira coluna.');
    } catch (error) {
      toast({ title: 'Planilha não aceita', description: error instanceof Error ? error.message : 'Não foi possível ler a planilha.', variant: 'destructive' });
    } finally { setBusy(false); }
  };
  const publish = async () => {
    if (!preview?.cpfs.length || !file) return;
    setBusy(true); setProgress(0); setMessage('Preparando a nova lista…');
    try {
      const { data: id, error } = await supabase.rpc('portal_odres_iniciar', { p_arquivo: file.name, p_total: preview.cpfs.length });
      if (error) throw error;
      if (!id) throw new Error('Não foi possível iniciar a importação.');
      for (let start = 0; start < preview.cpfs.length; start += 1000) {
        const { error: batchError } = await supabase.rpc('portal_odres_adicionar_lote', { p_lista: id, p_cpfs: preview.cpfs.slice(start, start + 1000) });
        if (batchError) throw batchError;
        setProgress(Math.round(Math.min(start + 1000, preview.cpfs.length) / preview.cpfs.length * 95));
      }
      setMessage('Publicando a lista validada…');
      const { data: total, error: publishError } = await supabase.rpc('portal_odres_publicar', { p_lista: id });
      if (publishError) throw publishError;
      setProgress(100); setMessage(`Lista publicada: ${total?.toLocaleString('pt-BR')} CPFs. Nenhuma dívida ou pagamento foi alterado.`);
      setPreview(null);
      await refresh();
      toast({ title: 'Lista Odres Cred atualizada', description: `${total?.toLocaleString('pt-BR')} CPFs na lista vigente.` });
    } catch (error) {
      setMessage('A publicação não foi confirmada. Confira a lista vigente antes de tentar novamente.');
      void refresh().catch(() => undefined);
      toast({ title: 'Importação não concluída', description: error instanceof Error ? error.message : String((error as { message?: string })?.message ?? 'Tente novamente.'), variant: 'destructive' });
    } finally { setBusy(false); }
  };
  return <Card className="mb-6"><CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Clientes Odres Cred — identificação no portal</CardTitle></CardHeader><CardContent className="space-y-4">
    <div className="text-sm text-muted-foreground">{current ? <><strong className="text-foreground">{current.total_esperado.toLocaleString('pt-BR')} CPFs na lista vigente</strong><p className="break-words">{current.nome_arquivo} · {current.publicado_em ? new Date(current.publicado_em).toLocaleString('pt-BR') : ''}</p></> : 'Nenhuma lista publicada.'}</div>
    <Input aria-label="Planilha de CPFs Odres Cred" type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={e => void readFile(e.target.files?.[0] ?? null)} />
    {preview && <div className="text-sm flex flex-wrap gap-x-5 gap-y-2"><span><strong>{preview.cpfs.length.toLocaleString('pt-BR')}</strong> CPFs válidos únicos</span><span>{preview.repetidos.toLocaleString('pt-BR')} repetidos</span><span>{preview.invalidos.toLocaleString('pt-BR')} inválidos</span></div>}
    <Button disabled={busy || !preview?.cpfs.length} onClick={() => setConfirm(true)}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Substituir lista Odres Cred</Button>
    {busy && <Progress value={progress} />}{message && <p className="text-sm" role="status">{message}</p>}
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Substituir a lista Odres Cred?</AlertDialogTitle><AlertDialogDescription>A lista anterior será substituída por {preview?.cpfs.length.toLocaleString('pt-BR')} CPFs válidos de {file?.name}. CPFs ausentes deixarão de ser identificados por esta lista. Dívidas, valores, acordos e pagamentos não serão alterados.{preview?.invalidos ? ` ${preview.invalidos} entradas inválidas serão ignoradas.` : ''}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => void publish()}>Confirmar substituição</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </CardContent></Card>;
}