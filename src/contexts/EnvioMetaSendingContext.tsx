import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export type DeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed';

export type EnvioItem = {
  telefone: string;
  instancia?: string;
  erro?: string;
  ts: number;
  deliveryStatus?: DeliveryStatus;
  deliveryErro?: string;
};

export type EnvioDetalhes = {
  enviados: EnvioItem[];
  erros: EnvioItem[];
  semWhatsapp: string[];
  erroValidacao: string[];
};

export type DeliveryResumo = { aceito: number; entregue: number; lida: number; falhou: number; aguardando: number };

export type EnvioProgresso = {
  enviados: number;
  erros: number;
  total: number;
  atualTelefone: string;
  atualInstancia: string;
  proximoEmSeg: number;
};

export type EnvioResultado = { enviados: number; erros: number; total: number; statusMotivo?: string } | null;

type ClienteRow = {
  telefone: string;
  nome?: string;
  cpf?: string;
  atraso?: string;
  saldo?: number;
  vars?: Record<string, string>;
};

type InstanciaMin = { id: string; nome: string };

export type IniciarParams = {
  template: { id: string; nome_template: string };
  instanciaIds: string[];
  instancias: InstanciaMin[];
  clientes: ClienteRow[];
  minSec: number;
  maxSec: number;
  semWhatsapp?: string[];
  erroValidacao?: string[];
  templateIdByInstance?: Record<string, string>;
  nomeCampanha?: string;
  modoRajada?: boolean;
  msgsPorSegundo?: number;
  onAfterEnvio?: () => void;
};

export type CampanhaJob = {
  id: string;
  status: 'rodando' | 'pausado' | 'concluido' | 'cancelado' | 'erro';
  template_nome: string | null;
  nome_campanha: string | null;
  instancia_ids: string[] | null;
  enviados: number;
  erros: number;
  total: number;
  atual_telefone: string | null;
  atual_instancia: string | null;
  proximo_em: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
  status_motivo: string | null;
  restantes: number;
  instancias_bloqueadas_run: string[];
};

type Ctx = {
  // ===== Legacy single-job API (aponta para o job "ativo" mais recente ou último iniciado nesta sessão) =====
  enviando: boolean;
  pausado: boolean;
  progresso: EnvioProgresso | null;
  detalhes: EnvioDetalhes;
  deliveryResumo: DeliveryResumo;
  resultado: EnvioResultado;
  templateNome: string | null;
  restantes: number;
  iniciar: (p: IniciarParams) => Promise<void>;
  togglePausa: () => void;
  cancelar: () => void;
  reativar: () => void;
  limpar: () => void;
  refreshStatus: () => Promise<void>;

  // ===== Multi-job API =====
  jobs: CampanhaJob[];
  jobsAtivos: CampanhaJob[];
  getProgressoJob: (jobId: string) => EnvioProgresso | null;
  getDetalhesJob: (jobId: string) => EnvioDetalhes;
  getDeliveryResumoJob: (jobId: string) => DeliveryResumo;
  getResultadoJob: (jobId: string) => EnvioResultado;
  togglePausaJob: (jobId: string) => Promise<void>;
  cancelarJob: (jobId: string) => Promise<void>;
  reativarJob: (jobId: string) => Promise<void>;
  limparJob: (jobId: string) => Promise<void>;
  ensureItensLoaded: (jobId: string) => Promise<void>;
  recarregarItensJob: (jobId: string) => Promise<void>;
  refreshCountersJob: (jobId: string) => Promise<void>;
};

const EnvioMetaSendingContext = createContext<Ctx | null>(null);

const EMPTY_DETALHES: EnvioDetalhes = { enviados: [], erros: [], semWhatsapp: [], erroValidacao: [] };
const EMPTY_RESUMO: DeliveryResumo = { aceito: 0, entregue: 0, lida: 0, falhou: 0, aguardando: 0 };
const LOCAL_EXTRAS_KEY = "envio_meta_extras_multi_v1"; // { [jobId]: { semWhatsapp, erroValidacao } }

type ExtrasMap = Record<string, { semWhatsapp: string[]; erroValidacao: string[] }>;

function loadExtras(): ExtrasMap {
  try {
    const raw = localStorage.getItem(LOCAL_EXTRAS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch { return {}; }
}
function saveExtras(x: ExtrasMap) {
  try { localStorage.setItem(LOCAL_EXTRAS_KEY, JSON.stringify(x)); } catch {}
}

function normTel(t: string): string {
  const d = String(t || "").replace(/\D+/g, "");
  if (!d) return "";
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

function mapStatusMeta(s: string): DeliveryStatus {
  const v = String(s || "").toLowerCase();
  if (v === "delivered") return "delivered";
  if (v === "read") return "read";
  if (v === "failed") return "failed";
  return "sent";
}

function rankDelivery(s: DeliveryStatus) {
  return s === "read" ? 3 : s === "delivered" ? 2 : s === "failed" ? 4 : 1;
}

function toCampanhaJob(j: any): CampanhaJob {
  const total = j.total || 0;
  const enviados = j.enviados || 0;
  const erros = j.erros || 0;
  return {
    id: j.id,
    status: j.status,
    template_nome: j.template_nome ?? null,
    nome_campanha: j.nome_campanha ?? null,
    instancia_ids: j.instancia_ids ?? null,
    enviados, erros, total,
    atual_telefone: j.atual_telefone ?? null,
    atual_instancia: j.atual_instancia ?? null,
    proximo_em: j.proximo_em ?? null,
    iniciado_em: j.iniciado_em ?? null,
    concluido_em: j.concluido_em ?? null,
    status_motivo: j.status_motivo ?? null,
    restantes: Math.max(0, total - enviados - erros),
    instancias_bloqueadas_run: Array.isArray(j.instancias_bloqueadas_run) ? j.instancias_bloqueadas_run : [],
  };
}

export function EnvioMetaSendingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id;

  const [jobs, setJobs] = useState<CampanhaJob[]>([]);
  const [itensByJob, setItensByJob] = useState<Map<string, any[]>>(new Map());
  const [logByJob, setLogByJob] = useState<Map<string, Map<string, { status: DeliveryStatus; erro?: string }>>>(new Map());
  const [extras, setExtras] = useState<ExtrasMap>(loadExtras());
  const [tick, setTick] = useState(0);
  const [lastStartedId, setLastStartedId] = useState<string | null>(null);
  const onAfterRef = useRef<Record<string, (() => void) | undefined>>({});
  const seenConcludedRef = useRef<Set<string>>(new Set());
  const manuallyCanceledRef = useRef<Set<string>>(new Set());
  const autoResumeAtRef = useRef<Map<string, number>>(new Map()); // jobId -> last auto-resume ts

  const carregarJobs = useCallback(async () => {
    if (!uid) { setJobs([]); setItensByJob(new Map()); setLogByJob(new Map()); return; }
    const { data } = await (supabase as any)
      .from("envio_meta_job")
      .select("*")
      .eq("user_id", uid)
      .order("iniciado_em", { ascending: false })
      .limit(30);
    const arr = (data || []).map(toCampanhaJob) as CampanhaJob[];
    setJobs(arr);
  }, [uid]);

  const carregarItens = useCallback(async (jobId: string) => {
    // Paginado — PostgREST tem cap de 1000 por request; buscamos em lotes até acabar (teto 10k).
    const PAGE = 1000;
    const MAX = 10000;
    const acc: any[] = [];
    for (let from = 0; from < MAX; from += PAGE) {
      const to = from + PAGE - 1;
      const { data, error } = await (supabase as any)
        .from("envio_meta_job_item")
        .select("*")
        .eq("job_id", jobId)
        .in("status", ["enviado", "erro"])
        .order("processado_em", { ascending: false })
        .range(from, to);
      if (error) break;
      const rows = data || [];
      acc.push(...rows);
      if (rows.length < PAGE) break;
    }
    setItensByJob((prev) => {
      const n = new Map(prev);
      n.set(jobId, acc);
      return n;
    });
  }, []);

  const carregarLogs = useCallback(async (jobId: string, desdeIso: string | null) => {
    if (!uid) return;
    const desde = desdeIso || new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data: logs } = await (supabase as any)
      .from("meta_whatsapp_envios_log")
      .select("telefone,status,erro,enviado_em")
      .eq("user_id", uid)
      .gte("enviado_em", desde)
      .order("enviado_em", { ascending: false })
      .limit(5000);
    const m = new Map<string, { status: DeliveryStatus; erro?: string }>();
    for (const l of logs || []) {
      const key = normTel(l.telefone);
      if (!key) continue;
      const st = mapStatusMeta(l.status);
      const prev = m.get(key);
      if (!prev || rankDelivery(st) > rankDelivery(prev.status)) {
        m.set(key, { status: st, erro: l.erro || undefined });
      }
    }
    setLogByJob((prev) => {
      const n = new Map(prev);
      n.set(jobId, m);
      return n;
    });
  }, [uid]);

  const ensureItensLoaded = useCallback(async (jobId: string) => {
    const has = itensByJob.has(jobId);
    if (!has) await carregarItens(jobId);
    const hasLogs = logByJob.has(jobId);
    if (!hasLogs) {
      const j = jobs.find((x) => x.id === jobId);
      await carregarLogs(jobId, j?.iniciado_em || null);
    }
  }, [itensByJob, logByJob, jobs, carregarItens, carregarLogs]);

  const recarregarItensJob = useCallback(async (jobId: string) => {
    const j = jobs.find((x) => x.id === jobId);
    await Promise.all([carregarItens(jobId), carregarLogs(jobId, j?.iniciado_em || null)]);
  }, [jobs, carregarItens, carregarLogs]);

  // Refresh parcial: atualiza APENAS contadores/current do job (não mexe em status/status_motivo).
  // Usado pelo botão "Atualizar" no diálogo — nunca faz o botão "Reativar" aparecer sozinho.
  const refreshCountersJob = useCallback(async (jobId: string) => {
    const { data } = await (supabase as any)
      .from("envio_meta_job")
      .select("enviados, erros, total, atual_telefone, atual_instancia, proximo_em")
      .eq("id", jobId)
      .maybeSingle();
    if (!data) return;
    setJobs((prev) => prev.map((j) => {
      if (j.id !== jobId) return j;
      const enviados = data.enviados || 0;
      const erros = data.erros || 0;
      const total = data.total || j.total;
      return {
        ...j,
        enviados,
        erros,
        total,
        atual_telefone: data.atual_telefone ?? j.atual_telefone,
        atual_instancia: data.atual_instancia ?? j.atual_instancia,
        proximo_em: data.proximo_em ?? j.proximo_em,
        restantes: Math.max(0, total - enviados - erros),
        // status e status_motivo preservados de propósito
      };
    }));
  }, []);

  useEffect(() => { carregarJobs(); }, [carregarJobs]);

  // Ao carregar jobs, pré-carrega itens+logs para os jobs ativos e o último iniciado
  useEffect(() => {
    const alvo = new Set<string>();
    jobs.filter((j) => j.status === "rodando" || j.status === "pausado").forEach((j) => alvo.add(j.id));
    if (lastStartedId) alvo.add(lastStartedId);
    if (!lastStartedId && jobs[0]) alvo.add(jobs[0].id);
    alvo.forEach((id) => {
      if (!itensByJob.has(id)) carregarItens(id);
      if (!logByJob.has(id)) {
        const j = jobs.find((x) => x.id === id);
        carregarLogs(id, j?.iniciado_em || null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, lastStartedId]);

  // Realtime
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`envio_meta_${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "envio_meta_job", filter: `user_id=eq.${uid}` },
        (payload: any) => {
          carregarJobs();
          // Se os contadores do job avançaram e temos itens em cache, refetch para atualizar a lista.
          const row = payload.new || payload.old;
          const jobId = row?.id;
          if (jobId && itensByJob.has(jobId)) {
            const cached = itensByJob.get(jobId) || [];
            const backend = (row?.enviados || 0) + (row?.erros || 0);
            if (backend !== cached.length) carregarItens(jobId);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "envio_meta_job_item" },
        (payload: any) => {
          const jobId = (payload.new || payload.old)?.job_id;
          if (jobId && itensByJob.has(jobId)) carregarItens(jobId);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meta_whatsapp_envios_log", filter: `user_id=eq.${uid}` },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row?.telefone || !row?.status) return;
          const key = normTel(row.telefone);
          const st = mapStatusMeta(row.status);
          setLogByJob((prev) => {
            const n = new Map(prev);
            // aplica a todos jobs em cache (o telefone pertence ao user, então tudo bem)
            for (const [jid, m] of n.entries()) {
              const cur = m.get(key);
              if (!cur || rankDelivery(st) > rankDelivery(cur.status)) {
                const nm = new Map(m);
                nm.set(key, { status: st, erro: row.erro || undefined });
                n.set(jid, nm);
              }
            }
            return n;
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid, carregarJobs, carregarItens, itensByJob]);

  // Ticker para atualizar "próximo em Xs"
  useEffect(() => {
    const hasRunning = jobs.some((j) => j.status === "rodando");
    if (!hasRunning) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [jobs]);

  // Dispara onAfterEnvio quando um job específico conclui/cancela
  useEffect(() => {
    for (const j of jobs) {
      if ((j.status === "concluido" || j.status === "cancelado") && !seenConcludedRef.current.has(j.id)) {
        seenConcludedRef.current.add(j.id);
        const cb = onAfterRef.current[j.id];
        if (cb) { try { cb(); } catch {} }
      }
    }
  }, [jobs]);

  const getProgressoJob = useCallback((jobId: string): EnvioProgresso | null => {
    const j = jobs.find((x) => x.id === jobId);
    if (!j) return null;
    if (j.status !== "rodando" && j.status !== "pausado") return null;
    const proximoMs = j.proximo_em ? new Date(j.proximo_em).getTime() - Date.now() : 0;
    return {
      enviados: j.enviados,
      erros: j.erros,
      total: j.total,
      atualTelefone: j.atual_telefone || "",
      atualInstancia: j.atual_instancia || "",
      proximoEmSeg: Math.max(0, Math.ceil(proximoMs / 1000)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, tick]);

  const getDetalhesJob = useCallback((jobId: string): EnvioDetalhes => {
    const its = itensByJob.get(jobId) || [];
    const logs = logByJob.get(jobId) || new Map();
    const enviados: EnvioItem[] = [];
    const erros: EnvioItem[] = [];
    for (const it of its) {
      const ts = it.processado_em ? new Date(it.processado_em).getTime() : Date.now();
      const key = normTel(it.telefone);
      const dlv = logs.get(key);
      if (it.status === "enviado") {
        enviados.push({
          telefone: it.telefone,
          instancia: it.instancia_nome || undefined,
          ts,
          deliveryStatus: dlv?.status,
          deliveryErro: dlv?.erro,
        });
      } else if (it.status === "erro") {
        erros.push({ telefone: it.telefone, instancia: it.instancia_nome || undefined, erro: it.erro || undefined, ts });
      }
    }
    const ex = extras[jobId] || { semWhatsapp: [], erroValidacao: [] };
    return { enviados, erros, semWhatsapp: ex.semWhatsapp, erroValidacao: ex.erroValidacao };
  }, [itensByJob, logByJob, extras]);

  const getDeliveryResumoJob = useCallback((jobId: string): DeliveryResumo => {
    const det = getDetalhesJob(jobId);
    const r: DeliveryResumo = { aceito: 0, entregue: 0, lida: 0, falhou: 0, aguardando: 0 };
    for (const e of det.enviados) {
      const s = e.deliveryStatus;
      if (s === "delivered") r.entregue++;
      else if (s === "read") r.lida++;
      else if (s === "failed") r.falhou++;
      else if (s === "sent") r.aceito++;
      else r.aguardando++;
    }
    return r;
  }, [getDetalhesJob]);

  const getResultadoJob = useCallback((jobId: string): EnvioResultado => {
    const j = jobs.find((x) => x.id === jobId);
    if (!j) return null;
    if (["concluido", "cancelado", "erro"].includes(j.status)) {
      return { enviados: j.enviados, erros: j.erros, total: j.total, statusMotivo: j.status_motivo || undefined };
    }
    return null;
  }, [jobs]);

  const iniciar = useCallback(async (p: IniciarParams) => {
    if (!uid) { toast.error("Faça login para iniciar o envio"); return; }
    try {
      const { data, error } = await supabase.functions.invoke("envio-meta-massa-iniciar", {
        body: {
          template: p.template,
          instanciaIds: p.instanciaIds,
          clientes: p.clientes,
          minSec: p.minSec,
          maxSec: p.maxSec,
          templateIdByInstance: p.templateIdByInstance ?? {},
          nomeCampanha: p.nomeCampanha ?? null,
          modoRajada: p.modoRajada === true,
          msgsPorSegundo: p.msgsPorSegundo,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao iniciar envio");

      const jobId = data.job_id as string;
      if (p.onAfterEnvio) onAfterRef.current[jobId] = p.onAfterEnvio;
      setExtras((prev) => {
        const next = { ...prev, [jobId]: { semWhatsapp: p.semWhatsapp ?? [], erroValidacao: p.erroValidacao ?? [] } };
        saveExtras(next);
        return next;
      });
      setLastStartedId(jobId);
      toast.success("Campanha iniciada — roda em paralelo às demais");
      carregarJobs();
    } catch (e: any) {
      toast.error("Erro ao iniciar envio: " + (e?.message || e));
    }
  }, [uid, carregarJobs]);

  const togglePausaJob = useCallback(async (jobId: string) => {
    const j = jobs.find((x) => x.id === jobId);
    if (!j) return;
    const acao = j.status === "rodando" ? "pausar" : "retomar";
    try {
      const { data, error } = await supabase.functions.invoke("envio-meta-massa-control", {
        body: { job_id: jobId, acao },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha");
      toast.info(acao === "pausar" ? "Campanha pausada" : "Campanha retomada");
      carregarJobs();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    }
  }, [jobs, carregarJobs]);

  const cancelarJob = useCallback(async (jobId: string) => {
    if (!confirm("Cancelar esta campanha? Os contatos restantes não serão disparados.")) return;
    try {
      const { data, error } = await supabase.functions.invoke("envio-meta-massa-control", {
        body: { job_id: jobId, acao: "cancelar" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha");
      toast.warning("Campanha cancelada");
      carregarJobs();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    }
  }, [carregarJobs]);

  const reativarJob = useCallback(async (jobId: string) => {
    const j = jobs.find((x) => x.id === jobId);
    if (!j) return;
    if (!["cancelado", "erro", "concluido"].includes(j.status)) {
      toast.error("Só é possível reativar campanhas finalizadas");
      return;
    }
    if (j.restantes <= 0) {
      toast.info("Não há contatos pendentes para reativar");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("envio-meta-massa-control", {
        body: { job_id: jobId, acao: "reativar" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha");
      toast.success(`Campanha reativada — ${j.restantes} contatos restantes`);
      carregarJobs();
    } catch (e: any) {
      toast.error("Erro ao reativar: " + (e?.message || e));
    }
  }, [jobs, carregarJobs]);

  const limparJob = useCallback(async (jobId: string) => {
    const j = jobs.find((x) => x.id === jobId);
    if (!j) return;
    if (["rodando", "pausado"].includes(j.status)) {
      toast.error("Não é possível limpar enquanto a campanha está em andamento");
      return;
    }
    try {
      await supabase.functions.invoke("envio-meta-massa-control", {
        body: { job_id: jobId, acao: "limpar" },
      });
      setExtras((prev) => {
        const next = { ...prev };
        delete next[jobId];
        saveExtras(next);
        return next;
      });
      setItensByJob((prev) => { const n = new Map(prev); n.delete(jobId); return n; });
      setLogByJob((prev) => { const n = new Map(prev); n.delete(jobId); return n; });
      if (lastStartedId === jobId) setLastStartedId(null);
      carregarJobs();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    }
  }, [jobs, lastStartedId, carregarJobs]);

  // ============ Legacy single-job derivations ============
  const currentJob: CampanhaJob | null = useMemo(() => {
    if (lastStartedId) {
      const j = jobs.find((x) => x.id === lastStartedId);
      if (j) return j;
    }
    // Preferir job ativo mais recente
    const ativo = jobs.find((j) => j.status === "rodando" || j.status === "pausado");
    if (ativo) return ativo;
    return jobs[0] || null;
  }, [jobs, lastStartedId]);

  const jobsAtivos = useMemo(
    () => jobs.filter((j) => j.status === "rodando" || j.status === "pausado"),
    [jobs]
  );

  const enviando = !!currentJob && (currentJob.status === "rodando" || currentJob.status === "pausado");
  const pausado = !!currentJob && currentJob.status === "pausado";
  const progresso = currentJob ? getProgressoJob(currentJob.id) : null;
  const detalhes = currentJob ? getDetalhesJob(currentJob.id) : EMPTY_DETALHES;
  const deliveryResumo = currentJob ? getDeliveryResumoJob(currentJob.id) : EMPTY_RESUMO;
  const resultado = currentJob ? getResultadoJob(currentJob.id) : null;
  const templateNome = currentJob?.template_nome || null;
  const restantes = currentJob?.restantes || 0;

  const togglePausa = useCallback(() => { if (currentJob) togglePausaJob(currentJob.id); }, [currentJob, togglePausaJob]);
  const cancelar = useCallback(() => { if (currentJob) cancelarJob(currentJob.id); }, [currentJob, cancelarJob]);
  const reativar = useCallback(() => { if (currentJob) reativarJob(currentJob.id); }, [currentJob, reativarJob]);
  const limpar = useCallback(() => { if (currentJob) limparJob(currentJob.id); }, [currentJob, limparJob]);
  const refreshStatus = useCallback(async () => { await carregarJobs(); }, [carregarJobs]);

  return (
    <EnvioMetaSendingContext.Provider
      value={{
        enviando, pausado, progresso, detalhes, deliveryResumo, resultado, templateNome, restantes,
        iniciar, togglePausa, cancelar, reativar, limpar, refreshStatus,
        jobs, jobsAtivos,
        getProgressoJob, getDetalhesJob, getDeliveryResumoJob, getResultadoJob,
        togglePausaJob, cancelarJob, reativarJob, limparJob, ensureItensLoaded, recarregarItensJob,
      }}
    >
      {children}
    </EnvioMetaSendingContext.Provider>
  );
}

export function useEnvioMetaSending() {
  const ctx = useContext(EnvioMetaSendingContext);
  if (!ctx) throw new Error("useEnvioMetaSending must be used within EnvioMetaSendingProvider");
  return ctx;
}
