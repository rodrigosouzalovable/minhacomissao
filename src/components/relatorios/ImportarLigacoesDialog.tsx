import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const HORAS = [
  '8h-9h', '9h-10h', '10h-11h', '11h-12h', '12h-13h', '13h-14h',
  '14h-15h', '15h-16h', '16h-17h', '17h-18h', '18h-19h',
];

const horaParaFaixa = (h: number) => `${h}h-${h + 1}h`;

type Contagem = Record<string, { tentativas: number; cpc: number; cpca: number }>;

type Resumo = {
  total: number;
  validas: number;
  ignoradas: number;
  foraExpediente: number;
  dataDetectada: string;
  contagem: Contagem;
  totalCpc: number;
  totalCpca: number;
};

type Props = { onDone: () => void };

function parseCallDate(raw: string): { dataIso: string; hora: number } | null {
  if (!raw) return null;
  const s = String(raw).trim().replace(/^"|"$/g, '');
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh] = m;
  return { dataIso: `${yyyy}-${mm}-${dd}`, hora: parseInt(hh, 10) };
}

const normQual = (s: string) =>
  String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/^"|"$/g, '');

export function ImportarLigacoesDialog({ onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [dataAlvo, setDataAlvo] = useState('');
  const [horaIni, setHoraIni] = useState(8);
  const [horaFim, setHoraFim] = useState(19);
  const [modo, setModo] = useState<'substituir' | 'somar'>('substituir');

  const reset = () => {
    setResumo(null);
    setDataAlvo('');
    setHoraIni(8);
    setHoraFim(19);
    setModo('substituir');
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', raw: true, FS: ';' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
      if (rows.length < 2) { toast.error('Planilha vazia'); return; }

      const header = rows[0].map((c: any) => String(c).trim().toLowerCase());
      let idxData = header.findIndex(h => h === 'call_date' || h === 'calldate' || h === 'data_chamada');
      if (idxData < 0) idxData = 37; // AL
      let idxQual = header.findIndex(h => h === 'qualification_name');
      if (idxQual < 0) idxQual = 19; // T

      let total = 0, validas = 0, ignoradas = 0, foraExp = 0;
      let totalCpc = 0, totalCpca = 0;
      const contagem: Contagem = {};
      HORAS.forEach(h => { contagem[h] = { tentativas: 0, cpc: 0, cpca: 0 }; });
      const datasMap: Record<string, number> = {};

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        total++;
        const parsed = parseCallDate(String(row[idxData] ?? ''));
        if (!parsed) { ignoradas++; continue; }
        validas++;
        datasMap[parsed.dataIso] = (datasMap[parsed.dataIso] || 0) + 1;
        if (parsed.hora < 8 || parsed.hora > 18) { foraExp++; continue; }

        const faixa = horaParaFaixa(parsed.hora);
        contagem[faixa].tentativas++;

        const q = normQual(String(row[idxQual] ?? ''));
        if (q === 'acordo') { contagem[faixa].cpca++; totalCpca++; }
        else if (q === 'contato com cliente') { contagem[faixa].cpc++; totalCpc++; }
      }

      const dataDetectada = Object.entries(datasMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      setResumo({ total, validas, ignoradas, foraExpediente: foraExp, dataDetectada, contagem, totalCpc, totalCpca });
      setDataAlvo(dataDetectada);
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao ler planilha: ' + (e?.message ?? 'desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const confirmar = async () => {
    if (!resumo || !dataAlvo) return;
    if (horaFim <= horaIni) { toast.error('Hora final deve ser maior que a hora inicial'); return; }
    const iniIdx = horaIni - 8;
    const fimIdx = horaFim - 1 - 8;
    if (iniIdx < 0 || fimIdx < 0 || iniIdx > fimIdx) { toast.error('Intervalo inválido'); return; }

    setLoading(true);
    try {
      const { data: existentes } = await supabase
        .from('relatorio_acionamentos' as any)
        .select('hora, tentativas, cpc, cpca')
        .eq('data', dataAlvo);
      const atuais: Record<string, { tentativas: number; cpc: number; cpca: number }> = {};
      (existentes as any[] | null)?.forEach(r => {
        atuais[r.hora] = { tentativas: r.tentativas ?? 0, cpc: r.cpc ?? 0, cpca: r.cpca ?? 0 };
      });

      let faixasAtualizadas = 0;
      let sumTent = 0, sumCpc = 0, sumCpca = 0;

      for (let i = iniIdx; i <= fimIdx; i++) {
        const h = HORAS[i];
        const imp = resumo.contagem[h];
        const ant = atuais[h] ?? { tentativas: 0, cpc: 0, cpca: 0 };
        const novo = modo === 'substituir'
          ? { tentativas: imp.tentativas, cpc: imp.cpc, cpca: imp.cpca }
          : { tentativas: ant.tentativas + imp.tentativas, cpc: ant.cpc + imp.cpc, cpca: ant.cpca + imp.cpca };

        if (novo.tentativas === ant.tentativas && novo.cpc === ant.cpc && novo.cpca === ant.cpca) continue;

        const { error } = await supabase
          .from('relatorio_acionamentos' as any)
          .upsert({ data: dataAlvo, hora: h, ...novo } as any, { onConflict: 'data,hora' });
        if (error) throw error;

        const logs: any[] = [];
        if (novo.tentativas !== ant.tentativas) logs.push({ acao: 'importacao_planilha_tentativas', data: dataAlvo, hora: h, valor_anterior: ant.tentativas, valor_novo: novo.tentativas });
        if (novo.cpc !== ant.cpc) logs.push({ acao: 'importacao_planilha_cpc', data: dataAlvo, hora: h, valor_anterior: ant.cpc, valor_novo: novo.cpc });
        if (novo.cpca !== ant.cpca) logs.push({ acao: 'importacao_planilha_cpca', data: dataAlvo, hora: h, valor_anterior: ant.cpca, valor_novo: novo.cpca });
        if (logs.length) await supabase.from('relatorio_acionamentos_log' as any).insert(logs as any);

        faixasAtualizadas++;
        sumTent += imp.tentativas;
        sumCpc += imp.cpc;
        sumCpca += imp.cpca;
      }

      toast.success(`${faixasAtualizadas} faixa(s) — ${sumTent} tentativas · ${sumCpc} CPC · ${sumCpca} CPC-A`);
      setOpen(false);
      reset();
      onDone();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + (e?.message ?? 'desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" /> Importar planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar planilha de ligações</DialogTitle>
        </DialogHeader>

        {!resumo ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Envie o arquivo <strong>.csv</strong> ou <strong>.xlsx</strong> da operação.
              O sistema lê a coluna <code>call_date</code> (AL) para o horário e <code>qualification_name</code> (T)
              para classificar <strong>CPC</strong> (Contato com Cliente) e <strong>CPC-A</strong> (Acordo).
            </p>
            <Input
              type="file" accept=".csv,.xlsx,.xls"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              disabled={loading}
            />
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Processando planilha...
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded border p-2">
                <p className="text-muted-foreground text-xs">Total</p>
                <p className="font-bold">{resumo.total}</p>
              </div>
              <div className="rounded border p-2">
                <p className="text-muted-foreground text-xs">Válidas</p>
                <p className="font-bold text-green-600">{resumo.validas}</p>
              </div>
              <div className="rounded border p-2">
                <p className="text-muted-foreground text-xs">CPC</p>
                <p className="font-bold text-blue-600">{resumo.totalCpc}</p>
              </div>
              <div className="rounded border p-2">
                <p className="text-muted-foreground text-xs">CPC-A</p>
                <p className="font-bold text-purple-600">{resumo.totalCpca}</p>
              </div>
            </div>

            <div className="rounded border max-h-48 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Faixa</th>
                    <th className="p-2 text-right">Tentativas</th>
                    <th className="p-2 text-right">CPC</th>
                    <th className="p-2 text-right">CPC-A</th>
                  </tr>
                </thead>
                <tbody>
                  {HORAS.map(h => (
                    <tr key={h} className="border-t">
                      <td className="p-2">{h}</td>
                      <td className="p-2 text-right tabular-nums">{resumo.contagem[h].tentativas}</td>
                      <td className="p-2 text-right tabular-nums">{resumo.contagem[h].cpc}</td>
                      <td className="p-2 text-right tabular-nums">{resumo.contagem[h].cpca}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Data alvo</Label>
                <Input type="date" value={dataAlvo} onChange={(e) => setDataAlvo(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Hora inicial</Label>
                <Select value={String(horaIni)} onValueChange={(v) => setHoraIni(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[8,9,10,11,12,13,14,15,16,17,18].map(h => (
                      <SelectItem key={h} value={String(h)}>{String(h).padStart(2,'0')}h</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Hora final</Label>
                <Select value={String(horaFim)} onValueChange={(v) => setHoraFim(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[9,10,11,12,13,14,15,16,17,18,19].map(h => (
                      <SelectItem key={h} value={String(h)}>{String(h).padStart(2,'0')}h</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Modo de gravação</Label>
              <RadioGroup value={modo} onValueChange={(v) => setModo(v as any)} className="flex gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="substituir" id="m-sub" />
                  <Label htmlFor="m-sub" className="font-normal cursor-pointer">Substituir</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="somar" id="m-som" />
                  <Label htmlFor="m-som" className="font-normal cursor-pointer">Somar ao valor atual</Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground mt-1">
                Aplica a Tentativas, CPC e CPC-A nas faixas selecionadas. Coluna WhatsApp não é alterada.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {resumo && (
            <>
              <Button variant="ghost" onClick={reset} disabled={loading}>Trocar arquivo</Button>
              <Button onClick={confirmar} disabled={loading || !dataAlvo}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar importação
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
