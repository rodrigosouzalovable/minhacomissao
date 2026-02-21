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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import * as XLSX from 'xlsx';

type CredorLayout = 'padrao' | 'montreal' | 'cobmais';

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
  montreal: 'A = CPF/CNPJ, B = Nome/Razão Social, C = Nº Contrato, F = Tipo Contrato, H = Parcela, I = Vencimento, J = Valor, L = Tel Residencial, M = Tel Comercial',
  cobmais: 'A = CPF/CNPJ, B = Cliente, C = Contrato, D = Número, E = Vencimento, F = Valor, G = Total | Aba 2: Telefones (opcional)',
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const CREDORES_OPCOES = ['MUNDO DA MODA', 'UME | NOVO MUNDO', 'MONTREAL'];

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
    setImported(false);
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
      const telRes = String(row['L'] ?? '').replace(/\D/g, '');
      const telCom = String(row['M'] ?? '').replace(/\D/g, '');
      return {
        cpf: String(row['A'] ?? '').replace(/\D/g, ''),
        nascimento: '',
        nome: String(row['B'] ?? ''),
        credor: 'MONTREAL',
        contrato: String(row['C'] ?? ''),
        descricao: String(row['F'] ?? ''),
        atraso: String(row['H'] ?? ''),
        valor_original: valor,
        valor_atualizado: valor,
        telefone: telRes || telCom || undefined,
      };
    }).filter(r => r.cpf.length >= 11);
  };

  const parseCobmais = (workbook: XLSX.WorkBook): DevedorRow[] => {
    // Aba 1 - Dados principais
    const sheet1 = workbook.Sheets[workbook.SheetNames[0]];
    const rows1 = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet1, { header: 'A' }).slice(1);
    console.log('[COBMAIS] Total de abas:', workbook.SheetNames.length, '| Linhas aba 1:', rows1.length);

    // Aba 2 - Telefones (opcional)
    const sheet2 = workbook.SheetNames.length >= 2 ? workbook.Sheets[workbook.SheetNames[1]] : null;
    const rows2 = sheet2 ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet2, { header: 'A' }).slice(1) : [];

    // Construir mapa de CPF real (zeros à esquerda) e telefones a partir da Aba 2
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

    // Cada linha da planilha = 1 registro individual (cada parcela)
    const devedores: DevedorRow[] = [];
    for (const row of rows1) {
      const cpf = resolverCpf(row['A']);
      if (cpf.length < 11) continue;

      const contrato = String(row['C'] ?? '').trim();
      const valor = parseNum(row['F']); // Valor da parcela individual

      // Converter vencimento Excel serial number para string dd/mm/yyyy
      let vencimentoStr = '';
      const vencRaw = row['E'];
      if (typeof vencRaw === 'number') {
        const dt = XLSX.SSF.parse_date_code(vencRaw);
        if (dt) {
          vencimentoStr = `${String(dt.d).padStart(2, '0')}/${String(dt.m).padStart(2, '0')}/${dt.y}`;
        }
      } else if (vencRaw) {
        vencimentoStr = String(vencRaw);
      }

      devedores.push({
        cpf,
        nascimento: '',
        nome: String(row['B'] ?? ''),
        credor: '',
        contrato,
        atraso: vencimentoStr,
        valor_original: valor,
        valor_atualizado: valor,
        telefone: phoneMap.get(cpf) || undefined,
      });
    }

    console.log(`[COBMAIS] Total de linhas lidas: ${devedores.length}`);
    return devedores;
  };

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setImported(false);
    setParsing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        let parsed: DevedorRow[];
        if (credorSelecionado === 'cobmais') {
          parsed = parseCobmais(workbook);
        } else {
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 'A' });
          const dataRows = json.slice(1);
          parsed = credorSelecionado === 'montreal' ? parseMontreal(dataRows) : parsePadrao(dataRows);
        }
        setRows(parsed);
        if (parsed.length === 0) {
          toast({ title: 'Nenhum registro encontrado', description: 'A planilha não contém dados válidos para importar.', variant: 'destructive' });
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

    // 1. Create importacao record
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

    // 2. Insert devedores with importacao_id
    const records = rows.map(r => ({
      nome: r.nome,
      cpf: r.cpf,
      valor_original: r.valor_original,
      valor_atualizado: r.valor_atualizado,
      credor: credorFinal,
      descricao: credorSelecionado === 'montreal' ? (r.descricao || null) : (r.credor || null),
      contrato: r.contrato || null,
      data_vencimento: (credorSelecionado === 'montreal' || credorSelecionado === 'cobmais') ? parseDate(r.atraso) : parseDate(r.nascimento),
      telefone: r.telefone || null,
      importado_por: user.id,
      arquivo_importacao: file?.name || 'unknown',
      importacao_id: importacaoId,
    }));

    // Inserção em lotes de 500 registros
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
    setImported(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isMontreal = credorSelecionado === 'montreal';
  const isCobmais = credorSelecionado === 'cobmais';

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
                  <SelectItem value="cobmais">COBMAIS</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                    <p className="text-xs text-muted-foreground">Lendo abas e cruzando dados, aguarde...</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {rows.length > 0 && (
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
                                return true; // navigate with CPF search
                              });
                              // Navigate to first matching devedor by CPF
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
                        {isMontreal ? (
                          <>
                            <TableHead>Nome</TableHead>
                            <TableHead>Contrato</TableHead>
                            <TableHead>Tipo Contrato</TableHead>
                            <TableHead>Parcela</TableHead>
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
                          {isMontreal ? (
                            <>
                              <TableCell>{row.nome || <span className="text-destructive"><AlertCircle className="h-3 w-3 inline" /> Vazio</span>}</TableCell>
                              <TableCell>{row.contrato || '-'}</TableCell>
                              <TableCell>{row.descricao || '-'}</TableCell>
                              <TableCell>{row.atraso || '-'}</TableCell>
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
