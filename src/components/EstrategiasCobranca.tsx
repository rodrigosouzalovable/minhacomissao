import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Download, Users, DollarSign, Clock, AlertTriangle, TrendingUp, CheckCircle, X, Filter } from 'lucide-react';
import { exportarParaExcel } from '@/lib/exportExcel';

// ── Types ──

interface AcordoComPagamentos {
  id: string;
  cliente_nome: string;
  cliente_cpf: string | null;
  valor_total: number;
  parcelas: number;
  dias_atraso: number;
  user_id: string;
  funcionario_nome: string;
  parcelas_pagas: number;
  parcelas_pendentes: number;
  valor_pago: number;
  valor_pendente: number;
  max_dias_atraso_parcela: number;
}

interface DevedorSemAcordo {
  id: string;
  nome: string;
  cpf: string;
  valor_original: number;
  valor_atualizado: number;
  credor: string | null;
  dias_vencido: number;
}

type TipoCliente = 'com_acordo' | 'sem_acordo';

// ── Constants ──

const CATEGORIAS = [
  { id: 'parciais', label: 'Pagadores Parciais', icon: TrendingUp, cor: 'text-emerald-600' },
  { id: 'unica', label: 'Parcela Única', icon: CheckCircle, cor: 'text-blue-600' },
  { id: 'recentes', label: 'Atraso < 30d', icon: Clock, cor: 'text-amber-600' },
  { id: 'moderados', label: 'Atraso 31-90d', icon: AlertTriangle, cor: 'text-orange-600' },
  { id: 'nunca', label: 'Nunca Pagaram', icon: AlertTriangle, cor: 'text-destructive' },
  { id: 'alto_valor', label: 'Alto Valor', icon: DollarSign, cor: 'text-primary' },
] as const;

type CategoriaId = typeof CATEGORIAS[number]['id'];

// ── Helpers ──

function calcularDiasAtrasoMaiorParcela(parcelas: { data_prevista: string; status: string }[]): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  let maxDias = 0;
  for (const p of parcelas) {
    if (p.status === 'pendente') {
      const vencimento = new Date(p.data_prevista + 'T00:00:00');
      const diff = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > maxDias) maxDias = diff;
    }
  }
  return maxDias;
}

function filtrarPorCategoria(acordos: AcordoComPagamentos[], categoria: CategoriaId): AcordoComPagamentos[] {
  switch (categoria) {
    case 'parciais':
      return acordos.filter(a => a.parcelas_pagas > 0 && a.parcelas_pendentes > 0);
    case 'unica':
      return acordos.filter(a => a.parcelas_pendentes === 1);
    case 'recentes':
      return acordos.filter(a => a.max_dias_atraso_parcela > 0 && a.max_dias_atraso_parcela <= 30);
    case 'moderados':
      return acordos.filter(a => a.max_dias_atraso_parcela > 30 && a.max_dias_atraso_parcela <= 90);
    case 'nunca':
      return acordos.filter(a => a.parcelas_pagas === 0);
    case 'alto_valor':
      return [...acordos].sort((a, b) => b.valor_pendente - a.valor_pendente).slice(0, 50);
    default:
      return [];
  }
}

function calcularDiasVencido(dataVencimento: string | null): number {
  if (!dataVencimento) return 0;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataVencimento + 'T00:00:00');
  const diff = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

// ── Excel columns ──

const colunasAcordo = [
  { chave: 'cliente_nome' as const, titulo: 'Cliente' },
  { chave: 'cliente_cpf' as const, titulo: 'CPF' },
  { chave: 'valor_total' as const, titulo: 'Valor Total' },
  { chave: 'parcelas_pagas' as const, titulo: 'Parcelas Pagas' },
  { chave: 'parcelas_pendentes' as const, titulo: 'Parcelas Pendentes' },
  { chave: 'valor_pago' as const, titulo: 'Valor Pago' },
  { chave: 'valor_pendente' as const, titulo: 'Valor Pendente' },
  { chave: 'max_dias_atraso_parcela' as const, titulo: 'Dias Atraso' },
  { chave: 'funcionario_nome' as const, titulo: 'Funcionário' },
];

const colunasDevedor = [
  { chave: 'nome' as const, titulo: 'Nome' },
  { chave: 'cpf' as const, titulo: 'CPF' },
  { chave: 'valor_original' as const, titulo: 'Valor Original' },
  { chave: 'valor_atualizado' as const, titulo: 'Valor Atualizado' },
  { chave: 'credor' as const, titulo: 'Credor' },
  { chave: 'dias_vencido' as const, titulo: 'Dias Vencido' },
];

// ── Component ──

export function EstrategiasCobranca() {
  const [tabAtiva, setTabAtiva] = useState<CategoriaId>('parciais');
  const [tipoCliente, setTipoCliente] = useState<TipoCliente>('com_acordo');
  const [diasAtrasoMin, setDiasAtrasoMin] = useState('');
  const [diasAtrasoMax, setDiasAtrasoMax] = useState('');
  const [filtroAtrasoAtivo, setFiltroAtrasoAtivo] = useState(false);

  // ── Query: Acordos ativos ──
  const { data: acordosProcessados, isLoading: loadingAcordos } = useQuery({
    queryKey: ['estrategias-cobranca'],
    enabled: tipoCliente === 'com_acordo',
    queryFn: async () => {
      const { data: acordos, error: acordosError } = await supabase
        .from('acordos')
        .select('id, cliente_nome, cliente_cpf, valor_total, parcelas, dias_atraso, user_id')
        .eq('status', 'ativo');

      if (acordosError) throw acordosError;
      if (!acordos?.length) return [];

      const acordoIds = acordos.map(a => a.id);

      const BATCH_SIZE = 50;
      const batches: string[][] = [];
      for (let i = 0; i < acordoIds.length; i += BATCH_SIZE) {
        batches.push(acordoIds.slice(i, i + BATCH_SIZE));
      }

      const pagamentosResults = await Promise.all(
        batches.map(batch =>
          supabase
            .from('pagamentos')
            .select('acordo_id, status, valor_parcela, data_prevista')
            .in('acordo_id', batch)
        )
      );

      const pagamentos = pagamentosResults.flatMap(r => {
        if (r.error) throw r.error;
        return r.data ?? [];
      });

      const userIds = [...new Set(acordos.map(a => a.user_id))];
      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', userIds);

      if (profError) throw profError;

      const profileMap = new Map(profiles?.map(p => [p.id, p.nome]) ?? []);
      const pagamentosPorAcordo = new Map<string, typeof pagamentos>();
      for (const p of pagamentos ?? []) {
        if (!pagamentosPorAcordo.has(p.acordo_id)) pagamentosPorAcordo.set(p.acordo_id, []);
        pagamentosPorAcordo.get(p.acordo_id)!.push(p);
      }

      return acordos.map(a => {
        const pags = pagamentosPorAcordo.get(a.id) ?? [];
        const pagas = pags.filter(p => p.status === 'pago');
        const pendentes = pags.filter(p => p.status === 'pendente');
        return {
          id: a.id,
          cliente_nome: a.cliente_nome,
          cliente_cpf: a.cliente_cpf,
          valor_total: a.valor_total,
          parcelas: a.parcelas,
          dias_atraso: a.dias_atraso,
          user_id: a.user_id,
          funcionario_nome: profileMap.get(a.user_id) ?? 'N/A',
          parcelas_pagas: pagas.length,
          parcelas_pendentes: pendentes.length,
          valor_pago: pagas.reduce((s, p) => s + Number(p.valor_parcela), 0),
          valor_pendente: pendentes.reduce((s, p) => s + Number(p.valor_parcela), 0),
          max_dias_atraso_parcela: calcularDiasAtrasoMaiorParcela(pags),
        } satisfies AcordoComPagamentos;
      });
    },
  });

  // ── Query: Devedores sem acordo ──
  const { data: devedoresSemAcordo, isLoading: loadingDevedores } = useQuery({
    queryKey: ['estrategias-sem-acordo'],
    enabled: tipoCliente === 'sem_acordo',
    queryFn: async () => {
      const [devRes, acordosRes] = await Promise.all([
        supabase.from('devedores').select('id, nome, cpf, valor_original, valor_atualizado, credor, data_vencimento').eq('ativo', true),
        supabase.from('acordos').select('cliente_cpf').in('status', ['ativo', 'concluido']),
      ]);

      if (devRes.error) throw devRes.error;
      if (acordosRes.error) throw acordosRes.error;

      const cpfsComAcordo = new Set(
        (acordosRes.data ?? [])
          .map(a => (a.cliente_cpf ?? '').replace(/\D/g, ''))
          .filter(Boolean)
      );

      return (devRes.data ?? [])
        .filter(d => !cpfsComAcordo.has(d.cpf.replace(/\D/g, '')))
        .map(d => ({
          id: d.id,
          nome: d.nome,
          cpf: d.cpf,
          valor_original: d.valor_original,
          valor_atualizado: d.valor_atualizado,
          credor: d.credor,
          dias_vencido: calcularDiasVencido(d.data_vencimento),
        } satisfies DevedorSemAcordo));
    },
  });

  // ── Memos for "com_acordo" ──
  const categoriasDados = useMemo(() => {
    if (!acordosProcessados) return {} as Record<CategoriaId, AcordoComPagamentos[]>;
    const result = {} as Record<CategoriaId, AcordoComPagamentos[]>;
    for (const cat of CATEGORIAS) {
      result[cat.id] = filtrarPorCategoria(acordosProcessados, cat.id);
    }
    return result;
  }, [acordosProcessados]);

  // ── Apply delay filter ──
  const aplicarFiltroAtraso = <T extends { max_dias_atraso_parcela?: number; dias_vencido?: number }>(dados: T[]): T[] => {
    if (!filtroAtrasoAtivo) return dados;
    const min = diasAtrasoMin ? Number(diasAtrasoMin) : 0;
    const max = diasAtrasoMax ? Number(diasAtrasoMax) : Infinity;
    return dados.filter(d => {
      const dias = ('max_dias_atraso_parcela' in d ? d.max_dias_atraso_parcela : d.dias_vencido) ?? 0;
      return dias >= min && dias <= max;
    });
  };

  const dadosAcordoAtivos = aplicarFiltroAtraso(categoriasDados[tabAtiva] ?? []);
  const dadosDevedorAtivos = aplicarFiltroAtraso(devedoresSemAcordo ?? []);

  const isLoading = tipoCliente === 'com_acordo' ? loadingAcordos : loadingDevedores;

  // ── Summary values ──
  const totalClientes = tipoCliente === 'com_acordo' ? dadosAcordoAtivos.length : dadosDevedorAtivos.length;
  const valorResumo = tipoCliente === 'com_acordo'
    ? dadosAcordoAtivos.reduce((s, a) => s + a.valor_pendente, 0)
    : dadosDevedorAtivos.reduce((s, d) => s + d.valor_atualizado, 0);

  // ── Export ──
  const handleExport = () => {
    if (tipoCliente === 'com_acordo') {
      const catLabel = CATEGORIAS.find(c => c.id === tabAtiva)?.label ?? tabAtiva;
      exportarParaExcel(dadosAcordoAtivos, colunasAcordo, `Estrategia_${catLabel}`);
    } else {
      exportarParaExcel(dadosDevedorAtivos, colunasDevedor, 'Devedores_Sem_Acordo');
    }
  };

  const handleFiltrar = () => setFiltroAtrasoAtivo(true);
  const handleLimpar = () => {
    setDiasAtrasoMin('');
    setDiasAtrasoMax('');
    setFiltroAtrasoAtivo(false);
  };

  const hasData = tipoCliente === 'com_acordo' ? !!acordosProcessados?.length : !!devedoresSemAcordo?.length;
  const exportDisabled = tipoCliente === 'com_acordo' ? !dadosAcordoAtivos.length : !dadosDevedorAtivos.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Estratégias de Cobrança
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div className="space-y-1">
            <Label className="text-xs">Tipo de Cliente</Label>
            <Select value={tipoCliente} onValueChange={(v) => setTipoCliente(v as TipoCliente)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="com_acordo">Com Acordo Ativo</SelectItem>
                <SelectItem value="sem_acordo">Sem Acordo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Atraso de</Label>
              <Input
                type="number"
                min={0}
                className="w-20"
                placeholder="0"
                value={diasAtrasoMin}
                onChange={e => setDiasAtrasoMin(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">até</Label>
              <Input
                type="number"
                min={0}
                className="w-20"
                placeholder="∞"
                value={diasAtrasoMax}
                onChange={e => setDiasAtrasoMax(e.target.value)}
              />
            </div>
            <span className="text-xs text-muted-foreground pb-2">dias</span>
            <Button size="sm" variant="secondary" onClick={handleFiltrar}>
              <Filter className="h-3 w-3 mr-1" />
              Filtrar
            </Button>
            {filtroAtrasoAtivo && (
              <Button size="sm" variant="ghost" onClick={handleLimpar}>
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando dados...</div>
        ) : !hasData ? (
          <div className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</div>
        ) : tipoCliente === 'com_acordo' ? (
          /* ── COM ACORDO ── */
          <Tabs value={tabAtiva} onValueChange={(v) => setTabAtiva(v as CategoriaId)}>
            <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
              {CATEGORIAS.map(cat => (
                <TabsTrigger key={cat.id} value={cat.id} className="text-xs gap-1">
                  <cat.icon className="h-3 w-3" />
                  {cat.label}
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                    {aplicarFiltroAtraso(categoriasDados[cat.id] ?? []).length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {CATEGORIAS.map(cat => (
              <TabsContent key={cat.id} value={cat.id}>
                <SummaryCards totalClientes={totalClientes} valorResumo={valorResumo} labelValor="Valor Pendente" />
                <ExportButton onClick={handleExport} disabled={exportDisabled} />
                <AcordoTable dados={dadosAcordoAtivos} />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          /* ── SEM ACORDO ── */
          <>
            <SummaryCards totalClientes={totalClientes} valorResumo={valorResumo} labelValor="Valor Atualizado" />
            <ExportButton onClick={handleExport} disabled={exportDisabled} />
            <DevedorTable dados={dadosDevedorAtivos} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Sub-components ──

function SummaryCards({ totalClientes, valorResumo, labelValor }: { totalClientes: number; valorResumo: number; labelValor: string }) {
  return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div className="border rounded-lg p-3 flex items-center gap-3">
        <Users className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Clientes</p>
          <p className="text-xl font-bold">{totalClientes}</p>
        </div>
      </div>
      <div className="border rounded-lg p-3 flex items-center gap-3">
        <DollarSign className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">{labelValor}</p>
          <p className="text-xl font-bold">
            {valorResumo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>
    </div>
  );
}

function ExportButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <div className="flex justify-end mb-2">
      <Button size="sm" variant="outline" onClick={onClick} disabled={disabled}>
        <Download className="h-4 w-4 mr-1" />
        Exportar Excel
      </Button>
    </div>
  );
}

function AcordoTable({ dados }: { dados: AcordoComPagamentos[] }) {
  if (!dados.length) return <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente nesta categoria.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>CPF</TableHead>
            <TableHead className="text-right">Valor Total</TableHead>
            <TableHead className="text-center">Pagas/Total</TableHead>
            <TableHead className="text-right">Valor Pendente</TableHead>
            <TableHead className="text-center">Dias Atraso</TableHead>
            <TableHead>Funcionário</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dados.map(a => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.cliente_nome}</TableCell>
              <TableCell>{a.cliente_cpf ?? '-'}</TableCell>
              <TableCell className="text-right">
                {a.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </TableCell>
              <TableCell className="text-center">{a.parcelas_pagas}/{a.parcelas}</TableCell>
              <TableCell className="text-right">
                {a.valor_pendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={a.max_dias_atraso_parcela > 30 ? 'destructive' : a.max_dias_atraso_parcela > 0 ? 'secondary' : 'outline'}>
                  {a.max_dias_atraso_parcela}
                </Badge>
              </TableCell>
              <TableCell>{a.funcionario_nome}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DevedorTable({ dados }: { dados: DevedorSemAcordo[] }) {
  if (!dados.length) return <p className="text-sm text-muted-foreground text-center py-4">Nenhum devedor encontrado.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>CPF</TableHead>
            <TableHead className="text-right">Valor Original</TableHead>
            <TableHead className="text-right">Valor Atualizado</TableHead>
            <TableHead>Credor</TableHead>
            <TableHead className="text-center">Dias Vencido</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dados.map(d => (
            <TableRow key={d.id}>
              <TableCell className="font-medium">{d.nome}</TableCell>
              <TableCell>{d.cpf}</TableCell>
              <TableCell className="text-right">
                {d.valor_original.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </TableCell>
              <TableCell className="text-right">
                {d.valor_atualizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </TableCell>
              <TableCell>{d.credor ?? '-'}</TableCell>
              <TableCell className="text-center">
                <Badge variant={d.dias_vencido > 30 ? 'destructive' : d.dias_vencido > 0 ? 'secondary' : 'outline'}>
                  {d.dias_vencido}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
