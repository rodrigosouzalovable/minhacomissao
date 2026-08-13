import { useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CalendarIcon, FileSpreadsheet, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type LinhaUme = {
  data_hora: string;
  cpf: string;
  origem: string;
  acionamento: string;
  ocorrencia: string;
  telefone: string | null;
  email: string | null;
  agente: string | null;
  assessoria: string;
};

const COLUNAS = [
  'DATA_HORA', 'CPF', 'ORIGEM', 'ACIONAMENTO', 'OCORRENCIA',
  'TELEFONE', 'EMAIL', 'AGENTE', 'ASSESSORIA',
];

const DICIONARIO: string[][] = [
  ['CAMPO', 'DESCRIÇÃO'],
  ['DATA_HORA', 'Data e hora do acionamento'],
  ['CPF', 'CPF do cliente'],
  ['ORIGEM', 'Origem do acionamento: DISCADOR/AÇÕES/CANAIS DIGITAIS'],
  ['ACIONAMENTO', 'Qualificação do acionamento: BADCALL/ALÔ/CPC/CONVERSÃO'],
  ['OCORRENCIA', 'Descrição da ocorrência'],
  ['TELEFONE', 'Telefone atrelado ao acionamento/ação massiva'],
  ['EMAIL', 'E-mail atrelado a ação massiva'],
  ['AGENTE', 'Nome do agente atrelado ao acionamento. Em casos de tentativa sem atendimento humano, o campo deve ser enviado vazio.'],
  ['ASSESSORIA', 'Nome da assessoria'],
  ['', ''],
  ['FORMATO DO ARQUIVO', 'CSV com separador (,)'],
  ['', ''],
  ['CONTEÚDO DO ARQUIVO', 'Todas as tentativas de acionamento, humano, máquina e ações massivas.'],
];

const PAGINA = 5000;

export function ArquivoDiarioUmeCard() {
  const [data, setData] = useState<Date>(new Date());
  const [carregando, setCarregando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [linhas, setLinhas] = useState<LinhaUme[] | null>(null);

  const dataStr = useMemo(() => format(data, 'yyyy-MM-dd'), [data]);

  const buscar = useCallback(async (): Promise<LinhaUme[]> => {
    const todas: LinhaUme[] = [];
    for (let offset = 0; ; offset += PAGINA) {
      const { data: bloco, error } = await (supabase as any)
        .rpc('relatorio_ume_acionamentos', { _data: dataStr })
        .range(offset, offset + PAGINA - 1);
      if (error) throw error;
      const arr = (bloco ?? []) as LinhaUme[];
      todas.push(...arr);
      if (arr.length < PAGINA) break;
    }
    return todas;
  }, [dataStr]);

  const conferir = async () => {
    setCarregando(true);
    try {
      const res = await buscar();
      setLinhas(res);
      toast.success(`${res.length.toLocaleString('pt-BR')} acionamentos encontrados`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível conferir o dia');
    } finally {
      setCarregando(false);
    }
  };

  const baixar = async () => {
    setGerando(true);
    try {
      const res = linhas ?? (await buscar());
      setLinhas(res);
      if (res.length === 0) {
        toast.error('Nenhum acionamento encontrado nesse dia');
        return;
      }
      const XLSX = await import('xlsx');
      const aoa: (string | null)[][] = [
        COLUNAS,
        ...res.map((l) => [
          l.data_hora, l.cpf, l.origem, l.acionamento, l.ocorrencia,
          l.telefone ?? '', l.email ?? '', l.agente ?? '', l.assessoria,
        ]),
      ];
      const wsLayout = XLSX.utils.aoa_to_sheet(aoa);
      wsLayout['!cols'] = [
        { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 13 }, { wch: 26 },
        { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 20 },
      ];
      const wsDic = XLSX.utils.aoa_to_sheet(DICIONARIO);
      wsDic['!cols'] = [{ wch: 22 }, { wch: 100 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsLayout, 'Layout');
      XLSX.utils.book_append_sheet(wb, wsDic, 'Dicionário');
      XLSX.writeFile(wb, `ACIONAMENTOS_UME_${format(data, 'ddMMyyyy')}.xlsx`);
      toast.success('Arquivo gerado');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao gerar o arquivo');
    } finally {
      setGerando(false);
    }
  };

  const resumo = useMemo(() => {
    if (!linhas) return null;
    const porOrigem = new Map<string, number>();
    let cpc = 0;
    let conversao = 0;
    for (const l of linhas) {
      porOrigem.set(l.origem, (porOrigem.get(l.origem) ?? 0) + 1);
      if (l.acionamento === 'CPC') cpc++;
      if (l.acionamento === 'CONVERSAO') conversao++;
    }
    return { total: linhas.length, porOrigem: [...porOrigem.entries()].sort((a, b) => b[1] - a[1]), cpc, conversao };
  }, [linhas]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          Arquivo diário UME (layout do credor)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Gera o arquivo com todos os acionamentos do dia da carteira UME/Novo Mundo, nas 9 colunas
          exigidas pelo credor, com a aba Dicionário incluída.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {format(data, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={data}
                onSelect={(d) => { if (d) { setData(d); setLinhas(null); } }}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" onClick={conferir} disabled={carregando || gerando}>
            {carregando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Conferir o dia
          </Button>

          <Button size="sm" onClick={baixar} disabled={gerando || carregando}>
            {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
            Baixar Excel
          </Button>
        </div>

        {resumo && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
            <div className="font-medium">
              {resumo.total.toLocaleString('pt-BR')} linhas • CPC: {resumo.cpc.toLocaleString('pt-BR')} • Conversões: {resumo.conversao.toLocaleString('pt-BR')}
            </div>
            <div className="text-muted-foreground">
              {resumo.porOrigem.length === 0
                ? 'Nenhum acionamento nesse dia.'
                : resumo.porOrigem.map(([o, q]) => `${o}: ${q.toLocaleString('pt-BR')}`).join(' • ')}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
