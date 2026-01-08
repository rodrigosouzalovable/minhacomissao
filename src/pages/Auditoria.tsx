import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileSpreadsheet, Upload, Download, AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatarMoeda, formatarData, calcularPercentualComissaoEmpresa } from '@/lib/comissao';
import { Link } from 'react-router-dom';

interface LinhaImportada {
  cpf: string;
  nomeCliente: string;
  faixaAtraso: number;
  dataPagamento: string;
  valorPago: number;
  comissao: number;
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
  pagamentoId?: string;
}

interface AcordoDivergente {
  id: string;
  clienteNome: string;
  clienteCpf: string;
  valorTotal: number;
  somaParcelas: number;
  diferencaValor: number;
  qtdParcelasAcordo: number;
  qtdParcelasCadastradas: number;
  comissaoTotal: number;
  somaComissoes: number;
  diferencaComissao: number;
  tiposDivergencia: string[];
}

const normalizarCPF = (cpf: string): string => {
  return String(cpf || '').replace(/\D/g, '');
};

const parseDataExcel = (valor: any): string => {
  if (!valor) return '';
  
  if (typeof valor === 'number') {
    const data = XLSX.SSF.parse_date_code(valor);
    if (data) {
      return `${String(data.d).padStart(2, '0')}/${String(data.m).padStart(2, '0')}/${data.y}`;
    }
  }
  
  return String(valor);
};

const parseValorNumerico = (valor: any): number => {
  if (typeof valor === 'number') return valor;
  if (!valor) return 0;
  
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
  
  if (data.includes('/')) {
    return data;
  }
  
  if (data.includes('-')) {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  
  return data;
};

const formatarCPF = (cpf: string): string => {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export default function Auditoria() {
  const { toast } = useToast();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [dadosImportados, setDadosImportados] = useState<LinhaImportada[]>([]);
  const [divergencias, setDivergencias] = useState<Divergencia[]>([]);
  const [correspondencias, setCorrespondencias] = useState(0);
  const [processado, setProcessado] = useState(false);

  // Estados para divergências internas
  const [acordosDivergentes, setAcordosDivergentes] = useState<AcordoDivergente[]>([]);
  const [carregandoDivergencias, setCarregandoDivergencias] = useState(false);
  const [corrigindo, setCorrigindo] = useState<string | null>(null);

  const handleArquivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setArquivo(file);
      setProcessado(false);
      setDivergencias([]);
      setCorrespondencias(0);
    }
  };

  const buscarDivergenciasInternas = async () => {
    setCarregandoDivergencias(true);
    try {
      // Buscar todos os acordos com suas parcelas
      const { data: acordos, error: acordosError } = await supabase
        .from('acordos')
        .select(`
          id,
          cliente_nome,
          cliente_cpf,
          valor_total,
          parcelas,
          comissao_total
        `)
        .order('criado_em', { ascending: false });

      if (acordosError) throw acordosError;

      // Buscar todos os pagamentos usando paginação (limite do Supabase é 1000)
      let allPagamentos: { acordo_id: string; valor_parcela: number; comissao_parcela: number }[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error: batchError } = await supabase
          .from('pagamentos')
          .select('acordo_id, valor_parcela, comissao_parcela')
          .order('id', { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (batchError) throw batchError;

        if (batch && batch.length > 0) {
          allPagamentos = [...allPagamentos, ...batch];
          offset += pageSize;
          hasMore = batch.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const pagamentos = allPagamentos;

      // Agrupar pagamentos por acordo
      const pagamentosPorAcordo = new Map<string, { soma: number; qtd: number; somaComissao: number }>();
      for (const pag of pagamentos || []) {
        const atual = pagamentosPorAcordo.get(pag.acordo_id) || { soma: 0, qtd: 0, somaComissao: 0 };
        atual.soma += Number(pag.valor_parcela) || 0;
        atual.qtd += 1;
        atual.somaComissao += Number(pag.comissao_parcela) || 0;
        pagamentosPorAcordo.set(pag.acordo_id, atual);
      }

      // Identificar acordos com divergências
      const divergentes: AcordoDivergente[] = [];
      
      for (const acordo of acordos || []) {
        const dadosParcelas = pagamentosPorAcordo.get(acordo.id) || { soma: 0, qtd: 0, somaComissao: 0 };
        const valorTotal = Number(acordo.valor_total) || 0;
        const somaParcelas = dadosParcelas.soma;
        const qtdParcelasAcordo = acordo.parcelas || 0;
        const qtdParcelasCadastradas = dadosParcelas.qtd;
        const comissaoTotal = Number(acordo.comissao_total) || 0;
        const somaComissoes = dadosParcelas.somaComissao;

        const diferencaValor = Math.abs(valorTotal - somaParcelas);
        const diferencaQtdParcelas = Math.abs(qtdParcelasAcordo - qtdParcelasCadastradas);
        const diferencaComissao = Math.abs(comissaoTotal - somaComissoes);

        const tiposDivergencia: string[] = [];

        // Tolerância de R$ 0,10 para valores
        if (diferencaValor > 0.10) {
          tiposDivergencia.push('Valor total divergente');
        }

        if (diferencaQtdParcelas > 0) {
          tiposDivergencia.push('Quantidade de parcelas incorreta');
        }

        if (diferencaComissao > 0.10) {
          tiposDivergencia.push('Comissão inconsistente');
        }

        if (tiposDivergencia.length > 0) {
          divergentes.push({
            id: acordo.id,
            clienteNome: acordo.cliente_nome,
            clienteCpf: acordo.cliente_cpf || '',
            valorTotal,
            somaParcelas,
            diferencaValor,
            qtdParcelasAcordo,
            qtdParcelasCadastradas,
            comissaoTotal,
            somaComissoes,
            diferencaComissao,
            tiposDivergencia,
          });
        }
      }

      setAcordosDivergentes(divergentes);

      if (divergentes.length === 0) {
        toast({
          title: 'Nenhuma divergência encontrada',
          description: 'Todos os acordos estão com valores consistentes.',
        });
      } else {
        toast({
          title: 'Divergências encontradas',
          description: `${divergentes.length} acordo(s) com inconsistências.`,
        });
      }
    } catch (error) {
      console.error('Erro ao buscar divergências:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível buscar as divergências.',
      });
    } finally {
      setCarregandoDivergencias(false);
    }
  };

  useEffect(() => {
    buscarDivergenciasInternas();
  }, []);

  const corrigirDataPagamento = async (pagamentoId: string, novaData: string, index: number) => {
    setCorrigindo(pagamentoId);
    try {
      // Converter data de DD/MM/YYYY para YYYY-MM-DD
      const [dia, mes, ano] = novaData.split('/');
      const dataFormatada = `${ano}-${mes}-${dia}`;

      const { error } = await supabase
        .from('pagamentos')
        .update({ 
          data_paga: dataFormatada,
          status: 'pago'
        })
        .eq('id', pagamentoId);

      if (error) throw error;

      // Remover a divergência da lista após correção
      setDivergencias(prev => prev.filter((_, i) => i !== index));
      setCorrespondencias(prev => prev + 1);

      toast({
        title: 'Data corrigida!',
        description: `A data de pagamento foi atualizada para ${novaData}.`,
      });
    } catch (error) {
      console.error('Erro ao corrigir data:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível corrigir a data de pagamento.',
      });
    } finally {
      setCorrigindo(null);
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
      const buffer = await arquivo.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      const linhasImportadas: LinhaImportada[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || !row[0]) continue;

        linhasImportadas.push({
          cpf: normalizarCPF(row[0]),
          nomeCliente: String(row[1] || '').trim(),
          faixaAtraso: parseInt(String(row[2] || '0'), 10),
          dataPagamento: parseDataExcel(row[3]),
          valorPago: parseValorNumerico(row[4]),
          comissao: parseValorNumerico(row[5]),
        });
      }

      setDadosImportados(linhasImportadas);

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

      const divergenciasEncontradas: Divergencia[] = [];
      let correspondenciasCount = 0;

      const pagamentosPorCPF = new Map<string, PagamentoSistema[]>();
      for (const pag of pagamentosSistema) {
        if (!pag.cpf) continue;
        const lista = pagamentosPorCPF.get(pag.cpf) || [];
        lista.push(pag);
        pagamentosPorCPF.set(pag.cpf, lista);
      }

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

        const dataPlanilhaFormatada = linha.dataPagamento;
        let encontrouCorrespondencia = false;

        for (const pagSistema of pagamentosCliente) {
          const dataSistemaFormatada = formatarDataParaComparacao(pagSistema.dataPaga || '');
          
          if (dataPlanilhaFormatada === dataSistemaFormatada) {
            encontrouCorrespondencia = true;
            
            const divergencias: string[] = [];
            
            if (!compararValores(linha.valorPago, pagSistema.valorParcela)) {
              divergencias.push('Valor divergente');
            }
            
            const percentualEmpresa = calcularPercentualComissaoEmpresa(pagSistema.diasAtraso);
            const comissaoEscritorioSistema = Math.round(pagSistema.valorParcela * (percentualEmpresa / 100) * 100) / 100;
            
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
          // Buscar parcela pendente para associar à correção
          const { data: parcelasPendentes } = await supabase
            .from('pagamentos')
            .select('id, valor_parcela, acordos!inner(cliente_cpf)')
            .eq('status', 'pendente')
            .not('acordos.cliente_cpf', 'is', null);
          
          const parcelaPendente = parcelasPendentes?.find(
            (p: any) => normalizarCPF(p.acordos?.cliente_cpf || '') === linha.cpf
          );

          divergenciasEncontradas.push({
            cpf: linha.cpf,
            nomeClientePlanilha: linha.nomeCliente,
            nomeClienteSistema: pagamentosCliente[0]?.nomeCliente || '-',
            tipoDivergencia: 'Data de pagamento não encontrada',
            valorPlanilha: linha.valorPago,
            valorSistema: parcelaPendente?.valor_parcela || 0,
            comissaoPlanilha: linha.comissao,
            comissaoSistema: 0,
            dataPlanilha: linha.dataPagamento,
            dataSistema: '-',
            pagamentoId: parcelaPendente?.id,
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

    ws['!cols'] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 15 },
      { wch: 15 },
    ];

    XLSX.writeFile(wb, 'divergencias-auditoria.xlsx');

    toast({
      title: 'Exportação concluída',
      description: 'Arquivo de divergências baixado com sucesso.',
    });
  };

  const exportarDivergenciasInternas = () => {
    if (acordosDivergentes.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Sem dados',
        description: 'Não há divergências internas para exportar.',
      });
      return;
    }

    const dadosExport = acordosDivergentes.map((a) => ({
      'Cliente': a.clienteNome,
      'CPF': formatarCPF(a.clienteCpf),
      'Tipo de Divergência': a.tiposDivergencia.join(', '),
      'Valor Total Acordo': a.valorTotal,
      'Soma das Parcelas': a.somaParcelas,
      'Diferença Valor': a.diferencaValor,
      'Parcelas Esperadas': a.qtdParcelasAcordo,
      'Parcelas Cadastradas': a.qtdParcelasCadastradas,
      'Comissão Total': a.comissaoTotal,
      'Soma Comissões': a.somaComissoes,
      'Diferença Comissão': a.diferencaComissao,
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Divergências Internas');

    ws['!cols'] = [
      { wch: 30 },
      { wch: 15 },
      { wch: 35 },
      { wch: 18 },
      { wch: 18 },
      { wch: 15 },
      { wch: 18 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
    ];

    XLSX.writeFile(wb, 'divergencias-internas-acordos.xlsx');

    toast({
      title: 'Exportação concluída',
      description: 'Arquivo de divergências internas baixado com sucesso.',
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
              Compare pagamentos e identifique divergências nos acordos
            </p>
          </div>
        </div>

        <Tabs defaultValue="divergencias-internas" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="divergencias-internas">
              <AlertCircle className="h-4 w-4 mr-2" />
              Divergências de Acordos
              {acordosDivergentes.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {acordosDivergentes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="comparacao-planilha">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Comparação com Planilha
            </TabsTrigger>
          </TabsList>

          <TabsContent value="divergencias-internas" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Acordos com Divergências</h2>
                <p className="text-sm text-muted-foreground">
                  Acordos que possuem inconsistências nos valores cadastrados
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={buscarDivergenciasInternas}
                  disabled={carregandoDivergencias}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${carregandoDivergencias ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
                {acordosDivergentes.length > 0 && (
                  <Button variant="outline" onClick={exportarDivergenciasInternas}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                )}
              </div>
            </div>

            {carregandoDivergencias ? (
              <Card>
                <CardContent className="flex items-center justify-center py-10">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : acordosDivergentes.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                  <h3 className="text-xl font-semibold">Nenhuma divergência encontrada</h3>
                  <p className="text-muted-foreground">
                    Todos os acordos estão com valores consistentes.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {acordosDivergentes.map((acordo) => (
                  <Card key={acordo.id} className="border-destructive/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          <CardTitle className="text-base">{acordo.clienteNome}</CardTitle>
                        </div>
                      </div>
                      {acordo.clienteCpf && (
                        <CardDescription className="font-mono text-xs">
                          CPF: {formatarCPF(acordo.clienteCpf)}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-1">
                        {acordo.tiposDivergencia.map((tipo, idx) => (
                          <Badge key={idx} variant="destructive" className="text-xs">
                            {tipo}
                          </Badge>
                        ))}
                      </div>

                      <div className="space-y-2 text-sm">
                        {acordo.diferencaValor > 0.10 && (
                          <div className="p-2 rounded bg-destructive/10 space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Valor Total:</span>
                              <span className="font-medium">{formatarMoeda(acordo.valorTotal)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Soma Parcelas:</span>
                              <span className="font-medium">{formatarMoeda(acordo.somaParcelas)}</span>
                            </div>
                            <div className="flex justify-between text-destructive font-medium">
                              <span>Diferença:</span>
                              <span>{formatarMoeda(acordo.diferencaValor)}</span>
                            </div>
                          </div>
                        )}

                        {acordo.qtdParcelasAcordo !== acordo.qtdParcelasCadastradas && (
                          <div className="p-2 rounded bg-destructive/10 space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Parcelas Esperadas:</span>
                              <span className="font-medium">{acordo.qtdParcelasAcordo}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Parcelas Cadastradas:</span>
                              <span className="font-medium">{acordo.qtdParcelasCadastradas}</span>
                            </div>
                          </div>
                        )}

                        {acordo.diferencaComissao > 0.10 && (
                          <div className="p-2 rounded bg-destructive/10 space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Comissão Total:</span>
                              <span className="font-medium">{formatarMoeda(acordo.comissaoTotal)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Soma Comissões:</span>
                              <span className="font-medium">{formatarMoeda(acordo.somaComissoes)}</span>
                            </div>
                            <div className="flex justify-between text-destructive font-medium">
                              <span>Diferença:</span>
                              <span>{formatarMoeda(acordo.diferencaComissao)}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link to={`/acordos/${acordo.id}`}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Ver Acordo
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="comparacao-planilha" className="space-y-6 mt-6">
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
                              <TableHead className="text-right">Com. Sist.</TableHead>
                              <TableHead>Data Plan.</TableHead>
                              <TableHead>Data Sist.</TableHead>
                              <TableHead className="text-center">Ação</TableHead>
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
                                <TableCell className="text-right">{formatarMoeda(d.comissaoSistema)}</TableCell>
                                <TableCell>{d.dataPlanilha}</TableCell>
                                <TableCell>{d.dataSistema}</TableCell>
                                <TableCell className="text-center">
                                  {d.tipoDivergencia === 'Data de pagamento não encontrada' && d.pagamentoId && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => corrigirDataPagamento(d.pagamentoId!, d.dataPlanilha, index)}
                                      disabled={corrigindo === d.pagamentoId}
                                    >
                                      {corrigindo === d.pagamentoId ? (
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <>
                                          <CheckCircle2 className="h-4 w-4 mr-1" />
                                          Corrigir
                                        </>
                                      )}
                                    </Button>
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
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
