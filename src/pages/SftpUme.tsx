import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { CheckCircle2, Download, FolderOpen, Loader2, RefreshCw, Upload } from 'lucide-react';
import { lerArquivoSftp } from '@/lib/umeSftpCsv';
import { exportarParaExcel } from '@/lib/exportExcel';

type ArquivoRemoto = { nome: string; caminho: string; tamanho: number; modificado: number };
type Importado = {
  id: string; nome_arquivo: string; origem: string; data_lote: string | null; total_linhas: number;
  total_baixas: number; casadas: number; aplicadas: number; status: string; criado_em: string;
};

const fmtData = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—');
const fmtTam = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

async function assinatura(texto: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function SftpUme() {
  const [pastas, setPastas] = useState<Record<string, ArquivoRemoto[]> | null>(null);
  const [erroConexao, setErroConexao] = useState('');
  const [listando, setListando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Importado[]>([]);

  const carregarHistorico = useCallback(async () => {
    const { data } = await supabase.from('sftp_ume_arquivos').select('*').order('criado_em', { ascending: false }).limit(30);
    setHistorico((data as Importado[]) ?? []);
  }, []);

  const listar = useCallback(async () => {
    setListando(true); setErroConexao('');
    const { data, error } = await supabase.functions.invoke('sftp-ume', { body: { acao: 'listar' } });
    setListando(false);
    if (error || data?.error) { setErroConexao(data?.error || 'Não foi possível conectar ao SFTP.'); return; }
    setPastas(data.pastas);
  }, []);

  const [chaveEm, setChaveEm] = useState<string | null>(null);
  const carregarChave = useCallback(async () => {
    const { data } = await supabase.rpc('sftp_ume_chave_status');
    setChaveEm((data as string | null) ?? null);
  }, []);
  useEffect(() => { carregarHistorico(); carregarChave(); }, [carregarHistorico, carregarChave]);

  const enviarChave = async (f: File | undefined) => {
    if (!f) return;
    const { error } = await supabase.rpc('sftp_ume_salvar_chave', { p_chave: await f.text() });
    if (error) { toast.error(error.message); return; }
    toast.success('Chave de acesso salva.');
    carregarChave();
  };

  const processar = async (nome: string, texto: string, origem: string) => {
    const lido = lerArquivoSftp(texto);
    if (!lido.dataLote) throw new Error('Arquivo fora do layout UME (sem cabeçalho 00).');
    const { error } = await supabase.rpc('sftp_ume_registrar', {
      p_nome: nome, p_origem: origem, p_data_lote: lido.dataLote, p_assinatura: await assinatura(texto),
      p_total_linhas: lido.totalLinhas, p_baixas: lido.baixas as never,
    });
    if (error) throw new Error(error.message);
    toast.success(`${nome}: ${lido.baixas.length} baixas lidas de ${lido.totalLinhas.toLocaleString('pt-BR')} linhas.`);
    await carregarHistorico();
  };

  const importarRemoto = async (a: ArquivoRemoto) => {
    setOcupado(a.caminho);
    try {
      const { data: s } = await supabase.auth.getSession();
      const r = await fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/sftp-ume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ acao: 'baixar', caminho: a.caminho }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Falha ao baixar do SFTP.');
      const texto = new TextDecoder('latin1').decode(await r.arrayBuffer());
      await processar(a.nome, texto, 'sftp');
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    setOcupado(null);
  };

  const importarLocal = async (f: File | undefined) => {
    if (!f) return;
    setOcupado('upload');
    try { await processar(f.name, new TextDecoder('latin1').decode(await f.arrayBuffer()), 'upload'); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    setOcupado(null);
  };

  const aplicar = async (h: Importado) => {
    if (!confirm(`Marcar como pagas ${h.casadas} parcelas encontradas em "${h.nome_arquivo}"?`)) return;
    setOcupado(h.id);
    const { data, error } = await supabase.rpc('sftp_ume_aplicar', { p_arquivo: h.id });
    setOcupado(null);
    if (error) toast.error(error.message); else toast.success(`${data} parcelas marcadas como pagas.`);
    carregarHistorico();
  };

  const exportar = async (h: Importado) => {
    const { data } = await supabase.from('sftp_ume_baixas').select('*').eq('arquivo_id', h.id).limit(10000);
    const rot: Record<string, string> = { casado: 'Pronta para baixa', aplicado: 'Baixada', ja_pago: 'Já estava paga', sem_acordo: 'Sem acordo no sistema' };
    const linhas: Record<string, unknown>[] = (data ?? []).map((b: any) => ({
      Tipo: b.tipo === '08' ? 'Pagamento' : 'Baixa de acordo', CPF: b.cpf, Contrato: b.contrato, Parcela: b.parcela_ref,
      Vencimento: fmtData(b.vencimento), Valor: b.valor, 'Data pagamento': fmtData(b.data_pagamento),
      'Valor pago': b.valor_pago, Situação: rot[b.status] ?? b.status,
    }));
    const cols = Object.keys(linhas[0] ?? { Tipo: '' }).map((k) => ({ chave: k, titulo: k }));
    await exportarParaExcel(linhas, cols, `auditoria_${h.nome_arquivo.replace(/\.csv$/i, '')}`);
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">SFTP UME / Odres</h1>
          <p className="text-sm text-muted-foreground">Arquivos enviados pela UME com clientes e baixas de pagamento.</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Servidor SFTP</CardTitle>
              <CardDescription>35.227.83.18 · ribeiro_usr</CardDescription>
            </div>
            <Button onClick={listar} disabled={listando}>
              {listando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Conectar e listar arquivos
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
              <span className="font-medium">Arquivo de chave (.pem):</span>
              <span className="text-muted-foreground">{chaveEm ? `cadastrada em ${new Date(chaveEm).toLocaleString('pt-BR')}` : 'não cadastrada'}</span>
              <Input className="max-w-xs" type="file" accept=".pem,.key,.txt" onChange={(e) => { enviarChave(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            {erroConexao && <p className="text-sm text-destructive">{erroConexao}</p>}
            {!pastas && !erroConexao && <p className="text-sm text-muted-foreground">Clique em conectar para ver os arquivos do servidor.</p>}
            {pastas && Object.entries(pastas).map(([pasta, itens]) => (
              <div key={pasta}>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium"><FolderOpen className="h-4 w-4" />{pasta} <Badge variant="secondary">{itens.length}</Badge></p>
                <div className="divide-y rounded-md border">
                  {itens.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhum arquivo.</p>}
                  {itens.slice(0, 10).map((a) => {
                    const ja = historico.some((h) => h.nome_arquivo === a.nome);
                    return (
                      <div key={a.caminho} className="flex items-center justify-between gap-2 p-2 text-sm">
                        <span className="truncate">{a.nome}</span>
                        <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
                          {new Date(a.modificado).toLocaleString('pt-BR')} · {fmtTam(a.tamanho)}
                          {ja ? <Badge variant="outline">Importado</Badge> : (
                            <Button size="sm" variant="outline" disabled={!!ocupado} onClick={() => importarRemoto(a)}>
                              {ocupado === a.caminho ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Importar'}
                            </Button>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Importar arquivo do computador</CardTitle>
            <CardDescription>Use quando já tiver baixado o .csv da UME.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Input type="file" accept=".csv,.txt" disabled={!!ocupado} onChange={(e) => { importarLocal(e.target.files?.[0]); e.target.value = ''; }} />
            {ocupado === 'upload' && <Loader2 className="h-4 w-4 animate-spin" />}
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Arquivos importados</CardTitle>
            <CardDescription>Revise as parcelas encontradas e confirme a baixa.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {historico.length === 0 && <p className="text-sm text-muted-foreground">Nenhum arquivo importado ainda.</p>}
            {historico.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{h.nome_arquivo}</p>
                  <p className="text-muted-foreground">
                    Lote {fmtData(h.data_lote)} · {h.total_linhas.toLocaleString('pt-BR')} linhas · {h.total_baixas} baixas no arquivo
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{h.casadas} prontas</Badge>
                  <Badge variant="outline"><CheckCircle2 className="mr-1 h-3 w-3" />{h.aplicadas} baixadas</Badge>
                  <Button size="sm" variant="outline" onClick={() => exportar(h)}><Download className="mr-1 h-4 w-4" />Excel</Button>
                  <Button size="sm" disabled={h.casadas === 0 || !!ocupado} onClick={() => aplicar(h)}>
                    {ocupado === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Dar baixa'}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
