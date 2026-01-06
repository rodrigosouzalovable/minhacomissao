import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Upload, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatarMoeda, formatarData, calcularPercentualComissaoEmpresa } from '@/lib/comissao';

interface LinhaImportada {
  cpf: string;
  nomeCliente: string;
  faixaAtraso: number;
  dataPagamento: string;
  valorPago: number;
  comissao: number; // Valor literal da coluna F (Receita)
}

interface PagamentoSistema {
  id: string;
  cpf: string;
  nomeCliente: string;
  dataPaga: string | null;
  valorParcela: number;
  comissaoParcela: number;
  diasAtraso: number;
}

interface Divergencia {
  cpf: string;
  nomeClientePlanilha: string;
  nomeClienteSistema: string;
  tipoDivergencia: string;
  valorPlanilha: number;
  valorSistema: number;
  comissaoPlanilha: number;
  comissaoSistema: number;
  dataPlanilha: string;
  dataSistema: string;
}

const normalizarCPF = (cpf: string): string => {
  return String(cpf || '').replace(/\D/g, '');
};

const parseDataExcel = (valor: any): string => {
  if (!valor) return '';
  
  // Se for número (formato de data do Excel)
  if (typeof valor === 'number') {
    const data = XLSX.SSF.parse_date_code(valor);
    if (data) {
      return `${String(data.d).padStart(2, '0')}/${String(data.m).padStart(2, '0')}/${data.y}`;
    }
  }
  
  // Se for string, retorna como está
  return String(valor);
};

const parseValorNumerico = (valor: any): number => {
  if (typeof valor === 'number') return valor;
  if (!valor) return 0;
  
  // Remove R$, espaços e converte vírgula para ponto
  const limpo = String(valor)
    .replace(/R\$\s?/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  return parseFloat(limpo) || 0;
};

const compararValores = (v1: number, v2: number, tolerancia = 0.01): boolean => {
  return Math.abs(v1 - v2) <= tolerancia;
};

const formatarDataParaComparacao = (data: string): string => {
  if (!data) return '';
  
  // Se já está no formato dd/mm/yyyy
  if (data.includes('/')) {
    return data;
  }
  
  // Se está no formato yyyy-mm-dd
  if (data.includes('-')) {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  
  return data;
};

export default function Auditoria() {
  const { toast } = useToast();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [dadosImportados, setDadosImportados] = useState<LinhaImportada[]>([]);
  const [divergencias, setDivergencias] = useState<Divergencia[]>([]);
  const [correspondencias, setCorrespondencias] = useState(0);
  const [processado, setProcessado] = useState(false);

  const handleArquivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setArquivo(file);
      setProcessado(false);
      setDivergencias([]);
      setCorrespondencias(0);
    }
  };

  const processarPlanilha = async () => {
    if (!arquivo) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Selecione um arquivo Excel para processar.',
      });
      return;
    }

    setProcessando(true);

    try {
      // Ler arquivo Excel
      const buffer = await arquivo.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Ignorar cabeçalho (primeira linha) e processar dados
      const linhasImportadas: LinhaImportada[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || !row[0]) continue; // Pular linhas vazias

        linhasImportadas.push({
          cpf: normalizarCPF(row[0]),
          nomeCliente: String(row[1] || '').trim(),
          faixaAtraso: parseInt(String(row[2] || '0'), 10),
          dataPagamento: parseDataExcel(row[3]),
          valorPago: parseValorNumerico(row[4]),
          comissao: parseValorNumerico(row[5]), // Valor literal da coluna F (Receita)
        });
      }

      setDadosImportados(linhasImportadas);

      // Buscar todos os pagamentos pagos do sistema
      const { data: pagamentosRaw, error } = await supabase
        .from('pagamentos')
        .select(`
          id,
          data_paga,
          valor_parcela,
          comissao_parcela,
          acordos (
            cliente_cpf,
            cliente_nome,
            dias_atraso
          )
        `)
        .eq('status', 'pago');

      if (error) throw error;

      const pagamentosSistema: PagamentoSistema[] = (pagamentosRaw || []).map((p: any) => ({
        id: p.id,
        cpf: normalizarCPF(p.acordos?.cliente_cpf || ''),
        nomeCliente: p.acordos?.cliente_nome || '',
        dataPaga: p.data_paga,
        valorParcela: p.valor_parcela,
        comissaoParcela: p.comissao_parcela,
        diasAtraso: p.acordos?.dias_atraso || 0,
      }));

      // Realizar comparação
      const divergenciasEncontradas: Divergencia[] = [];
      let correspondenciasCount = 0;

      // Agrupar pagamentos do sistema por CPF
      const pagamentosPorCPF = new Map<string, PagamentoSistema[]>();
      for (const pag of pagamentosSistema) {
        if (!pag.cpf) continue;
        const lista = pagamentosPorCPF.get(pag.cpf) || [];
        lista.push(pag);
        pagamentosPorCPF.set(pag.cpf, lista);
      }

      // Verificar cada linha da planilha
      for (const linha of linhasImportadas) {
        const pagamentosCliente = pagamentosPorCPF.get(linha.cpf) || [];

        if (pagamentosCliente.length === 0) {
          divergenciasEncontradas.push({
            cpf: linha.cpf,
            nomeClientePlanilha: linha.nomeCliente,
            nomeClienteSistema: '-',
            tipoDivergencia: 'CPF não encontrado no sistema',
            valorPlanilha: linha.valorPago,
            valorSistema: 0,
            comissaoPlanilha: linha.comissao,
            comissaoSistema: 0,
            dataPlanilha: linha.dataPagamento,
            dataSistema: '-',
          });
          continue;
        }

        // Procurar pagamento correspondente por data
        const dataPlanilhaFormatada = linha.dataPagamento;
        let encontrouCorrespondencia = false;

        for (const pagSistema of pagamentosCliente) {
          const dataSistemaFormatada = formatarDataParaComparacao(pagSistema.dataPaga || '');
          
          // Comparar por data
          if (dataPlanilhaFormatada === dataSistemaFormatada) {
            encontrouCorrespondencia = true;
            
            const divergencias: string[] = [];
            
            if (!compararValores(linha.valorPago, pagSistema.valorParcela)) {
              divergencias.push('Valor divergente');
            }
            
            // Calcular comissão do escritório esperada pelo SISTEMA
            const percentualEmpresa = calcularPercentualComissaoEmpresa(pagSistema.diasAtraso);
            const comissaoEscritorioSistema = Math.round(pagSistema.valorParcela * (percentualEmpresa / 100) * 100) / 100;
            
            // Comparar valor da planilha (coluna F) com comissão do escritório do sistema
            if (!compararValores(linha.comissao, comissaoEscritorioSistema)) {
              divergencias.push('Comissão divergente');
            }

            if (divergencias.length > 0) {
              divergenciasEncontradas.push({
                cpf: linha.cpf,
                nomeClientePlanilha: linha.nomeCliente,
                nomeClienteSistema: pagSistema.nomeCliente,
                tipoDivergencia: divergencias.join(', '),
                valorPlanilha: linha.valorPago,
                valorSistema: pagSistema.valorParcela,
                comissaoPlanilha: linha.comissao,
                comissaoSistema: comissaoEscritorioSistema,
                dataPlanilha: linha.dataPagamento,
                dataSistema: dataSistemaFormatada,
              });
            } else {
              correspondenciasCount++;
            }
            break;
          }
        }

        if (!encontrouCorrespondencia) {
          // Nenhum pagamento com a mesma data encontrado
          divergenciasEncontradas.push({
            cpf: linha.cpf,
            nomeClientePlanilha: linha.nomeCliente,
            nomeClienteSistema: pagamentosCliente[0]?.nomeCliente || '-',
            tipoDivergencia: 'Data de pagamento não encontrada',
            valorPlanilha: linha.valorPago,
            valorSistema: 0,
            comissaoPlanilha: linha.comissao,
            comissaoSistema: 0,
            dataPlanilha: linha.dataPagamento,
            dataSistema: '-',
          });
        }
      }

      setDivergencias(divergenciasEncontradas);
      setCorrespondencias(correspondenciasCount);
      setProcessado(true);

      toast({
        title: 'Processamento concluído',
        description: `${correspondenciasCount} correspondências, ${divergenciasEncontradas.length} divergências.`,
      });

    } catch (error) {
      console.error('Erro ao processar planilha:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao processar',
        description: 'Não foi possível processar a planilha. Verifique o formato.',
      });
    } finally {
      setProcessando(false);
    }
  };

  const exportarDivergencias = () => {
    if (divergencias.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Sem dados',
        description: 'Não há divergências para exportar.',
      });
      return;
    }

    const dadosExport = divergencias.map((d) => ({
      'CPF': d.cpf,
      'Nome Cliente (Planilha)': d.nomeClientePlanilha,
      'Nome Cliente (Sistema)': d.nomeClienteSistema,
      'Tipo de Divergência': d.tipoDivergencia,
      'Valor Planilha': d.valorPlanilha,
      'Valor Sistema': d.valorSistema,
      'Comissão Planilha': d.comissaoPlanilha,
      'Data Planilha': d.dataPlanilha,
      'Data Sistema': d.dataSistema,
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Divergências');

    // Ajustar largura das colunas
    ws['!cols'] = [
      { wch: 15 }, // CPF
      { wch: 30 }, // Nome Planilha
      { wch: 30 }, // Nome Sistema
      { wch: 30 }, // Tipo Divergência
      { wch: 15 }, // Valor Planilha
      { wch: 15 }, // Valor Sistema
      { wch: 18 }, // Comissão Planilha
      { wch: 15 }, // Data Planilha
      { wch: 15 }, // Data Sistema
    ];

    XLSX.writeFile(wb, 'divergencias-auditoria.xlsx');

    toast({
      title: 'Exportação concluída',
      description: 'Arquivo de divergências baixado com sucesso.',
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Auditoria de Pagamentos</h1>
            <p className="text-muted-foreground">
              Compare pagamentos da planilha com os registros do sistema
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Importar Planilha</CardTitle>
            <CardDescription>
              Selecione um arquivo Excel (.xlsx, .xls) com as colunas: CPF, Nome do Cliente, Faixa de Atraso, Data do Pagamento, Valor Pago, Comissão
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleArquivoChange}
                className="flex-1"
              />
              <Button
                onClick={processarPlanilha}
                disabled={!arquivo || processando}
              >
                <Upload className="h-4 w-4 mr-2" />
                {processando ? 'Processando...' : 'Processar e Comparar'}
              </Button>
            </div>
            
            {arquivo && (
              <p className="text-sm text-muted-foreground">
                Arquivo selecionado: {arquivo.name}
              </p>
            )}
          </CardContent>
        </Card>

        {processado && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="flex items-center gap-4 pt-6">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{correspondencias}</p>
                    <p className="text-muted-foreground">Registros correspondentes</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex items-center gap-4 pt-6">
                  <AlertTriangle className="h-10 w-10 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">{divergencias.length}</p>
                    <p className="text-muted-foreground">Divergências encontradas</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {divergencias.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Divergências Encontradas</CardTitle>
                    <CardDescription>
                      Lista de registros com diferenças entre a planilha e o sistema
                    </CardDescription>
                  </div>
                  <Button onClick={exportarDivergencias} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>CPF</TableHead>
                          <TableHead>Cliente (Planilha)</TableHead>
                          <TableHead>Cliente (Sistema)</TableHead>
                          <TableHead>Divergência</TableHead>
                          <TableHead className="text-right">Valor Plan.</TableHead>
                          <TableHead className="text-right">Valor Sist.</TableHead>
                          <TableHead className="text-right">Com. Plan.</TableHead>
                          <TableHead>Data Plan.</TableHead>
                          <TableHead>Data Sist.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {divergencias.map((d, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono text-sm">{d.cpf}</TableCell>
                            <TableCell>{d.nomeClientePlanilha}</TableCell>
                            <TableCell>{d.nomeClienteSistema}</TableCell>
                            <TableCell>
                              <Badge variant="destructive" className="text-xs">
                                {d.tipoDivergencia}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatarMoeda(d.valorPlanilha)}</TableCell>
                            <TableCell className="text-right">{formatarMoeda(d.valorSistema)}</TableCell>
                            <TableCell className="text-right">{formatarMoeda(d.comissaoPlanilha)}</TableCell>
                            <TableCell>{d.dataPlanilha}</TableCell>
                            <TableCell>{d.dataSistema}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {divergencias.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                  <h3 className="text-xl font-semibold">Tudo certo!</h3>
                  <p className="text-muted-foreground">
                    Todos os registros da planilha correspondem ao sistema.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
