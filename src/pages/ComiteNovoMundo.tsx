import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Printer, Pencil } from 'lucide-react';
import {
  useCarteira,
  useFunilMes,
  useAcordosNovoMundo,
  useCobradores,
  useMetasMes,
  useTextosMes,
  useComiteRealtime,
  FAIXAS_NN,
  FAIXAS_COLCHAO,
  TODAS_FAIXAS,
  type FaixaKey,
} from '@/hooks/useComiteNovoMundo';
import { CampoZeradoHint } from '@/components/comite/CampoZeradoHint';
import { InformarAdmissaoDialog } from '@/components/comite/InformarAdmissaoDialog';
import { ImportarCarteiraNMDialog } from '@/components/comite/ImportarCarteiraNMDialog';
import { BreakdownFaixasDialog } from '@/components/comite/BreakdownFaixasDialog';

const moeda = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—');

function mesesDisponiveis(): string[] {
  const arr: string[] = [];
  const hoje = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return arr;
}

function labelMes(mes: string) {
  const [a, m] = mes.split('-');
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${nomes[Number(m) - 1]} / ${a}`;
}

const BLOCOS: { key: string; titulo: string }[] = [
  { key: 'acoes_mes', titulo: 'Ações do Mês' },
  { key: 'proximos_passos', titulo: 'Próximos Passos' },
  { key: 'observacoes', titulo: 'Observações' },
  { key: 'dificuldades', titulo: 'Dificuldades na Execução' },
  { key: 'ata', titulo: 'Ata' },
];

export default function ComiteNovoMundo() {
  const { isAdmin, isGestor } = useUserRole();
  const podeEditar = isAdmin || isGestor;
  const qc = useQueryClient();

  const [mesAno, setMesAno] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useComiteRealtime();
  const carteira = useCarteira();
  const funil = useFunilMes(mesAno);
  const acordos = useAcordosNovoMundo(mesAno, carteira.data?.cpfs);
  const userIds = useMemo(() => Array.from(acordos.data?.porUser.keys() ?? []), [acordos.data]);
  const cobradores = useCobradores(userIds);
  const metas = useMetasMes(mesAno);
  const textos = useTextosMes(mesAno);

  const cobradorMap = useMemo(() => {
    const m = new Map<string, { nome: string; admissao: string | null }>();
    for (const c of cobradores.data ?? []) m.set(c.id, { nome: c.nome ?? '—', admissao: (c as any).data_admissao ?? null });
    return m;
  }, [cobradores.data]);

  const totalNNRealizado = useMemo(() => {
    if (!carteira.data) return 0;
    return FAIXAS_NN.reduce((s, f) => s + (carteira.data!.porFaixa[f]?.valorAtualizado ?? 0), 0);
  }, [carteira.data]);
  const totalColchaoRealizado = useMemo(() => {
    if (!carteira.data) return 0;
    return FAIXAS_COLCHAO.reduce((s, f) => s + (carteira.data!.porFaixa[f]?.valorAtualizado ?? 0), 0);
  }, [carteira.data]);

  return (
    <AppLayout>
      <div className="space-y-4 p-2 print:p-0">
        <div className="flex items-center justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold">Comitê de Resultados — Novo Mundo</h1>
            <p className="text-sm text-muted-foreground">Visão consolidada do credor para o comitê mensal.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={mesAno} onValueChange={setMesAno}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mesesDisponiveis().map((m) => (
                  <SelectItem key={m} value={m}>{labelMes(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" /> Exportar PDF
            </Button>
            {podeEditar && (
              <>
                <ImportarCarteiraNMDialog />
                <MetasDialog mesAno={mesAno} onSaved={() => qc.invalidateQueries({ queryKey: ['comite-nm', 'metas', mesAno] })} />
              </>
            )}
          </div>
        </div>

        <div className="hidden print:block">
          <h1 className="text-2xl font-bold">Comitê de Resultados — Novo Mundo · {labelMes(mesAno)}</h1>
        </div>

        {/* Resumo executivo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI
            titulo="Carteira (CPFs)"
            valor={carteira.data?.totalQtd.toLocaleString('pt-BR') ?? '—'}
            hint={(carteira.data?.totalQtd ?? 0) === 0 ? {
              motivo: 'Nenhum devedor ativo encontrado com credor "ume_novo_mundo". Importe a base do credor para começar.',
              acao: { label: 'Importar base Novo Mundo', to: '/admin/importar-devedores' },
            } : undefined}
          />
          <KPI
            titulo="Valor em aberto"
            valor={moeda(carteira.data?.totalValorAtualizado ?? 0)}
            hint={(carteira.data?.totalValorAtualizado ?? 0) === 0 ? {
              motivo: 'Sem valores em aberto porque a base do credor está vazia.',
              acao: { label: 'Importar base Novo Mundo', to: '/admin/importar-devedores' },
            } : undefined}
          />
          <KPI
            titulo="Recuperado no mês"
            valor={moeda(acordos.data?.totalPagoValor ?? 0)}
            sub={`${acordos.data?.totalPagoQtd ?? 0} parcelas pagas`}
            hint={(acordos.data?.totalPagoValor ?? 0) === 0 ? {
              motivo: 'Nenhum pagamento marcado como pago neste mês para acordos cujo CPF bate com a base Novo Mundo. Conforme parcelas forem marcadas como pagas em "Meus Acordos", este número atualiza sozinho.',
            } : undefined}
          />
          <KPI
            titulo="Acordos fechados"
            valor={String(acordos.data?.totalAcordosQtd ?? 0)}
            sub={moeda(acordos.data?.totalAcordosValor ?? 0)}
            hint={(acordos.data?.totalAcordosQtd ?? 0) === 0 ? {
              motivo: 'Nenhum acordo criado neste mês com CPF da base Novo Mundo. Cada novo acordo registrado em "Novo Acordo" cujo CPF esteja na base aparece aqui automaticamente.',
            } : undefined}
          />
        </div>

        {/* Funil */}
        <Card>
          <CardHeader className="pb-2"><CardTitle>01 · Funil de Acionamento</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
              <FunilItem rotulo="Base" valor={(carteira.data?.totalQtd ?? 0).toLocaleString('pt-BR')} />
              <FunilItem
                rotulo="Tentativas"
                valor={(funil.data?.tentativas ?? 0).toLocaleString('pt-BR')}
                sub={pct(funil.data?.tentativas ?? 0, carteira.data?.totalQtd ?? 0) + ' da base'}
                hint={(funil.data?.tentativas ?? 0) === 0 ? {
                  motivo: 'Nenhuma tentativa registrada em "relatorio_acionamentos" para o mês. Importe a planilha de ligações ou registre tentativas pelo painel de Acionamento.',
                  acao: { label: 'Ir para Relatórios', to: '/relatorios' },
                } : undefined}
              />
              <FunilItem
                rotulo="Alô"
                valor={(funil.data?.alo ?? 0).toLocaleString('pt-BR')}
                sub={pct(funil.data?.alo ?? 0, funil.data?.tentativas ?? 0)}
                hint={(funil.data?.alo ?? 0) === 0 ? { motivo: 'Sem "Alô" registrado no mês. Importe a planilha de ligações na aba Relatórios.', acao: { label: 'Ir para Relatórios', to: '/relatorios' } } : undefined}
              />
              <FunilItem
                rotulo="CPC"
                valor={(funil.data?.cpc ?? 0).toLocaleString('pt-BR')}
                sub={pct(funil.data?.cpc ?? 0, funil.data?.alo ?? 0)}
                hint={(funil.data?.cpc ?? 0) === 0 ? { motivo: 'Sem CPC (contato com o cliente) no mês. CPCs vêm da planilha de ligações (coluna T = CPC) importada em Relatórios.', acao: { label: 'Ir para Relatórios', to: '/relatorios' } } : undefined}
              />
              <FunilItem
                rotulo="CPC-A (acordo)"
                valor={(funil.data?.cpca ?? 0).toLocaleString('pt-BR')}
                sub={pct(funil.data?.cpca ?? 0, funil.data?.cpc ?? 0)}
                hint={(funil.data?.cpca ?? 0) === 0 ? { motivo: 'Sem CPC-A (acordo) no mês. Acordos da planilha (coluna T = CPC-A) ou acordos criados no sistema durante o horário comercial contam aqui.', acao: { label: 'Ir para Relatórios', to: '/relatorios' } } : undefined}
              />
              <FunilItem
                rotulo="Pagamento"
                valor={String(acordos.data?.totalPagoQtd ?? 0)}
                sub={pct(acordos.data?.totalPagoQtd ?? 0, funil.data?.cpca ?? 0)}
                hint={(acordos.data?.totalPagoQtd ?? 0) === 0 ? { motivo: 'Nenhuma parcela paga no mês para acordos Novo Mundo. Conforme parcelas forem marcadas como pagas, este número atualiza automaticamente.' } : undefined}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Funil de acionamento agregado (não segmentado por credor). Acordos e pagamentos filtrados por Novo Mundo.
            </p>
          </CardContent>
        </Card>

        {/* NN / Colchão */}
        <div className="grid md:grid-cols-2 gap-3">
          <TabelaRecuperacao titulo="02 · Recuperação NN" faixas={FAIXAS_NN} tipo="nn" carteira={carteira.data} metas={metas.data} totalRealizado={totalNNRealizado} />
          <TabelaRecuperacao titulo="02 · Colchão" faixas={FAIXAS_COLCHAO} tipo="colchao" carteira={carteira.data} metas={metas.data} totalRealizado={totalColchaoRealizado} />
        </div>

        {/* Aging List */}
        <Card>
          <CardHeader className="pb-2"><CardTitle>08 · Aging List (carteira ativa)</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Faixa de atraso (dias)</th>
                    <th className="text-right p-2">Qtd CPFs</th>
                    <th className="text-right p-2">Valor original</th>
                    <th className="text-right p-2">Valor atualizado</th>
                    <th className="text-right p-2">% da carteira</th>
                  </tr>
                </thead>
                <tbody>
                  {TODAS_FAIXAS.map((f) => {
                    const r = carteira.data?.porFaixa[f] ?? { qtd: 0, valor: 0, valorAtualizado: 0 };
                    const total = carteira.data?.totalValorAtualizado ?? 0;
                    return (
                      <tr key={f} className="border-b">
                        <td className="p-2">{f}</td>
                        <td className="p-2 text-right">{r.qtd.toLocaleString('pt-BR')}</td>
                        <td className="p-2 text-right">{moeda(r.valor)}</td>
                        <td className="p-2 text-right">{moeda(r.valorAtualizado)}</td>
                        <td className="p-2 text-right">{pct(r.valorAtualizado, total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold bg-muted/50">
                    <td className="p-2">Total</td>
                    <td className="p-2 text-right">{(carteira.data?.totalQtd ?? 0).toLocaleString('pt-BR')}</td>
                    <td className="p-2 text-right">{moeda(carteira.data?.totalValor ?? 0)}</td>
                    <td className="p-2 text-right">{moeda(carteira.data?.totalValorAtualizado ?? 0)}</td>
                    <td className="p-2 text-right">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Performance por cobrador */}
        <Card>
          <CardHeader className="pb-2"><CardTitle>09 · Performance por Cobrador</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Cobrador</th>
                    <th className="text-right p-2">Acordos fechados</th>
                    <th className="text-right p-2">Valor acordado</th>
                    <th className="text-right p-2">Valor recebido</th>
                    <th className="text-right p-2">Conversão $</th>
                    <th className="text-right p-2">Tempo em casa</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(acordos.data?.porUser.entries() ?? [])
                    .sort((a, b) => b[1].pago - a[1].pago)
                    .map(([uid, e]) => {
                      const info = cobradorMap.get(uid);
                      const dias = info?.admissao
                        ? Math.floor((Date.now() - new Date(info.admissao).getTime()) / 86400000)
                        : null;
                      return (
                        <tr key={uid} className="border-b">
                          <td className="p-2">{info?.nome ?? '—'}</td>
                          <td className="p-2 text-right">{e.qtd}</td>
                          <td className="p-2 text-right">{moeda(e.valor)}</td>
                          <td className="p-2 text-right">{moeda(e.pago)}</td>
                          <td className="p-2 text-right">{pct(e.pago, e.valor)}</td>
                          <td className="p-2 text-right">
                            {dias !== null ? (
                              `${dias} dias`
                            ) : podeEditar ? (
                              <InformarAdmissaoDialog
                                userId={uid}
                                nome={info?.nome ?? 'Cobrador'}
                                onSaved={() => qc.invalidateQueries({ queryKey: ['comite-nm', 'cobradores'] })}
                              />
                            ) : (
                              <span className="text-muted-foreground">— informar admissão</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  {(acordos.data?.porUser.size ?? 0) === 0 && (
                    <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Sem acordos no mês.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* TMR */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              10 · TMR — Tempo Médio de Recuperação
              {(acordos.data?.tmr === null || acordos.data?.tmr === undefined) && (
                <CampoZeradoHint motivo="TMR só calcula quando há pelo menos um acordo criado no mês com uma parcela paga. Conforme pagamentos forem registrados, este número aparece automaticamente." />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {acordos.data?.tmr !== null && acordos.data?.tmr !== undefined ? `${acordos.data.tmr.toFixed(1)} dias` : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Média de dias entre a criação do acordo e o primeiro pagamento (acordos do mês com pagamento registrado).
            </p>
          </CardContent>
        </Card>

        {/* Blocos qualitativos */}
        {BLOCOS.map((b) => (
          <BlocoTexto
            key={b.key}
            titulo={b.titulo}
            bloco={b.key}
            mesAno={mesAno}
            conteudo={textos.data?.get(b.key) ?? ''}
            podeEditar={podeEditar}
            onSaved={() => qc.invalidateQueries({ queryKey: ['comite-nm', 'textos', mesAno] })}
          />
        ))}
      </div>
    </AppLayout>
  );
}

function KPI({ titulo, valor, sub, hint }: { titulo: string; valor: string; sub?: string; hint?: { motivo: string; acao?: import('@/components/comite/CampoZeradoHint').AcaoHint } }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase text-muted-foreground flex items-center gap-1">
          <span>{titulo}</span>
          {hint && <CampoZeradoHint motivo={hint.motivo} acao={hint.acao} />}
        </div>
        <div className="text-2xl font-bold mt-1">{valor}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function FunilItem({ rotulo, valor, sub, hint }: { rotulo: string; valor: string; sub?: string; hint?: { motivo: string; acao?: import('@/components/comite/CampoZeradoHint').AcaoHint } }) {
  return (
    <div className="rounded-md border p-3 text-center">
      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
        <span>{rotulo}</span>
        {hint && <CampoZeradoHint motivo={hint.motivo} acao={hint.acao} />}
      </div>
      <div className="text-xl font-bold">{valor}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function TabelaRecuperacao({
  titulo,
  faixas,
  tipo,
  carteira,
  metas,
  totalRealizado,
}: {
  titulo: string;
  faixas: FaixaKey[];
  tipo: 'nn' | 'colchao';
  carteira: ReturnType<typeof useCarteira>['data'];
  metas: Map<string, number> | undefined;
  totalRealizado: number;
}) {
  const totalMeta = faixas.reduce((s, f) => s + (metas?.get(`${tipo}:${f}`) ?? 0), 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {titulo}
          {totalMeta === 0 && (
            <CampoZeradoHint motivo={`Sem meta cadastrada para ${tipo === 'nn' ? 'NN' : 'Colchão'} neste mês. Use o botão "Metas do mês" no topo da página para definir os valores por faixa.`} />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-2">Faixa</th>
              <th className="text-right p-2">Meta</th>
              <th className="text-right p-2">Em aberto</th>
              <th className="text-right p-2">% atingido</th>
            </tr>
          </thead>
          <tbody>
            {faixas.map((f) => {
              const meta = metas?.get(`${tipo}:${f}`) ?? 0;
              const realizado = carteira?.porFaixa[f]?.valorAtualizado ?? 0;
              return (
                <tr key={f} className="border-b">
                  <td className="p-2">{f}</td>
                  <td className="p-2 text-right">
                    <span className="inline-flex items-center gap-1 justify-end">
                      {moeda(meta)}
                      {meta === 0 && (
                        <CampoZeradoHint motivo={`Meta da faixa ${f} não cadastrada. Abra "Metas do mês" para informar.`} />
                      )}
                    </span>
                  </td>
                  <td className="p-2 text-right">{moeda(realizado)}</td>
                  <td className="p-2 text-right">{pct(realizado, meta)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold bg-muted/50">
              <td className="p-2">Total</td>
              <td className="p-2 text-right">{moeda(totalMeta)}</td>
              <td className="p-2 text-right">{moeda(totalRealizado)}</td>
              <td className="p-2 text-right">{pct(totalRealizado, totalMeta)}</td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}

function BlocoTexto({
  titulo, bloco, mesAno, conteudo, podeEditar, onSaved,
}: { titulo: string; bloco: string; mesAno: string; conteudo: string; podeEditar: boolean; onSaved: () => void }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(conteudo);
  const [saving, setSaving] = useState(false);

  // ressincroniza ao trocar mês
  useMemo(() => { setValor(conteudo); }, [conteudo]);

  async function salvar() {
    setSaving(true);
    const { error } = await supabase
      .from('comite_textos_novomundo')
      .upsert({ mes_ano: mesAno, bloco, conteudo: valor }, { onConflict: 'mes_ano,bloco' });
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      return;
    }
    toast.success('Salvo');
    setEditando(false);
    onSaved();
  }

  return (
    <Card className={!conteudo && !editando ? 'border-amber-500/40' : ''}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          {titulo}
          {!conteudo && !editando && (
            <CampoZeradoHint motivo="Este bloco ainda está em branco. Clique em Editar para preencher — o conteúdo fica salvo por mês." />
          )}
        </CardTitle>
        {podeEditar && !editando && (
          <Button size="sm" variant="ghost" onClick={() => setEditando(true)}>
            <Pencil className="h-3 w-3 mr-1" /> {conteudo ? 'Editar' : 'Preencher'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editando ? (
          <div className="space-y-2">
            <Textarea value={valor} onChange={(e) => setValor(e.target.value)} rows={5} />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setValor(conteudo); setEditando(false); }}>Cancelar</Button>
              <Button size="sm" onClick={salvar} disabled={saving}>Salvar</Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground min-h-[2rem]">
            {conteudo || <span className="italic">— em branco —</span>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MetasDialog({ mesAno, onSaved }: { mesAno: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const metas = useMetasMes(mesAno);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function abrir(v: boolean) {
    setOpen(v);
    if (v && metas.data) {
      const inicial: Record<string, string> = {};
      for (const f of TODAS_FAIXAS) {
        const tipo = FAIXAS_NN.includes(f) ? 'nn' : 'colchao';
        inicial[`${tipo}:${f}`] = String(metas.data.get(`${tipo}:${f}`) ?? '');
      }
      inicial['global:total'] = String(metas.data.get('global:total') ?? '');
      setValores(inicial);
    }
  }

  async function salvar() {
    setSaving(true);
    const rows: any[] = [];
    for (const f of TODAS_FAIXAS) {
      const tipo = FAIXAS_NN.includes(f) ? 'nn' : 'colchao';
      const key = `${tipo}:${f}`;
      const v = Number((valores[key] ?? '0').replace(',', '.')) || 0;
      rows.push({ mes_ano: mesAno, tipo, faixa: f, meta_valor: v });
    }
    const vGlobal = Number((valores['global:total'] ?? '0').replace(',', '.')) || 0;
    rows.push({ mes_ano: mesAno, tipo: 'global', faixa: 'total', meta_valor: vGlobal });
    const { error } = await supabase
      .from('comite_metas_novomundo')
      .upsert(rows, { onConflict: 'mes_ano,tipo,faixa' });
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Metas salvas');
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={abrir}>
      <DialogTrigger asChild>
        <Button variant="outline"><Pencil className="h-4 w-4 mr-2" /> Metas do mês</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Metas — {mesAno}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm mb-2">NN</h4>
            {FAIXAS_NN.map((f) => (
              <LinhaMeta key={f} label={f} value={valores[`nn:${f}`] ?? ''} onChange={(v) => setValores((s) => ({ ...s, [`nn:${f}`]: v }))} />
            ))}
          </div>
          <div>
            <h4 className="font-medium text-sm mb-2">Colchão</h4>
            {FAIXAS_COLCHAO.map((f) => (
              <LinhaMeta key={f} label={f} value={valores[`colchao:${f}`] ?? ''} onChange={(v) => setValores((s) => ({ ...s, [`colchao:${f}`]: v }))} />
            ))}
          </div>
          <div>
            <h4 className="font-medium text-sm mb-2">Meta global</h4>
            <LinhaMeta label="Total" value={valores['global:total'] ?? ''} onChange={(v) => setValores((s) => ({ ...s, ['global:total']: v }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinhaMeta({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="w-20 text-sm">{label}</span>
      <Input type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0,00" />
    </div>
  );
}
