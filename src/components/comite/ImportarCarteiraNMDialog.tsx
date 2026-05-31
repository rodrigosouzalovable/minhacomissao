import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  TODAS_FAIXAS,
  CREDOR_TIPOS,
  faixaDeAtraso,
  type FaixaKey,
  type CredorTipo,
} from '@/hooks/useComiteNovoMundo';

type LinhaParsed = {
  cpf_cnpj: string;
  credor_tipo: CredorTipo;
  atraso_dias: number;
  risco: number;
  faixa: FaixaKey;
};

const moeda = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

function normalizeKey(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function pickHeader(row: Record<string, any>, candidates: string[]): string | null {
  const map = new Map<string, string>();
  for (const k of Object.keys(row)) map.set(normalizeKey(k), k);
  for (const c of candidates) {
    const hit = map.get(normalizeKey(c));
    if (hit) return hit;
  }
  return null;
}

export function ImportarCarteiraNMDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linhas, setLinhas] = useState<LinhaParsed[] | null>(null);
  const [ignoradas, setIgnoradas] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  function reset() {
    setArquivo(null);
    setLinhas(null);
    setIgnoradas(0);
    setErro(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleFile(f: File) {
    setArquivo(f);
    setErro(null);
    setLinhas(null);
    setIgnoradas(0);
    setParsing(true);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (rows.length === 0) {
        setErro('Planilha vazia.');
        return;
      }

      const first = rows[0];
      const colCpf = pickHeader(first, ['CPF/CNPJ', 'CPF', 'CNPJ', 'Documento']);
      const colCredor = pickHeader(first, ['CREDOR', 'Credor', 'Carteira']);
      const colAtraso = pickHeader(first, ['ATRASO', 'Atraso', 'Dias de atraso', 'Dias']);
      const colRisco = pickHeader(first, ['RISCO', 'Risco', 'Valor', 'Saldo']);

      if (!colCpf || !colCredor || !colAtraso || !colRisco) {
        setErro(
          `Cabeçalhos não encontrados. A planilha precisa ter as colunas CPF/CNPJ, CREDOR, ATRASO e RISCO. Achei: ${Object.keys(first).join(', ')}`,
        );
        return;
      }

      let ign = 0;
      const ok: LinhaParsed[] = [];
      for (const r of rows) {
        const cpfRaw = String(r[colCpf] ?? '').replace(/\D/g, '');
        const credorRaw = String(r[colCredor] ?? '').toUpperCase();
        const atrasoNum = Number(String(r[colAtraso] ?? '').toString().replace(',', '.'));
        const riscoNum = Number(String(r[colRisco] ?? '').toString().replace(',', '.'));

        if (!cpfRaw) {
          ign++;
          continue;
        }
        let tipo: CredorTipo;
        if (credorRaw.includes('APORTE')) tipo = 'APORTE';
        else if (credorRaw.includes('INADIMPLENTE')) tipo = 'INADIMPLENTES';
        else {
          ign++;
          continue;
        }
        const f = faixaDeAtraso(isNaN(atrasoNum) ? null : atrasoNum);
        if (!f) {
          ign++;
          continue;
        }
        ok.push({
          cpf_cnpj: cpfRaw,
          credor_tipo: tipo,
          atraso_dias: Math.floor(atrasoNum),
          risco: isNaN(riscoNum) ? 0 : riscoNum,
          faixa: f,
        });
      }

      setLinhas(ok);
      setIgnoradas(ign);
    } catch (e: any) {
      setErro('Erro ao ler planilha: ' + (e?.message ?? String(e)));
    } finally {
      setParsing(false);
    }
  }

  async function confirmar() {
    if (!linhas || linhas.length === 0) return;
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;

      // 1) desativa snapshots anteriores
      const { error: e1 } = await supabase
        .from('comite_carteira_nm_snapshot')
        .update({ ativo: false })
        .eq('ativo', true);
      if (e1) throw e1;

      const cpfsUnicos = new Set(linhas.map((l) => l.cpf_cnpj)).size;
      const totalRisco = linhas.reduce((s, l) => s + l.risco, 0);

      // 2) cria snapshot novo
      const { data: snap, error: e2 } = await supabase
        .from('comite_carteira_nm_snapshot')
        .insert({
          importado_por: uid,
          arquivo_nome: arquivo?.name ?? null,
          total_linhas: linhas.length,
          total_cpfs_unicos: cpfsUnicos,
          total_risco: totalRisco,
          ativo: true,
        })
        .select()
        .single();
      if (e2) throw e2;

      // 3) insere itens em chunks
      const chunkSize = 500;
      for (let i = 0; i < linhas.length; i += chunkSize) {
        const chunk = linhas.slice(i, i + chunkSize).map((l) => ({ ...l, snapshot_id: snap.id }));
        const { error: e3 } = await supabase.from('comite_carteira_nm_item').insert(chunk);
        if (e3) throw e3;
      }

      toast.success(`Carteira atualizada: ${linhas.length} contratos · ${cpfsUnicos} CPFs únicos`);
      qc.invalidateQueries({ queryKey: ['comite-nm'] });
      setOpen(false);
      reset();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  }

  // Resumo por faixa x tipo para preview
  const resumo = (() => {
    if (!linhas) return null;
    const m: Record<FaixaKey, Record<CredorTipo, { qtd: number; risco: number }>> = Object.fromEntries(
      TODAS_FAIXAS.map((f) => [f, { INADIMPLENTES: { qtd: 0, risco: 0 }, APORTE: { qtd: 0, risco: 0 } }]),
    ) as any;
    for (const l of linhas) m[l.faixa][l.credor_tipo].qtd += 1, (m[l.faixa][l.credor_tipo].risco += l.risco);
    return m;
  })();

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Upload className="h-3 w-3 mr-1" /> Importar planilha
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar carteira Novo Mundo</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-muted p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Formato esperado</p>
            <p>Planilha .xlsx ou .csv com 4 colunas (primeira linha = cabeçalho):</p>
            <ul className="list-disc list-inside mt-1">
              <li><b>CPF/CNPJ</b> — com ou sem máscara</li>
              <li><b>CREDOR</b> — "UME | NOVO MUNDO - INADIMPLENTES" ou "UME | NOVO MUNDO - APORTE"</li>
              <li><b>ATRASO</b> — dias de atraso (número)</li>
              <li><b>RISCO</b> — valor em risco (R$)</li>
            </ul>
            <p className="mt-2 text-amber-700 dark:text-amber-400">
              Atenção: cada importação substitui a anterior.
            </p>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-primary-foreground hover:file:opacity-90"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          {parsing && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lendo planilha...
            </div>
          )}

          {erro && (
            <div className="flex items-start gap-2 text-destructive bg-destructive/10 p-2 rounded">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="text-xs">{erro}</span>
            </div>
          )}

          {linhas && resumo && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>
                  <b>{linhas.length}</b> linhas válidas
                  {ignoradas > 0 && <> · <span className="text-amber-700">{ignoradas} ignoradas</span></>}
                  {' · '}
                  <b>{new Set(linhas.map((l) => l.cpf_cnpj)).size}</b> CPFs únicos · risco{' '}
                  <b>{moeda(linhas.reduce((s, l) => s + l.risco, 0))}</b>
                </span>
              </div>

              <div className="overflow-x-auto border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Faixa</th>
                      <th className="text-right p-2">Inad. (qtd)</th>
                      <th className="text-right p-2">Inad. (R$)</th>
                      <th className="text-right p-2">Aporte (qtd)</th>
                      <th className="text-right p-2">Aporte (R$)</th>
                      <th className="text-right p-2">Total qtd</th>
                      <th className="text-right p-2">Total R$</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TODAS_FAIXAS.map((f) => {
                      const r = resumo[f];
                      const totQ = r.INADIMPLENTES.qtd + r.APORTE.qtd;
                      const totR = r.INADIMPLENTES.risco + r.APORTE.risco;
                      return (
                        <tr key={f} className="border-b">
                          <td className="p-2">{f}</td>
                          <td className="p-2 text-right">{r.INADIMPLENTES.qtd}</td>
                          <td className="p-2 text-right">{moeda(r.INADIMPLENTES.risco)}</td>
                          <td className="p-2 text-right">{r.APORTE.qtd}</td>
                          <td className="p-2 text-right">{moeda(r.APORTE.risco)}</td>
                          <td className="p-2 text-right font-medium">{totQ}</td>
                          <td className="p-2 text-right font-medium">{moeda(totR)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { setOpen(false); reset(); }} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!linhas || linhas.length === 0 || saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : 'Confirmar e substituir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
