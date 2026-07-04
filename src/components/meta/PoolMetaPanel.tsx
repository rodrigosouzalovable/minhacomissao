import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, PauseCircle, PlayCircle, RefreshCw, ShieldCheck, Loader2, Clock } from "lucide-react";

type MetaInst = {
  id: string;
  nome: string | null;
  display_phone: string | null;
  ativo: boolean;
  tier_diario: number | null;
  enviados_hoje: number | null;
  saude_quality: string | null;
  saude_tier: string | null;
  saude_status: string | null;
  data_ativacao_api: string | null;
  fase_rampup: string | null;
  pausa_automatica_ate: string | null;
  pausa_automatica_motivo: string | null;
  score_saude_cache: number | null;
  estado_pool: string | null;
  messaging_limit_manual: string | null;
  messaging_limit_source: string | null;
  messaging_limit_synced_at: string | null;
};

type PoolConfig = {
  cota_fase1: number; cota_fase2: number; cota_fase3: number; cota_fase4: number;
  bloquear_domingo: boolean;
  horario_inicio: string; horario_fim: string;
};

const FASE_LABEL: Record<string, string> = {
  aguardando: "Aguardando templates",
  fase1: "Fase 1 (dias 1-3)",
  fase2: "Fase 2 (dias 4-7)",
  fase3: "Fase 3 (dias 8-14)",
  fase4: "Fase 4 (dias 15-21)",
  livre: "Maduro (livre)",
};

function qualityColor(q?: string | null) {
  const v = String(q || "").toUpperCase();
  if (v === "GREEN") return "bg-green-500";
  if (v === "YELLOW") return "bg-yellow-500";
  if (v === "RED") return "bg-red-500";
  return "bg-muted-foreground";
}
function estadoBadge(e: string | null | undefined) {
  const v = e || "aguardando_templates";
  if (v === "ativo") return { label: "Ativo", cls: "bg-green-600 text-white" };
  if (v === "pausado") return { label: "Pausado", cls: "bg-red-600 text-white" };
  return { label: "Aguardando templates", cls: "bg-amber-500 text-white" };
}
function cotaDaFase(fase: string | null, cfg: PoolConfig | null): number {
  if (!fase || !cfg) return 0;
  switch (fase) {
    case "fase1": return cfg.cota_fase1;
    case "fase2": return cfg.cota_fase2;
    case "fase3": return cfg.cota_fase3;
    case "fase4": return cfg.cota_fase4;
    case "livre": return 999999;
    default: return 0;
  }
}

export function PoolMetaPanel() {
  const [instancias, setInstancias] = useState<MetaInst[]>([]);
  const [cfg, setCfg] = useState<PoolConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [checando, setChecando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const sb = supabase as any;
    const [i, c] = await Promise.all([
      sb.from("meta_whatsapp_instances").select("*").eq("ativo", true).order("nome"),
      sb.from("meta_envio_pool_config").select("*").eq("id", 1).maybeSingle(),
    ]);
    if (i.data) setInstancias(i.data as any);
    if (c.data) setCfg(c.data as any);
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const ativarNoPool = async (inst: MetaInst) => {
    if (!confirm(`Ativar "${inst.nome}" no pool? O ramp-up começa hoje (Dia 1 = 20 msg máx).`)) return;
    setSavingId(inst.id);
    const { error } = await (supabase as any).from("meta_whatsapp_instances")
      .update({
        estado_pool: "ativo",
        data_ativacao_api: new Date().toISOString().slice(0, 10),
        fase_rampup: "fase1",
        pausa_automatica_ate: null,
        pausa_automatica_motivo: null,
      })
      .eq("id", inst.id);
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${inst.nome} ativado no pool — Dia 1 iniciado`);
    await carregar();
  };

  const pausarManual = async (inst: MetaInst) => {
    setSavingId(inst.id);
    const { error } = await (supabase as any).from("meta_whatsapp_instances")
      .update({ estado_pool: "pausado", pausa_automatica_motivo: "manual" })
      .eq("id", inst.id);
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${inst.nome} pausado`);
    await carregar();
  };

  const retomar = async (inst: MetaInst) => {
    setSavingId(inst.id);
    const { error } = await (supabase as any).from("meta_whatsapp_instances")
      .update({
        estado_pool: "ativo",
        pausa_automatica_ate: null,
        pausa_automatica_motivo: null,
      })
      .eq("id", inst.id);
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${inst.nome} retomado`);
    await carregar();
  };

  const checarSaude = async () => {
    setChecando(true);
    try {
      const { error } = await supabase.functions.invoke("check-meta-instance-health", { body: {} });
      if (error) throw error;
      toast.success("Saúde de todos os números atualizada");
      await carregar();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    } finally {
      setChecando(false);
    }
  };

  const ativos = instancias.filter(i => i.estado_pool === "ativo").length;
  const pausados = instancias.filter(i => i.estado_pool === "pausado").length;
  const aguardando = instancias.filter(i => (i.estado_pool || "aguardando_templates") === "aguardando_templates").length;
  const enviadosHoje = instancias.reduce((s, i) => s + (i.enviados_hoje || 0), 0);
  const cotaTotal = instancias.reduce((s, i) => {
    if (i.estado_pool !== "ativo") return s;
    const c = Math.min(cotaDaFase(i.fase_rampup, cfg), i.tier_diario || 250);
    return s + c;
  }, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Pool Meta Oficial
            </CardTitle>
            <CardDescription>
              Distribuição inteligente por score de saúde, ramp-up de 21 dias por número, auto-pausa em YELLOW.
              {cfg?.bloquear_domingo && " Domingo bloqueado. "}
              Horário {cfg?.horario_inicio?.slice(0, 5)}–{cfg?.horario_fim?.slice(0, 5)} BRT.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={checarSaude} disabled={checando}>
            {checando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Verificar saúde
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Ativos no pool</p>
            <p className="text-2xl font-bold text-green-600">{ativos}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Aguardando templates</p>
            <p className="text-2xl font-bold text-amber-600">{aguardando}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Pausados</p>
            <p className="text-2xl font-bold text-red-600">{pausados}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Enviadas hoje / cota</p>
            <p className="text-2xl font-bold">{enviadosHoje}<span className="text-sm text-muted-foreground"> / {cotaTotal || "—"}</span></p>
          </div>
        </div>

        {/* Cards por número */}
        {loading ? (
          <div className="text-sm text-muted-foreground py-4">Carregando...</div>
        ) : instancias.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">Nenhum número Meta conectado.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {instancias.map((inst) => {
              const est = estadoBadge(inst.estado_pool);
              const cota = Math.min(cotaDaFase(inst.fase_rampup, cfg), inst.tier_diario || 250);
              const uso = inst.enviados_hoje || 0;
              const pct = cota > 0 ? Math.min(100, (uso / cota) * 100) : 0;
              const dias = inst.data_ativacao_api
                ? Math.floor((Date.now() - new Date(inst.data_ativacao_api).getTime()) / 86400000) + 1
                : 0;
              const pausado = inst.pausa_automatica_ate && new Date(inst.pausa_automatica_ate) > new Date();
              return (
                <div key={inst.id} className="rounded-lg border p-3 space-y-2 bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${qualityColor(inst.saude_quality)}`} title={inst.saude_quality || "UNKNOWN"} />
                        <p className="font-medium truncate">{inst.nome}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{inst.display_phone}</p>
                    </div>
                    <Badge className={est.cls}>{est.label}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <Badge variant="outline">Qualidade: {inst.saude_quality || "UNKNOWN"}</Badge>
                    <Badge variant="outline" title={inst.messaging_limit_source === "manual" ? "Definido manualmente" : inst.messaging_limit_source === "meta_api" ? `Sincronizado da Meta ${inst.messaging_limit_synced_at ? "em " + new Date(inst.messaging_limit_synced_at).toLocaleString("pt-BR") : ""}` : "Padrão (permissão Meta pendente)"}>
                      {inst.messaging_limit_source === "manual" ? "✋" : inst.messaging_limit_source === "meta_api" ? "🔄" : "•"} Tier: {(inst.messaging_limit_manual || inst.saude_tier)?.replace("MESSAGING_LIMIT_TIER_", "").replace("MESSAGING_LIMIT_", "") || "—"}
                    </Badge>
                    <Badge variant="outline">{FASE_LABEL[inst.fase_rampup || "aguardando"]}</Badge>
                    {inst.data_ativacao_api && <Badge variant="outline">{dias}d na API</Badge>}
                  </div>

                  {inst.estado_pool === "ativo" && (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Cota hoje</span>
                        <span className="font-medium">{uso} / {cota}</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  )}

                  {pausado && (
                    <div className="text-xs bg-red-500/10 border border-red-500/30 rounded p-2 flex items-start gap-1.5 text-red-700 dark:text-red-400">
                      <PauseCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">Pausa automática</p>
                        <p>Motivo: {inst.pausa_automatica_motivo || "?"}</p>
                        <p className="flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" /> até {new Date(inst.pausa_automatica_ate!).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    {(inst.estado_pool || "aguardando_templates") === "aguardando_templates" && (
                      <Button size="sm" onClick={() => ativarNoPool(inst)} disabled={savingId === inst.id} className="flex-1">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Ativar no pool
                      </Button>
                    )}
                    {inst.estado_pool === "ativo" && (
                      <Button size="sm" variant="outline" onClick={() => pausarManual(inst)} disabled={savingId === inst.id} className="flex-1">
                        <PauseCircle className="h-3.5 w-3.5 mr-1" /> Pausar
                      </Button>
                    )}
                    {(inst.estado_pool === "pausado" || pausado) && (
                      <Button size="sm" onClick={() => retomar(inst)} disabled={savingId === inst.id} className="flex-1">
                        <PlayCircle className="h-3.5 w-3.5 mr-1" /> Retomar
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
