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

type Contagem = Record<string, { tentativas: number; whatsapp: number; alo: number; cpc: number; cpca: number }>;

type Origem = '3c' | 'cobmais';

type Resumo = {
  origem: Origem;
  total: number;
  validas: number;
  ignoradas: number;
  foraExpediente: number;
  dataDetectada: string;
  contagem: Contagem;
  totalTent: number;
  totalWa: number;
  totalAlo: number;
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

const normStr = (s: any) =>
  String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/^"|"$/g, '');

// Normaliza removendo acentos para casar "alteração", "2ª via" etc.
const normEvento = (s: any) => {
  return normStr(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

const cpfDigits = (s: any) => String(s ?? '').replace(/\D/g, '');

function emptyContagem(): Contagem {
  const c: Contagem = {};
  HORAS.forEach(h => { c[h] = { tentativas: 0, whatsapp: 0, alo: 0, cpc: 0, cpca: 0 }; });
  return c;
}

export function ImportarLigacoesDialog({ onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [origem, setOrigem] = useState<Origem>('3c');
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
    setOrigem('3c');
  };

  const handleFile3C = async (file: File) => {
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
      if (idxData < 0) idxData = 37;
      let idxQual = header.findIndex(h => h === 'qualification_name');
      if (idxQual < 0) idxQual = 19;

      let total = 0, validas = 0, ignoradas = 0, foraExp = 0;
      let totalCpc = 0, totalCpca = 0, totalTent = 0;
      const contagem = emptyContagem();
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
        totalTent++;

        const q = normStr(row[idxQual]);
        if (q === 'acordo') { contagem[faixa].cpca++; totalCpca++; }
        else if (q === 'contato com cliente') { contagem[faixa].cpc++; totalCpc++; }
      }

      const dataDetectada = Object.entries(datasMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      setResumo({
        origem: '3c', total, validas, ignoradas, foraExpediente: foraExp, dataDetectada, contagem,
        totalTent, totalWa: 0, totalAlo: 0, totalCpc, totalCpca,
      });
      setDataAlvo(dataDetectada);
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao ler planilha: ' + (e?.message ?? 'desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleFileCobmais = async (file: File) => {
    setLoading(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', raw: false, cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
      if (rows.length < 2) { toast.error('Planilha vazia'); return; }

      // Localizar linha de cabeçalho com Data, Hora, Evento, CPF/CNPJ
      let headerIdx = -1;
      let idxData = -1, idxHora = -1, idxEvento = -1, idxCpf = -1;
      for (let i = 0; i < Math.min(rows.length, 50); i++) {
        const r = rows[i].map(c => normEvento(c));
        const iData = r.findIndex(c => c === 'data');
        const iHora = r.findIndex(c => c === 'hora');
        const iEv = r.findIndex(c => c === 'evento');
        const iCpf = r.findIndex(c => c.includes('cpf'));
        if (iData >= 0 && iHora >= 0 && iEv >= 0 && iCpf >= 0) {
          headerIdx = i; idxData = iData; idxHora = iHora; idxEvento = iEv; idxCpf = iCpf;
          break;
        }
      }
      if (headerIdx < 0) {
        toast.error('Cabeçalho CobMais não encontrado (Data/Hora/Evento/CPF).');
        return;
      }

      let total = 0, validas = 0, ignoradas = 0, foraExp = 0;
      let totalTent = 0, totalWa = 0, totalAlo = 0, totalCpc = 0, totalCpca = 0;
      const contagem = emptyContagem();
      const datasMap: Record<string, number> = {};

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        total++;

        const cpf = cpfDigits(row[idxCpf]);
        if (cpf.length < 11) { ignoradas++; continue; }

        // Hora: aceita "HH:MM" ou "HH:MM:SS"
        const horaRaw = String(row[idxHora] ?? '').trim();
        const mHora = horaRaw.match(/^(\d{1,2}):(\d{2})/);
        if (!mHora) { ignoradas++; continue; }
        const horaInt = parseInt(mHora[1], 10);

        // Data: DD/MM/YYYY
        const dataRaw = String(row[idxData] ?? '').trim();
        const mData = dataRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (!mData) { ignoradas++; continue; }
        const dataIso = `${mData[3]}-${mData[2]}-${mData[1]}`;
        datasMap[dataIso] = (datasMap[dataIso] || 0) + 1;

        validas++;
        if (horaInt < 8 || horaInt > 18) { foraExp++; continue; }
        const faixa = horaParaFaixa(horaInt);

        // Toda linha com CPF = tentativa
        contagem[faixa].tentativas++;
        totalTent++;

        const ev = normEvento(row[idxEvento]);
        const isWhatsapp = ev.includes('whatsapp');
        const isCpc = ev === 'contato com cliente';
        const isAcordo = ev === 'acordo';
        const isBoleto = ev.includes('boleto') || ev.includes('2a via') || ev.includes('2 via');

        if (isWhatsapp) {
          contagem[faixa].whatsapp++; totalWa++;
          contagem[faixa].alo++; totalAlo++;
        }
        if (isCpc) {
          contagem[faixa].cpc++; totalCpc++;
          contagem[faixa].alo++; totalAlo++;
        }
        if (isAcordo || isBoleto) {
          contagem[faixa].cpca++; totalCpca++;
          contagem[faixa].cpc++; totalCpc++;
          contagem[faixa].alo++; totalAlo++;
        }
      }

      const dataDetectada = Object.entries(datasMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      setResumo({
        origem: 'cobmais', total, validas, ignoradas, foraExpediente: foraExp, dataDetectada, contagem,
        totalTent, totalWa, totalAlo, totalCpc, totalCpca,
      });
      setDataAlvo(dataDetectada);
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao ler planilha: ' + (e?.message ?? 'desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (file: File) => {
    if (origem === '3c') return handleFile3C(file);
    return handleFileCobmais(file);
  };

  const confirmar = async () => {
    if (!resumo || !dataAlvo) return;
    if (horaFim <= horaIni) { toast.error('Hora final deve ser maior que a hora inicial'); return; }
    const iniIdx = horaIni - 8;
    const fimIdx = horaFim - 1 - 8;
    if (iniIdx < 0 || fimIdx < 0 || iniIdx > fimIdx) { toast.error('Intervalo inválido'); return; }

    const isCob = resumo.origem === 'cobmais';
    setLoading(true);
    try {
      const { data: existentes } = await supabase
        .from('relatorio_acionamentos' as any)
        .select('hora, tentativas, whatsapp, alo, cpc, cpca')
        .eq('data', dataAlvo);
      const atuais: Record<string, { tentativas: number; whatsapp: number; alo: number; cpc: number; cpca: number }> = {};
      (existentes as any[] | null)?.forEach(r => {
        atuais[r.hora] = {
          tentativas: r.tentativas ?? 0,
          whatsapp: r.whatsapp ?? 0,
          alo: r.alo ?? 0,
          cpc: r.cpc ?? 0,
          cpca: r.cpca ?? 0,
        };
      });

      let faixasAtualizadas = 0;
      let sumTent = 0, sumWa = 0, sumAlo = 0, sumCpc = 0, sumCpca = 0;
      const logPrefix = isCob ? 'importacao_cobmais_' : 'importacao_planilha_';

      for (let i = iniIdx; i <= fimIdx; i++) {
        const h = HORAS[i];
        const imp = resumo.contagem[h];
        const ant = atuais[h] ?? { tentativas: 0, whatsapp: 0, alo: 0, cpc: 0, cpca: 0 };

        // 3C nunca toca em whatsapp/alo
        const novo = isCob
          ? (modo === 'substituir'
              ? { tentativas: imp.tentativas, whatsapp: imp.whatsapp, alo: imp.alo, cpc: imp.cpc, cpca: imp.cpca }
              : { tentativas: ant.tentativas + imp.tentativas, whatsapp: ant.whatsapp + imp.whatsapp, alo: ant.alo + imp.alo, cpc: ant.cpc + imp.cpc, cpca: ant.cpca + imp.cpca })
          : (modo === 'substituir'
              ? { tentativas: imp.tentativas, whatsapp: ant.whatsapp, alo: ant.alo, cpc: imp.cpc, cpca: imp.cpca }
              : { tentativas: ant.tentativas + imp.tentativas, whatsapp: ant.whatsapp, alo: ant.alo, cpc: ant.cpc + imp.cpc, cpca: ant.cpca + imp.cpca });

        if (
          novo.tentativas === ant.tentativas &&
          novo.whatsapp === ant.whatsapp &&
          novo.alo === ant.alo &&
          novo.cpc === ant.cpc &&
          novo.cpca === ant.cpca
        ) continue;

        const { error } = await supabase
          .from('relatorio_acionamentos' as any)
          .upsert({ data: dataAlvo, hora: h, ...novo } as any, { onConflict: 'data,hora' });
        if (error) throw error;

        const logs: any[] = [];
        if (novo.tentativas !== ant.tentativas) logs.push({ acao: logPrefix + 'tentativas', data: dataAlvo, hora: h, valor_anterior: ant.tentativas, valor_novo: novo.tentativas });
        if (novo.whatsapp !== ant.whatsapp) logs.push({ acao: logPrefix + 'whatsapp', data: dataAlvo, hora: h, valor_anterior: ant.whatsapp, valor_novo: novo.whatsapp });
        if (novo.alo !== ant.alo) logs.push({ acao: logPrefix + 'alo', data: dataAlvo, hora: h, valor_anterior: ant.alo, valor_novo: novo.alo });
        if (novo.cpc !== ant.cpc) logs.push({ acao: logPrefix + 'cpc', data: dataAlvo, hora: h, valor_anterior: ant.cpc, valor_novo: novo.cpc });
        if (novo.cpca !== ant.cpca) logs.push({ acao: logPrefix + 'cpca', data: dataAlvo, hora: h, valor_anterior: ant.cpca, valor_novo: novo.cpca });
        if (logs.length) await supabase.from('relatorio_acionamentos_log' as any).insert(logs as any);

        faixasAtualizadas++;
        sumTent += imp.tentativas;
        sumWa += imp.whatsapp;
        sumAlo += imp.alo;
        sumCpc += imp.cpc;
        sumCpca += imp.cpca;
      }

      const partes = [`${faixasAtualizadas} faixa(s)`, `${sumTent} tent.`];
      if (isCob) partes.push(`${sumWa} WA`, `${sumAlo} Alô`);
      partes.push(`${sumCpc} CPC`, `${sumCpca} CPC-A`);
      toast.success(partes.join(' · '));
      setOpen(false);
      reset();
      onDone();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + (e?.message ?? 'desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const isCob = resumo?.origem === 'cobmais';

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" /> Importar planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar planilha de operação</DialogTitle>
        </DialogHeader>

        {!resumo ? (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Origem da planilha</Label>
              <RadioGroup value={origem} onValueChange={(v) => setOrigem(v as Origem)} className="flex gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="3c" id="o-3c" />
                  <Label htmlFor="o-3c" className="font-normal cursor-pointer">3C Plus Discador</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="cobmais" id="o-cob" />
                  <Label htmlFor="o-cob" className="font-normal cursor-pointer">Relatório CobMais</Label>
                </div>
              </RadioGroup>
            </div>

            {origem === '3c' ? (
              <p className="text-sm text-muted-foreground">
                Lê <code>call_date</code> (AL) para o horário e <code>qualification_name</code> (T)
                para classificar <strong>CPC</strong> e <strong>CPC-A</strong>. Não altera WhatsApp/Alô.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Lê as colunas <strong>Data</strong>, <strong>Hora</strong>, <strong>Evento</strong> e <strong>CPF/CNPJ</strong>.
                Toda linha com CPF conta como <strong>Tentativa</strong>. Eventos de <strong>WhatsApp</strong> somam em WhatsApp + Alô.
                <strong> Contato com Cliente</strong> soma em CPC + Alô. <strong>Acordo</strong> e <strong>Boleto Gerado/Alteração</strong> somam em CPC-A + CPC + Alô.
              </p>
            )}

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
            <div className={`grid gap-3 text-sm ${isCob ? 'grid-cols-2 md:grid-cols-6' : 'grid-cols-2 md:grid-cols-4'}`}>
              <div className="rounded border p-2">
                <p className="text-muted-foreground text-xs">Total</p>
                <p className="font-bold">{resumo.total}</p>
              </div>
              <div className="rounded border p-2">
                <p className="text-muted-foreground text-xs">Tentativas</p>
                <p className="font-bold">{resumo.totalTent}</p>
              </div>
              {isCob && (
                <>
                  <div className="rounded border p-2">
                    <p className="text-muted-foreground text-xs">WhatsApp</p>
                    <p className="font-bold text-emerald-600">{resumo.totalWa}</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-muted-foreground text-xs">Alô</p>
                    <p className="font-bold">{resumo.totalAlo}</p>
                  </div>
                </>
              )}
              <div className="rounded border p-2">
                <p className="text-muted-foreground text-xs">CPC</p>
                <p className="font-bold text-blue-600">{resumo.totalCpc}</p>
              </div>
              <div className="rounded border p-2">
                <p className="text-muted-foreground text-xs">CPC-A</p>
                <p className="font-bold text-purple-600">{resumo.totalCpca}</p>
              </div>
            </div>

            <div className="rounded border max-h-56 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Faixa</th>
                    <th className="p-2 text-right">Tentativas</th>
                    {isCob && <th className="p-2 text-right">WhatsApp</th>}
                    {isCob && <th className="p-2 text-right">Alô</th>}
                    <th className="p-2 text-right">CPC</th>
                    <th className="p-2 text-right">CPC-A</th>
                  </tr>
                </thead>
                <tbody>
                  {HORAS.map(h => (
                    <tr key={h} className="border-t">
                      <td className="p-2">{h}</td>
                      <td className="p-2 text-right tabular-nums">{resumo.contagem[h].tentativas}</td>
                      {isCob && <td className="p-2 text-right tabular-nums">{resumo.contagem[h].whatsapp}</td>}
                      {isCob && <td className="p-2 text-right tabular-nums">{resumo.contagem[h].alo}</td>}
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
                {isCob
                  ? 'Aplica Tentativas, WhatsApp, Alô, CPC e CPC-A nas faixas selecionadas.'
                  : 'Aplica Tentativas, CPC e CPC-A. WhatsApp/Alô não são alterados.'}
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
