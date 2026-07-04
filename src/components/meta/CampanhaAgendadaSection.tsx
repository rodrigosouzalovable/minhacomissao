import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Calendar, Loader2, PauseCircle, PlayCircle, Trash2, RefreshCw } from "lucide-react";

type ClienteRow = {
  telefone: string;
  nome?: string;
  cpf?: string;
  atraso?: string;
  saldo?: number;
};

type InstanciaLite = {
  id: string;
  nome: string;
};

type PlanoDia = {
  data: string; // YYYY-MM-DD
  porInstancia: Record<string, number>;
  total: number;
};

type PlanoDistribuicao = {
  dias: PlanoDia[];
  atribuicoes: { clienteIndex: number; instanciaId: string; data: string }[];
  cotasPorInstancia: Record<string, number>;
};

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function proximoDiaUtil(d: Date): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + 1);
  if (n.getDay() === 0) n.setDate(n.getDate() + 1); // pula domingo
  return n;
}

async function calcularPlano(
  instanciaIds: string[],
  clientes: ClienteRow[],
  folga: number,
): Promise<PlanoDistribuicao> {
  // Busca cota efetiva de cada instância via RPC
  const cotas: Record<string, number> = {};
  for (const id of instanciaIds) {
    const { data } = await supabase.rpc("get_effective_daily_quota", { _instance_id: id } as any);
    const c = typeof data === "number" ? data : 1000;
    cotas[id] = Math.max(1, Math.floor(c * folga));
  }

  const atribuicoes: PlanoDistribuicao["atribuicoes"] = [];
  const dias: PlanoDia[] = [];
  let hoje = new Date();
  if (hoje.getDay() === 0) hoje = proximoDiaUtil(hoje);

  let currentDate = new Date(hoje);
  let usoDoDia: Record<string, number> = Object.fromEntries(instanciaIds.map((id) => [id, 0]));
  const registrarDia = () => {
    const total = Object.values(usoDoDia).reduce((a, b) => a + b, 0);
    if (total > 0) {
      dias.push({ data: toYMD(currentDate), porInstancia: { ...usoDoDia }, total });
    }
  };

  for (let i = 0; i < clientes.length; i++) {
    let colocado = false;
    let tentativas = 0;
    while (!colocado && tentativas < 400) {
      // ordena instâncias por menor uso relativo (round-robin ponderado por cota)
      const ordenadas = [...instanciaIds].sort((a, b) => {
        const usoA = usoDoDia[a] / cotas[a];
        const usoB = usoDoDia[b] / cotas[b];
        return usoA - usoB;
      });
      const inst = ordenadas.find((id) => usoDoDia[id] < cotas[id]);
      if (inst) {
        usoDoDia[inst]++;
        atribuicoes.push({ clienteIndex: i, instanciaId: inst, data: toYMD(currentDate) });
        colocado = true;
      } else {
        registrarDia();
        currentDate = proximoDiaUtil(currentDate);
        usoDoDia = Object.fromEntries(instanciaIds.map((id) => [id, 0]));
        tentativas++;
      }
    }
  }
  registrarDia();
  return { dias, atribuicoes, cotasPorInstancia: cotas };
}

type Props = {
  clientes: ClienteRow[];
  instanciaIds: string[];
  instancias: InstanciaLite[];
  template: { id: string; nome_template: string } | null;
  templateIdByInstance: Record<string, string>;
  minSec: number;
  maxSec: number;
  disabled?: boolean;
  onCriada?: () => void;
};

export function AgendarCampanhaBox({
  clientes,
  instanciaIds,
  instancias,
  template,
  templateIdByInstance,
  minSec,
  maxSec,
  disabled,
  onCriada,
}: Props) {
  const [agendar, setAgendar] = useState(false);
  const [folga, setFolga] = useState(0.8);
  const [nome, setNome] = useState("");
  const [plano, setPlano] = useState<PlanoDistribuicao | null>(null);
  const [calc, setCalc] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const instMap = useMemo(() => new Map(instancias.map((i) => [i.id, i])), [instancias]);

  useEffect(() => {
    if (!agendar) { setPlano(null); return; }
    if (clientes.length === 0 || instanciaIds.length === 0) { setPlano(null); return; }
    let cancelled = false;
    (async () => {
      setCalc(true);
      try {
        const p = await calcularPlano(instanciaIds, clientes, folga);
        if (!cancelled) setPlano(p);
      } catch (e: any) {
        toast.error("Erro ao calcular plano: " + (e?.message || e));
      } finally {
        if (!cancelled) setCalc(false);
      }
    })();
    return () => { cancelled = true; };
  }, [agendar, clientes, instanciaIds, folga]);

  const confirmar = async () => {
    if (!plano || !template) return;
    if (!nome.trim()) return toast.error("Dê um nome para a campanha");
    setSalvando(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sem usuário logado");

      const dataInicio = plano.dias[0]?.data || toYMD(new Date());
      const dataFim = plano.dias[plano.dias.length - 1]?.data || dataInicio;

      const { data: camp, error: cErr } = await (supabase as any)
        .from("meta_campanha_agendada")
        .insert({
          user_id: uid,
          nome: nome.trim(),
          template_id: template.id,
          template_nome: template.nome_template,
          instancia_ids: instanciaIds,
          template_id_by_instance: templateIdByInstance,
          min_seg: minSec,
          max_seg: maxSec,
          folga_cota: folga,
          status: "agendada",
          total_itens: plano.atribuicoes.length,
          data_inicio: dataInicio,
          data_fim_prevista: dataFim,
        })
        .select()
        .single();
      if (cErr) throw cErr;

      // Insere itens em lote
      const itens = plano.atribuicoes.map((a) => ({
        campanha_id: camp.id,
        cliente: clientes[a.clienteIndex] as any,
        instancia_id: a.instanciaId,
        data_prevista: a.data,
        status: "pendente",
      }));
      // Chunks de 500
      for (let i = 0; i < itens.length; i += 500) {
        const chunk = itens.slice(i, i + 500);
        const { error: iErr } = await (supabase as any).from("meta_campanha_item").insert(chunk);
        if (iErr) throw iErr;
      }

      toast.success(`Campanha "${nome}" agendada — ${plano.atribuicoes.length} envios em ${plano.dias.length} dia(s)`);
      setAgendar(false);
      setNome("");
      setPlano(null);
      onCriada?.();
    } catch (e: any) {
      toast.error("Erro ao agendar: " + (e?.message || e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Agendar campanha multi-dia
            </CardTitle>
            <CardDescription>
              Distribui os contatos entre os dias respeitando a cota diária segura de cada número. Cron dispara automaticamente às 08:00 BRT (segunda a sábado).
            </CardDescription>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <Checkbox checked={agendar} onCheckedChange={(v) => setAgendar(!!v)} disabled={disabled} />
            <span>Agendar em vez de disparar agora</span>
          </label>
        </div>
      </CardHeader>
      {agendar && (
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Nome da campanha</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Lote julho — cobrança preventiva" />
            </div>
            <div>
              <Label>Folga de segurança sobre a cota</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={50}
                  max={100}
                  step={5}
                  value={Math.round(folga * 100)}
                  onChange={(e) => setFolga(Math.max(0.5, Math.min(1, Number(e.target.value) / 100)))}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">80% recomendado — deixa margem para lembretes e conversas.</p>
            </div>
            <div>
              <Label>Delay entre envios</Label>
              <p className="text-sm mt-2">{minSec}–{maxSec}s (herdado do bloco "Delay e disparo")</p>
            </div>
          </div>

          {calc && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Calculando distribuição...
            </div>
          )}

          {plano && !calc && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm">
                  <strong>{plano.atribuicoes.length}</strong> envios em <strong>{plano.dias.length}</strong> dia(s) —{" "}
                  {plano.dias[0]?.data} → {plano.dias[plano.dias.length - 1]?.data}
                </div>
                <div className="text-xs text-muted-foreground">Domingos ignorados automaticamente</div>
              </div>

              <div className="overflow-auto max-h-56 border rounded bg-background">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Dia</th>
                      {instanciaIds.map((id) => (
                        <th key={id} className="text-right p-2">
                          {instMap.get(id)?.nome || id.slice(0, 6)}
                          <div className="text-[10px] text-muted-foreground font-normal">
                            máx {plano.cotasPorInstancia[id]}/dia
                          </div>
                        </th>
                      ))}
                      <th className="text-right p-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plano.dias.map((d) => (
                      <tr key={d.data} className="border-t">
                        <td className="p-2 font-medium">{d.data}</td>
                        {instanciaIds.map((id) => (
                          <td key={id} className="text-right p-2">{d.porInstancia[id] || 0}</td>
                        ))}
                        <td className="text-right p-2 font-medium">{d.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button
                onClick={confirmar}
                disabled={salvando || !nome.trim() || !template || plano.atribuicoes.length === 0}
                className="mt-2"
              >
                {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
                Confirmar agendamento ({plano.atribuicoes.length} envios)
              </Button>
            </div>
          )}

          {!plano && !calc && agendar && (
            <p className="text-sm text-muted-foreground">
              Selecione template, instâncias e destinatários acima para ver a distribuição prevista.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

type CampanhaRow = {
  id: string;
  nome: string;
  template_nome: string;
  status: string;
  total_itens: number;
  enviados: number;
  erros: number;
  data_inicio: string | null;
  data_fim_prevista: string | null;
  created_at: string;
};

export function CampanhasAgendadasList() {
  const [rows, setRows] = useState<CampanhaRow[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("meta_campanha_agendada")
      .select("id, nome, template_nome, status, total_itens, enviados, erros, data_inicio, data_fim_prevista, created_at")
      .in("status", ["agendada", "em_execucao", "concluida", "pausada", "cancelada"])
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const alterarStatus = async (id: string, status: string) => {
    const { error } = await (supabase as any)
      .from("meta_campanha_agendada").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Atualizada");
    carregar();
  };

  const cancelar = async (id: string) => {
    if (!confirm("Cancelar campanha? Envios pendentes serão descartados.")) return;
    const { error: e1 } = await (supabase as any)
      .from("meta_campanha_item")
      .update({ status: "cancelado" })
      .eq("campanha_id", id)
      .eq("status", "pendente");
    if (e1) return toast.error(e1.message);
    await alterarStatus(id, "cancelada");
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir campanha? Isso remove todos os registros.")) return;
    const { error } = await (supabase as any).from("meta_campanha_agendada").delete().eq("id", id);
    if (error) return toast.error(error.message);
    carregar();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Campanhas agendadas</CardTitle>
            <CardDescription>Envios distribuídos ao longo de vários dias, processados pelo cron das 08:00 BRT.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={carregar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma campanha agendada.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const pct = r.total_itens > 0 ? Math.round(((r.enviados + r.erros) / r.total_itens) * 100) : 0;
              return (
                <div key={r.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{r.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        Template: <code>{r.template_nome}</code>
                        {r.data_inicio && r.data_fim_prevista && ` • ${r.data_inicio} → ${r.data_fim_prevista}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <StatusBadge status={r.status} />
                      <Badge variant="secondary">✅ {r.enviados}</Badge>
                      {r.erros > 0 && <Badge variant="destructive">❌ {r.erros}</Badge>}
                      <Badge variant="outline">Total {r.total_itens}</Badge>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.status === "em_execucao" && (
                      <Button size="sm" variant="outline" onClick={() => alterarStatus(r.id, "pausada")}>
                        <PauseCircle className="h-3.5 w-3.5 mr-1" /> Pausar
                      </Button>
                    )}
                    {(r.status === "pausada" || r.status === "agendada") && (
                      <Button size="sm" variant="outline" onClick={() => alterarStatus(r.id, "em_execucao")}>
                        <PlayCircle className="h-3.5 w-3.5 mr-1" /> Retomar
                      </Button>
                    )}
                    {!["cancelada", "concluida"].includes(r.status) && (
                      <Button size="sm" variant="outline" onClick={() => cancelar(r.id)}>
                        Cancelar
                      </Button>
                    )}
                    {["cancelada", "concluida"].includes(r.status) && (
                      <Button size="sm" variant="ghost" onClick={() => excluir(r.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    agendada: { label: "Agendada", cls: "bg-blue-500 text-white" },
    em_execucao: { label: "Em execução", cls: "bg-green-600 text-white" },
    pausada: { label: "Pausada", cls: "bg-amber-500 text-white" },
    concluida: { label: "Concluída", cls: "bg-muted-foreground text-white" },
    cancelada: { label: "Cancelada", cls: "bg-red-500 text-white" },
  };
  const m = map[status] || { label: status, cls: "" };
  return <Badge className={`text-[10px] ${m.cls}`}>{m.label}</Badge>;
}
