import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, Download, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { textoProposta, MODELOS_PADRAO, type CredorProposta } from '@/lib/propostaSftp';

const db = supabase as any;
const LOTE = 150;
const CHAVE_MODELOS = 'proposta-sftp-modelos-v1';

interface Resultado { total: number; preenchidos: number; semDivida: number; amostra: string }

export function PropostaSftpTab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [pronto, setPronto] = useState<{ wb: any; nome: string; XLSX: any } | null>(null);
  const [credor, setCredor] = useState<CredorProposta>('odres');
  const [modelos, setModelos] = useState<Record<CredorProposta, string>>(() => {
    try { return { ...MODELOS_PADRAO, ...JSON.parse(localStorage.getItem(CHAVE_MODELOS) || '{}') }; }
    catch { return MODELOS_PADRAO; }
  });
  useEffect(() => { localStorage.setItem(CHAVE_MODELOS, JSON.stringify(modelos)); }, [modelos]);


  async function processar(file: File) {
    setProcessando(true); setRes(null); setPronto(null);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, defval: '' });
      if (rows.length < 2) throw new Error('Planilha vazia');
      const head = rows[0].map((h: any) => String(h).trim().toUpperCase());
      const iCpf = head.findIndex((h: string) => h.includes('CPF'));
      const iVar = head.findIndex((h: string) => h.replace(/\s/g, '') === '{{2}}');
      const iCred = head.findIndex((h: string) => h.includes('CREDOR'));
      if (iCpf < 0 || iVar < 0) throw new Error('A planilha precisa das colunas CPF e {{2}}');

      const cpfDe = (v: any) => String(v ?? '').replace(/\D/g, '').padStart(11, '0');
      const cpfs = [...new Set(rows.slice(1).map((r) => cpfDe(r[iCpf])).filter((c) => c !== '00000000000'))];

      // Soma o principal em aberto do último lote do SFTP por CPF (lotes pequenos para não estourar a URL).
      const porCpf = new Map<string, { lote: string; soma: number }>();
      for (let i = 0; i < cpfs.length; i += LOTE) {
        // O servidor devolve no máximo 1.000 linhas por consulta: paginar até acabar.
        const data: any[] = [];
        for (let de = 0; ; de += 1000) {
          const { data: pg, error } = await db.from('ume_carteira_parcelas')
            .select('cpf, valor, data_lote, installment_id').in('cpf', cpfs.slice(i, i + LOTE))
            .order('installment_id').range(de, de + 999);
          if (error) throw error;
          data.push(...(pg ?? []));
          if (!pg || pg.length < 1000) break;
        }
        for (const p of data) {
          const at = porCpf.get(p.cpf);
          const v = Number(p.valor) || 0;
          if (!at || p.data_lote > at.lote) porCpf.set(p.cpf, { lote: p.data_lote, soma: v });
          else if (p.data_lote === at.lote) at.soma += v;
        }
      }

      let preenchidos = 0, semDivida = 0, amostra = '';
      const saida = rows.map((r, idx) => {
        if (idx === 0) return r;
        const linha = [...r];
        const info = porCpf.get(cpfDe(r[iCpf]));
        if (!info || info.soma <= 0) { semDivida++; linha[iVar] = ''; return linha; }
        const celCred = String(iCred >= 0 ? r[iCred] : '').toUpperCase();
        const cred: CredorProposta = celCred.includes('UME') ? 'ume' : celCred.includes('ODRES') ? 'odres' : credor;
        linha[iCpf] = cpfDe(r[iCpf]);
        linha[iVar] = textoProposta(info.soma, cred, modelos[cred]);
        if (!amostra) amostra = linha[iVar];
        preenchidos++;
        return linha;
      });

      const okRows = [saida[0], ...saida.slice(1).filter((l) => l[iVar])];
      const semRows = [saida[0], ...saida.slice(1).filter((l) => !l[iVar])];
      const out = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(okRows), 'Pronto para envio');
      if (semRows.length > 1) XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(semRows), 'Sem dívida no SFTP');
      setPronto({ wb: out, nome: file.name.replace(/\.xlsx?$/i, '') + '_PRONTO.xlsx', XLSX });
      setRes({ total: rows.length - 1, preenchidos, semDivida, amostra });
      toast.success(`${preenchidos} propostas preenchidas`);
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || e));
    } finally {
      setProcessando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="font-semibold">Preencher proposta {'{{2}}'} pelo SFTP (UME / Odres)</h2>
          <p className="text-sm text-muted-foreground">
            Envie a planilha com as colunas CPF, {'{{1}}'}, TELEFONE, {'{{2}}'} (em branco) e CREDOR. O sistema busca o principal em aberto
            de cada CPF, calcula à vista pelo principal e parcelado com +10% em até 18x (parcela mínima R$ 100) e baixa a planilha pronta para o Envio Meta.
          </p>
        </div>
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex gap-2">
            <Button size="sm" variant={credor === 'odres' ? 'default' : 'outline'} onClick={() => setCredor('odres')}>ODRES CRED</Button>
            <Button size="sm" variant={credor === 'ume' ? 'default' : 'outline'} onClick={() => setCredor('ume')}>UME</Button>
          </div>
          <Textarea rows={4} value={modelos[credor]}
            onChange={(e) => setModelos((m) => ({ ...m, [credor]: e.target.value }))} />
          <p className="text-xs text-muted-foreground">
            Variáveis: {'{avista}'}, {'{parcelas}'}, {'{valor_parcela}'}. O trecho entre [ ] some quando a dívida não permite parcelar.
            Linhas com CREDOR na planilha usam o texto do credor delas; sem CREDOR, usam o credor selecionado.
          </p>
          <p className="text-sm"><b>Prévia:</b> {textoProposta(2101.8, credor, modelos[credor])}</p>
          <Button size="sm" variant="ghost" onClick={() => setModelos((m) => ({ ...m, [credor]: MODELOS_PADRAO[credor] }))}>
            <RotateCcw className="mr-2 h-4 w-4" /> Restaurar texto padrão
          </Button>
        </div>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void processar(f); }} />
        <Button onClick={() => inputRef.current?.click()} disabled={processando}>
          {processando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {processando ? 'Calculando...' : 'Enviar planilha'}
        </Button>
        {res && (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <p>Planilha pronta: <b>{res.preenchidos}</b> de {res.total} clientes com proposta.
              {res.semDivida > 0 && <> {res.semDivida} sem dívida no SFTP ficaram numa aba separada e não devem ser enviados.</>}</p>
            {pronto && (
              <Button variant="secondary" onClick={() => pronto.XLSX.writeFile(pronto.wb, pronto.nome)}>
                <Download className="mr-2 h-4 w-4" /> Baixar planilha pronta
              </Button>
            )}
            {res.amostra && <p className="text-muted-foreground">Exemplo: {res.amostra}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
