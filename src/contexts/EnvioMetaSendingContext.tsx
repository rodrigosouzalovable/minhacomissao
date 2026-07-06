import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type EnvioItem = { telefone: string; instancia?: string; erro?: string; ts: number };

export type EnvioDetalhes = {
  enviados: EnvioItem[];
  erros: EnvioItem[];
  semWhatsapp: string[];
  erroValidacao: string[];
};

export type EnvioProgresso = {
  enviados: number;
  erros: number;
  total: number;
  atualTelefone: string;
  atualInstancia: string;
  proximoEmSeg: number;
};

export type EnvioResultado = { enviados: number; erros: number; total: number } | null;

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
  resultado: EnvioResultado;
  templateNome: string | null;
  iniciar: (p: IniciarParams) => Promise<void>;
  togglePausa: () => void;
  cancelar: () => void;
  limpar: () => void;
};

const EnvioMetaSendingContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "envio_meta_state_v1";
const EMPTY_DETALHES: EnvioDetalhes = { enviados: [], erros: [], semWhatsapp: [], erroValidacao: [] };

type Persisted = {
  enviando: boolean;
  pausado: boolean;
  progresso: EnvioProgresso | null;
  detalhes: EnvioDetalhes;
  resultado: EnvioResultado;
  templateNome: string | null;
};

function loadPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Persisted;
    // If reload happened mid-send, the loop is dead — show snapshot as stopped.
    if (p.enviando) {
      p.enviando = false;
      p.pausado = false;
      if (p.progresso && !p.resultado) {
        p.resultado = { enviados: p.progresso.enviados, erros: p.progresso.erros, total: p.progresso.total };
      }
      p.progresso = null;
    }
    return p;
  } catch {
    return null;
  }
}

export function EnvioMetaSendingProvider({ children }: { children: ReactNode }) {
  const initial = typeof window !== "undefined" ? loadPersisted() : null;

  const [enviando, setEnviando] = useState<boolean>(initial?.enviando ?? false);
  const [pausado, setPausado] = useState<boolean>(initial?.pausado ?? false);
  const [progresso, setProgresso] = useState<EnvioProgresso | null>(initial?.progresso ?? null);
  const [detalhes, setDetalhes] = useState<EnvioDetalhes>(initial?.detalhes ?? EMPTY_DETALHES);
  const [resultado, setResultado] = useState<EnvioResultado>(initial?.resultado ?? null);
  const [templateNome, setTemplateNome] = useState<string | null>(initial?.templateNome ?? null);

  const pausedRef = useRef<boolean>(false);
  const cancelRef = useRef<boolean>(false);
  const runningRef = useRef<boolean>(false);

  // Persist every change
  useEffect(() => {
    try {
      const snap: Persisted = { enviando, pausado, progresso, detalhes, resultado, templateNome };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
    } catch {}
  }, [enviando, pausado, progresso, detalhes, resultado, templateNome]);

  const togglePausa = useCallback(() => {
    const novo = !pausedRef.current;
    pausedRef.current = novo;
    setPausado(novo);
    toast.info(novo ? "Envio pausado" : "Envio retomado");
  }, []);

  const cancelar = useCallback(() => {
    if (!confirm("Cancelar o envio? Os contatos restantes não serão disparados.")) return;
    cancelRef.current = true;
    pausedRef.current = false;
    setPausado(false);
    toast.warning("Cancelando envio...");
  }, []);

  const limpar = useCallback(() => {
    if (runningRef.current) {
      toast.error("Não é possível limpar enquanto há envio em andamento");
      return;
    }
    setProgresso(null);
    setResultado(null);
    setDetalhes(EMPTY_DETALHES);
    setTemplateNome(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  const iniciar = useCallback(async (p: IniciarParams) => {
    if (runningRef.current) {
      toast.error("Já existe um envio em andamento");
      return;
    }
    runningRef.current = true;
    pausedRef.current = false;
    cancelRef.current = false;

    const { template, instanciaIds, instancias, clientes, minSec, maxSec } = p;
    const lo = Math.max(1, minSec);
    const hi = Math.max(lo, maxSec);
    const total = clientes.length;

    setTemplateNome(template.nome_template);
    setDetalhes({
      enviados: [],
      erros: [],
      semWhatsapp: p.semWhatsapp ?? [],
      erroValidacao: p.erroValidacao ?? [],
    });
    setResultado(null);
    setEnviando(true);
    setPausado(false);
    setProgresso({ enviados: 0, erros: 0, total, atualTelefone: "", atualInstancia: "", proximoEmSeg: 0 });

    const instAtivas = [...instanciaIds];
    const instMap = new Map(instancias.map((i) => [i.id, i] as const));
    let enviados = 0;
    let erros = 0;
    let rr = 0;
    let cancelado = false;

    const sleepInterruptible = async (segs: number) => {
      const ate = Date.now() + segs * 1000;
      while (Date.now() < ate) {
        if (cancelRef.current) return;
        while (pausedRef.current && !cancelRef.current) {
          await new Promise((r) => setTimeout(r, 250));
        }
        const restanteMs = Math.max(0, ate - Date.now());
        setProgresso((pr) => pr ? { ...pr, proximoEmSeg: Math.ceil(restanteMs / 1000) } : pr);
        await new Promise((r) => setTimeout(r, Math.min(250, restanteMs)));
      }
    };

    for (let i = 0; i < clientes.length; i++) {
      if (cancelRef.current) { cancelado = true; break; }
      while (pausedRef.current && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, 250));
      }
      if (cancelRef.current) { cancelado = true; break; }

      if (instAtivas.length === 0) { toast.error("Nenhuma instância disponível para envio. Se acabou de aprovar templates, ative-as em Configurar Meta → Pool, ou use o botão 'Enviar teste' na página de envio para validar antes do ramp-up."); break; }

      // Seleção inteligente por score de saúde (respeita ramp-up, pausa, domingo, horário)
      let instId: string;
      let instInfo: InstanciaMin | undefined;
      try {
        const { data: pick, error: pickErr } = await supabase.functions.invoke("pick-meta-instance", {
          body: { instancia_ids: instAtivas },
        });
        if (pickErr) throw pickErr;
        if (!pick?.success) {
          // Bloqueio global (domingo/horário/sem disponível): aborta
          toast.error(pick?.error || "Nenhuma instância disponível");
          break;
        }
        instId = pick.instancia_id;
        instInfo = instMap.get(instId);
        rr++;
      } catch (e: any) {
        // Fallback: round-robin simples se pick falhar
        console.warn("[EnvioMeta] pick falhou, usando round-robin", e?.message);
        instId = instAtivas[rr % instAtivas.length];
        instInfo = instMap.get(instId);
        rr++;
      }

      const cliente = clientes[i];
      setProgresso((pr) => pr ? {
        ...pr,
        atualTelefone: cliente.telefone,
        atualInstancia: instInfo?.nome || "",
        proximoEmSeg: 0,
      } : pr);

      try {
        const tplIdParaEssaInst = p.templateIdByInstance?.[instId] || template.id;
        const { data, error } = await supabase.functions.invoke("send-whatsapp-meta", {
          body: { template_id: tplIdParaEssaInst, instancia_id: instId, cliente },
        });
        if (error) throw error;
        if (data?.tier_full || data?.pool_blocked || data?.pool_paused) {
          const idx = instAtivas.indexOf(instId);
          if (idx >= 0) instAtivas.splice(idx, 1);
          i--; continue;
        }
        if (data?.blocked === 'domingo' || data?.blocked === 'horario') {
          toast.error(data.error);
          break;
        }
        if (!data?.success) throw new Error(data?.error || "Falha");
        enviados++;
        setDetalhes((d) => ({
          ...d,
          enviados: [...d.enviados, { telefone: cliente.telefone, instancia: instInfo?.nome, ts: Date.now() }],
        }));
      } catch (e: any) {
        erros++;
        const msg = e?.message || String(e);
        console.error("[EnvioMeta]", msg);
        setDetalhes((d) => ({
          ...d,
          erros: [...d.erros, { telefone: cliente.telefone, instancia: instInfo?.nome, erro: msg, ts: Date.now() }],
        }));
      }
      setProgresso((pr) => pr ? { ...pr, enviados, erros } : pr);

      if (i < clientes.length - 1 && !cancelRef.current) {
        const delay = Math.floor(Math.random() * (hi - lo + 1)) + lo;
        await sleepInterruptible(delay);
      }
    }


    setResultado({ enviados, erros, total });
    setProgresso(null);
    setEnviando(false);
    setPausado(false);
    pausedRef.current = false;
    cancelRef.current = false;
    runningRef.current = false;
    toast.success(`${enviados} enviados • ${erros} erros${cancelado ? " (cancelado)" : ""}`);
    p.onAfterEnvio?.();
  }, []);

  // Warn on close if sending
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (runningRef.current) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return (
    <EnvioMetaSendingContext.Provider
      value={{ enviando, pausado, progresso, detalhes, resultado, templateNome, iniciar, togglePausa, cancelar, limpar }}
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
