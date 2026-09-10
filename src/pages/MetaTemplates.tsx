import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { humanizarErroTemplate } from "@/lib/humanizarErroTemplate";
import { Loader2, Plus, Send, Trash2, RefreshCw, X, Search, Eye, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import TemplateWhatsAppPreview from "@/components/meta/TemplateWhatsAppPreview";
import BusinessManagersManager from "@/components/meta/BusinessManagersManager";

type Categoria = "UTILITY" | "MARKETING" | "AUTHENTICATION";
type BotaoTipo = "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
type FormatoVar = "NUMERADA" | "NOMEADA";

interface Botao {
  type: BotaoTipo;
  text: string;
  url?: string;
  phone_number?: string;
  example?: string;
}

interface Mestre {
  id: string;
  nome: string;
  categoria: Categoria;
  idioma: string;
  corpo: string;
  cabecalho_tipo: string | null;
  cabecalho_texto: string | null;
  rodape: string | null;
  botoes: Botao[];
  exemplo: any;
  cabecalho_media_url?: string | null;
  cabecalho_media_mime?: string | null;
  criado_em: string;
  injetar_em_novos?: boolean;
  usar_em_leads?: boolean;


}

interface Instancia {
  id: string;
  nome: string;
  display_phone: string | null;
  ativo: boolean;
  waba_id: string | null;
  saude_quality: string | null;
  meta_bm_id: string | null;
  business_id: string | null;
}

interface Bm {
  id: string;
  nome: string | null;
  business_id: string | null;
}

const QUALIDADE_CORES: Record<string, string> = {
  GREEN: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  YELLOW: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  RED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

const qualidadeDa = (i: Instancia): string => (i.saude_quality || "").toUpperCase() || "SEM LEITURA";

interface TemplateInst {
  id: string;
  template_mestre_id: string;
  instancia_id: string;
  status: string;
  erro: string | null;
  motivo_rejeicao: string | null;
  meta_template_id: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  APPROVED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  PENDING: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  ENVIADO: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  PENDENTE: "bg-muted text-muted-foreground",
  REJECTED: "bg-destructive/15 text-destructive",
  FALHA_ENVIO: "bg-destructive/15 text-destructive",
  PAUSED: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  DISABLED: "bg-muted text-muted-foreground",
};

// Extrai variáveis do corpo separando numeradas ({{1}}) de nomeadas ({{name}}).
function extrairVars(text: string): { numeradas: number; nomeadas: string[] } {
  const numeradas = new Set<number>();
  const nomeadas: string[] = [];
  for (const m of String(text || "").matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*|\d+)\s*\}\}/g)) {
    const k = m[1];
    if (/^\d+$/.test(k)) numeradas.add(Number(k));
    else if (!nomeadas.includes(k)) nomeadas.push(k);
  }
  return {
    numeradas: numeradas.size > 0 ? Math.max(...numeradas) : 0,
    nomeadas,
  };
}

// Termos que a Meta costuma ler como oferta/promoção — risco de rejeição em UTILITY.
const TERMOS_PROMOCIONAIS = [
  "oferta", "promoção", "promocao", "aproveite", "desconto", "condições", "condicoes",
  "imperdível", "imperdivel", "última chance", "ultima chance", "exclusivo", "vantagem",
];

function riscosDeConteudo(corpo: string, categoria: string): string[] {
  if (categoria !== "UTILITY") return [];
  const txt = corpo.toLowerCase();
  const achados = TERMOS_PROMOCIONAIS.filter((t) => txt.includes(t));
  if (achados.length === 0) return [];
  return [
    `O corpo usa termos promocionais (${achados.join(", ")}). Em UTILITY isso costuma gerar rejeição por categoria incorreta — descreva uma transação existente do cliente (ex.: boleto, parcela, contrato).`,
  ];
}


export default function MetaTemplates() {
  const [tab, setTab] = useState("criar");
  const [mestres, setMestres] = useState<Mestre[]>([]);
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [templInst, setTemplInst] = useState<TemplateInst[]>([]);
  const [templMeta, setTemplMeta] = useState<Array<{ instancia_id: string; nome_template: string; status: string | null }>>([]);
  const [bms, setBms] = useState<Bm[]>([]);
  const [loading, setLoading] = useState(true);

  // form criar
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<Categoria>("UTILITY");
  const [idioma, setIdioma] = useState("pt_BR");
  const [corpo, setCorpo] = useState("");
  const [cabecalhoTipo, setCabecalhoTipo] = useState<string>("NONE");
  const [cabecalhoTexto, setCabecalhoTexto] = useState("");
  const [rodape, setRodape] = useState("");
  const [botoes, setBotoes] = useState<Botao[]>([]);
  const [exemploBody, setExemploBody] = useState<string[]>([]);
  const [exemploNomeado, setExemploNomeado] = useState<Record<string, string>>({});
  const [formatoVar, setFormatoVar] = useState<FormatoVar>("NUMERADA");
  const [salvando, setSalvando] = useState(false);
  // mídia do cabeçalho
  const [mediaPath, setMediaPath] = useState<string | null>(null);
  const [mediaMime, setMediaMime] = useState<string | null>(null);
  const [mediaSignedUrl, setMediaSignedUrl] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);


  // aplicar em lote
  const [selMestre, setSelMestre] = useState<string>("");
  const [selInst, setSelInst] = useState<Set<string>>(new Set());
  const [loteMediaUrl, setLoteMediaUrl] = useState<string | null>(null);
  const [buscaInst, setBuscaInst] = useState("");
  const [mestreDialog, setMestreDialog] = useState<string | null>(null);
  const [selecaoAutoAberta, setSelecaoAutoAberta] = useState(false);
  const [buscaMestre, setBuscaMestre] = useState("");


  const [enviando, setEnviando] = useState(false);
  const { parceiroMeta } = useUserPermissions();

  const carregar = async () => {
    setLoading(true);
    const [m, i, ti, par, tm, bmRows] = await Promise.all([
      supabase.from("meta_templates_mestre").select("*").order("criado_em", { ascending: false }),
      supabase
        .from("meta_whatsapp_instances")
        .select("id, nome, display_phone, ativo, waba_id, saude_quality, meta_bm_id, business_id")
        .eq("provider", "meta")
        .order("nome"),
      supabase.from("meta_templates_instancia").select("id, template_mestre_id, instancia_id, status, erro, motivo_rejeicao, meta_template_id"),
      supabase.from("meta_instance_parceiros").select("instancia_id"),
      supabase.from("meta_whatsapp_templates").select("instancia_id, nome_template, status"),
      supabase.from("meta_business_managers").select("id, nome, business_id"),
    ]);
    setBms(((bmRows.data as any) || []) as Bm[]);
    setTemplMeta(((tm.data as any) || []) as any);
    setMestres((m.data as any) || []);
    const idsParceiro = new Set(((par.data as any) || []).map((r: any) => r.instancia_id as string));
    const lista = ((i.data as any) || []) as Instancia[];
    setInstancias(parceiroMeta ? lista : lista.filter((x) => !idsParceiro.has(x.id)));
    setTemplInst((ti.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [parceiroMeta]);

  useEffect(() => {
    const ch = supabase.channel("meta-templates-inst")
      .on("postgres_changes", { event: "*", schema: "public", table: "meta_templates_instancia" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "meta_templates_mestre" }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const varsCorpo = useMemo(() => extrairVars(corpo), [corpo]);
  const riscosDeContexto = useMemo(() => riscosDeConteudo(corpo, categoria), [corpo, categoria]);
  const nVarsCorpo = varsCorpo.numeradas;
  const varsNomeadas = varsCorpo.nomeadas;
  const formatoErrado =
    formatoVar === "NUMERADA" ? varsNomeadas.length > 0 : nVarsCorpo > 0;

  // Insere variável no corpo já no formato escolhido
  const inserirVariavel = (nomeSugerido?: string) => {
    const token =
      formatoVar === "NUMERADA"
        ? `{{${nVarsCorpo + 1}}}`
        : `{{${nomeSugerido || `var${varsNomeadas.length + 1}`}}}`;
    const el = document.getElementById("corpo-template") as HTMLTextAreaElement | null;
    if (el && typeof el.selectionStart === "number") {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      setCorpo(corpo.slice(0, start) + token + corpo.slice(end));
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
    } else {
      setCorpo(corpo + token);
    }
  };

  // Converte as variáveis do corpo para o formato selecionado, preservando exemplos
  const converterFormato = () => {
    const ordem: string[] = [];
    const novoCorpo = String(corpo).replace(
      /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*|\d+)\s*\}\}/g,
      (_m, k: string) => {
        if (formatoVar === "NUMERADA") {
          if (/^\d+$/.test(k)) return `{{${k}}}`;
          if (!ordem.includes(k)) ordem.push(k);
          return `{{${ordem.indexOf(k) + 1}}}`;
        }
        if (!/^\d+$/.test(k)) return `{{${k}}}`;
        const nomeVar = `var${k}`;
        if (!ordem.includes(nomeVar)) ordem.push(nomeVar);
        return `{{${nomeVar}}}`;
      },
    );
    if (formatoVar === "NUMERADA") {
      setExemploBody(ordem.map((k) => exemploNomeado[k] || ""));
    } else {
      const next: Record<string, string> = {};
      ordem.forEach((nomeVar) => {
        const idx = Number(nomeVar.replace("var", "")) - 1;
        next[nomeVar] = exemploBody[idx] || "";
      });
      setExemploNomeado(next);
    }
    setCorpo(novoCorpo);
    toast.success("Variáveis convertidas");
  };

  useEffect(() => {
    setExemploBody((prev) => {
      const arr = [...prev];
      while (arr.length < nVarsCorpo) arr.push("");
      arr.length = nVarsCorpo;
      return arr;
    });
  }, [nVarsCorpo]);

  useEffect(() => {
    setExemploNomeado((prev) => {
      const next: Record<string, string> = {};
      for (const k of varsNomeadas) next[k] = prev[k] ?? "";
      return next;
    });
  }, [corpo]);


  // Gera URL assinada para a mídia do template selecionado na aba Lote
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = mestres.find((x) => x.id === selMestre);
      const path = m?.cabecalho_media_url;
      if (!path || !["IMAGE", "VIDEO", "DOCUMENT"].includes(m?.cabecalho_tipo || "")) {
        setLoteMediaUrl(null);
        return;
      }
      const { data } = await supabase.storage
        .from("meta-template-media")
        .createSignedUrl(path, 3600);
      if (!cancelled) setLoteMediaUrl(data?.signedUrl || null);
    })();
    return () => { cancelled = true; };
  }, [selMestre, mestres]);



  const validarSlug = (v: string) => /^[a-z0-9_]+$/.test(v);

  const nomeDuplicado = nome.trim()
    ? mestres.find((m) => (m.nome || "").toLowerCase() === nome.trim().toLowerCase()) || null
    : null;

  const salvarMestre = async () => {
    if (!validarSlug(nome)) {
      toast.error("Nome deve conter apenas letras minúsculas, números e sublinhado (ex: boleto_vencimento)");
      return;
    }
    if (nomeDuplicado) {
      toast.error(`Já existe um modelo com o nome "${nomeDuplicado.nome}" — escolha outro nome`);
      return;
    }
    if (!corpo.trim()) { toast.error("Corpo é obrigatório"); return; }
    if (formatoErrado) {
      toast.error(
        formatoVar === "NUMERADA"
          ? "O corpo tem variáveis por nome, mas o tipo selecionado é Número. Use \"Converter para o formato selecionado\"."
          : "O corpo tem variáveis numeradas, mas o tipo selecionado é Nome. Use \"Converter para o formato selecionado\".",
      );
      return;
    }
    if (formatoVar === "NUMERADA" && nVarsCorpo > 0 && exemploBody.some((v) => !v.trim())) {
      toast.error("Preencha os exemplos das variáveis para a Meta aprovar");
      return;
    }
    if (formatoVar === "NOMEADA" && varsNomeadas.some((k) => !String(exemploNomeado[k] || "").trim())) {
      toast.error("Preencha os exemplos das variáveis nomeadas — sem eles a Meta rejeita por INVALID_FORMAT");
      return;
    }

    setSalvando(true);
    const exemplo: any = {};
    if (formatoVar === "NUMERADA" && nVarsCorpo > 0) exemplo.body_text = [exemploBody];
    if (formatoVar === "NOMEADA" && varsNomeadas.length > 0) {
      exemplo.body_text_named_params = varsNomeadas.map((k) => ({
        param_name: k,
        example: exemploNomeado[k],
      }));
    }


    if (cabecalhoTipo === "TEXT" && !cabecalhoTexto.trim()) {
      toast.error("Cabeçalho de texto vazio: preencha o texto do cabeçalho ou escolha \"Nenhum\" — a Meta rejeita cabeçalho sem conteúdo");
      setSalvando(false);
      return;
    }

    if (["IMAGE", "VIDEO", "DOCUMENT"].includes(cabecalhoTipo) && !mediaPath) {
      toast.error("Faça upload da amostra de mídia do cabeçalho");
      setSalvando(false);
      return;
    }

    const { data: user } = await supabase.auth.getUser();
    const { data: novo, error } = await supabase.from("meta_templates_mestre").insert({
      nome,
      categoria,
      idioma,
      corpo,
      cabecalho_tipo: cabecalhoTipo === "NONE" ? null : cabecalhoTipo,
      cabecalho_texto: cabecalhoTipo === "TEXT" ? cabecalhoTexto : null,
      cabecalho_media_url: ["IMAGE", "VIDEO", "DOCUMENT"].includes(cabecalhoTipo) ? mediaPath : null,
      cabecalho_media_mime: ["IMAGE", "VIDEO", "DOCUMENT"].includes(cabecalhoTipo) ? mediaMime : null,
      rodape: rodape || null,
      botoes: botoes as any,
      exemplo,
      criado_por: user.user?.id,
    } as any).select().single();
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    if (novo) {
      setMestres((prev) => [novo as any, ...prev.filter((m) => m.id !== (novo as any).id)]);
      setSelMestre((novo as any).id);
    }
    carregar();
    toast.success("Template mestre criado. Vá em 'Aplicar em lote'.");
    setNome(""); setCorpo(""); setRodape(""); setCabecalhoTexto("");
    setCabecalhoTipo("NONE"); setBotoes([]); setExemploBody([]); setExemploNomeado({});
    setMediaPath(null); setMediaMime(null); setMediaSignedUrl(null);
    setTab("lote");
  };


  const uploadMedia = async (file: File) => {
    setUploadingMedia(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `templates/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("meta-template-media")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("meta-template-media")
        .createSignedUrl(path, 3600);
      setMediaPath(path);
      setMediaMime(file.type);
      setMediaSignedUrl(signed?.signedUrl || null);
      toast.success("Mídia enviada");
    } catch (e: any) {
      toast.error(e.message || "Falha no upload");
    } finally {
      setUploadingMedia(false);
    }
  };

  const removerMedia = async () => {
    if (mediaPath) {
      await supabase.storage.from("meta-template-media").remove([mediaPath]);
    }
    setMediaPath(null); setMediaMime(null); setMediaSignedUrl(null);
  };


  const addBotao = (tipo: BotaoTipo) => {
    if (botoes.length >= 3) { toast.error("Máximo 3 botões"); return; }
    setBotoes([...botoes, { type: tipo, text: "" }]);
  };

  const enviarLote = async (modo?: "piloto" | "replicar") => {
    if (!selMestre) { toast.error("Selecione um template"); return; }
    if (modo !== "replicar" && selInst.size === 0) { toast.error("Selecione ao menos uma instância"); return; }

    setEnviando(true);
    const { data, error } = await supabase.functions.invoke("meta-criar-template-lote", {
      body: {
        mestre_id: selMestre,
        instancia_ids: Array.from(selInst),
        ...(modo ? { modo } : {}),
      },
    });
    setEnviando(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.success === false) {
      const v = (data as any)?.validacao as string[] | undefined;
      toast.error(v?.length ? v.join(" ") : ((data as any).error || "Falha"), { duration: 12000 });
      return;
    }
    toast.success(
      modo === "piloto"
        ? "Piloto enviado. Aguarde a aprovação da Meta e depois clique em 'Replicar nas demais'."
        : `Enviado: ${(data as any)?.sucessos ?? 0} sucesso(s), ${(data as any)?.falhas ?? 0} falha(s)`,
    );
    carregar();
  };


  const contarFalhas = (mestreId: string) =>
    templInst.filter(
      (t) => t.template_mestre_id === mestreId && ["FALHA_ENVIO", "REJECTED"].includes(t.status),
    ).length;

  const reenviarFalhas = async (mestreId: string) => {
    const n = contarFalhas(mestreId);
    if (n === 0) { toast.info("Nenhuma falha para reenviar neste modelo."); return; }
    if (!confirm(`Reenviar este modelo para ${n} número(s) com falha ou reprovação?`)) return;
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke("meta-criar-template-lote", {
      body: { mestre_id: mestreId, apenas_falhas: true },
    });
    setEnviando(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.elegiveis === 0) { toast.info((data as any)?.mensagem || "Nenhuma falha para reenviar."); return; }
    toast.success(`Reenviado: ${(data as any)?.sucessos ?? 0} ok, ${(data as any)?.falhas ?? 0} falhas`);
    carregar();
  };


  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    atualizados: number;
    aprovados: number;
    instancias: number;
    resumo: Array<{ id: string; nome: string; telefone: string; bm: string; qualidade: string }>;
  }>({ open: false, atualizados: 0, aprovados: 0, instancias: 0, resumo: [] });

  const verificarStatus = async () => {
    const { data, error } = await supabase.functions.invoke("meta-verificar-status-templates", { body: {} });
    if (error) { toast.error(error.message); return; }
    setStatusDialog({
      open: true,
      atualizados: (data as any)?.atualizados ?? 0,
      aprovados: (data as any)?.aprovados ?? 0,
      instancias: (data as any)?.instancias ?? 0,
      resumo: ((data as any)?.resumo || []) as any,
    });
    setTimeout(carregar, 1500);
  };

  const deletarMestre = async (id: string) => {
    if (!confirm("Excluir template mestre e todos os registros por instância?")) return;
    const { error } = await supabase.from("meta_templates_mestre").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    carregar();
  };

  // Marca/desmarca o modelo para injeção automática em números novos
  const alternarInjecao = async (id: string, valor: boolean) => {
    const { error } = await supabase
      .from("meta_templates_mestre")
      .update({ injetar_em_novos: valor })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMestres((prev) => prev.map((m) => (m.id === id ? { ...m, injetar_em_novos: valor } : m)));
    toast.success(valor ? "Marcado para números novos" : "Removido dos números novos");
  };

  // Marca/desmarca o modelo para uso no aquecimento de leads do Google Maps
  const alternarLeads = async (id: string, valor: boolean) => {
    const { error } = await supabase
      .from("meta_templates_mestre")
      .update({ usar_em_leads: valor } as any)
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMestres((prev) => prev.map((m) => (m.id === id ? { ...m, usar_em_leads: valor } : m)));
    toast.success(valor ? "Marcado para leads do Google Maps" : "Removido dos leads");
  };

  const marcarTodosInjecao = async (valor: boolean) => {
    const ids = mestres.map((m) => m.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("meta_templates_mestre")
      .update({ injetar_em_novos: valor })
      .in("id", ids);
    if (error) { toast.error(error.message); return; }
    setMestres((prev) => prev.map((m) => ({ ...m, injetar_em_novos: valor })));
    toast.success(valor ? "Todos marcados" : "Marcação limpa");
  };

  // Monta os componentes de prévia de um modelo mestre
  const componentesDoMestre = (m: Mestre) => {
    const comps: any[] = [];
    if (m.cabecalho_tipo) {
      comps.push({ type: "HEADER", format: m.cabecalho_tipo, text: m.cabecalho_texto || undefined });
    }
    comps.push({ type: "BODY", text: m.corpo });
    if (m.rodape) comps.push({ type: "FOOTER", text: m.rodape });
    if (Array.isArray(m.botoes) && m.botoes.length > 0) comps.push({ type: "BUTTONS", buttons: m.botoes });
    return comps;
  };

  const mestresFiltrados = useMemo(() => {
    const t = buscaMestre.trim().toLowerCase();
    if (!t) return mestres;
    return mestres.filter((m) => m.nome.toLowerCase().includes(t));
  }, [mestres, buscaMestre]);

  const qtdMarcados = mestres.filter((m) => m.injetar_em_novos).length;



  const contagemPorMestre = (mestreId: string): Record<string, number> => {
    const filhas = templInst.filter((t) => t.template_mestre_id === mestreId);
    const c: Record<string, number> = { total: filhas.length };
    filhas.forEach((f) => { c[f.status] = (c[f.status] || 0) + 1; });
    return c;
  };

  // BM vinculada ao número — mostrada ao lado da instância para abrir rápido
  // no Gerenciador de Negócios quando algo falha.
  const bmDaInstancia = (inst?: Instancia | null) => {
    if (!inst) return null;
    const bm =
      bms.find((b) => b.id === inst.meta_bm_id) ||
      (inst.business_id ? bms.find((b) => b.business_id === inst.business_id) : undefined);
    const businessId = bm?.business_id || inst.business_id || null;
    const nome = bm?.nome || (businessId ? `Business ${businessId}` : null);
    if (!nome) return null;
    return { nome, url: businessId ? `https://business.facebook.com/settings?business_id=${businessId}` : null };
  };

  const instAtivas = instancias.filter((i) => i.ativo);
  const instFiltradas = useMemo(() => {
    const termo = buscaInst.trim().toLowerCase();
    if (!termo) return instAtivas;
    const digitos = termo.replace(/\D/g, "");
    return instAtivas.filter((i) => {
      const nomeOk = (i.nome || "").toLowerCase().includes(termo);
      const fone = String(i.display_phone || "").replace(/\D/g, "");
      const foneOk = digitos.length >= 3 && fone.includes(digitos);
      return nomeOk || foneOk;
    });
  }, [instAtivas, buscaInst]);

  // Instâncias que JÁ possuem o template selecionado (aprovado ou em análise).
  // Rejeitado/falha não conta — esses podem ser reenviados.
  const jaPossuemSet = useMemo(() => {
    const s = new Set<string>();
    if (!selMestre) return s;
    const mestre = mestres.find((x) => x.id === selMestre);
    const okStatus = (st?: string | null) => {
      const v = String(st || "").toUpperCase();
      return v === "APPROVED" || v === "PENDING" || v === "ENVIADO" || v === "IN_APPEAL";
    };
    templInst.forEach((t) => {
      if (t.template_mestre_id === selMestre && okStatus(t.status)) s.add(t.instancia_id);
    });
    if (mestre?.nome) {
      const alvo = String(mestre.nome).trim().toLowerCase();
      templMeta.forEach((t) => {
        if (String(t.nome_template || "").trim().toLowerCase() === alvo && okStatus(t.status)) {
          s.add(t.instancia_id);
        }
      });
    }
    return s;
  }, [selMestre, mestres, templInst, templMeta]);


  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Templates Meta (em lote)</h1>
          <p className="text-sm text-muted-foreground">
            Crie um template uma vez e aplique em todas as {instAtivas.length} instâncias ativas.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="criar">Criar Template</TabsTrigger>
            <TabsTrigger value="lote">Aplicar em Lote</TabsTrigger>
            <TabsTrigger value="status">Status & Aprovação</TabsTrigger>
            <TabsTrigger value="bms">Business Managers</TabsTrigger>
          </TabsList>

          <TabsContent value="bms" className="space-y-4">
            <BusinessManagersManager />
          </TabsContent>


          {/* ===== Criar ===== */}
          <TabsContent value="criar" className="space-y-4">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
              <Card>
                <CardHeader><CardTitle>Novo template mestre</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label>Nome (slug)</Label>
                      <Input value={nome} onChange={(e) => setNome(e.target.value.toLowerCase())}
                        placeholder="boleto_vencimento_novo_mundo" />
                      <p className="text-xs text-muted-foreground mt-1">apenas a-z, 0-9 e _</p>
                      {nomeDuplicado && (
                        <p className="text-xs mt-1 font-medium text-amber-600 dark:text-amber-400">
                          Já existe um modelo com esse nome ({nomeDuplicado.categoria}) na aba "Aplicar em lote".
                          A Meta rejeita nomes duplicados na mesma conta.
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Categoria</Label>
                      <Select value={categoria} onValueChange={(v) => setCategoria(v as Categoria)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UTILITY">UTILITY</SelectItem>
                          <SelectItem value="MARKETING">MARKETING</SelectItem>
                          <SelectItem value="AUTHENTICATION">AUTHENTICATION</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Idioma</Label>
                      <Input value={idioma} onChange={(e) => setIdioma(e.target.value)} />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Cabeçalho</Label>
                      <Select value={cabecalhoTipo} onValueChange={(v) => { setCabecalhoTipo(v); if (v !== "TEXT") setCabecalhoTexto(""); if (!["IMAGE","VIDEO","DOCUMENT"].includes(v)) { setMediaPath(null); setMediaMime(null); setMediaSignedUrl(null); } }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">Sem cabeçalho</SelectItem>
                          <SelectItem value="TEXT">Texto</SelectItem>
                          <SelectItem value="IMAGE">Imagem</SelectItem>
                          <SelectItem value="DOCUMENT">Documento</SelectItem>
                          <SelectItem value="VIDEO">Vídeo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {cabecalhoTipo === "TEXT" && (
                      <div>
                        <Label>Texto do cabeçalho</Label>
                        <Input value={cabecalhoTexto} onChange={(e) => setCabecalhoTexto(e.target.value)} maxLength={60} />
                      </div>
                    )}
                  </div>

                  {["IMAGE", "VIDEO", "DOCUMENT"].includes(cabecalhoTipo) && (
                    <div className="rounded-md border p-3 bg-muted/30 space-y-2">
                      <Label>Amostra de mídia · Obrigatório para aprovação Meta</Label>
                      {!mediaPath ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept={
                              cabecalhoTipo === "IMAGE" ? "image/jpeg,image/png" :
                              cabecalhoTipo === "VIDEO" ? "video/mp4,video/3gpp" :
                              "application/pdf"
                            }
                            disabled={uploadingMedia}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMedia(f); }}
                          />
                          {uploadingMedia && <Loader2 className="w-4 h-4 animate-spin" />}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          {cabecalhoTipo === "IMAGE" && mediaSignedUrl && (
                            <img src={mediaSignedUrl} alt="preview" className="h-16 w-16 object-cover rounded border" />
                          )}
                          <div className="flex-1 text-xs text-muted-foreground truncate">
                            {mediaPath.split("/").pop()} · {mediaMime}
                          </div>
                          <Button size="sm" variant="outline" type="button" onClick={removerMedia}>
                            <X className="w-3 h-3 mr-1" /> Remover
                          </Button>
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        A Meta usa este arquivo como referência para aprovar o template. Requer <code>meta_app_id</code> configurado.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2 rounded-md border p-3">
                    <Label>Tipo de variável *</Label>
                    <Select value={formatoVar} onValueChange={(v) => setFormatoVar(v as FormatoVar)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NUMERADA">Número — {"{{1}}"}, {"{{2}}"} (recomendado)</SelectItem>
                        <SelectItem value="NOMEADA">Nome — {"{{nome}}"}, {"{{valor}}"}</SelectItem>
                      </SelectContent>
                    </Select>
                    {formatoVar === "NOMEADA" ? (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        Muitas contas da Meta não aceitam variáveis por nome e rejeitam o modelo com
                        "os parâmetros de variável devem ser números inteiros". Se não tiver certeza, use Número.
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Formato aceito por todas as contas da Meta.
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Corpo *</Label>
                    <Textarea id="corpo-template" rows={5} value={corpo} onChange={(e) => setCorpo(e.target.value)}
                      placeholder={formatoVar === "NUMERADA"
                        ? "Olá {{1}}, seu boleto de R$ {{2}} vence em {{3}}."
                        : "Olá {{nome}}, seu boleto de R$ {{valor}} vence em {{data}}."} />
                    <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                      <span>
                        {formatoVar === "NUMERADA"
                          ? `Use {{1}}, {{2}}... ${nVarsCorpo} variável(is) detectada(s).`
                          : `Use {{nome}}, {{valor}}... ${varsNomeadas.length} variável(is) detectada(s).`}
                      </span>
                      <span>{corpo.length}/1024</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Button size="sm" variant="outline" type="button" onClick={() => inserirVariavel()}>
                        <Plus className="w-3 h-3 mr-1" /> Inserir variável
                      </Button>
                      {formatoVar === "NOMEADA" && ["nome", "valor", "data"].map((k) => (
                        <Button key={k} size="sm" variant="ghost" type="button" onClick={() => inserirVariavel(k)}>
                          {`{{${k}}}`}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {formatoErrado && (
                    <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
                      <Label className="text-destructive">Formato de variável incorreto</Label>
                      <p className="text-xs text-muted-foreground">
                        {formatoVar === "NUMERADA"
                          ? "O corpo usa variáveis por nome, mas o tipo selecionado é Número. A Meta rejeita esse modelo."
                          : "O corpo usa variáveis numeradas, mas o tipo selecionado é Nome."}
                      </p>
                      <Button size="sm" variant="outline" type="button" onClick={converterFormato}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Converter para o formato selecionado
                      </Button>
                    </div>
                  )}

                  {formatoVar === "NUMERADA" && nVarsCorpo > 0 && (
                    <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                      <Label>Exemplos para aprovação Meta *</Label>
                      {exemploBody.map((v, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-14">{`{{${idx + 1}}}`}</span>
                          <Input value={v} onChange={(e) => {
                            const arr = [...exemploBody]; arr[idx] = e.target.value; setExemploBody(arr);
                          }} placeholder={`Exemplo para variável ${idx + 1}`} />
                        </div>
                      ))}
                    </div>
                  )}

                  {formatoVar === "NOMEADA" && varsNomeadas.length > 0 && (
                    <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                      <Label>Exemplos das variáveis nomeadas *</Label>
                      <p className="text-xs text-muted-foreground">
                        A Meta exige um exemplo por variável nomeada. Sem isso o template é rejeitado com INVALID_FORMAT.
                      </p>
                      {varsNomeadas.map((k) => (
                        <div key={k} className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-28 truncate">{`{{${k}}}`}</span>
                          <Input
                            value={exemploNomeado[k] ?? ""}
                            onChange={(e) => setExemploNomeado((p) => ({ ...p, [k]: e.target.value }))}
                            placeholder={`Exemplo para ${k}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {riscosDeContexto.length > 0 && (
                    <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                      <Label className="text-amber-600 dark:text-amber-400">Risco de rejeição</Label>
                      {riscosDeContexto.map((r, i) => (
                        <p key={i} className="text-xs text-muted-foreground">{r}</p>
                      ))}
                    </div>
                  )}

                  <div>
                    <Label>Rodapé</Label>
                    <Input value={rodape} onChange={(e) => setRodape(e.target.value)} maxLength={60} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Label>Botões (opcional, máx 3)</Label>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" type="button" onClick={() => addBotao("QUICK_REPLY")}>
                          <Plus className="w-3 h-3 mr-1" /> Resposta Rápida
                        </Button>
                        <Button size="sm" variant="outline" type="button" onClick={() => addBotao("URL")}>
                          <Plus className="w-3 h-3 mr-1" /> URL
                        </Button>
                        <Button size="sm" variant="outline" type="button" onClick={() => addBotao("PHONE_NUMBER")}>
                          <Plus className="w-3 h-3 mr-1" /> Telefone
                        </Button>
                      </div>
                    </div>
                    {botoes.map((b, idx) => (
                      <div key={idx} className="flex items-center gap-2 rounded-md border p-2">
                        <Badge variant="secondary">{b.type}</Badge>
                        <Input placeholder="Texto do botão" value={b.text} maxLength={25}
                          onChange={(e) => {
                            const arr = [...botoes]; arr[idx] = { ...b, text: e.target.value }; setBotoes(arr);
                          }} />
                        {b.type === "URL" && (
                          <Input placeholder="https://..." value={b.url || ""}
                            onChange={(e) => {
                              const arr = [...botoes]; arr[idx] = { ...b, url: e.target.value }; setBotoes(arr);
                            }} />
                        )}
                        {b.type === "PHONE_NUMBER" && (
                          <Input placeholder="+55..." value={b.phone_number || ""}
                            onChange={(e) => {
                              const arr = [...botoes]; arr[idx] = { ...b, phone_number: e.target.value }; setBotoes(arr);
                            }} />
                        )}
                        <Button size="icon" variant="ghost" onClick={() => setBotoes(botoes.filter((_, i) => i !== idx))}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button onClick={salvarMestre} disabled={salvando || !!nomeDuplicado}>
                    {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Salvar template mestre
                  </Button>
                </CardContent>
              </Card>

              {/* Prévia ao vivo */}
              <div>
                <Card className="lg:sticky lg:top-4">
                  <CardHeader className="pb-2"><CardTitle className="text-base">Prévia do modelo</CardTitle></CardHeader>
                  <CardContent>
                    <TemplateWhatsAppPreview
                      sampleValues={exemploBody}

                      template={{
                        nome_template: nome,
                        body_text: corpo || "Digite o corpo da mensagem...",
                        variaveis: {
                          _components: (() => {
                            const c: any[] = [];
                            if (cabecalhoTipo !== "NONE") {
                              c.push({
                                type: "HEADER",
                                format: cabecalhoTipo,
                                text: cabecalhoTipo === "TEXT" ? cabecalhoTexto : undefined,
                              });
                            }
                            c.push({ type: "BODY", text: corpo });
                            if (rodape) c.push({ type: "FOOTER", text: rodape });
                            if (botoes.length > 0) c.push({ type: "BUTTONS", buttons: botoes });
                            return c;
                          })(),
                          _header_image_url: mediaSignedUrl || undefined,
                        },
                      }}
                    />
                    <p className="text-[11px] text-muted-foreground mt-2 text-center">
                      Assim a mensagem aparecerá no WhatsApp do destinatário.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>


          {/* ===== Lote ===== */}
          <TabsContent value="lote" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Aplicar template em várias instâncias</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label>Template mestre</Label>
                    <Button size="sm" variant="outline" onClick={() => setSelecaoAutoAberta(true)}>
                      <Zap className="w-4 h-4 mr-2" />
                      Modelos para números novos ({qtdMarcados})
                    </Button>
                  </div>
                  <Select value={selMestre} onValueChange={setSelMestre}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {mestres.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.nome} ({m.categoria})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Lista de todos os modelos: abre cada um em janela para ver/excluir */}
                  <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
                    {mestres.length === 0 && (
                      <p className="p-3 text-sm text-muted-foreground">Nenhum template criado ainda.</p>
                    )}
                    {mestres.map((m) => {
                      const usos = templInst.filter((t) => t.template_mestre_id === m.id).length;
                      return (
                        <div
                          key={m.id}
                          className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 ${selMestre === m.id ? "bg-muted/60" : ""}`}
                        >
                          <button
                            type="button"
                            className="flex-1 text-left"
                            onClick={() => setMestreDialog(m.id)}
                          >
                            <span className="font-medium">{m.nome}</span>
                            <span className="text-xs text-muted-foreground"> · {m.categoria}</span>
                          </button>
                          <Badge variant="outline" className="text-xs">{usos} nº</Badge>
                          {m.injetar_em_novos && (
                            <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 text-xs">
                              <Zap className="w-3 h-3 mr-1" /> nº novos
                            </Badge>
                          )}
                          <label
                            className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer"
                            title="Usar este modelo nas mensagens de aquecimento para leads do Google Maps"
                          >
                            <Checkbox
                              checked={!!m.usar_em_leads}
                              onCheckedChange={(v) => alternarLeads(m.id, v === true)}
                            />
                            leads
                          </label>
                          <Button size="icon" variant="ghost" onClick={() => setMestreDialog(m.id)} title="Ver template">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>


                {selMestre && (() => {
                  const m = mestres.find((x) => x.id === selMestre);
                  if (!m) return null;
                  const _components: any[] = [];
                  if (m.cabecalho_tipo) {
                    _components.push({
                      type: "HEADER",
                      format: m.cabecalho_tipo,
                      text: m.cabecalho_texto || undefined,
                    });
                  }
                  _components.push({ type: "BODY", text: m.corpo });
                  if (m.rodape) _components.push({ type: "FOOTER", text: m.rodape });
                  if (Array.isArray(m.botoes) && m.botoes.length > 0) {
                    _components.push({ type: "BUTTONS", buttons: m.botoes });
                  }
                  return (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        Pré-visualização (como aparece no WhatsApp)
                      </div>
                      <TemplateWhatsAppPreview
                        imageUrlOverride={loteMediaUrl || undefined}
                        sampleValues={(m.exemplo?.body_text?.[0] as string[]) || []}
                        template={{
                          nome_template: m.nome,
                          body_text: m.corpo,
                          variaveis: { _components },
                        }}
                      />

                    </div>
                  );
                })()}

                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={buscaInst}
                      onChange={(e) => setBuscaInst(e.target.value)}
                      placeholder="Buscar por nome ou número"
                      className="pl-8"
                    />
                  </div>

                  {(() => {
                    const liberadas = instFiltradas.filter((i) => {
                      const q = qualidadeDa(i);
                      const qualidadeOk = q === "GREEN" || q === "UNKNOWN" || q === "SEM LEITURA";
                      return qualidadeOk && !jaPossuemSet.has(i.id);
                    });
                    const jaTem = instFiltradas.filter((i) => jaPossuemSet.has(i.id)).length;
                    return (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={liberadas.length > 0 && liberadas.every((i) => selInst.has(i.id))}
                            onCheckedChange={(v) => {
                              const s = new Set(selInst);
                              if (v) liberadas.forEach((i) => s.add(i.id));
                              else liberadas.forEach((i) => s.delete(i.id));
                              setSelInst(s);
                            }}
                          />
                          <Label>Todas as {liberadas.length} instâncias liberadas (GREEN + qualidade desconhecida)</Label>
                        </div>
                        {selMestre && jaTem > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {jaTem} número(s) já possuem este template e ficam fora da seleção em massa.
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  <div className="max-h-96 overflow-y-auto rounded-md border">
                    {instFiltradas.length === 0 && (
                      <p className="p-3 text-sm text-muted-foreground">Nenhuma instância encontrada.</p>
                    )}
                    {instFiltradas.map((inst) => {
                      const t = templInst.find((x) => x.instancia_id === inst.id && x.template_mestre_id === selMestre);
                      const status = t?.status;
                      const jaPossui = jaPossuemSet.has(inst.id);
                      return (
                        <div key={inst.id} className={`flex items-center gap-3 border-b last:border-0 p-2 hover:bg-muted/40 ${jaPossui ? "opacity-60" : ""}`}>
                          <Checkbox
                            checked={selInst.has(inst.id)}
                            onCheckedChange={(v) => {
                              const s = new Set(selInst);
                              if (v) s.add(inst.id); else s.delete(inst.id);
                              setSelInst(s);
                            }}
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium">{inst.nome}</div>
                            <div className="text-xs text-muted-foreground">{inst.display_phone || "-"}</div>
                          </div>
                          {jaPossui && (
                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                              Já possui
                            </Badge>
                          )}
                          {(() => {
                            const q = qualidadeDa(inst);
                            return (
                              <Badge className={QUALIDADE_CORES[q] || "bg-muted text-muted-foreground"}>
                                {q === "SEM LEITURA" ? "Sem leitura" : q}
                              </Badge>
                            );
                          })()}
                          {status && (
                            <div className="flex flex-col items-end gap-1 max-w-[260px]">
                              <Badge className={STATUS_COLORS[status] || ""}>{status}</Badge>
                              {(t?.erro || t?.motivo_rejeicao) && (
                                <span
                                  className="text-[11px] text-destructive text-right leading-snug"
                                  title={t?.erro || t?.motivo_rejeicao || ""}
                                >
                                  {humanizarErroTemplate(t?.erro || t?.motivo_rejeicao)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Fluxo recomendado (evita rejeição em massa)</p>
                  <p>1. Envie o <b>piloto</b> para 1 número. 2. Aguarde a aprovação da Meta. 3. Clique em <b>Replicar nas demais</b> — só as instâncias ainda não aprovadas recebem.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => enviarLote("piloto")}
                    disabled={enviando || !selMestre || selInst.size === 0}
                  >
                    {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Enviar piloto (1 número)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => enviarLote("replicar")}
                    disabled={enviando || !selMestre}
                  >
                    {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Replicar nas demais
                  </Button>
                  <Button onClick={() => enviarLote()} disabled={enviando || !selMestre || selInst.size === 0}>
                    {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Enviar para todas agora ({selInst.size})
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Status ===== */}
          <TabsContent value="status" className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={verificarStatus}>
                <RefreshCw className="w-4 h-4 mr-2" /> Verificar status na Meta
              </Button>
            </div>

            <Dialog open={statusDialog.open} onOpenChange={(v) => setStatusDialog((s) => ({ ...s, open: v }))}>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Status verificado na Meta</DialogTitle>
                  <DialogDescription>
                    {statusDialog.instancias} instância(s) conferida(s). Atualizados: {statusDialog.atualizados} · Aprovados: {statusDialog.aprovados}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 mt-2">
                  {statusDialog.resumo.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma instância aguardando resposta da Meta no momento.</p>
                  )}
                  {statusDialog.resumo.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.nome}</div>
                        <div className="text-xs text-muted-foreground truncate">{r.telefone} · BM: {r.bm || "não vinculada"}</div>
                      </div>
                      <Badge className={QUALIDADE_CORES[r.qualidade] || QUALIDADE_CORES["SEM LEITURA"] || "bg-muted text-muted-foreground"}>
                        {r.qualidade}
                      </Badge>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            {loading && <div className="text-center py-6"><Loader2 className="w-6 h-6 animate-spin inline" /></div>}
            {mestres.map((m) => {
              const c = contagemPorMestre(m.id);
              const filhas = templInst.filter((t) => t.template_mestre_id === m.id);
              return (
                <Card key={m.id}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">{m.nome}</CardTitle>
                      <p className="text-xs text-muted-foreground">{m.categoria} · {m.idioma}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {c.APPROVED ? <Badge className={STATUS_COLORS.APPROVED}>APPROVED {c.APPROVED}</Badge> : null}
                      {c.PENDING ? <Badge className={STATUS_COLORS.PENDING}>PENDING {c.PENDING}</Badge> : null}
                      {c.ENVIADO ? <Badge className={STATUS_COLORS.ENVIADO}>ENVIADO {c.ENVIADO}</Badge> : null}
                      {c.REJECTED ? <Badge className={STATUS_COLORS.REJECTED}>REJECTED {c.REJECTED}</Badge> : null}
                      {c.FALHA_ENVIO ? <Badge className={STATUS_COLORS.FALHA_ENVIO}>FALHA {c.FALHA_ENVIO}</Badge> : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reenviarFalhas(m.id)}
                        disabled={enviando || contarFalhas(m.id) === 0}
                        title={contarFalhas(m.id) === 0 ? "Nenhuma falha para reenviar" : undefined}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Reenviar falhas ({contarFalhas(m.id)})
                      </Button>

                      {filhas.length === 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deletarMestre(m.id)}
                          title="Excluir template (não anexado a nenhuma instância)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <details>
                      <summary className="cursor-pointer text-sm text-muted-foreground">Ver detalhes por instância ({filhas.length})</summary>
                      <div className="mt-2 space-y-1">
                        {filhas.map((f) => {
                          const inst = instancias.find((i) => i.id === f.instancia_id);
                          return (
                            <div key={f.id} className="flex items-center gap-3 text-sm border-b py-1">
                              <span className="flex-1">
                                {inst?.nome || "Número não visível nesta tela"}{" "}
                                <span className="text-xs text-muted-foreground">{inst?.display_phone}</span>
                                {(() => {
                                  const bm = bmDaInstancia(inst);
                                  if (!bm) return null;
                                  return bm.url ? (
                                    <a
                                      href={bm.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="ml-2 text-xs text-primary underline underline-offset-2"
                                      title="Abrir a conta de negócios vinculada"
                                    >
                                      BM: {bm.nome}
                                    </a>
                                  ) : (
                                    <span className="ml-2 text-xs text-muted-foreground">BM: {bm.nome}</span>
                                  );
                                })()}
                                {inst && (
                                  <Badge
                                    className={QUALIDADE_CORES[qualidadeDa(inst)] || "bg-muted text-muted-foreground"}
                                    title="Qualidade atual da instância na Meta"
                                  >
                                    {qualidadeDa(inst)}
                                  </Badge>
                                )}
                              </span>

                              <Badge className={STATUS_COLORS[f.status] || ""}>{f.status}</Badge>
                              {(f.erro || f.motivo_rejeicao) && (
                                <span className="text-xs text-destructive max-w-sm leading-snug" title={f.erro || f.motivo_rejeicao || ""}>
                                  {humanizarErroTemplate(f.erro || f.motivo_rejeicao)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  </CardContent>
                </Card>
              );
            })}
            {!loading && mestres.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nenhum template criado ainda.</p>
            )}
          </TabsContent>
        </Tabs>

        {/* ===== Janela de um template mestre ===== */}
        <Dialog open={!!mestreDialog} onOpenChange={(o) => !o && setMestreDialog(null)}>
          <DialogContent className="max-w-lg">
            {(() => {
              const m = mestres.find((x) => x.id === mestreDialog);
              if (!m) return null;
              const usos = templInst.filter((t) => t.template_mestre_id === m.id).length;
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="break-all">{m.nome}</DialogTitle>
                    <DialogDescription>
                      {m.categoria} · {m.idioma} · aplicado em {usos} número(s)
                    </DialogDescription>
                  </DialogHeader>

                  <div className="rounded-lg border bg-muted/30 p-3">
                    <TemplateWhatsAppPreview
                      imageUrlOverride={m.cabecalho_media_url || undefined}
                      sampleValues={(m.exemplo?.body_text?.[0] as string[]) || []}
                      template={{
                        nome_template: m.nome,
                        body_text: m.corpo,
                        variaveis: { _components: componentesDoMestre(m) },
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-2 rounded-md border p-3">
                    <Checkbox
                      checked={!!m.injetar_em_novos}
                      onCheckedChange={(v) => alternarInjecao(m.id, !!v)}
                    />
                    <div className="text-sm">
                      <p className="font-medium">Injetar em números novos</p>
                      <p className="text-xs text-muted-foreground">
                        Aplicado sozinho em cada número novo, um por vez com 2–5 min de intervalo.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => { setSelMestre(m.id); setMestreDialog(null); }}
                    >
                      <Send className="w-4 h-4 mr-2" /> Usar no envio em lote
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={async () => { await deletarMestre(m.id); setMestreDialog(null); }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Excluir template
                    </Button>
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* ===== Seleção dos modelos aplicados em números novos ===== */}
        <Dialog open={selecaoAutoAberta} onOpenChange={setSelecaoAutoAberta}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Modelos para números novos</DialogTitle>
              <DialogDescription>
                Os marcados são aplicados automaticamente em cada número novo, todos no mesmo dia,
                um por vez com 2–5 min de intervalo, das 07h às 20h e nunca no domingo.
              </DialogDescription>
            </DialogHeader>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={buscaMestre}
                onChange={(e) => setBuscaMestre(e.target.value)}
                placeholder="Buscar template"
                className="pl-8"
              />
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => marcarTodosInjecao(true)}>Marcar todos</Button>
              <Button size="sm" variant="outline" onClick={() => marcarTodosInjecao(false)}>Limpar</Button>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
              {mestresFiltrados.map((m) => (
                <label key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                  <Checkbox
                    checked={!!m.injetar_em_novos}
                    onCheckedChange={(v) => alternarInjecao(m.id, !!v)}
                  />
                  <span className="flex-1">{m.nome}</span>
                  <span className="text-xs text-muted-foreground">{m.categoria}</span>
                </label>
              ))}
              {mestresFiltrados.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">Nenhum template encontrado.</p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {qtdMarcados} marcado(s). Sem nenhum marcado, o sistema escolhe sozinho os modelos mais aprovados.
            </p>
          </DialogContent>
        </Dialog>
      </div>

    </AppLayout>
  );
}
