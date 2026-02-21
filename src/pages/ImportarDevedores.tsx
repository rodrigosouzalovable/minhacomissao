import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Upload, FileSpreadsheet, Trash2, Check, AlertCircle, History, Users, Eye } from 'lucide-react';
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
  cobmais: 'Aba 1: CPF/CNPJ, Cliente, Credor, Contrato, Atraso, Risco | Aba 2: Telefones | Aba 4: Nascimento',
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
    // Aba 1 - Clientes (principal)
    const sheet1 = workbook.Sheets[workbook.SheetNames[0]];
    const rows1 = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet1, { header: 'A' }).slice(1);

    // Aba 2 - Telefones
    const sheet2 = workbook.Sheets[workbook.SheetNames[1]];
    const rows2 = sheet2 ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet2, { header: 'A' }).slice(1) : [];

    // Aba 4 - Dados Pessoais
    const sheet4 = workbook.SheetNames.length >= 4 ? workbook.Sheets[workbook.SheetNames[3]] : null;
    const rows4 = sheet4 ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet4, { header: 'A' }).slice(1) : [];

    // Mapear telefones ativos por CPF (primeiro telefone ativo encontrado)
    const phoneMap = new Map<string, string>();
    for (const row of rows2) {
      const cpf = String(row['A'] ?? '').replace(/\D/g, '');
      const ativo = String(row['I'] ?? '').toUpperCase().trim();
      if (cpf && ativo === 'SIM' && !phoneMap.has(cpf)) {
        const numero = String(row['C'] ?? '').replace(/\D/g, '');
        if (numero) phoneMap.set(cpf, numero);
      }
    }

    // Mapear nascimento por CPF
    const birthMap = new Map<string, string>();
    for (const row of rows4) {
      const cpf = String(row['A'] ?? '').replace(/\D/g, '');
      if (cpf && !birthMap.has(cpf)) {
        const nasc = String(row['D'] ?? '');
        if (nasc) birthMap.set(cpf, nasc);
      }
    }

    // Processar Aba 1 e combinar dados
    const cpfAccum = new Map<string, DevedorRow>();
    for (const row of rows1) {
      const cpf = String(row['A'] ?? '').replace(/\D/g, '');
      if (cpf.length < 11) continue;

      const risco = parseNum(row['M']);
      const existing = cpfAccum.get(cpf);

      if (existing) {
        existing.valor_original += risco;
        existing.valor_atualizado += risco;
      } else {
        cpfAccum.set(cpf, {
          cpf,
          nascimento: birthMap.get(cpf) || '',
          nome: String(row['C'] ?? ''),
          credor: String(row['D'] ?? ''),
          contrato: String(row['E'] ?? ''),
          atraso: String(row['F'] ?? ''),
          valor_original: risco,
          valor_atualizado: risco,
          telefone: phoneMap.get(cpf) || undefined,
        });
      }
    }

    return Array.from(cpfAccum.values());
  };

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setImported(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });

      if (credorSelecionado === 'cobmais') {
        const parsed = parseCobmais(workbook);
        setRows(parsed);
      } else {
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 'A' });
        const dataRows = json.slice(1);
        const parsed = credorSelecionado === 'montreal' ? parseMontreal(dataRows) : parsePadrao(dataRows);
        setRows(parsed);
      }
    };
    reader.readAsBinaryString(f);
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
    setImporting(true);

    // 1. Create importacao record
    const { data: importacao, error: importError } = await supabase
      .from('importacoes' as any)
      .insert({
        nome_arquivo: file?.name || 'unknown',
        credor: credorSelecionado,
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
      credor: r.credor || null,
      descricao: credorSelecionado === 'montreal' ? (r.descricao || null) : (r.credor || null),
      contrato: r.contrato || null,
      data_vencimento: credorSelecionado === 'montreal' ? parseDate(r.atraso) : parseDate(r.nascimento),
      ...(credorSelecionado === 'cobmais' ? { credor: r.credor || null } : {}),
      telefone: r.telefone || null,
      importado_por: user.id,
      arquivo_importacao: file?.name || 'unknown',
      importacao_id: importacaoId,
    }));

    const { error } = await supabase.from('devedores' as any).insert(records as any);

    if (error) {
      toast({ title: 'Erro na importação', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Importação concluída', description: `${rows.length} registros importados com sucesso.` });
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
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                className="max-w-sm"
              />
              {file && (
                <Button variant="outline" size="sm" onClick={handleClear}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
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
                    {importing ? 'Importando...' : (
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
                            <TableHead>Credor</TableHead>
                            <TableHead>Contrato</TableHead>
                            <TableHead>Atraso</TableHead>
                            <TableHead>Risco (R$)</TableHead>
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
                              <TableCell>{row.credor || '-'}</TableCell>
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
