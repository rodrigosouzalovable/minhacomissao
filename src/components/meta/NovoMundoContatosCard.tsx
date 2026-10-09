import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Upload, RefreshCw, Pause, Play, Loader2, AlertTriangle } from 'lucide-react';
import { conferirContatosNovoMundo, NOVO_MUNDO_MAX, NOVO_MUNDO_AVISO } from '@/lib/novoMundoContatos';
import { toast } from 'sonner';

type Resumo = { disponiveis: number; reservados: number; aceitos: number; entregues: number; respondidos: number; falhas: number; bloqueados: number; descartados: number; ativo: boolean; custo_hoje: number; teto: number; ultimo_lote?: { arquivo: string; adicionados: number } };
type Conferencia = { total: number; adicionados: number; bloqueados: number; ja_utilizados: number; ja_pendentes: number; invalidos: number; duplicados: number };
type Previa = ReturnType<typeof conferirContatosNovoMundo> & { arquivo: string; resumo: Conferencia };

export function NovoMundoContatosCard() {
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [lendo, setLendo] = useState(false);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [consentimento, setConsentimento] = useState(false);
  const [confirmarAtivacao, setConfirmarAtivacao] = useState(false);
  const query = useQuery({ queryKey: ['nm-contatos-resumo'], staleTime: 300_000, refetchOnWindowFocus: false, queryFn: async () => {
    const { data, error } = await supabase.rpc('resumo_base_novo_mundo');
    if (error) throw error;
    return data as unknown as Resumo;
  } });
  const resumo = query.data;
  const saldo = resumo?.disponiveis ?? 0;
  const livre = Math.max(0, NOVO_MUNDO_MAX - saldo - (resumo?.reservados ?? 0));

  const ler = async (file?: File) => {
    if (!file) return;
    setLendo(true); setConsentimento(false);
    try {
      if (!/\.(xlsx|xls)$/i.test(file.name) || file.size > 10 * 1024 * 1024) throw new Error('Selecione um Excel de até 10 MB com no máximo 5.000 contatos.');
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', sheetRows: 5003 });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('Planilha vazia.');
      const checked = conferirContatosNovoMundo(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' }));
      if (checked.conflitos.length) throw new Error(`${checked.conflitos.length} telefones repetidos com variáveis diferentes. Revise o arquivo.`);
      if (!checked.contatos.length) throw new Error('Nenhum contato válido no arquivo.');
      const { data, error } = await supabase.rpc('importar_contatos_novo_mundo', { p_arquivo: file.name, p_rows: checked.contatos, p_resumo: { total: checked.total, invalidos: checked.invalidos, duplicados: checked.duplicados }, p_autorizado: true, p_simulacao: true });
      if (error) throw error;
      setPrevia({ ...checked, arquivo: file.name, resumo: data as unknown as Conferencia });
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível conferir o arquivo.'); }
    finally { setLendo(false); if (input.current) input.current.value = ''; }
  };
  const importar = useMutation({ mutationFn: async () => {
    if (!previa || !consentimento) throw new Error('Confirme a autorização WhatsApp dos contatos.');
    const { data, error } = await supabase.rpc('importar_contatos_novo_mundo', { p_arquivo: previa.arquivo, p_rows: previa.contatos, p_resumo: { total: previa.total, invalidos: previa.invalidos, duplicados: previa.duplicados }, p_autorizado: consentimento, p_simulacao: false });
    if (error) throw error;
    return data as unknown as Conferencia;
  }, onSuccess: (data) => { setPrevia(null); setConsentimento(false); qc.invalidateQueries({ queryKey: ['nm-contatos-resumo'] }); toast.success(`${data.adicionados} novos contatos adicionados. A configuração de envio foi preservada.`); }, onError: (e) => toast.error(e.message) });
  const ativar = useMutation({ mutationFn: async (ativo: boolean) => {
    const { error } = await supabase.rpc('ativar_base_novo_mundo', { p_ativo: ativo });
    if (error) throw error;
  }, onSuccess: (_, ativo) => { setConfirmarAtivacao(false); qc.invalidateQueries({ queryKey: ['nm-contatos-resumo'] }); toast.success(ativo ? 'Base ativada para os próximos ciclos automáticos.' : 'Base pausada.'); }, onError: (e) => toast.error(e.message) });

  return <section className="space-y-4 border-b pb-5" aria-label="Contatos Novo Mundo">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-base font-semibold">Contatos Novo Mundo</h3><div className="mt-1 flex gap-2"><Badge variant={resumo?.ativo ? 'default' : 'secondary'}>{resumo?.ativo ? 'Ativo' : 'Pausado'}</Badge><Badge variant="outline">Caixa PADRÃO</Badge></div></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="icon" title="Atualizar saldo" aria-label="Atualizar saldo Novo Mundo" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} /></Button>
        <Button variant="outline" onClick={() => input.current?.click()} disabled={lendo || importar.isPending}>{lendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Importar Excel</Button>
        <Button variant={resumo?.ativo ? 'outline' : 'default'} disabled={ativar.isPending || !resumo || (!resumo.ativo && saldo === 0)} onClick={() => resumo?.ativo ? ativar.mutate(false) : setConfirmarAtivacao(true)}>{resumo?.ativo ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}{resumo?.ativo ? 'Pausar base' : 'Ativar base'}</Button>
      </div>
      <input ref={input} type="file" accept=".xlsx,.xls" className="hidden" aria-label="Excel contatos Novo Mundo" onChange={e => ler(e.target.files?.[0])} />
    </div>
    {query.isError ? <div className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />Não foi possível atualizar o saldo. <Button variant="link" onClick={() => query.refetch()}>Tentar novamente</Button></div> : <>
      <div className="grid gap-3 sm:grid-cols-4">
        <div><div className="text-sm text-muted-foreground">Disponíveis</div><div className="text-3xl font-semibold">{query.isLoading ? '—' : saldo.toLocaleString('pt-BR')}</div></div>
        <div><div className="text-sm text-muted-foreground">Aceitos pela Meta</div><div className="text-xl font-semibold">{resumo?.aceitos ?? 0}</div></div>
        <div><div className="text-sm text-muted-foreground">Entregues / respostas</div><div className="text-xl font-semibold">{resumo?.entregues ?? 0} / {resumo?.respondidos ?? 0}</div></div>
        <div><div className="text-sm text-muted-foreground">Falhas / bloqueados</div><div className="text-xl font-semibold">{resumo?.falhas ?? 0} / {resumo?.bloqueados ?? 0}</div></div>
      </div>
      <Progress value={(saldo + (resumo?.reservados ?? 0)) / NOVO_MUNDO_MAX * 100} />
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>Capacidade livre: {livre.toLocaleString('pt-BR')} · Reservados: {resumo?.reservados ?? 0}</span><span>Recuperação hoje: R$ {Number(resumo?.custo_hoje ?? 0).toFixed(2)} / R$ {Number(resumo?.teto ?? 20.30).toFixed(2)} compartilhados</span></div>
      {resumo && saldo <= NOVO_MUNDO_AVISO && <p className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />{saldo === 0 ? 'Estoque esgotado. A base não enviará até receber contatos novos.' : 'Estoque baixo. Importe contatos novos antes de esgotar.'}</p>}
      {resumo?.ultimo_lote && <p className="text-xs text-muted-foreground break-all">Último lote: {resumo.ultimo_lote.arquivo} · {resumo.ultimo_lote.adicionados} adicionados · Descartados no total: {resumo.descartados}</p>}
    </>}
    <Dialog open={!!previa} onOpenChange={open => { if (!open && !importar.isPending) setPrevia(null); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Conferir contatos Novo Mundo</DialogTitle><DialogDescription>{previa?.arquivo} · {previa?.total} linhas · Template fins_de_atualizacao_cadastral</DialogDescription></DialogHeader>
        {previa && <>
          <div className="grid grid-cols-2 gap-2 text-sm"><span>Novos: <strong>{previa.resumo.adicionados}</strong></span><span>Inválidos: {previa.resumo.invalidos}</span><span>Duplicados no arquivo: {previa.resumo.duplicados}</span><span>Já pendentes: {previa.resumo.ja_pendentes}</span><span>Já utilizados: {previa.resumo.ja_utilizados}</span><span>Blacklist: {previa.resumo.bloqueados}</span></div>
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b text-left"><th className="p-2">A · Telefone</th><th className="p-2">B · Variável 1</th><th className="p-2">C · Variável 2</th></tr></thead><tbody>{previa.contatos.slice(0, 5).map(c => <tr key={c.telefone} className="border-b"><td className="p-2">{c.telefone}</td><td className="p-2 break-words">{c.var1}</td><td className="p-2 break-words">{c.var2}</td></tr>)}</tbody></table></div>
          <label className="flex items-start gap-2 text-sm"><Checkbox checked={consentimento} onCheckedChange={v => setConsentimento(v === true)} disabled={importar.isPending} /><span>Confirmo que estes contatos autorizaram receber mensagens pelo WhatsApp.</span></label>
        </>}
        <DialogFooter><Button variant="outline" disabled={importar.isPending} onClick={() => setPrevia(null)}>Cancelar</Button><Button disabled={!consentimento || importar.isPending || !previa?.resumo.adicionados} onClick={() => importar.mutate()}>{importar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar importação</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={confirmarAtivacao} onOpenChange={setConfirmarAtivacao}><DialogContent><DialogHeader><DialogTitle>Ativar base Novo Mundo?</DialogTitle><DialogDescription>Os próximos ciclos usarão esta base, sem alternar para Google Maps enquanto estiver ativa. Envios das 08h às 19h, exceto domingos, até 20 por número/dia e dentro do teto compartilhado de R$ {Number(resumo?.teto ?? 20.30).toFixed(2)}. Apenas números RED/YELLOW elegíveis e template Utility aprovado; recuperação para GREEN não é garantida.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirmarAtivacao(false)}>Cancelar</Button><Button onClick={() => ativar.mutate(true)} disabled={ativar.isPending}>Confirmar ativação</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}