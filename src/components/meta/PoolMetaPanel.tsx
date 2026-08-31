import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, PauseCircle, PlayCircle, RefreshCw, ShieldCheck, Loader2, Clock, Settings2, Zap } from "lucide-react";



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
  teto_escada: number | null;
  quarentena_ate: string | null;
  quarentena_motivo: string | null;
};

type PoolConfig = {
  cota_fase1: number; cota_fase2: number; cota_fase3: number; cota_fase4: number;
  bloquear_domingo: boolean;
  horario_inicio: string; horario_fim: string;
  freio_ativo: boolean | null;
  cota_max_hora: number | null;
  sem_teto_global: boolean | null;
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
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editData, setEditData] = useState("");
  const [editTeto, setEditTeto] = useState("");
  const [savingTurbo, setSavingTurbo] = useState(false);
  const [horaInput, setHoraInput] = useState("");

  const salvarTurbo = async (turbo: boolean, cotaHora?: number) => {
    setSavingTurbo(true);
    const patch: any = { freio_ativo: !turbo, atualizado_em: new Date().toISOString() };
    if (typeof cotaHora === "number" && cotaHora > 0) patch.cota_max_hora = cotaHora;
    const { error } = await (supabase as any).from("meta_envio_pool_config").update(patch).eq("id", 1);
    setSavingTurbo(false);
    if (error) { toast.error(error.message); return; }
    toast.success(turbo ? "Modo Turbo ligado — sem teto de rampa" : "Freio de rampa reativado");
    await carregar();
  };

  const salvarSemTeto = async (semTeto: boolean) => {
    setSavingTurbo(true);
    const { error } = await (supabase as any).from("meta_envio_pool_config")
      .update({ sem_teto_global: semTeto, atualizado_em: new Date().toISOString() }).eq("id", 1);
    setSavingTurbo(false);
    if (error) { toast.error(error.message); return; }
    toast.success(semTeto ? "Sem teto ligado — GREEN usa a cota da Meta" : "Limites internos reativados");
    await carregar();
  };

  const salvarLiberarQualidade = async (liberar: boolean) => {
    setSavingTurbo(true);
    const { error } = await (supabase as any).from("meta_envio_pool_config")
      .update({ liberar_qualidade_global: liberar, atualizado_em: new Date().toISOString() }).eq("id", 1);
    setSavingTurbo(false);
    if (error) { toast.error(error.message); return; }
    toast.success(liberar ? "YELLOW/RED liberados para todos os usuários" : "Proteção por qualidade reativada");
    await carregar();
  };



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
        // Retomada manual libera envio mesmo com qualidade YELLOW/RED
        qualidade_liberada_manual: true,
        qualidade_liberada_em: new Date().toISOString(),
      })
      .eq("id", inst.id);
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${inst.nome} retomado`);
    await carregar();
  };

  const abrirEdicao = (inst: MetaInst) => {
    setEditandoId(inst.id);
    setEditData(inst.data_ativacao_api ? String(inst.data_ativacao_api).slice(0, 10) : "");
    setEditTeto(inst.teto_escada != null ? String(inst.teto_escada) : "");
  };

  const salvarRampa = async (inst: MetaInst) => {
    setSavingId(inst.id);
    const dias = editData
      ? Math.floor((Date.now() - new Date(editData + "T00:00:00").getTime()) / 86400000) + 1
      : null;
    const fase = dias == null
      ? inst.fase_rampup
      : dias <= 3 ? "fase1" : dias <= 7 ? "fase2" : dias <= 14 ? "fase3" : dias <= 21 ? "fase4" : "livre";
    const tetoNum = editTeto.trim() === "" ? null : Math.max(1, Number(editTeto));
    if (tetoNum != null && !Number.isFinite(tetoNum)) {
      setSavingId(null);
      toast.error("Teto inválido");
      return;
    }
    const { error } = await (supabase as any).from("meta_whatsapp_instances")
      .update({
        data_ativacao_api: editData || null,
        fase_rampup: fase,
        teto_escada: tetoNum,
      })
      .eq("id", inst.id);
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Rampa de ${inst.nome} atualizada`);
    setEditandoId(null);
    await carregar();
  };

  const sairQuarentena = async (inst: MetaInst) => {
    setSavingId(inst.id);
    const { error } = await (supabase as any).from("meta_whatsapp_instances")
      .update({ quarentena_ate: null, quarentena_motivo: null })
      .eq("id", inst.id);
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${inst.nome} liberado da quarentena`);
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
    const greenSemTeto = cfg?.sem_teto_global === true && String(i.saude_quality || "").toUpperCase() === "GREEN";
    const c = greenSemTeto ? (i.tier_diario || 0) : Math.min(cotaDaFase(i.fase_rampup, cfg), i.tier_diario || 250);
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
        {/* Modo Turbo */}
        <div className={`rounded-md border p-3 space-y-2 ${cfg?.freio_ativo === false ? "border-amber-500/60 bg-amber-500/10" : ""}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Zap className={`h-4 w-4 ${cfg?.freio_ativo === false ? "text-amber-600" : "text-muted-foreground"}`} />
              <div>
                <p className="text-sm font-semibold">Modo Turbo (sem freio de rampa)</p>
                <p className="text-xs text-muted-foreground">
                  Ignora teto por hora, teto diário de fase e corte por engajamento. Os envios respeitam apenas o delay configurado na campanha.
                </p>
              </div>
            </div>
            <Switch
              checked={cfg?.freio_ativo === false}
              disabled={savingTurbo}
              onCheckedChange={(v) => salvarTurbo(v)}
            />
          </div>
          {cfg?.freio_ativo === false ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              ⚠️ Risco assumido: sem freio, a qualidade dos números pode cair (YELLOW/RED) ou o número pode ser banido pela Meta. Desligue quando terminar a campanha.
            </p>
          ) : (
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Teto por hora / número</Label>
                <Input
                  className="h-8 w-28"
                  type="number"
                  value={horaInput}
                  placeholder={String(cfg?.cota_max_hora ?? 12)}
                  onChange={(e) => setHoraInput(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={savingTurbo || !horaInput}
                onClick={() => salvarTurbo(false, Number(horaInput))}
              >
                Salvar teto
              </Button>
              <span className="text-xs text-muted-foreground pb-1.5">
                Atual: {cfg?.cota_max_hora ?? 12}/h — com delay de 5–10s são necessários ~500/h por número.
              </span>
            </div>
          )}
        </div>

         {/* Modo sem teto */}
         <div className={`rounded-md border p-3 space-y-2 ${cfg?.sem_teto_global ? "border-amber-500/60 bg-amber-500/10" : ""}`}>
           <div className="flex items-center justify-between gap-3 flex-wrap">
             <div className="flex items-center gap-2">
               <ShieldCheck className={`h-4 w-4 ${cfg?.sem_teto_global ? "text-amber-600" : "text-muted-foreground"}`} />
               <div>
                 <p className="text-sm font-semibold">Sem teto interno para números GREEN</p>
                 <p className="text-xs text-muted-foreground">Números GREEN usam a cota real da Meta; YELLOW e RED continuam protegidos pelo aquecimento automático.</p>
               </div>
             </div>
             <Switch checked={cfg?.sem_teto_global === true} disabled={savingTurbo} onCheckedChange={salvarSemTeto} />
           </div>
           {cfg?.sem_teto_global && <p className="text-xs text-amber-700 dark:text-amber-400">⚠️ O volume GREEN pode aumentar. Quarentena e recuperação de qualidade permanecem obrigatórias.</p>}
         </div>

         {/* Liberar YELLOW/RED */}
         <div className={`rounded-md border p-3 space-y-2 ${cfg?.liberar_qualidade_global ? "border-destructive/60 bg-destructive/10" : ""}`}>
           <div className="flex items-center justify-between gap-3 flex-wrap">
             <div className="flex items-center gap-2">
               <ShieldCheck className={`h-4 w-4 ${cfg?.liberar_qualidade_global ? "text-destructive" : "text-muted-foreground"}`} />
               <div>
                 <p className="text-sm font-semibold">Liberar números YELLOW e RED para envio</p>
                 <p className="text-xs text-muted-foreground">Ignora quarentena, pausa por qualidade e modo recuperação para todos os usuários (inclusive parceiros).</p>
               </div>
             </div>
             <Switch checked={cfg?.liberar_qualidade_global === true} disabled={savingTurbo} onCheckedChange={salvarLiberarQualidade} />
           </div>
           {cfg?.liberar_qualidade_global && <p className="text-xs text-destructive">⚠️ Risco de banimento maior. Bloqueios reais da Meta (BANNED/FLAGGED/pagamento) continuam valendo.</p>}
         </div>



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
               const greenSemTeto = cfg?.sem_teto_global === true && String(inst.saude_quality || "").toUpperCase() === "GREEN";
               const cota = greenSemTeto ? (inst.tier_diario || 0) : Math.min(cotaDaFase(inst.fase_rampup, cfg), inst.tier_diario || 250);
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
                    {inst.teto_escada != null && <Badge variant="outline">Teto manual: {inst.teto_escada}/dia</Badge>}
                  </div>

                  {inst.quarentena_ate && new Date(inst.quarentena_ate) > new Date() && (
                    <div className="text-xs bg-amber-500/10 border border-amber-500/30 rounded p-2 text-amber-700 dark:text-amber-400 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">Em quarentena ({inst.quarentena_motivo || "qualidade"})</p>
                        <p>Fora das campanhas até {new Date(inst.quarentena_ate).toLocaleDateString("pt-BR")} — segue atendendo conversas recebidas.</p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => sairQuarentena(inst)} disabled={savingId === inst.id}>
                        Liberar
                      </Button>
                    </div>
                  )}

                  {editandoId === inst.id ? (
                    <div className="rounded border p-2 space-y-2 bg-muted/40">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">Na API oficial desde</Label>
                          <Input type="date" value={editData} onChange={(e) => setEditData(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Teto diário manual</Label>
                          <Input
                            type="number"
                            min={1}
                            placeholder="automático"
                            value={editTeto}
                            onChange={(e) => setEditTeto(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        A data define a fase da rampa (1–3d: {cfg?.cota_fase1 ?? 15}/dia · 4–7d: {cfg?.cota_fase2 ?? 40} · 8–14d: {cfg?.cota_fase3 ?? 80} · 15–21d: {cfg?.cota_fase4 ?? 200} · +21d: livre).
                        Deixe o teto vazio para usar a fase automaticamente.
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => salvarRampa(inst)} disabled={savingId === inst.id} className="flex-1">
                          {savingId === inst.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null} Salvar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditandoId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => abrirEdicao(inst)}>
                      <Settings2 className="h-3.5 w-3.5 mr-1" /> Editar rampa / teto
                    </Button>
                  )}

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
