import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Upload, FileSpreadsheet, Trash2, Check, AlertCircle, History, Users, Eye, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import * as XLSX from 'xlsx';

type CredorLayout = 'padrao' | 'montreal' | 'montreal_atualizacao' | 'cobmais' | 'pesquisa' | 'pagamentos';

type MontrealRowStatus = 'existe' | 'nova_parcela' | 'cliente_novo';

interface MontrealAtualizacaoRow extends DevedorRow {
  status_importacao: MontrealRowStatus;
}

interface DevedorRow {
  cpf: string;
  nascimento: string;
  nome: string;
  credor: string;
  contrato: string;
  atraso: string;
  valor_original: number;
  valor_atualizado: number;
  telefone?: string;
  descricao?: string;
}

interface PagamentoRow {
  cpf: string;
  cliente: string;
  numero_parcela: number;
  vencimento: string;
  valor: number;
  observacao: string;
  status_planilha: string;
  acordo_id?: string;
  pagamento_id?: string;
  ja_pago?: boolean;
  sem_acordo?: boolean;
}

interface Importacao {
  id: string;
  nome_arquivo: string;
  credor: string;
  total_registros: number;
  importado_por: string;
  criado_em: string;
}

const DESCRICOES: Record<CredorLayout, string> = {
  padrao: 'A = CPF/CNPJ, B = Nascimento, C = Cliente, D = Credor, E = Contrato, F = Atraso, G = Risco (valor devido)',
  montreal: 'A = Parceiro, B = Razão Social, C = CNPJ/CPF, D = Fone1, E = Fone2, F = Apelido, G = Atraso (dias), H = Nro Nota, I = Desdob., J = Vlr do Desdobramento, K = Dt. Venc. Inicial',
  montreal_atualizacao: 'Importação inteligente MONTREAL — Cruza com dados existentes e insere apenas parcelas novas. Mesmo layout da planilha Montreal.',
  cobmais: 'A = CPF/CNPJ, B = Cliente, C = Contrato, D = Número, E = Vencimento, F = Valor, G = Total, H = Telefone | Aba 2: Telefones (opcional)',
  pesquisa: 'A = CPF/CNPJ, B = Nome, C = Telefone',
  pagamentos: 'A = CPF/CNPJ, B = Cliente, C = Credor, D = Contrato, E = Inclusão, F = Arquivo, G = Número, H = Vencimento, I = Valor, J = Observação, K = Status — Marca parcelas PAGAS automaticamente',
};

export default function ImportarDevedores() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [credorSelecionado, setCredorSelecionado] = useState<CredorLayout>('padrao');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<DevedorRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [grouped, setGrouped] = useState(false);
  const [importacoes, setImportacoes] = useState<Importacao[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [credorDestino, setCredorDestino] = useState('');
  const [credorOutro, setCredorOutro] = useState('');
  const [importProgress, setImportProgress] = useState(0);
  const [insertedCount, setInsertedCount] = useState(0);

  // Pagamentos-specific state
  const [pagamentoRows, setPagamentoRows] = useState<PagamentoRow[]>([]);
  const [pagamentoImporting, setPagamentoImporting] = useState(false);
  const [pagamentoImported, setPagamentoImported] = useState(false);
  const [pagamentoProgress, setPagamentoProgress] = useState(0);
  const [pagamentoUpdated, setPagamentoUpdated] = useState(0);

  // Montreal Atualização state
  const [montrealRows, setMontrealRows] = useState<MontrealAtualizacaoRow[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const CREDORES_OPCOES = ['MUNDO DA MODA', 'UME | NOVO MUNDO', 'MONTREAL'];

  const isPagamentos = credorSelecionado === 'pagamentos';
  const isMontrealAtualizacao = credorSelecionado === 'montreal_atualizacao';

  const fetchImportacoes = useCallback(async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from('importacoes' as any)
      .select('*')
      .order('criado_em', { ascending: false });
    if (!error && data) {
      setImportacoes(data as unknown as Importacao[]);
    }
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    fetchImportacoes();
  }, [fetchImportacoes]);

  const handleCredorChange = (value: CredorLayout) => {
    setCredorSelecionado(value);
    setFile(null);
    setRows([]);
    setPagamentoRows([]);
    setMontrealRows([]);
    setImported(false);
    setPagamentoImported(false);
    if (value === 'pagamentos') {
      setCredorDestino('UME | NOVO MUNDO');
    }
    if (value === 'montreal_atualizacao') {
      setCredorDestino('MONTREAL');
    }
  };

  const parseNum = (val: unknown) => {
    if (val === undefined || val === null) return 0;
    const raw = String(val).replace(/[^\d.,]/g, '').replace(',', '.');
    return parseFloat(raw) || 0;
  };

  const parsePadrao = (dataRows: Record<string, unknown>[]): DevedorRow[] => {
    return dataRows.map((row) => {
      const risco = parseNum(row['G']);
      return {
        cpf: String(row['A'] ?? '').replace(/\D/g, ''),
        nascimento: String(row['B'] ?? ''),
        nome: String(row['C'] ?? ''),
        credor: String(row['D'] ?? ''),
        contrato: String(row['E'] ?? ''),
        atraso: String(row['F'] ?? ''),
        valor_original: risco,
        valor_atualizado: risco,
      };
    }).filter(r => r.cpf.length >= 11);
  };

  const parseMontreal = (dataRows: Record<string, unknown>[]): DevedorRow[] => {
    return dataRows.map((row) => {
      const valor = parseNum(row['J']);
      const tel1 = String(row['D'] ?? '').replace(/\D/g, '');
      const tel2 = String(row['E'] ?? '').replace(/\D/g, '');

      let vencimentoStr = '';
      const vencRaw = row['K'];
      if (typeof vencRaw === 'number') {
        const dt = XLSX.SSF.parse_date_code(vencRaw);
        if (dt) {
          vencimentoStr = `${String(dt.d).padStart(2, '0')}/${String(dt.m).padStart(2, '0')}/${dt.y}`;
        }
      } else if (vencRaw) {
        vencimentoStr = String(vencRaw);
      }

      return {
        cpf: String(row['C'] ?? '').replace(/\D/g, ''),
        nascimento: '',
        nome: String(row['B'] ?? ''),
        credor: 'MONTREAL',
        contrato: String(row['H'] ?? ''),
        descricao: String(row['I'] ?? ''),
        atraso: vencimentoStr,
        valor_original: valor,
        valor_atualizado: valor,
        telefone: tel1 || tel2 || undefined,
      };
    }).filter(r => r.cpf.length >= 11);
  };

  const parseMontrealAtualizacao = async (dataRows: Record<string, unknown>[]): Promise<MontrealAtualizacaoRow[]> => {
    const parsed = parseMontreal(dataRows);
    if (parsed.length === 0) return [];

    const uniqueCpfs = [...new Set(parsed.map(r => r.cpf))];

    // Fetch existing devedores for these CPFs
    const existingMap = new Map<string, { cpf: string; contrato: string; descricao: string; data_vencimento: string }[]>();
    
    for (let i = 0; i < uniqueCpfs.length; i += 50) {
      const batch = uniqueCpfs.slice(i, i + 50);
      const { data } = await supabase
        .from('devedores')
        .select('cpf, contrato, descricao, data_vencimento')
        .eq('credor', 'MONTREAL')
        .eq('ativo', true)
        .in('cpf', batch);
      
      if (data) {
        for (const d of data) {
          const cpfNorm = (d.cpf || '').replace(/\D/g, '');
          if (!existingMap.has(cpfNorm)) existingMap.set(cpfNorm, []);
          existingMap.get(cpfNorm)!.push({
            cpf: cpfNorm,
            contrato: d.contrato || '',
            descricao: d.descricao || '',
            data_vencimento: d.data_vencimento || '',
          });
        }
      }
    }

    return parsed.map(row => {
      const existingForCpf = existingMap.get(row.cpf);
      if (!existingForCpf || existingForCpf.length === 0) {
        return { ...row, status_importacao: 'cliente_novo' as MontrealRowStatus };
      }

      const vencIso = parseDate(row.atraso);
      const match = existingForCpf.find(e => 
        e.contrato === (row.contrato || '') && 
        e.descricao === (row.descricao || '') &&
        e.data_vencimento === (vencIso || '')
      );

      return {
        ...row,
        status_importacao: match ? 'existe' as MontrealRowStatus : 'nova_parcela' as MontrealRowStatus,
      };
    });
  };

  const parsePesquisa = (dataRows: Record<string, unknown>[]): DevedorRow[] => {
    return dataRows.map((row) => {
      const cpf = String(row['A'] ?? '').replace(/\D/g, '');
      const nome = String(row['B'] ?? '').trim();
      const telefone = String(row['C'] ?? '').replace(/\D/g, '');
      return {
        cpf,
        nascimento: '',
        nome,
        credor: '',
        contrato: '',
        atraso: '',
        valor_original: 0,
        valor_atualizado: 0,
        telefone: telefone || undefined,
      };
    }).filter(r => r.cpf.length >= 11 && r.nome.length > 0);
  };

  const isNDValue = (val: unknown): boolean => {
    if (val === undefined || val === null) return true;
    const s = String(val).trim().toUpperCase();
    return s === '#N/D' || s === '#N/A' || s === '#REF!' || s === '#VALUE!' || s === '';
  };

  const parseCobmais = (workbook: XLSX.WorkBook): DevedorRow[] => {
    const sheet1 = workbook.Sheets[workbook.SheetNames[0]];
    const rows1 = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet1, { header: 'A' }).slice(1);
    console.log('[COBMAIS] Total de abas:', workbook.SheetNames.length, '| Linhas aba 1:', rows1.length);

    const sheet2 = workbook.SheetNames.length >= 2 ? workbook.Sheets[workbook.SheetNames[1]] : null;
    const rows2 = sheet2 ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet2, { header: 'A' }).slice(1) : [];

    const cpfRealMap = new Map<string, string>();
    const phoneMap = new Map<string, string>();
    for (const row of rows2) {
      const cpfReal = String(row['A'] ?? '').replace(/\D/g, '');
      if (!cpfReal) continue;
      const cpfSemZeros = cpfReal.replace(/^0+/, '');
      if (cpfSemZeros && !cpfRealMap.has(cpfSemZeros)) {
        cpfRealMap.set(cpfSemZeros, cpfReal);
      }
      const ativo = String(row['I'] ?? '').toUpperCase().trim();
      if (cpfReal && ativo === 'SIM' && !phoneMap.has(cpfReal)) {
        const numero = String(row['C'] ?? '').replace(/\D/g, '');
        if (numero) phoneMap.set(cpfReal, numero);
      }
    }

    const resolverCpf = (raw: unknown): string => {
      const digits = String(raw ?? '').replace(/\D/g, '');
      if (!digits) return '';
      const semZeros = digits.replace(/^0+/, '');
      const cpfReal = cpfRealMap.get(semZeros);
      if (cpfReal) return cpfReal;
      if (digits.length <= 11) return digits.padStart(11, '0');
      if (digits.length <= 14) return digits.padStart(14, '0');
      return digits;
    };

    const devedores: DevedorRow[] = [];
    for (const row of rows1) {
      const cpf = resolverCpf(row['A']);
      if (cpf.length < 11) continue;

      const contrato = String(row['C'] ?? '').trim();
      const valor = parseNum(row['F']);
      const total = isNDValue(row['G']) ? valor : parseNum(row['G']);

      // Telefone from column H (direct), fallback to phone map from sheet 2
      let telefone = '';
      if (!isNDValue(row['H'])) {
        telefone = String(row['H']).replace(/\D/g, '');
      }
      if (!telefone) {
        telefone = phoneMap.get(cpf) || '';
      }

      let vencimentoStr = '';
      const vencRaw = row['E'];
      if (typeof vencRaw === 'number') {
        const dt = XLSX.SSF.parse_date_code(vencRaw);
        if (dt) {
          vencimentoStr = `${String(dt.d).padStart(2, '0')}/${String(dt.m).padStart(2, '0')}/${dt.y}`;
        }
      } else if (vencRaw && !isNDValue(vencRaw)) {
        vencimentoStr = String(vencRaw);
      }

      devedores.push({
        cpf,
        nascimento: '',
        nome: isNDValue(row['B']) ? '' : String(row['B'] ?? ''),
        credor: '',
        contrato: isNDValue(contrato) ? '' : contrato,
        atraso: vencimentoStr,
        valor_original: valor,
        valor_atualizado: total || valor,
        telefone: telefone || undefined,
      });
    }

    console.log(`[COBMAIS] Total de linhas lidas: ${devedores.length}`);
    return devedores;
  };

  const parsePagamentos = async (dataRows: Record<string, unknown>[]): Promise<PagamentoRow[]> => {
    // Parse rows and filter only STATUS = "PAGA"
    const rawRows: PagamentoRow[] = [];
    // Debug: log first 3 rows to see actual column mapping
    console.log('[PAGAMENTOS] Primeiras 3 linhas:', dataRows.slice(0, 3).map(r => {
      const keys = Object.keys(r);
      return { keys, K: r['K'], J: r['J'], allValues: keys.map(k => `${k}=${r[k]}`) };
    }));
    console.log('[PAGAMENTOS] Total dataRows:', dataRows.length);
    for (const row of dataRows) {
      const statusRaw = String(row['K'] ?? '').trim().toUpperCase();
      if (statusRaw !== 'PAGA') continue;

      let cpf = String(row['A'] ?? '').replace(/\D/g, '');
      if (cpf.length >= 10 && cpf.length < 11) cpf = cpf.padStart(11, '0');
      if (cpf.length < 11) continue;

      let vencimentoStr = '';
      const vencRaw = row['H'];
      if (typeof vencRaw === 'number') {
        const dt = XLSX.SSF.parse_date_code(vencRaw);
        if (dt) {
          vencimentoStr = `${String(dt.d).padStart(2, '0')}/${String(dt.m).padStart(2, '0')}/${dt.y}`;
        }
      } else if (vencRaw) {
        vencimentoStr = String(vencRaw);
      }

      rawRows.push({
        cpf,
        cliente: String(row['B'] ?? ''),
        numero_parcela: parseInt(String(row['G'] ?? '0')) || 0,
        vencimento: vencimentoStr,
        valor: parseNum(row['I']),
        observacao: String(row['J'] ?? ''),
        status_planilha: 'PAGA',
      });
    }

    if (rawRows.length === 0) return [];

    // Detect 0-based parcela numbering per CPF and shift to 1-based
    const cpfGroups = new Map<string, PagamentoRow[]>();
    for (const row of rawRows) {
      if (!cpfGroups.has(row.cpf)) cpfGroups.set(row.cpf, []);
      cpfGroups.get(row.cpf)!.push(row);
    }
    for (const [, rows] of cpfGroups) {
      const hasZero = rows.some(r => r.numero_parcela === 0);
      if (hasZero) {
        for (const r of rows) {
          r.numero_parcela += 1;
        }
      }
    }

    // Get unique CPFs
    const uniqueCpfs = [...new Set(rawRows.map(r => r.cpf))];
    console.log(`[PAGAMENTOS] ${rawRows.length} linhas PAGA, ${uniqueCpfs.length} CPFs únicos`);

    // Fetch all active acordos for these CPFs
    const { data: acordos } = await supabase
      .from('acordos')
      .select('id, cliente_cpf, status')
      .in('status', ['ativo', 'concluido']);

    // Build CPF -> acordo map (normalized)
    const cpfAcordoMap = new Map<string, string>();
    if (acordos) {
      for (const a of acordos) {
        const cpfNorm = (a.cliente_cpf || '').replace(/\D/g, '');
        if (cpfNorm && !cpfAcordoMap.has(cpfNorm)) {
          cpfAcordoMap.set(cpfNorm, a.id);
        }
      }
    }

    // Get acordo IDs that we found
    const acordoIds = [...new Set(
      rawRows
        .map(r => cpfAcordoMap.get(r.cpf))
        .filter(Boolean)
    )] as string[];

    // Fetch all pagamentos for these acordos
    const pagamentosMap = new Map<string, { id: string; numero_parcela: number; status: string }[]>();
    if (acordoIds.length > 0) {
      // Fetch in batches to avoid URI too long
      for (let i = 0; i < acordoIds.length; i += 50) {
        const batch = acordoIds.slice(i, i + 50);
        const { data: pags } = await supabase
          .from('pagamentos')
          .select('id, acordo_id, numero_parcela, status')
          .in('acordo_id', batch);
        if (pags) {
          for (const p of pags) {
            if (!pagamentosMap.has(p.acordo_id)) pagamentosMap.set(p.acordo_id, []);
            pagamentosMap.get(p.acordo_id)!.push({ id: p.id, numero_parcela: p.numero_parcela, status: p.status });
          }
        }
      }
    }

    // Match each row
    for (const row of rawRows) {
      const acordoId = cpfAcordoMap.get(row.cpf);
      if (!acordoId) {
        row.sem_acordo = true;
        continue;
      }
      row.acordo_id = acordoId;
      const parcelas = pagamentosMap.get(acordoId) || [];
      const match = parcelas.find(p => p.numero_parcela === row.numero_parcela);
      if (match) {
        row.pagamento_id = match.id;
        row.ja_pago = match.status === 'pago';
      } else {
        row.sem_acordo = true; // parcela not found
      }
    }

    return rawRows;
  };

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setImported(false);
    setPagamentoImported(false);
    setParsing(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'buffer' });

        if (credorSelecionado === 'pagamentos') {
          // Find the sheet with the most data — try all sheets and pick the one with most rows
          let bestSheet = workbook.Sheets[workbook.SheetNames[0]];
          let bestSheetName = workbook.SheetNames[0];
          let bestRowCount = 0;
          for (const sName of workbook.SheetNames) {
            const s = workbook.Sheets[sName];
            const ref = s['!ref'] || '';
            const match = ref.match(/:.*?(\d+)$/);
            const rowCount = match ? parseInt(match[1], 10) : 0;
            if (rowCount > bestRowCount) {
              bestRowCount = rowCount;
              bestSheet = s;
              bestSheetName = sName;
            }
          }
          const sheet = bestSheet;
          console.log('[PAGAMENTOS] Using sheet:', bestSheetName, 'ref:', sheet['!ref'], 'rows:', bestRowCount);
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 'A' });
          console.log('[PAGAMENTOS] json.length:', json.length);
          if (json.length > 1) {
            console.log('[PAGAMENTOS] Row 2 sample:', Object.keys(json[1]).map(k => `${k}=${json[1][k]}`).join(', '));
          }
          const dataRows = json.slice(1);
          const parsed = await parsePagamentos(dataRows);
          setPagamentoRows(parsed);
          setRows([]);
          if (parsed.length === 0) {
            toast({ title: 'Nenhuma parcela PAGA encontrada', description: 'A planilha não contém linhas com status PAGA.', variant: 'destructive' });
          }
        } else if (credorSelecionado === 'montreal_atualizacao') {
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 'A' });
          const dataRows = json.slice(1);
          const parsed = await parseMontrealAtualizacao(dataRows);
          setMontrealRows(parsed);
          setRows([]);
          setPagamentoRows([]);
          if (parsed.length === 0) {
            toast({ title: 'Nenhum registro encontrado', description: 'A planilha não contém dados válidos.', variant: 'destructive' });
          }
        } else {
          let parsed: DevedorRow[];
          if (credorSelecionado === 'cobmais') {
            parsed = parseCobmais(workbook);
          } else {
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 'A' });
            const dataRows = json.slice(1);
            parsed = credorSelecionado === 'montreal' ? parseMontreal(dataRows) : credorSelecionado === 'pesquisa' ? parsePesquisa(dataRows) : parsePadrao(dataRows);
          }
          setRows(parsed);
          setPagamentoRows([]);
          setMontrealRows([]);
          if (parsed.length === 0) {
            toast({ title: 'Nenhum registro encontrado', description: 'A planilha não contém dados válidos para importar.', variant: 'destructive' });
          }
        }
      } catch {
        toast({ title: 'Erro ao processar planilha', variant: 'destructive' });
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setParsing(false);
      toast({ title: 'Erro ao ler arquivo', variant: 'destructive' });
    };
    reader.readAsArrayBuffer(f);
  }, [credorSelecionado]);

  const parseDate = (raw: string): string | null => {
    if (!raw) return null;
    const parts = raw.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      if (day && month && year && year.length === 4) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    return null;
  };

  const handleImportPagamentos = async () => {
    const toUpdate = pagamentoRows.filter(r => r.pagamento_id && !r.ja_pago);
    if (toUpdate.length === 0) {
      toast({ title: 'Nada para atualizar', description: 'Todas as parcelas já estão marcadas como pagas.', variant: 'destructive' });
      return;
    }

    setPagamentoImporting(true);
    setPagamentoProgress(0);
    setPagamentoUpdated(0);

    let updated = 0;
    for (let i = 0; i < toUpdate.length; i++) {
      const row = toUpdate[i];
      const dataPaga = parseDate(row.vencimento);
      const { error } = await supabase
        .from('pagamentos')
        .update({ status: 'pago', data_paga: dataPaga } as any)
        .eq('id', row.pagamento_id!);
      
      if (!error) {
        updated++;
        row.ja_pago = true;
      }
      setPagamentoUpdated(updated);
      setPagamentoProgress(Math.round(((i + 1) / toUpdate.length) * 100));
    }

    setPagamentoImported(true);
    setPagamentoImporting(false);
    toast({ title: 'Importação concluída', description: `${updated} parcelas marcadas como pagas.` });
  };

  const handleImport = async () => {
    if (!user || rows.length === 0) return;

    const credorFinal = credorDestino === 'outro' ? credorOutro.trim() : credorDestino;
    if (!credorFinal) {
      toast({ title: 'Selecione o credor de destino', variant: 'destructive' });
      return;
    }

    setImporting(true);
    setImportProgress(0);
    setInsertedCount(0);

    const { data: importacao, error: importError } = await supabase
      .from('importacoes' as any)
      .insert({
        nome_arquivo: file?.name || 'unknown',
        credor: credorFinal,
        total_registros: rows.length,
        importado_por: user.id,
      } as any)
      .select('id')
      .single();

    if (importError || !importacao) {
      toast({ title: 'Erro ao registrar importação', description: importError?.message, variant: 'destructive' });
      setImporting(false);
      return;
    }

    const importacaoId = (importacao as any).id;

    const records = rows.map(r => ({
      nome: r.nome,
      cpf: r.cpf,
      valor_original: r.valor_original,
      valor_atualizado: r.valor_atualizado,
      credor: credorFinal,
      descricao: credorSelecionado === 'montreal' ? (r.descricao || null) : (r.credor || null),
      contrato: r.contrato || null,
      data_vencimento: credorSelecionado === 'pesquisa' ? null : (credorSelecionado === 'montreal' || credorSelecionado === 'cobmais') ? parseDate(r.atraso) : parseDate(r.nascimento),
      telefone: r.telefone || null,
      importado_por: user.id,
      arquivo_importacao: file?.name || 'unknown',
      importacao_id: importacaoId,
    }));

    const BATCH_SIZE = 500;
    let inserted = 0;
    let batchError: any = null;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('devedores' as any).insert(batch as any);
      if (error) {
        batchError = error;
        break;
      }
      inserted += batch.length;
      setInsertedCount(inserted);
      setImportProgress(Math.round((inserted / records.length) * 100));
    }

    if (batchError) {
      toast({
        title: 'Erro na importação',
        description: `${inserted} de ${records.length} registros inseridos antes do erro: ${batchError.message}`,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Importação concluída', description: `${records.length} registros importados com sucesso.` });
      setImported(true);
      fetchImportacoes();
    }
    setImporting(false);
  };

  const handleDeleteImportacao = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('importacoes' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Importação excluída', description: 'Todos os devedores associados foram removidos.' });
      fetchImportacoes();
    }
    setDeleting(null);
  };

  const handleClear = () => {
    setFile(null);
    setRows([]);
    setPagamentoRows([]);
    setMontrealRows([]);
    setImported(false);
    setPagamentoImported(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportMontrealAtualizacao = async () => {
    if (!user) return;
    const toImport = montrealRows.filter(r => r.status_importacao !== 'existe');
    if (toImport.length === 0) {
      toast({ title: 'Nada para importar', description: 'Todas as parcelas já existem no sistema.', variant: 'destructive' });
      return;
    }

    setImporting(true);
    setImportProgress(0);
    setInsertedCount(0);

    const { data: importacao, error: importError } = await supabase
      .from('importacoes' as any)
      .insert({
        nome_arquivo: file?.name || 'unknown',
        credor: 'MONTREAL',
        total_registros: toImport.length,
        importado_por: user.id,
      } as any)
      .select('id')
      .single();

    if (importError || !importacao) {
      toast({ title: 'Erro ao registrar importação', description: importError?.message, variant: 'destructive' });
      setImporting(false);
      return;
    }

    const importacaoId = (importacao as any).id;

    const records = toImport.map(r => ({
      nome: r.nome,
      cpf: r.cpf,
      valor_original: r.valor_original,
      valor_atualizado: r.valor_atualizado,
      credor: 'MONTREAL',
      descricao: r.descricao || null,
      contrato: r.contrato || null,
      data_vencimento: parseDate(r.atraso),
      telefone: r.telefone || null,
      importado_por: user.id,
      arquivo_importacao: file?.name || 'unknown',
      importacao_id: importacaoId,
    }));

    const BATCH_SIZE = 500;
    let inserted = 0;
    let batchError: any = null;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('devedores' as any).insert(batch as any);
      if (error) {
        batchError = error;
        break;
      }
      inserted += batch.length;
      setInsertedCount(inserted);
      setImportProgress(Math.round((inserted / records.length) * 100));
    }

    if (batchError) {
      toast({
        title: 'Erro na importação',
        description: `${inserted} de ${records.length} registros inseridos antes do erro: ${batchError.message}`,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Importação concluída', description: `${inserted} registros importados (${montrealRows.filter(r => r.status_importacao === 'existe').length} ignorados por já existirem).` });
      setImported(true);
      fetchImportacoes();
    }
    setImporting(false);
  };

  const isMontreal = credorSelecionado === 'montreal';
  const isCobmais = credorSelecionado === 'cobmais';
  const isPesquisa = credorSelecionado === 'pesquisa';

  // Pagamentos summary
  const pagToUpdate = pagamentoRows.filter(r => r.pagamento_id && !r.ja_pago);
  const pagJaPago = pagamentoRows.filter(r => r.ja_pago);
  const pagSemAcordo = pagamentoRows.filter(r => r.sem_acordo);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Importar Devedores</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload de Planilha
            </CardTitle>
            <CardDescription>
              {DESCRICOES[credorSelecionado]}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Credor / Layout da Planilha</Label>
              <Select value={credorSelecionado} onValueChange={(v) => handleCredorChange(v as CredorLayout)}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="padrao">Padrão</SelectItem>
                  <SelectItem value="montreal">MONTREAL</SelectItem>
                  <SelectItem value="montreal_atualizacao">MONTREAL (Atualização)</SelectItem>
                   <SelectItem value="cobmais">COBMAIS</SelectItem>
                   <SelectItem value="pesquisa">Pesquisa Cliente</SelectItem>
                   <SelectItem value="pagamentos">Pagamentos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!isPagamentos && !isMontrealAtualizacao && (
              <div className="space-y-2">
                <Label>Credor de Destino</Label>
                <Select value={credorDestino} onValueChange={setCredorDestino}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Selecione o credor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CREDORES_OPCOES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    <SelectItem value="outro">Outro (digitar)</SelectItem>
                  </SelectContent>
                </Select>
                {credorDestino === 'outro' && (
                  <Input
                    placeholder="Digite o nome do credor"
                    value={credorOutro}
                    onChange={(e) => setCredorOutro(e.target.value)}
                    className="max-w-xs"
                  />
                )}
              </div>
            )}
            {isPagamentos && (
              <div className="text-sm text-muted-foreground">
                Credor: <strong>UME | NOVO MUNDO</strong> (automático)
              </div>
            )}
            {isMontrealAtualizacao && (
              <div className="text-sm text-muted-foreground">
                Credor: <strong>MONTREAL</strong> (automático) — O sistema cruzará os dados e importará apenas parcelas novas.
              </div>
            )}
            <div className="flex items-center gap-4">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                className="max-w-sm"
                disabled={parsing}
              />
              {file && !parsing && (
                <Button variant="outline" size="sm" onClick={handleClear}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>

            {parsing && (
              <Card className="border-dashed">
                <CardContent className="flex items-center gap-3 py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="font-semibold text-sm">Processando planilha...</p>
                    <p className="text-xs text-muted-foreground">
                      {isPagamentos ? 'Lendo parcelas e cruzando com acordos no sistema...' : 'Lendo abas e cruzando dados, aguarde...'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* Montreal Atualização Preview */}
        {isMontrealAtualizacao && montrealRows.length > 0 && (() => {
          const existe = montrealRows.filter(r => r.status_importacao === 'existe').length;
          const novaParcela = montrealRows.filter(r => r.status_importacao === 'nova_parcela').length;
          const clienteNovo = montrealRows.filter(r => r.status_importacao === 'cliente_novo').length;
          const toImport = novaParcela + clienteNovo;
          return (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5" />
                      Preview Montreal ({montrealRows.length} registros)
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {file?.name} — 
                      <span className="text-green-600 font-medium"> {existe} já existem</span>,
                      <span className="text-yellow-600 font-medium"> {novaParcela} novas parcelas</span>,
                      <span className="text-blue-600 font-medium"> {clienteNovo} clientes novos</span>
                      {toImport > 0 && <span className="font-semibold"> → {toImport} serão importados</span>}
                    </CardDescription>
                  </div>
                  {!imported ? (
                    <Button
                      onClick={handleImportMontrealAtualizacao}
                      disabled={importing || toImport === 0}
                      style={{ background: '#00a86b', color: '#fff' }}
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Importando...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Importar {toImport} registros
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 text-sm" style={{ color: '#00a86b' }}>
                      <Check className="h-4 w-4" />
                      {insertedCount} registros importados
                    </div>
                  )}
                </div>
                {importing && (
                  <div className="mt-4 space-y-2">
                    <Progress value={importProgress} className="h-3" />
                    <p className="text-sm text-muted-foreground text-center">
                      Inserindo {insertedCount.toLocaleString('pt-BR')} de {toImport.toLocaleString('pt-BR')} registros... ({importProgress}%)
                    </p>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>CPF/CNPJ</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Nro Nota</TableHead>
                        <TableHead>Desdob.</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor (R$)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {montrealRows.slice(0, 100).map((row, i) => (
                        <TableRow key={i} className={row.status_importacao === 'existe' ? 'opacity-50' : ''}>
                          <TableCell>
                            {row.status_importacao === 'existe' ? (
                              <Badge className="bg-green-600 hover:bg-green-700 text-white">Já existe</Badge>
                            ) : row.status_importacao === 'nova_parcela' ? (
                              <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Nova parcela</Badge>
                            ) : (
                              <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Cliente novo</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{row.cpf}</TableCell>
                          <TableCell>{row.nome}</TableCell>
                          <TableCell>{row.contrato || '-'}</TableCell>
                          <TableCell>{row.descricao || '-'}</TableCell>
                          <TableCell>{row.atraso || '-'}</TableCell>
                          <TableCell>{row.valor_original.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {montrealRows.length > 100 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Mostrando 100 de {montrealRows.length} registros
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Pagamentos Preview */}
        {isPagamentos && pagamentoRows.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    Preview Pagamentos ({pagamentoRows.length} parcelas PAGAS)
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {file?.name} — 
                    <span className="text-yellow-600 font-medium"> {pagToUpdate.length} a atualizar</span>,
                    <span className="text-green-600 font-medium"> {pagJaPago.length} já pagas</span>
                    {pagSemAcordo.length > 0 && <span className="text-red-600 font-medium">, {pagSemAcordo.length} sem acordo</span>}
                  </CardDescription>
                </div>
                {!pagamentoImported ? (
                  <Button
                    onClick={handleImportPagamentos}
                    disabled={pagamentoImporting || pagToUpdate.length === 0}
                    style={{ background: '#00a86b', color: '#fff' }}
                  >
                    {pagamentoImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Atualizando...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Marcar {pagToUpdate.length} como Pagas
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 text-sm" style={{ color: '#00a86b' }}>
                    <Check className="h-4 w-4" />
                    {pagamentoUpdated} parcelas atualizadas
                  </div>
                )}
              </div>
              {pagamentoImporting && (
                <div className="mt-4 space-y-2">
                  <Progress value={pagamentoProgress} className="h-3" />
                  <p className="text-sm text-muted-foreground text-center">
                    Atualizando {pagamentoUpdated} de {pagToUpdate.length} parcelas... ({pagamentoProgress}%)
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CPF</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status no Sistema</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagamentoRows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{row.cpf}</TableCell>
                        <TableCell>{row.cliente}</TableCell>
                        <TableCell className="text-center">{row.numero_parcela}</TableCell>
                        <TableCell>{row.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                        <TableCell>{row.vencimento}</TableCell>
                        <TableCell>
                          {row.sem_acordo ? (
                            <Badge variant="destructive">Acordo não encontrado</Badge>
                          ) : row.ja_pago ? (
                            <Badge className="bg-green-600 hover:bg-green-700 text-white">Já pago</Badge>
                          ) : (
                            <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Será marcado como pago</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Standard Devedores Preview */}
        {!isPagamentos && rows.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    Preview ({rows.length} registros)
                  </CardTitle>
                  <CardDescription>{file?.name}</CardDescription>
                </div>
                {!imported ? (
                   <Button onClick={handleImport} disabled={importing} style={{ background: '#00a86b', color: '#fff' }}>
                     {importing ? (
                       <>
                         <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                         Importando...
                       </>
                     ) : (
                       <>
                         <Check className="h-4 w-4 mr-1" />
                         Confirmar Importação
                       </>
                     )}
                   </Button>
                ) : (
                  <div className="flex items-center gap-2 text-sm" style={{ color: '#00a86b' }}>
                    <Check className="h-4 w-4" />
                    Importado com sucesso
                  </div>
                )}
              </div>
              {importing && (
                <div className="mt-4 space-y-2">
                  <Progress value={importProgress} className="h-3" />
                  <p className="text-sm text-muted-foreground text-center">
                    Inserindo {insertedCount.toLocaleString('pt-BR')} de {rows.length.toLocaleString('pt-BR')} registros... ({importProgress}%)
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <Switch checked={grouped} onCheckedChange={setGrouped} id="group-toggle" />
                <Label htmlFor="group-toggle" className="flex items-center gap-1 cursor-pointer">
                  <Users className="h-4 w-4" />
                  Agrupar por CPF/CNPJ
                </Label>
              </div>

              {grouped ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(() => {
                    const groups = rows.reduce<Record<string, { cpf: string; nome: string; contratos: number; valorTotal: number }>>((acc, row) => {
                      const cpfNorm = row.cpf.replace(/\D/g, '');
                      if (!acc[cpfNorm]) {
                        acc[cpfNorm] = { cpf: row.cpf, nome: row.nome, contratos: 0, valorTotal: 0 };
                      }
                      acc[cpfNorm].contratos += 1;
                      acc[cpfNorm].valorTotal += row.valor_atualizado;
                      return acc;
                    }, {});

                    return Object.entries(groups).map(([cpfNorm, g]) => (
                      <div key={cpfNorm} className="flex items-center justify-between border rounded-lg p-3">
                        <div>
                          <p className="font-medium">{g.nome}</p>
                          <p className="text-xs text-muted-foreground font-mono">{g.cpf}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-semibold">
                              {g.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-xs text-muted-foreground">{g.contratos} contrato{g.contratos !== 1 ? 's' : ''}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const { data } = await supabase
                                .from('devedores')
                                .select('id')
                                .eq('ativo', true)
                                .limit(1);
                              const match = data?.find((d: any) => {
                                return true;
                              });
                              const { data: devs } = await supabase
                                .from('devedores')
                                .select('id, cpf')
                                .eq('ativo', true);
                              const found = devs?.find((d: any) => d.cpf.replace(/\D/g, '') === cpfNorm);
                              if (found) navigate(`/clientes/${found.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Ficha
                          </Button>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>CPF/CNPJ</TableHead>
                        {isPesquisa ? (
                          <>
                            <TableHead>Nome</TableHead>
                            <TableHead>Telefone</TableHead>
                          </>
                        ) : isMontreal ? (
                          <>
                            <TableHead>Nome</TableHead>
                            <TableHead>Nro Nota</TableHead>
                            <TableHead>Tipo Título</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Valor (R$)</TableHead>
                            <TableHead>Telefone</TableHead>
                          </>
                        ) : isCobmais ? (
                          <>
                            <TableHead>Nome</TableHead>
                            <TableHead>Contrato</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Total (R$)</TableHead>
                            <TableHead>Telefone</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead>Nascimento</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Credor</TableHead>
                            <TableHead>Contrato</TableHead>
                            <TableHead>Atraso</TableHead>
                            <TableHead>Risco (R$)</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 50).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{row.cpf}</TableCell>
                          {isPesquisa ? (
                            <>
                              <TableCell>{row.nome || <span className="text-destructive"><AlertCircle className="h-3 w-3 inline" /> Vazio</span>}</TableCell>
                              <TableCell>{row.telefone || '-'}</TableCell>
                            </>
                          ) : isMontreal ? (
                            <>
                              <TableCell>{row.nome || <span className="text-destructive"><AlertCircle className="h-3 w-3 inline" /> Vazio</span>}</TableCell>
                              <TableCell>{row.contrato || '-'}</TableCell>
                              <TableCell>{row.descricao || '-'}</TableCell>
                              <TableCell>{row.atraso || '-'}</TableCell>
                              <TableCell>{row.valor_original.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                              <TableCell>{row.telefone || '-'}</TableCell>
                            </>
                          ) : isCobmais ? (
                            <>
                              <TableCell>{row.nome || <span className="text-destructive"><AlertCircle className="h-3 w-3 inline" /> Vazio</span>}</TableCell>
                              <TableCell>{row.contrato || '-'}</TableCell>
                              <TableCell>{row.atraso || '-'}</TableCell>
                              <TableCell>{row.valor_original.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                              <TableCell>{row.telefone || '-'}</TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell>{row.nascimento || '-'}</TableCell>
                              <TableCell>{row.nome || <span className="text-destructive"><AlertCircle className="h-3 w-3 inline" /> Vazio</span>}</TableCell>
                              <TableCell>{row.credor || '-'}</TableCell>
                              <TableCell>{row.contrato || '-'}</TableCell>
                              <TableCell>{row.atraso || '-'}</TableCell>
                              <TableCell>{row.valor_original.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {rows.length > 50 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Mostrando 50 de {rows.length} registros
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Histórico de Importações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Importações
            </CardTitle>
            <CardDescription>Planilhas importadas anteriormente. Ao excluir, todos os devedores associados serão removidos.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : importacoes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma importação registrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Credor</TableHead>
                      <TableHead>Registros</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importacoes.map((imp) => (
                      <TableRow key={imp.id}>
                        <TableCell className="font-medium">{imp.nome_arquivo}</TableCell>
                        <TableCell className="capitalize">{imp.credor}</TableCell>
                        <TableCell>{imp.total_registros}</TableCell>
                        <TableCell>{new Date(imp.criado_em).toLocaleDateString('pt-BR')} {new Date(imp.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" disabled={deleting === imp.id}>
                                <Trash2 className="h-4 w-4 mr-1" />
                                {deleting === imp.id ? 'Excluindo...' : 'Excluir'}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir importação?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Isso removerá permanentemente <strong>{imp.total_registros} devedores</strong> importados do arquivo "<strong>{imp.nome_arquivo}</strong>". Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteImportacao(imp.id)}>
                                  Confirmar Exclusão
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
