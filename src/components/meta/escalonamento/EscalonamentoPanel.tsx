import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, Target, TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useMetaEscalonamento,
  metaSugeridaParaDia,
  hojeISO,
} from "@/hooks/useMetaEscalonamento";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const PIE_COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

export default function EscalonamentoPanel() {
  const [open, setOpen] = useState(true);
  const { resumo, plano, refetchResumo, refetchPlano } = useMetaEscalonamento();
  const [editObjetivo, setEditObjetivo] = useState(false);
  const [novoObj, setNovoObj] = useState<number>(1000);
  const [novoDias, setNovoDias] = useState<number>(7);

  const today = hojeISO();

  const planoTabela = useMemo(() => {
    if (!plano) return [];
    const linhas: { dia: number; data: string; meta: number; acumulado: number; pct: number; isHoje: boolean }[] = [];
    let acc = 0;
    const total = plano.plano_dias + 2; // mostra 2 dias extras
    for (let i = 1; i <= total; i++) {
      const meta = metaSugeridaParaDia(i, plano.plano_objetivo_unicos, plano.plano_dias);
      acc += meta;
      const d = new Date(plano.plano_inicio + "T00:00:00");
      d.setDate(d.getDate() + (i - 1));
      const iso = d.toISOString().slice(0, 10);
      linhas.push({
        dia: i,
        data: iso,
        meta,
        acumulado: acc,
        pct: Math.round((acc / plano.plano_objetivo_unicos) * 100),
        isHoje: iso === today,
      });
    }
    return linhas;
  }, [plano, today]);

  const unicos7d = resumo?.unicos_7d ?? 0;
  const unicosHoje = resumo?.unicos_hoje ?? 0;
  const metaHoje = plano?.meta_clientes_unicos ?? 30;
  const objetivo = plano?.plano_objetivo_unicos ?? 1000;
  const pct7d = Math.min(100, Math.round((unicos7d / Math.max(objetivo, 1)) * 100));
  const pctDia = Math.min(100, Math.round((unicosHoje / Math.max(metaHoje, 1)) * 100));

  const alerta = useMemo(() => {
    if (!resumo || !plano) return null;
    if (unicosHoje >= metaHoje) return { tipo: "ok" as const, msg: `✅ Meta de hoje atingida (${unicosHoje}/${metaHoje}).` };
    if (resumo.por_instancia.some((i) => (i.saude_quality || "").toUpperCase() === "RED")) {
      return { tipo: "erro" as const, msg: "🔴 Qualidade RED em algum número — pause envios em massa por 24-48h." };
    }
    // alerta amarelo se já passou da metade do dia e está abaixo de 50% da meta
    const hora = new Date().getHours();
    if (hora >= 14 && unicosHoje < metaHoje * 0.5) {
      return { tipo: "atencao" as const, msg: `🟡 Abaixo do ritmo — faltam ${metaHoje - unicosHoje} envios únicos para hoje.` };
    }
    return { tipo: "info" as const, msg: `▶️ ${metaHoje - unicosHoje} envios únicos restantes para fechar a meta de hoje.` };
  }, [resumo, plano, unicosHoje, metaHoje]);

  const enviadasPorInst = useMemo(
    () => (resumo?.por_instancia || []).map((i) => ({ name: i.nome, value: i.qtd_hoje })).filter((x) => x.value > 0),
    [resumo]
  );

  const salvarObjetivo = async () => {
    if (!plano) return;
    if (novoObj < 100 || novoDias < 1) {
      toast.error("Objetivo mínimo 100 e dias mínimo 1");
      return;
    }
    const novaMeta = metaSugeridaParaDia(plano.dia_numero, novoObj, novoDias);
    const { error } = await (supabase as any)
      .from("meta_envios_meta_diaria")
      .upsert(
        {
          user_id: plano.user_id,
          data: plano.data,
          meta_clientes_unicos: novaMeta,
          dia_numero: plano.dia_numero,
          plano_inicio: plano.plano_inicio,
          plano_objetivo_unicos: novoObj,
          plano_dias: novoDias,
        },
        { onConflict: "user_id,data" }
      );
    if (error) {
      toast.error("Falha ao salvar objetivo: " + error.message);
      return;
    }
    toast.success("Objetivo atualizado");
    setEditObjetivo(false);
    refetchPlano();
  };

  const reiniciarPlano = async () => {
    if (!plano) return;
    if (!confirm("Reiniciar o plano para começar HOJE como Dia 1?")) return;
    const { error } = await (supabase as any)
      .from("meta_envios_meta_diaria")
      .upsert(
        {
          user_id: plano.user_id,
          data: today,
          meta_clientes_unicos: metaSugeridaParaDia(1, plano.plano_objetivo_unicos, plano.plano_dias),
          dia_numero: 1,
          plano_inicio: today,
          plano_objetivo_unicos: plano.plano_objetivo_unicos,
          plano_dias: plano.plano_dias,
        },
        { onConflict: "user_id,data" }
      );
    if (error) {
      toast.error("Falha: " + error.message);
      return;
    }
    toast.success("Plano reiniciado");
    refetchPlano();
    refetchResumo();
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Controle de Escalonamento — API Oficial
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            Dia {plano?.dia_numero ?? 1} de {plano?.plano_dias ?? 7}
          </Badge>
        </div>
        <CardDescription>
          Plano gradual para subir de tier respeitando os limites da Meta.
        </CardDescription>
      </CardHeader>
      {open && (
        <CardContent className="space-y-5">
          {/* Alerta */}
          {alerta && (
            <div
              className={
                "rounded-md border px-3 py-2 text-sm flex items-center gap-2 " +
                (alerta.tipo === "ok"
                  ? "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                  : alerta.tipo === "erro"
                  ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                  : alerta.tipo === "atencao"
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                  : "border-sky-500 bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300")
              }
            >
              {alerta.tipo === "erro" || alerta.tipo === "atencao" ? <AlertTriangle className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              <span>{alerta.msg}</span>
            </div>
          )}

          {/* Cards de resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResumoMini titulo="Meta hoje" valor={metaHoje} sub={`${unicosHoje} feitos · ${pctDia}%`} pct={pctDia} />
            <ResumoMini titulo="Únicos hoje" valor={unicosHoje} sub={`Faltam ${Math.max(metaHoje - unicosHoje, 0)}`} pct={pctDia} />
            <ResumoMini
              titulo={`Únicos 7d / ${objetivo}`}
              valor={unicos7d}
              sub={`${pct7d}% do objetivo`}
              pct={pct7d}
            />
            <ResumoMini titulo="Mensagens hoje" valor={resumo?.enviadas_hoje ?? 0} sub="Total enviado" />
          </div>

          {/* Configuração de objetivo */}
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex flex-wrap items-end gap-3">
              {editObjetivo ? (
                <>
                  <div>
                    <Label className="text-xs">Objetivo (únicos)</Label>
                    <Input type="number" min={100} value={novoObj} onChange={(e) => setNovoObj(Number(e.target.value))} className="h-8 w-28" />
                  </div>
                  <div>
                    <Label className="text-xs">Dias</Label>
                    <Input type="number" min={1} value={novoDias} onChange={(e) => setNovoDias(Number(e.target.value))} className="h-8 w-20" />
                  </div>
                  <Button size="sm" onClick={salvarObjetivo}>Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditObjetivo(false)}>Cancelar</Button>
                </>
              ) : (
                <>
                  <div className="text-sm">
                    Objetivo: <strong>{objetivo}</strong> únicos em <strong>{plano?.plano_dias ?? 7}</strong> dias.
                  </div>
                  <Button size="sm" variant="outline" onClick={() => {
                    setNovoObj(objetivo);
                    setNovoDias(plano?.plano_dias ?? 7);
                    setEditObjetivo(true);
                  }}>Ajustar objetivo</Button>
                  <Button size="sm" variant="ghost" onClick={reiniciarPlano}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reiniciar plano (hoje = Dia 1)
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Plano */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Plano de escalonamento</h4>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">Dia</th>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-right">Meta</th>
                    <th className="px-3 py-2 text-right">Acumulado</th>
                    <th className="px-3 py-2 text-right">% Objetivo</th>
                  </tr>
                </thead>
                <tbody>
                  {planoTabela.map((l) => (
                    <tr
                      key={l.dia}
                      className={
                        "border-t " +
                        (l.isHoje
                          ? "bg-primary/10 font-semibold"
                          : l.pct >= 100
                          ? "bg-green-50 dark:bg-green-950/20"
                          : "")
                      }
                    >
                      <td className="px-3 py-1.5">{l.dia}{l.isHoje && <Badge className="ml-2 text-[10px]">HOJE</Badge>}</td>
                      <td className="px-3 py-1.5">{l.data.split("-").reverse().join("/")}</td>
                      <td className="px-3 py-1.5 text-right">{l.meta}</td>
                      <td className="px-3 py-1.5 text-right">{l.acumulado}</td>
                      <td className="px-3 py-1.5 text-right">{l.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Por número */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Envios por número (hoje)</h4>
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">Número</th>
                    <th className="px-3 py-2 text-right">Enviadas hoje</th>
                    <th className="px-3 py-2 text-right">Únicos hoje</th>
                    <th className="px-3 py-2 text-right">Tier</th>
                    <th className="px-3 py-2 text-center">Qualidade</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(resumo?.por_instancia || []).map((i) => {
                    const q = (i.saude_quality || "").toUpperCase();
                    const qColor = q === "GREEN" ? "bg-green-600 text-white" : q === "YELLOW" ? "bg-yellow-500 text-white" : q === "RED" ? "bg-red-600 text-white" : "bg-muted";
                    const usoPct = Math.round((i.qtd_hoje / Math.max(i.tier_diario, 1)) * 100);
                    return (
                      <tr key={i.id} className="border-t">
                        <td className="px-3 py-1.5">
                          <div className="font-medium">{i.nome}</div>
                          <div className="text-xs text-muted-foreground">{i.display_phone || "—"}</div>
                        </td>
                        <td className="px-3 py-1.5 text-right">{i.qtd_hoje} / {i.tier_diario} <span className="text-xs text-muted-foreground">({usoPct}%)</span></td>
                        <td className="px-3 py-1.5 text-right">{i.unicos_hoje}</td>
                        <td className="px-3 py-1.5 text-right">{i.saude_tier || "—"}</td>
                        <td className="px-3 py-1.5 text-center">
                          {q ? <Badge className={`text-[10px] ${qColor}`}>{q}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {i.ativo ? <Badge variant="default" className="bg-green-600 text-white text-[10px]">Ativo</Badge> : <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                  {(!resumo || resumo.por_instancia.length === 0) && (
                    <tr><td colSpan={6} className="text-center text-muted-foreground py-4 text-xs">Nenhuma instância Meta cadastrada</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-md border p-3">
              <div className="text-sm font-semibold mb-2">Evolução de únicos (7 dias)</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={resumo?.serie_7d ?? []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" tickFormatter={(d) => d?.slice(5) ?? ""} fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Line type="monotone" dataKey="unicos" stroke="#0ea5e9" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-sm font-semibold mb-2">Distribuição por número (hoje)</div>
              <div className="h-56">
                {enviadasPorInst.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={enviadasPorInst} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                        {enviadasPorInst.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem envios hoje</div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function ResumoMini({ titulo, valor, sub, pct }: { titulo: string; valor: number | string; sub?: string; pct?: number }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{titulo}</div>
      <div className="text-2xl font-bold mt-0.5">{valor}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      {typeof pct === "number" && (
        <div className="h-1.5 w-full bg-muted rounded mt-2 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
    </div>
  );
}
