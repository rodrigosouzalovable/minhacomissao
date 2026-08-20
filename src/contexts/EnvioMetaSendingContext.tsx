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
  /** true quando o job está apenas esperando a janela de envio (horário/domingo) */
  aguardandoJanela?: boolean;
  janelaMotivo?: string;

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
  /** Variação de templates: round-robin entre variantes (mesma qtd de variáveis) */
  templateVariantes?: Array<{ template_id: string; nome_template: string; template_id_by_instance: Record<string, string> }>;

  nomeCampanha?: string;
  modoRajada?: boolean;
  msgsPorSegundo?: number;
  folderId?: string | null;
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
  min_seg: number | null;
  max_seg: number | null;
  modo_rajada: boolean;
  msgs_por_segundo: number | null;
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
  iniciar: (p: IniciarParams) => Promise<string | null>;
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
  carregarMaisItensJob: (jobId: string) => Promise<void>;
  getPaginacaoJob: (jobId: string) => { carregados: number; temMais: boolean };
  refreshCountersJob: (jobId: string) => Promise<void>;
  marcarJobAberto: (jobId: string, aberto: boolean) => void;
  exportarItensJob: (
    jobId: string,
    onProgresso?: (n: number) => void,
  ) => Promise<Array<{ telefone: string; status: string; instancia?: string; erro?: string; ts?: string; deliveryStatus?: DeliveryStatus; deliveryErro?: string }>>;


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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function isRateLimitErro(erro?: string | null): boolean {
  return /rate\s*limit|80007|131056|retry\s*after/i.test(String(erro || ""));
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
    min_seg: j.min_seg ?? null,
    max_seg: j.max_seg ?? null,
    modo_rajada: j.modo_rajada === true,
    msgs_por_segundo: j.msgs_por_segundo ?? null,
  };
}

export function EnvioMetaSendingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id;

  const [jobs, setJobs] = useState<CampanhaJob[]>([]);
  const [itensByJob, setItensByJob] = useState<Map<string, any[]>>(new Map());
  const [pagByJob, setPagByJob] = useState<Map<string, { temMais: boolean }>>(new Map());
  const [resumoByJob, setResumoByJob] = useState<Map<string, DeliveryResumo>>(new Map());

  const [logByJob, setLogByJob] = useState<Map<string, Map<string, { status: DeliveryStatus; erro?: string }>>>(new Map());
  const [extras, setExtras] = useState<ExtrasMap>(loadExtras());
  const [tick, setTick] = useState(0);
  const [lastStartedId, setLastStartedId] = useState<string | null>(null);
  const onAfterRef = useRef<Record<string, (() => void) | undefined>>({});
  const seenConcludedRef = useRef<Set<string>>(new Set());
  const manuallyCanceledRef = useRef<Set<string>>(new Set());
  const autoResumeAtRef = useRef<Map<string, number>>(new Map()); // jobId -> last auto-resume ts
  const sessionRefreshRef = useRef<Promise<string> | null>(null);

  // A API de autenticação rejeita corretamente JWTs cuja sessão foi revogada.
  // Renova a sessão antes do comando e devolve o token recém-emitido, evitando
  // que o Functions client reutilize um access token obsoleto do storage.
  const refreshAccessToken = useCallback(async (): Promise<string> => {
    if (!sessionRefreshRef.current) {
      sessionRefreshRef.current = (async () => {
        const { data, error } = await supabase.auth.refreshSession();
        const accessToken = data.session?.access_token;
        if (error || !accessToken) {
          throw new Error("Sua sessão expirou. Entre novamente para continuar.");
        }
        return accessToken;
      })().finally(() => {
        sessionRefreshRef.current = null;
      });
    }
    return sessionRefreshRef.current;
  }, []);

  const invokeControle = useCallback(async (jobId: string, acao: string) => {
    const accessToken = await refreshAccessToken();
    return supabase.functions.invoke("envio-meta-massa-control", {
      body: { job_id: jobId, acao },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }, [refreshAccessToken]);

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

  const PAGINA_ITENS = 200;

  // Detalhe visual paginado: a primeira página traz os 200 eventos mais recentes.
  // Páginas extras só são baixadas quando o usuário clica em "Carregar mais".
  const carregarItens = useCallback(async (jobId: string, offset = 0, append = false): Promise<any[]> => {
    const { data, error } = await (supabase as any)
      .from("envio_meta_job_item")
      .select("telefone,status,instancia_nome,erro,processado_em")
      .eq("job_id", jobId)
      .in("status", ["enviado", "erro"])
      .order("processado_em", { ascending: false })
      .range(offset, offset + PAGINA_ITENS - 1);
    const pagina = error ? [] : (data || []);
    setItensByJob((prev) => {
      const n = new Map(prev);
      const anteriores = append ? (prev.get(jobId) || []) : [];
      n.set(jobId, [...anteriores, ...pagina]);
      return n;
    });
    setPagByJob((prev) => {
      const n = new Map(prev);
      n.set(jobId, { temMais: pagina.length === PAGINA_ITENS });
      return n;
    });
    return pagina;
  }, []);

  const carregarResumoEntrega = useCallback(async (jobId: string) => {
    const { data, error } = await (supabase as any).rpc("envio_meta_job_delivery_resumo", { _job_id: jobId });
    if (error || !data) return;
    setResumoByJob((prev) => {
      const n = new Map(prev);
      n.set(jobId, {
        aceito: Number((data as any).aceito || 0),
        entregue: Number((data as any).entregue || 0),
        lida: Number((data as any).lida || 0),
        falhou: Number((data as any).falhou || 0),
        aguardando: Number((data as any).aguardando || 0),
      });
      return n;
    });
  }, []);


  // Consulta somente os telefones visíveis no detalhe da campanha. Antes baixava
  // até 3.000 logs por abertura, inclusive de outras campanhas na mesma janela.
  const carregarLogs = useCallback(async (jobId: string, desdeIso: string | null, telefones: string[] = []) => {
    if (!uid) return;
    const desde = desdeIso || new Date(Date.now() - 7 * 86400_000).toISOString();
    const normalizados = [...new Set(telefones.map(normTel).filter(Boolean))].slice(0, 200);
    if (normalizados.length === 0) {
      setLogByJob((prev) => {
        const n = new Map(prev);
        n.set(jobId, new Map());
        return n;
      });
      return;
    }
    const { data } = await (supabase as any)
      .from("meta_whatsapp_envios_log")
      .select("telefone,status,erro,enviado_em")
      .eq("user_id", uid)
      .gte("enviado_em", desde)
      .in("telefone", normalizados)
      .order("enviado_em", { ascending: false })
      .limit(500);

    const m = new Map<string, { status: DeliveryStatus; erro?: string }>();
    for (const l of data || []) {
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
    const rows = has ? (itensByJob.get(jobId) || []) : await carregarItens(jobId);
    const hasLogs = logByJob.has(jobId);
    if (!hasLogs) {
      const j = jobs.find((x) => x.id === jobId);
      await carregarLogs(jobId, j?.iniciado_em || null, rows.map((r) => r.telefone));
    }
    if (!resumoByJob.has(jobId)) await carregarResumoEntrega(jobId);
  }, [itensByJob, logByJob, jobs, carregarItens, carregarLogs, resumoByJob, carregarResumoEntrega]);

  const recarregarItensJob = useCallback(async (jobId: string) => {
    const j = jobs.find((x) => x.id === jobId);
    const rows = await carregarItens(jobId);
    await carregarLogs(jobId, j?.iniciado_em || null, rows.map((r) => r.telefone));
    await carregarResumoEntrega(jobId);
  }, [jobs, carregarItens, carregarLogs, carregarResumoEntrega]);

  const carregarMaisItensJob = useCallback(async (jobId: string) => {
    const j = jobs.find((x) => x.id === jobId);
    const atuais = itensByJob.get(jobId) || [];
    const pagina = await carregarItens(jobId, atuais.length, true);
    if (pagina.length > 0) {
      await carregarLogs(jobId, j?.iniciado_em || null, pagina.map((r: any) => r.telefone));
    }
  }, [jobs, itensByJob, carregarItens, carregarLogs]);

  const getPaginacaoJob = useCallback((jobId: string) => ({
    carregados: (itensByJob.get(jobId) || []).length,
    temMais: pagByJob.get(jobId)?.temMais === true,
  }), [itensByJob, pagByJob]);

  // Exportação completa: percorre TODOS os itens do job em páginas de 1.000,
  // sem gravar no cache visual (a lista da tela continua paginada em 200).
  const exportarItensJob = useCallback(async (jobId: string, onProgresso?: (n: number) => void) => {
    const PAGINA = 1000;
    const todos: any[] = [];
    for (let offset = 0; ; offset += PAGINA) {
      const { data, error } = await (supabase as any)
        .from("envio_meta_job_item")
        .select("telefone,status,instancia_nome,erro,processado_em")
        .eq("job_id", jobId)
        .in("status", ["enviado", "erro"])
        .order("processado_em", { ascending: false })
        .range(offset, offset + PAGINA - 1);
      if (error) break;
      const pagina = data || [];
      todos.push(...pagina);
      onProgresso?.(todos.length);
      if (pagina.length < PAGINA) break;
    }

    // Status de entrega para todos os telefones, em lotes
    const entrega = new Map<string, { status: DeliveryStatus; erro?: string }>();
    if (uid && todos.length > 0) {
      const j = jobs.find((x) => x.id === jobId);
      const desde = j?.iniciado_em || new Date(Date.now() - 30 * 86400_000).toISOString();
      const unicos = [...new Set(todos.map((r) => normTel(r.telefone)).filter(Boolean))];
      const LOTE = 300;
      for (let i = 0; i < unicos.length; i += LOTE) {
        const lote = unicos.slice(i, i + LOTE);
        const { data } = await (supabase as any)
          .from("meta_whatsapp_envios_log")
          .select("telefone,status,erro,enviado_em")
          .eq("user_id", uid)
          .gte("enviado_em", desde)
          .in("telefone", lote)
          .order("enviado_em", { ascending: false })
          .limit(2000);
        for (const l of data || []) {
          const key = normTel(l.telefone);
          if (!key) continue;
          const st = mapStatusMeta(l.status);
          const prev = entrega.get(key);
          if (!prev || rankDelivery(st) > rankDelivery(prev.status)) {
            entrega.set(key, { status: st, erro: l.erro || undefined });
          }
        }
      }
    }

    return todos.map((r) => {
      const d = entrega.get(normTel(r.telefone));
      return {
        telefone: r.telefone,
        status: r.status,
        instancia: r.instancia_nome || undefined,
        erro: r.erro || undefined,
        ts: r.processado_em || undefined,
        deliveryStatus: d?.status,
        deliveryErro: d?.erro,
      };
    });
  }, [uid, jobs]);




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

  // Detalhes completos de itens/logs são carregados apenas quando o usuário abre a campanha.

  // Refs mirrando estado + funções — evita recriar o canal Realtime a cada render
  // (o que causava avalanche de eventos e a UI "piscando" no diálogo Campanhas).
  const itensByJobRef = useRef(itensByJob);
  useEffect(() => { itensByJobRef.current = itensByJob; }, [itensByJob]);
  const logByJobRef = useRef(logByJob);
  useEffect(() => { logByJobRef.current = logByJob; }, [logByJob]);
  const carregarJobsRef = useRef(carregarJobs);
  useEffect(() => { carregarJobsRef.current = carregarJobs; }, [carregarJobs]);
  const carregarItensRef = useRef(carregarItens);
  useEffect(() => { carregarItensRef.current = carregarItens; }, [carregarItens]);

  // Debounces por jobId — coalescem bursts de eventos numa única leitura curta.
  const debounceItensRef = useRef<Map<string, number>>(new Map());
  const debounceJobsRef = useRef<number | null>(null);
  // Campanhas com diálogo aberto — só elas justificam reler os itens do banco.
  const openJobsRef = useRef<Set<string>>(new Set());
  const marcarJobAberto = useCallback((jobId: string, aberto: boolean) => {
    if (aberto) openJobsRef.current.add(jobId);
    else openJobsRef.current.delete(jobId);
  }, []);
  const scheduleCarregarItens = useCallback((jobId: string, delay = 8000) => {
    // Sem diálogo aberto não há ninguém olhando a lista: evita releituras caras.
    if (!openJobsRef.current.has(jobId)) return;
    const map = debounceItensRef.current;
    const prev = map.get(jobId);
    if (prev) window.clearTimeout(prev);
    const id = window.setTimeout(() => {
      map.delete(jobId);
      // Aba em segundo plano: adia — o próximo evento ou o abrir do diálogo dispara refetch.
      if (document.visibilityState !== 'visible') return;
      if (!openJobsRef.current.has(jobId)) return;
      carregarItensRef.current?.(jobId);
    }, delay);
    map.set(jobId, id);
  }, []);

  const scheduleCarregarJobs = useCallback((delay = 2500) => {
    if (debounceJobsRef.current) window.clearTimeout(debounceJobsRef.current);
    debounceJobsRef.current = window.setTimeout(() => {
      debounceJobsRef.current = null;
      if (document.visibilityState !== 'visible') return;
      carregarJobsRef.current?.();
    }, delay);
  }, []);

  // Realtime — subscription única por usuário (sem depender de estados que mudam a cada refetch)
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`envio_meta_${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "envio_meta_job", filter: `user_id=eq.${uid}` },
        (payload: any) => {
          scheduleCarregarJobs(2500);
          const row = payload.new || payload.old;
          const jobId = row?.id;
          if (jobId && itensByJobRef.current.has(jobId)) {
            const cached = itensByJobRef.current.get(jobId) || [];
            const backend = (row?.enviados || 0) + (row?.erros || 0);
            if (backend !== cached.length) scheduleCarregarItens(jobId, 15000);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meta_whatsapp_envios_log", filter: `user_id=eq.${uid}` },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row?.telefone || !row?.status) return;
          if (logByJobRef.current.size === 0) return;
          const key = normTel(row.telefone);
          const st = mapStatusMeta(row.status);
          setLogByJob((prev) => {
            const n = new Map(prev);
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
    return () => {
      supabase.removeChannel(channel);
      // limpa timers pendentes
      for (const id of debounceItensRef.current.values()) window.clearTimeout(id);
      debounceItensRef.current.clear();
      if (debounceJobsRef.current) { window.clearTimeout(debounceJobsRef.current); debounceJobsRef.current = null; }
    };
  }, [uid, scheduleCarregarItens, scheduleCarregarJobs]);


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
    const motivo = j.status_motivo || "";
    const aguardandoJanela = /fora do hor|abertura da janela|domingo/i.test(motivo);
    return {
      enviados: j.enviados,
      erros: j.erros,
      total: j.total,
      atualTelefone: j.atual_telefone || "",
      atualInstancia: j.atual_instancia || "",
      proximoEmSeg: Math.max(0, Math.ceil(proximoMs / 1000)),
      aguardandoJanela,
      janelaMotivo: aguardandoJanela ? motivo : undefined,
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
        if (isRateLimitErro(it.erro)) continue;
        erros.push({ telefone: it.telefone, instancia: it.instancia_nome || undefined, erro: it.erro || undefined, ts });
      }
    }
    const ex = extras[jobId] || { semWhatsapp: [], erroValidacao: [] };
    return { enviados, erros, semWhatsapp: ex.semWhatsapp, erroValidacao: ex.erroValidacao };
  }, [itensByJob, logByJob, extras]);

  const getDeliveryResumoJob = useCallback((jobId: string): DeliveryResumo => {
    // Preferimos a agregação feita no banco (cobre 100% dos envios do job).
    const agregado = resumoByJob.get(jobId);
    if (agregado) return agregado;
    // Fallback local (amostra carregada) caso a agregação ainda não tenha chegado.
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
  }, [getDetalhesJob, resumoByJob]);


  const getResultadoJob = useCallback((jobId: string): EnvioResultado => {
    const j = jobs.find((x) => x.id === jobId);
    if (!j) return null;
    if (["concluido", "cancelado", "erro"].includes(j.status)) {
      return { enviados: j.enviados, erros: j.erros, total: j.total, statusMotivo: j.status_motivo || undefined };
    }
    return null;
  }, [jobs]);

  const iniciar = useCallback(async (p: IniciarParams): Promise<string | null> => {
    if (!uid) { toast.error("Faça login para iniciar o envio"); return null; }
    try {
      // Renova a sessão antes de disparar: um access token obsoleto fazia a função
      // responder 401 e a campanha nunca era criada (sem aviso claro na tela).
      const accessToken = await refreshAccessToken();
      const { data, error } = await supabase.functions.invoke("envio-meta-massa-iniciar", {
        body: {
          template: p.template,
          instanciaIds: p.instanciaIds,
          clientes: p.clientes,
          minSec: p.minSec,
          maxSec: p.maxSec,
          templateIdByInstance: p.templateIdByInstance ?? {},
          templateVariantes: p.templateVariantes ?? [],

          nomeCampanha: p.nomeCampanha ?? null,
          modoRajada: p.modoRajada === true,
          msgsPorSegundo: p.msgsPorSegundo,
          folderId: p.folderId ?? null,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) {
        // Erros HTTP do Functions client escondem o corpo — tenta extrair a mensagem real.
        let detalhe = error.message || "falha ao iniciar";
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            if (body?.error) detalhe = body.error;
          }
        } catch { /* mantém a mensagem original */ }
        throw new Error(detalhe);
      }
      if (!data?.success) throw new Error(data?.error || "Falha ao iniciar envio");

      const jobId = data.job_id as string;
      if (!jobId) throw new Error("A campanha não foi criada (sem job_id). Tente novamente.");
      if (p.onAfterEnvio) onAfterRef.current[jobId] = p.onAfterEnvio;
      setExtras((prev) => {
        const next = { ...prev, [jobId]: { semWhatsapp: p.semWhatsapp ?? [], erroValidacao: p.erroValidacao ?? [] } };
        saveExtras(next);
        return next;
      });
      setLastStartedId(jobId);
      carregarJobs();
      return jobId;
    } catch (e: any) {
      toast.error("Erro ao iniciar envio: " + (e?.message || e));
      return null;
    }
  }, [uid, carregarJobs, refreshAccessToken]);

  const togglePausaJob = useCallback(async (jobId: string) => {
    // Decide a ação pelo status ATUAL no servidor, não pelo status desenhado na tela.
    const { data: atual } = await (supabase as any)
      .from("envio_meta_job")
      .select("status")
      .eq("id", jobId)
      .maybeSingle();
    const statusServidor = atual?.status ?? jobs.find((x) => x.id === jobId)?.status;
    if (!statusServidor) return;
    const acao = statusServidor === "rodando" ? "pausar" : "retomar";
    try {
      const { data, error } = await invokeControle(jobId, acao);
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha");
      // Reflete imediatamente na UI (sem esperar o próximo refresh/realtime)
      const novoStatus = acao === "pausar" ? "pausado" : "rodando";
      setJobs((prev) => prev.map((x) => (x.id === jobId ? { ...x, status: novoStatus } : x)));
      if (acao === "pausar") autoResumeAtRef.current.delete(jobId);
      toast.info(acao === "pausar" ? "Campanha pausada" : "Campanha retomada");
      carregarJobs();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
      carregarJobs();
    }
  }, [jobs, carregarJobs, invokeControle]);

  const cancelarJob = useCallback(async (jobId: string) => {
    if (!confirm("Cancelar esta campanha? Os contatos restantes não serão disparados.")) return;
    try {
      const { data, error } = await invokeControle(jobId, "cancelar");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha");
      manuallyCanceledRef.current.add(jobId);
      autoResumeAtRef.current.delete(jobId);
      toast.warning("Campanha cancelada");
      carregarJobs();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    }
  }, [carregarJobs, invokeControle]);

  // Reativação de baixo nível — usada por reativarJob (manual) e pelo auto-resume interno.
  const reativarJobInterno = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      const { data, error } = await invokeControle(jobId, "reativar");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha");
      return true;
    } catch (e: any) {
      console.warn("[envio-meta] reativar interno falhou:", e?.message || e);
      return false;
    }
  }, [invokeControle]);

  const reativarJob = useCallback(async (jobId: string) => {
    const j = jobs.find((x) => x.id === jobId);
    if (!j) return;
    if (j.restantes <= 0) {
      toast.info("Não há contatos pendentes para reativar");
      return;
    }
    manuallyCanceledRef.current.delete(jobId);
    autoResumeAtRef.current.delete(jobId);
    const ok = await reativarJobInterno(jobId);
    if (ok) {
      toast.success(`Campanha reativada — ${j.restantes} contatos restantes`);
      carregarJobs();
    } else {
      toast.error("Erro ao reativar");
    }
  }, [jobs, carregarJobs, reativarJobInterno]);

  // Auto-retomada: só para jobs que caíram por erro/conclusão prematura.
  // Campanhas CANCELADAS nunca são retomadas automaticamente — só via "Reativar".
  useEffect(() => {
    const now = Date.now();
    for (const j of jobs) {
      if (!["erro", "concluido"].includes(j.status)) continue;
      if (j.restantes <= 0) continue;
      if (manuallyCanceledRef.current.has(j.id)) continue;
      const last = autoResumeAtRef.current.get(j.id) || 0;
      if (now - last < 60_000) continue;
      autoResumeAtRef.current.set(j.id, now);
      reativarJobInterno(j.id).then((ok) => {
        if (ok) carregarJobs();
      });
    }
  }, [jobs, reativarJobInterno, carregarJobs]);



  const limparJob = useCallback(async (jobId: string) => {
    const j = jobs.find((x) => x.id === jobId);
    if (!j) return;
    if (["rodando", "pausado"].includes(j.status)) {
      toast.error("Não é possível limpar enquanto a campanha está em andamento");
      return;
    }
    try {
      const { data, error } = await invokeControle(jobId, "limpar");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha");
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
  }, [jobs, lastStartedId, carregarJobs, invokeControle]);

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
        togglePausaJob, cancelarJob, reativarJob, limparJob, ensureItensLoaded, recarregarItensJob, carregarMaisItensJob, getPaginacaoJob, refreshCountersJob, marcarJobAberto, exportarItensJob,
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
