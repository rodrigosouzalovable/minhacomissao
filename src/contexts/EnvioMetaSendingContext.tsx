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
  onAfterEnvio?: () => void;
};

type Ctx = {
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
};

const EnvioMetaSendingContext = createContext<Ctx | null>(null);

const EMPTY_DETALHES: EnvioDetalhes = { enviados: [], erros: [], semWhatsapp: [], erroValidacao: [] };
const LOCAL_EXTRAS_KEY = "envio_meta_extras_v1"; // guarda apenas sem_whatsapp / erro_validacao (não voltam da server)

type LocalExtras = { jobId?: string; semWhatsapp: string[]; erroValidacao: string[] };

function loadExtras(): LocalExtras {
  try {
    const raw = localStorage.getItem(LOCAL_EXTRAS_KEY);
    if (!raw) return { semWhatsapp: [], erroValidacao: [] };
    return JSON.parse(raw);
  } catch { return { semWhatsapp: [], erroValidacao: [] }; }
}
function saveExtras(x: LocalExtras) {
  try { localStorage.setItem(LOCAL_EXTRAS_KEY, JSON.stringify(x)); } catch {}
}

export function EnvioMetaSendingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id;

  const [job, setJob] = useState<any | null>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [logStatus, setLogStatus] = useState<Map<string, { status: DeliveryStatus; erro?: string }>>(new Map());
  const [extras, setExtras] = useState<LocalExtras>(loadExtras());
  const [tick, setTick] = useState(0);
  const onAfterRef = useRef<(() => void) | undefined>();

  function normTel(t: string): string {
    const d = String(t || "").replace(/\D+/g, "");
    if (!d) return "";
    if (d.startsWith("55") && d.length >= 12) return d;
    if (d.length === 10 || d.length === 11) return "55" + d;
    return d;
  }

  const mapStatusMeta = (s: string): DeliveryStatus => {
    const v = String(s || "").toLowerCase();
    if (v === "delivered") return "delivered";
    if (v === "read") return "read";
    if (v === "failed") return "failed";
    return "sent";
  };

  // Carrega job mais recente do usuário (rodando, pausado ou o último finalizado)
  const carregar = useCallback(async () => {
    if (!uid) { setJob(null); setItens([]); setLogStatus(new Map()); return; }
    const { data: ativo } = await (supabase as any)
      .from("envio_meta_job")
      .select("*")
      .eq("user_id", uid)
      .in("status", ["rodando", "pausado"])
      .order("iniciado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    let j = ativo;
    if (!j) {
      const { data: ult } = await (supabase as any)
        .from("envio_meta_job")
        .select("*")
        .eq("user_id", uid)
        .order("iniciado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      j = ult;
    }
    setJob(j || null);
    if (j) {
      const { data: its } = await (supabase as any)
        .from("envio_meta_job_item")
        .select("*")
        .eq("job_id", j.id)
        .in("status", ["enviado", "erro"])
        .order("processado_em", { ascending: false })
        .limit(2000);
      setItens(its || []);

      // Puxa status de entrega da Meta (webhook grava em meta_whatsapp_envios_log)
      try {
        const desde = j.iniciado_em || new Date(Date.now() - 7 * 86400_000).toISOString();
        const { data: logs } = await (supabase as any)
          .from("meta_whatsapp_envios_log")
          .select("telefone,status,erro,enviado_em")
          .eq("user_id", uid)
          .gte("enviado_em", desde)
          .order("enviado_em", { ascending: false })
          .limit(5000);
        const m = new Map<string, { status: DeliveryStatus; erro?: string }>();
        // Ordem: mais forte vence (read > delivered > sent; failed = terminal)
        const rank = (s: DeliveryStatus) => s === "read" ? 3 : s === "delivered" ? 2 : s === "failed" ? 4 : 1;
        for (const l of logs || []) {
          const key = normTel(l.telefone);
          if (!key) continue;
          const st = mapStatusMeta(l.status);
          const prev = m.get(key);
          if (!prev || rank(st) > rank(prev.status)) {
            m.set(key, { status: st, erro: l.erro || undefined });
          }
        }
        setLogStatus(m);
      } catch { /* ignora */ }
    } else {
      setItens([]);
      setLogStatus(new Map());
    }
  }, [uid]);

  useEffect(() => { carregar(); }, [carregar]);

  // Realtime: assina mudanças em job + itens do usuário
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`envio_meta_${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "envio_meta_job", filter: `user_id=eq.${uid}` },
        () => { carregar(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "envio_meta_job_item" },
        (payload: any) => {
          const jobId = (payload.new || payload.old)?.job_id;
          if (job && jobId === job.id) carregar();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meta_whatsapp_envios_log", filter: `user_id=eq.${uid}` },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row?.telefone || !row?.status) return;
          const key = normTel(row.telefone);
          setLogStatus((prev) => {
            const next = new Map(prev);
            const st = mapStatusMeta(row.status);
            const rank = (s: DeliveryStatus) => s === "read" ? 3 : s === "delivered" ? 2 : s === "failed" ? 4 : 1;
            const cur = next.get(key);
            if (!cur || rank(st) > rank(cur.status)) {
              next.set(key, { status: st, erro: row.erro || undefined });
            }
            return next;
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid, job?.id, carregar]);

  // Ticker para atualizar "próximo em Xs"
  useEffect(() => {
    if (!job || job.status !== "rodando") return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [job?.status, job?.id]);

  const enviando = !!job && (job.status === "rodando" || job.status === "pausado");
  const pausado = !!job && job.status === "pausado";

  const progresso: EnvioProgresso | null = useMemo(() => {
    if (!job || !enviando) return null;
    const proximoMs = job.proximo_em ? new Date(job.proximo_em).getTime() - Date.now() : 0;
    return {
      enviados: job.enviados || 0,
      erros: job.erros || 0,
      total: job.total || 0,
      atualTelefone: job.atual_telefone || "",
      atualInstancia: job.atual_instancia || "",
      proximoEmSeg: Math.max(0, Math.ceil(proximoMs / 1000)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, enviando, tick]);

  const detalhes: EnvioDetalhes = useMemo(() => {
    const enviados: EnvioItem[] = [];
    const erros: EnvioItem[] = [];
    for (const it of itens) {
      const ts = it.processado_em ? new Date(it.processado_em).getTime() : Date.now();
      const key = normTel(it.telefone);
      const dlv = logStatus.get(key);
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
    const extrasForJob = extras.jobId === job?.id
      ? { semWhatsapp: extras.semWhatsapp, erroValidacao: extras.erroValidacao }
      : { semWhatsapp: [], erroValidacao: [] };
    return { enviados, erros, ...extrasForJob };
  }, [itens, extras, job?.id, logStatus]);

  const deliveryResumo: DeliveryResumo = useMemo(() => {
    const r: DeliveryResumo = { aceito: 0, entregue: 0, lida: 0, falhou: 0, aguardando: 0 };
    for (const e of detalhes.enviados) {
      const s = e.deliveryStatus;
      if (s === "delivered") r.entregue++;
      else if (s === "read") r.lida++;
      else if (s === "failed") r.falhou++;
      else if (s === "sent") r.aceito++;
      else r.aguardando++;
    }
    return r;
  }, [detalhes.enviados]);

  const resultado: EnvioResultado = useMemo(() => {
    if (!job) return null;
    if (["concluido", "cancelado", "erro"].includes(job.status)) {
      return { enviados: job.enviados || 0, erros: job.erros || 0, total: job.total || 0, statusMotivo: job.status_motivo || undefined };
    }
    return null;
  }, [job]);

  // Dispara callback quando o job conclui
  useEffect(() => {
    if (job && ["concluido", "cancelado"].includes(job.status)) {
      onAfterRef.current?.();
    }
  }, [job?.status, job?.id]);

  const iniciar = useCallback(async (p: IniciarParams) => {
    if (!uid) { toast.error("Faça login para iniciar o envio"); return; }
    onAfterRef.current = p.onAfterEnvio;

    try {
      const { data, error } = await supabase.functions.invoke("envio-meta-massa-iniciar", {
        body: {
          template: p.template,
          instanciaIds: p.instanciaIds,
          clientes: p.clientes,
          minSec: p.minSec,
          maxSec: p.maxSec,
          templateIdByInstance: p.templateIdByInstance ?? {},
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao iniciar envio");

      const jobId = data.job_id as string;
      const novo: LocalExtras = {
        jobId,
        semWhatsapp: p.semWhatsapp ?? [],
        erroValidacao: p.erroValidacao ?? [],
      };
      setExtras(novo);
      saveExtras(novo);
      toast.success("Envio iniciado no servidor — vai continuar mesmo se você fechar o navegador");
      carregar();
    } catch (e: any) {
      toast.error("Erro ao iniciar envio: " + (e?.message || e));
    }
  }, [uid, carregar]);

  const togglePausa = useCallback(async () => {
    if (!job) return;
    const acao = job.status === "rodando" ? "pausar" : "retomar";
    try {
      const { data, error } = await supabase.functions.invoke("envio-meta-massa-control", {
        body: { job_id: job.id, acao },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha");
      toast.info(acao === "pausar" ? "Envio pausado" : "Envio retomado");
      carregar();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    }
  }, [job, carregar]);

  const cancelar = useCallback(async () => {
    if (!job) return;
    if (!confirm("Cancelar o envio? Os contatos restantes não serão disparados.")) return;
    try {
      const { data, error } = await supabase.functions.invoke("envio-meta-massa-control", {
        body: { job_id: job.id, acao: "cancelar" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha");
      toast.warning("Envio cancelado");
      carregar();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    }
  }, [job, carregar]);

  const limpar = useCallback(async () => {
    if (!job) return;
    if (["rodando", "pausado"].includes(job.status)) {
      toast.error("Não é possível limpar enquanto o envio está em andamento");
      return;
    }
    try {
      await supabase.functions.invoke("envio-meta-massa-control", {
        body: { job_id: job.id, acao: "limpar" },
      });
      setJob(null);
      setItens([]);
      setExtras({ semWhatsapp: [], erroValidacao: [] });
      saveExtras({ semWhatsapp: [], erroValidacao: [] });
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    }
  }, [job]);

  const templateNome = job?.template_nome || null;
  const restantes = job ? Math.max(0, (job.total || 0) - (job.enviados || 0) - (job.erros || 0)) : 0;

  const reativar = useCallback(async () => {
    if (!job) return;
    if (!["cancelado", "erro", "concluido"].includes(job.status)) {
      toast.error("Só é possível reativar jobs finalizados");
      return;
    }
    if (restantes <= 0) {
      toast.info("Não há contatos pendentes para reativar");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("envio-meta-massa-control", {
        body: { job_id: job.id, acao: "reativar" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha");
      toast.success(`Envio reativado — ${restantes} contatos restantes`);
      carregar();
    } catch (e: any) {
      toast.error("Erro ao reativar: " + (e?.message || e));
    }
  }, [job, restantes, carregar]);

  const refreshStatus = useCallback(async () => {
    await carregar();
  }, [carregar]);

  return (
    <EnvioMetaSendingContext.Provider
      value={{ enviando, pausado, progresso, detalhes, deliveryResumo, resultado, templateNome, restantes, iniciar, togglePausa, cancelar, reativar, limpar, refreshStatus }}
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
