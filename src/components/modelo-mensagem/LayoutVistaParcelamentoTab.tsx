import { useEffect, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, Wand2, Trash2, Plus } from 'lucide-react';
import { gradeAte, descontoPorFaixa, faixasSobrepostas, MAX_PADRAO, type FaixaDesconto } from '@/lib/descontoFaixa';
import { toast } from 'sonner';
import { PARCELA_MINIMA } from '@/lib/parseCobmaisPlanilha';
import {
  GRADE_POR_CREDOR,
  montarParcelamentoTexto,
  primeiroNome,
  type CredorPlanilha,
} from '@/lib/gradeCredor';
import {
  MapearColunasPlanilha,
  extrairLinhas,
  type MapeamentoPlanilha,
} from './MapearColunasPlanilha';

interface LinhaPreview {
  nome: string;
  cpf: string;
  telefone: string;
  valor: number;
  aVista: number;
  parcelamento: string;
  descVista: number;
  descParcelado: number;
}

const CHAVE_CONFIG = 'layout-vista-parcelamento-config-v1';
interface ConfigCredor { maxParcelas: number; faixas: FaixaDesconto[] }
const CONFIG_PADRAO: Record<CredorPlanilha, ConfigCredor> = {
  novo_mundo: { maxParcelas: MAX_PADRAO.novo_mundo, faixas: [] },
  ume: { maxParcelas: MAX_PADRAO.ume, faixas: [] },
};

const SOMENTE_AVISTA = 'Somente à vista';
const CHAVE_MODELO = 'layout-vista-parcelamento-modelo-v1';
const NOME_CREDOR: Record<CredorPlanilha, string> = { novo_mundo: 'Novo Mundo', ume: 'UME' };

interface ModeloMsg { comParcela: string; soVista: string; parcelaVazia: string }
const MODELO_PADRAO: ModeloMsg = {
  comParcela:
    '*{credor}. Você tem uma condição imperdível de renegociação BLACK FRIDAY! Negocie hoje com {desconto_vista}% de desconto para pagamento à vista no valor de {valor_a_vista} ou parcelamento em: {parcelamento}.*',
  soVista:
    '*{credor}. Você tem uma condição imperdível de renegociação BLACK FRIDAY! Negocie hoje com {desconto_vista}% de desconto para pagamento à vista no valor de {valor_a_vista}.*',
  parcelaVazia: 'somente à vista',
};

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const moeda = (n: number) => `R$ ${fmtBRL(n)}`;

export function LayoutVistaParcelamentoTab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState('');
  const [rows, setRows] = useState<any[][]>([]);
  const [mapeamento, setMapeamento] = useState<MapeamentoPlanilha | null>(null);
  const [credor, setCredor] = useState<CredorPlanilha>('novo_mundo');
  const [descVista, setDescVista] = useState(50);
  const [descParcelado, setDescParcelado] = useState(30);
  const [preview, setPreview] = useState<LinhaPreview[]>([]);
  const [config, setConfig] = useState<Record<CredorPlanilha, ConfigCredor>>(() => {
    try { return { ...CONFIG_PADRAO, ...JSON.parse(localStorage.getItem(CHAVE_CONFIG) || '{}') }; }
    catch { return CONFIG_PADRAO; }
  });
  useEffect(() => { localStorage.setItem(CHAVE_CONFIG, JSON.stringify(config)); }, [config]);
  const cfg = config[credor];
  const grade = gradeAte(credor, cfg.maxParcelas);
  const rotulo = (c: CredorPlanilha) => `${NOME_CREDOR[c]} (até ${config[c].maxParcelas}x)`;
  const setCfg = (p: Partial<ConfigCredor>) => setConfig((o) => ({ ...o, [credor]: { ...o[credor], ...p } }));
  const setFaixa = (i: number, p: Partial<FaixaDesconto>) =>
    setCfg({ faixas: cfg.faixas.map((f, j) => (j === i ? { ...f, ...p } : f)) });
  const pct = (v: string) => Math.min(90, Math.max(0, Number(v) || 0));

  const [modelo, setModelo] = useState<ModeloMsg>(() => {
    try { return { ...MODELO_PADRAO, ...JSON.parse(localStorage.getItem(CHAVE_MODELO) || '{}') }; }
    catch { return MODELO_PADRAO; }
  });
  useEffect(() => { localStorage.setItem(CHAVE_MODELO, JSON.stringify(modelo)); }, [modelo]);

  const soVista = (l: LinhaPreview) => l.parcelamento === SOMENTE_AVISTA;
  const varParcelamento = (l: LinhaPreview) => (soVista(l) ? modelo.parcelaVazia : l.parcelamento);
  const mensagem = (l: LinhaPreview) =>
    (soVista(l) ? modelo.soVista : modelo.comParcela)
      .split('{credor}').join(NOME_CREDOR[credor])
      .split('{nome}').join(l.nome)
      .split('{desconto_vista}').join(String(l.descVista))
      .split('{desconto_parcelado}').join(String(l.descParcelado))
      .split('{valor_a_vista}').join(moeda(l.aVista))
      .split('{parcelamento}').join(l.parcelamento);

  async function handleFile(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error('Planilha vazia');
      const lidas = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as any[][];
      const uteis = lidas.filter((r) => (r || []).some((c) => String(c ?? '').trim() !== ''));
      if (uteis.length === 0) throw new Error('Nenhuma linha encontrada na planilha');
      setRows(uteis);
      setMapeamento(null);
      setPreview([]);
      setArquivo(file.name);
      toast.success(`${uteis.length} linhas lidas — selecione as colunas`);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao ler a planilha');
    }
  }

  function aplicar() {
    if (!mapeamento) return toast.error('Importe uma planilha primeiro');
    if (!mapeamento.papeis.includes('telefone') || !mapeamento.papeis.includes('valor'))
      return toast.error('Selecione as colunas de Telefone e de Valor total devido');
    const base = extrairLinhas(rows, mapeamento);
    if (base.length === 0) return toast.error('Nenhuma linha válida com telefone e valor');
    setPreview(
      base.map((l) => {
        const d = descontoPorFaixa(l.valor, cfg.faixas, { vista: descVista, parcelado: descParcelado });
        return {
          ...l,
          nome: primeiroNome(l.nome),
          descVista: d.vista,
          descParcelado: d.parcelado,
          aVista: l.valor * (1 - (d.vista || 0) / 100),
          parcelamento: montarParcelamentoTexto(l.valor * (1 - (d.parcelado || 0) / 100), grade),
        };
      }),
    );
    toast.success(`${base.length} clientes processados`);
  }

  function exportar() {
    if (preview.length === 0) return;
    const aoa = [
      ['Telefone', 'CPF', 'Nome {{1}}', 'Credor {{2}}', 'À vista {{3}}', 'Parcelamento {{4}}', 'Desconto aplicado', 'Mensagem completa'],
      ...preview.map((l) => [l.telefone, l.cpf, l.nome, NOME_CREDOR[credor], moeda(l.aVista), varParcelamento(l), `${l.descVista}% à vista / ${l.descParcelado}% parcelado`, mensagem(l)]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 90 }, { wch: 26 }, { wch: 140 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'A vista e Parcelado');
    XLSX.writeFile(wb, `avista-parcelamento-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function limpar() {
    setRows([]);
    setMapeamento(null);
    setPreview([]);
    setArquivo('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Planilha (.xlsx / .xls)</Label>
              <Input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
            <div className="space-y-1 w-52">
              <Label>Credor</Label>
              <Select value={credor} onValueChange={(v) => setCredor(v as CredorPlanilha)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(GRADE_POR_CREDOR) as CredorPlanilha[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {rotulo(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 w-36">
              <Label>Máximo de parcelas</Label>
              <Input type="number" min={1} max={60} value={cfg.maxParcelas}
                onChange={(e) => setCfg({ maxParcelas: Math.min(60, Math.max(1, Number(e.target.value) || 1)) })} />
            </div>
            <div className="space-y-1 w-40">
              <Label>Desconto à vista padrão (%)</Label>
              <Input
                type="number"
                min={0}
                max={90}
                value={descVista}
                onChange={(e) =>
                  setDescVista(Math.min(90, Math.max(0, Number(e.target.value) || 0)))
                }
              />
            </div>
            <div className="space-y-1 w-40">
              <Label>Desconto parcelado padrão (%)</Label>
              <Input
                type="number"
                min={0}
                max={90}
                value={descParcelado}
                onChange={(e) =>
                  setDescParcelado(Math.min(90, Math.max(0, Number(e.target.value) || 0)))
                }
              />
            </div>
            <Button onClick={aplicar} disabled={rows.length === 0}>
              <Wand2 className="h-4 w-4 mr-2" /> Aplicar
            </Button>
            {rows.length > 0 && (
              <Button variant="ghost" onClick={limpar}>
                <Trash2 className="h-4 w-4 mr-2" /> Limpar
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Upload className="h-3 w-3" />
            {arquivo ? `${arquivo} — ${rows.length} linhas. ` : ''}
            {`Grade ${rotulo(credor)}: ${grade.join('x, ')}x. Parcela mínima R$ ${fmtBRL(PARCELA_MINIMA)}.`}
          </p>
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Descontos por valor do débito — {NOME_CREDOR[credor]}</Label>
              <Button size="sm" variant="outline"
                onClick={() => {
                  const ult = cfg.faixas[cfg.faixas.length - 1];
                  const de = ult ? (ult.ate ?? ult.de) + 0.01 : 0;
                  setCfg({ faixas: [...cfg.faixas, { de: Number(de.toFixed(2)), ate: null, vista: descVista, parcelado: descParcelado }] });
                }}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar faixa
              </Button>
            </div>
            {cfg.faixas.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma faixa: todos os clientes usam o desconto padrão.</p>
            )}
            {cfg.faixas.map((f, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <div className="space-y-1 w-32"><Label className="text-xs">De R$</Label>
                  <Input type="number" min={0} value={f.de} onChange={(e) => setFaixa(i, { de: Math.max(0, Number(e.target.value) || 0) })} /></div>
                <div className="space-y-1 w-32"><Label className="text-xs">Até R$ (vazio = ou mais)</Label>
                  <Input type="number" min={0} value={f.ate ?? ''} onChange={(e) => setFaixa(i, { ate: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0) })} /></div>
                <div className="space-y-1 w-32"><Label className="text-xs">À vista (%)</Label>
                  <Input type="number" min={0} max={90} value={f.vista} onChange={(e) => setFaixa(i, { vista: pct(e.target.value) })} /></div>
                <div className="space-y-1 w-32"><Label className="text-xs">Parcelado (%)</Label>
                  <Input type="number" min={0} max={90} value={f.parcelado} onChange={(e) => setFaixa(i, { parcelado: pct(e.target.value) })} /></div>
                <Button size="icon" variant="ghost" aria-label="Remover faixa"
                  onClick={() => setCfg({ faixas: cfg.faixas.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {faixasSobrepostas(cfg.faixas) && (
              <p className="text-xs text-destructive">Atenção: há faixas sobrepostas; vale a primeira da lista que se encaixar.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-sm font-medium">Mensagem (coluna "Mensagem completa")</p>
          <p className="text-xs text-muted-foreground">
            Use: {'{credor}'}, {'{nome}'}, {'{desconto_vista}'}, {'{desconto_parcelado}'}, {'{valor_a_vista}'}, {'{parcelamento}'}. Salvo automaticamente.
          </p>
          <div className="space-y-1">
            <Label>Com parcelamento</Label>
            <Textarea rows={3} value={modelo.comParcela} onChange={(e) => setModelo({ ...modelo, comParcela: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Somente à vista (quando não há parcela acima do mínimo)</Label>
            <Textarea rows={3} value={modelo.soVista} onChange={(e) => setModelo({ ...modelo, soVista: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Texto da coluna Parcelamento {'{{4}}'} quando for somente à vista</Label>
            <Input value={modelo.parcelaVazia} onChange={(e) => setModelo({ ...modelo, parcelaVazia: e.target.value })} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setModelo(MODELO_PADRAO)}>Restaurar padrão</Button>
        </CardContent>
      </Card>

      <MapearColunasPlanilha rows={rows} mapeamento={mapeamento} onChange={setMapeamento} />

      {preview.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1 w-52">
                <Label>Credor</Label>
                <Select
                  value={credor}
                  onValueChange={(v) => setCredor(v as CredorPlanilha)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(GRADE_POR_CREDOR) as CredorPlanilha[]).map((c) => (
                      <SelectItem key={c} value={c}>
                        {rotulo(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="secondary" onClick={aplicar}>
                <Wand2 className="h-4 w-4 mr-2" /> Reaplicar
              </Button>
              <Button variant="outline" onClick={exportar}>
                <Download className="h-4 w-4 mr-2" /> Baixar à vista + parcelamento ({preview.length})
              </Button>
            </div>

            <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Valor original</TableHead>
                    <TableHead>À vista</TableHead>
                    <TableHead>Parcelamento {'{{4}}'}</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((l, i) => (
                    <TableRow key={`${l.telefone}-${i}`}>
                      <TableCell className="whitespace-nowrap">{l.telefone}</TableCell>
                      <TableCell className="whitespace-nowrap">{l.cpf || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{l.nome}</TableCell>
                      <TableCell className="whitespace-nowrap">{moeda(l.valor)}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {moeda(l.aVista)}
                      </TableCell>
                      <TableCell className="text-xs">{varParcelamento(l)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{l.descVista}% / {l.descParcelado}%</TableCell>
                      <TableCell className="text-xs min-w-[320px]">{mensagem(l)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
