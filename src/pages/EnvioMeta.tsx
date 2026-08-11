import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Send, RefreshCw, Pencil, Check, X, Pause, Play, StopCircle, HeartPulse, AlertTriangle, Upload, FileSpreadsheet, ShieldCheck, TestTube, CheckCircle2, Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AppLayout } from "@/components/layout/AppLayout";
import TemplateWhatsAppPreview from "@/components/meta/TemplateWhatsAppPreview";
import CustoEnvioCard, { type CustoEnvioCardHandle } from "@/components/meta/CustoEnvioCard";
import CustoEstimadoEnvio, { LIMITE_CUSTO_BRL_DEFAULT } from "@/components/meta/CustoEstimadoEnvio";
import { calcularCustoEstimado } from "@/hooks/useCustoEstimadoEnvio";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useMetaEnviosTotais } from "@/hooks/useMetaEnviosTotais";
import { useAuth } from "@/hooks/useAuth";
import { AgendarCampanhaBox, CampanhasAgendadasList } from "@/components/meta/CampanhaAgendadaSection";
import { useEnvioMetaSending } from "@/contexts/EnvioMetaSendingContext";
import { Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import MapearColunasImportDialog from "@/components/meta/MapearColunasImportDialog";
import { splitLinhaEnvio, parseNumeroBR } from "@/lib/valorBR";
import EditarVariaveisTemplateDialog from "@/components/meta/EditarVariaveisTemplateDialog";
import { SaudeBadgeStatus, SaudeBadgeQuality } from "@/components/meta/SaudeBadges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";




type UazInstancia = {
  id: string;
  nome: string;
  telefone: string | null;
  server_url: string;
  instance_token: string;
};

type Instancia = {
  id: string;
  nome: string;
  phone_number_id: string;
  display_phone: string | null;
  tier_diario: number;
  enviados_hoje: number;
  ativo: boolean;
  estado_pool?: string | null;
  fase_rampup?: string | null;
  saude_status?: string | null;
  saude_quality?: string | null;
  saude_tier?: string | null;
  saude_name_status?: string | null;
  saude_ban_info?: any;
  saude_raw?: any;
  saude_checked_at?: string | null;
  meta_verified_name?: string | null;
  meta_name_status?: string | null;
  meta_profile_pic_url?: string | null;
  meta_profile_about?: string | null;
  meta_perfil_sync_em?: string | null;
  meta_bm_id?: string | null;
};



type Template = {
  id: string;
  nome_template: string;
  body_text: string | null;
  status: string;
  idioma: string;
  variaveis: Record<string, string> | null;
  instancia_id: string;
  categoria: string | null;
};

type ClienteRow = {
  telefone: string;
  nome?: string;
  cpf?: string;
  atraso?: string;
  saldo?: number;
  vars?: Record<string, string>;
};

function normalizeTelKey(t: string): string {
  const d = String(t || "").replace(/\D+/g, "");
  if (!d) return "";
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

function normalizeDocument(value: string): string {
  const d = String(value || "").replace(/\D/g, "");
  return d.length === 11 || d.length === 14 ? d : "";
}

function parseRecipients(input: string): ClienteRow[] {
  const linhas = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ClienteRow[] = [];
  const seen = new Set<string>();
  for (const linha of linhas) {
    const parts = splitLinhaEnvio(linha);
    const telefone = parts[0] || "";
    const secondAsDoc = normalizeDocument(parts[1] || "");
    const thirdAsDoc = normalizeDocument(parts[2] || "");
    const cpf = thirdAsDoc || (!parts[2] && secondAsDoc ? secondAsDoc : (parts[2] || "").replace(/\D/g, ""));
    const nome = !parts[2] && secondAsDoc ? "" : (parts[1] || "");
    const key = normalizeTelKey(telefone);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      telefone,
      nome,
      cpf,
      atraso: parts[3] || "",
      saldo: parseNumeroBR(parts[4]) ?? 0,
    });
  }
  return rows;
}

// Reescreve o textarea sem duplicados, retornando quantos foram removidos.
function dedupRecipientsRaw(raw: string): { texto: string; duplicados: number } {
  const linhas = raw.split(/\r?\n/);
  const seen = new Set<string>();
  const out: string[] = [];
  let dup = 0;
  for (const l of linhas) {
    const trimmed = l.trim();
    if (!trimmed) continue;
    const tel = splitLinhaEnvio(trimmed)[0] || "";
    const key = normalizeTelKey(tel);
    if (!key) { out.push(trimmed); continue; }
    if (seen.has(key)) { dup++; continue; }
    seen.add(key);
    out.push(trimmed);
  }
  return { texto: out.join("\n"), duplicados: dup };
}

export default function EnvioMeta() {
  const { user } = useAuth();
  const {
    enviando,
    pausado,
    progresso,
    detalhes,
    deliveryResumo,
    resultado,
    restantes,
    iniciar,
    togglePausa,
    cancelar,
    reativar,
    limpar,
    refreshStatus,
  } = useEnvioMetaSending();

  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [bmNomes, setBmNomes] = useState<Record<string, string>>({});
  const [bmFiltro, setBmFiltro] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const [templateId, setTemplateId] = useState<string>("");
  const [instanciaIds, setInstanciaIds] = useState<string[]>([]);
  const [recipientsRaw, setRecipientsRaw] = useState<string>("");
  const [recipientsHeaders, setRecipientsHeaders] = useState<string[]>([]);
  const [editAsText, setEditAsText] = useState<boolean>(false);
  
  const [nomeCampanha, setNomeCampanha] = useState<string>("");
  const [folderId, setFolderId] = useState<string>("__default__"); // __default__ = caixa padrão
  const [foldersDisponiveis, setFoldersDisponiveis] = useState<Array<{ id: string; nome: string; cor: string }>>([]);
  const [minSec, setMinSec] = useState<string>("30");
  const [maxSec, setMaxSec] = useState<string>("90");
  const [modoRajada, setModoRajada] = useState<boolean>(false);
  const [msgsPorSegundo, setMsgsPorSegundo] = useState<string>("1");
  const [uazInstancias, setUazInstancias] = useState<UazInstancia[]>([]);
  const [validadorId, setValidadorId] = useState<string>("");
  const [validando, setValidando] = useState<boolean>(false);
  const [enviandoTeste, setEnviandoTeste] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState<string>("");
  const [editPhone, setEditPhone] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [instanciasDialogOpen, setInstanciasDialogOpen] = useState<boolean>(false);
  const custoRef = useRef<CustoEnvioCardHandle>(null);
  const [checandoSaude, setChecandoSaude] = useState<boolean>(false);
  const [detalheSaude, setDetalheSaude] = useState<Instancia | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validacaoPreview, setValidacaoPreview] = useState<{ valid: string[]; invalid: string[]; errors: string[]; duplicados?: number } | null>(null);
  const [custoDlg, setCustoDlg] = useState<{
    open: boolean;
    cobrados: number;
    gratis: number;
    total: number;
    usd: number;
    brl: number;
    categoria: string;
    valorDigitado: string;
    resolver: ((ok: boolean) => void) | null;
  }>({ open: false, cobrados: 0, gratis: 0, total: 0, usd: 0, brl: 0, categoria: "", valorDigitado: "", resolver: null });

  const pedirConfirmacaoCusto = async (
    telefones: string[],
    instIds: string[],
    categoria: string | null,
  ): Promise<boolean> => {
    const est = await calcularCustoEstimado(telefones, instIds, categoria);
    if (est.brl <= 0) return true; // nada a cobrar (tudo grátis / preço zero)
    return await new Promise<boolean>((resolve) => {
      setCustoDlg({
        open: true,
        cobrados: est.cobrados,
        gratis: est.gratis,
        total: est.total,
        usd: est.usd,
        brl: est.brl,
        categoria: est.categoria,
        valorDigitado: "",
        resolver: resolve,
      });
    });
  };

  const [mapDlg, setMapDlg] = useState<{ open: boolean; rows: any[][] }>({ open: false, rows: [] });
  const [varsByTel, setVarsByTel] = useState<Record<string, Record<string, string>>>({});
  const [editVarsOpen, setEditVarsOpen] = useState(false);

  const importarExcel = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("Planilha vazia");
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, defval: "" });
      if (!rows || rows.length === 0) { toast.error("Planilha vazia"); return; }
      setMapDlg({ open: true, rows });
    } catch (e: any) {
      toast.error("Erro ao ler planilha: " + (e?.message || e));
    }
  };

  const validarAgora = async () => {
    if (!validadorId) return toast.error("Selecione uma instância UAZAPI para validar");
    const validador = uazInstancias.find((x) => x.id === validadorId);
    if (!validador) return toast.error("Instância validadora inválida");

    // 1) Deduplica antes de tudo
    const { texto, duplicados } = dedupRecipientsRaw(recipientsRaw);
    if (duplicados > 0) {
      setRecipientsRaw(texto);
      toast.message(`${duplicados} duplicado(s) removido(s) antes da validação`);
    }

    const numeros = parseRecipients(texto).map((r) => r.telefone);
    if (numeros.length === 0) return toast.error("Adicione destinatários primeiro");
    setValidando(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-whatsapp-numbers", {
        body: { numbers: numeros, server_url: validador.server_url, instance_token: validador.instance_token },
      });
      if (error) throw error;
      const preview = {
        valid: (data?.valid || []).map((n: string) => String(n)),
        invalid: (data?.invalid || []).map((n: string) => String(n)),
        errors: (data?.errors || []).map((n: string) => String(n)),
        duplicados,
      };
      setValidacaoPreview(preview);
      toast.success(`Validação: ✅ ${preview.valid.length} • ❌ ${preview.invalid.length} • ⚠️ ${preview.errors.length}${duplicados ? ` • 🔁 ${duplicados}` : ""}`);
    } catch (e: any) {
      toast.error("Erro na validação: " + (e?.message || e));
    } finally {
      setValidando(false);
    }
  };

  const removerSemWhatsApp = () => {
    if (!validacaoPreview) return;
    const invalidSet = new Set(validacaoPreview.invalid.map((t) => normalizeTelKey(t)));
    // Filtra as linhas cru do textarea preservando a ordem/colunas originais (tabela ou texto).
    const linhas = recipientsRaw.split(/\r?\n/).filter((linha) => {
      const trimmed = linha.trim();
      if (!trimmed) return false;
      const tel = splitLinhaEnvio(trimmed)[0] || "";
      const key = normalizeTelKey(tel);
      if (!key) return false;
      return !invalidSet.has(key);
    });
    setRecipientsRaw(linhas.join("\n"));
    setValidacaoPreview({ ...validacaoPreview, invalid: [] });
    toast.success(`${invalidSet.size} número(s) sem WhatsApp removido(s)`);
  };

  const [sincronizandoPerfis, setSincronizandoPerfis] = useState(false);
  const sincronizarPerfis = async () => {
    setSincronizandoPerfis(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-sync-perfil-instancias", { body: {} });
      if (error) throw error;
      const results: any[] = data?.results || [];
      const comFoto = results.filter((r) => r.foto).length;
      toast.success(`${results.length} instância(s) sincronizada(s) • ${comFoto} com foto`);
      await carregar();
    } catch (e: any) {
      toast.error("Erro ao sincronizar perfis: " + (e?.message || e));
    } finally {
      setSincronizandoPerfis(false);
    }
  };


  const verificarSaude = async () => {
    setChecandoSaude(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-meta-instance-health", { body: {} });
      if (error) throw error;
      const results: any[] = data?.results || [];
      const bannedOrFlagged = results.filter((r) => r.ban_info || ["FLAGGED", "RESTRICTED"].includes(String(r.status || "").toUpperCase()));
      if (bannedOrFlagged.length > 0) {
        toast.warning(`${bannedOrFlagged.length} instância(s) com problema: ${bannedOrFlagged.map((r) => r.nome).join(", ")}`);
      } else {
        toast.success(`Todas as ${results.length} instância(s) OK`);
      }
      await carregar();
    } catch (e: any) {
      toast.error("Erro ao verificar saúde: " + (e?.message || e));
    } finally {
      setChecandoSaude(false);
    }
  };

  const startEdit = (i: Instancia) => {
    setEditingId(i.id);
    setEditNome(i.nome || "");
    setEditPhone(i.display_phone || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditNome("");
    setEditPhone("");
  };

  const salvarEdicao = async (id: string) => {
    setSavingEdit(true);
    const { error } = await supabase
      .from("meta_whatsapp_instances")
      .update({ nome: editNome.trim(), display_phone: editPhone.trim() || null })
      .eq("id", id);
    setSavingEdit(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    setInstancias((prev) => prev.map((x) => (x.id === id ? { ...x, nome: editNome.trim(), display_phone: editPhone.trim() || null } : x)));
    toast.success("Instância atualizada");
    cancelEdit();
  };

  const [ativandoPoolId, setAtivandoPoolId] = useState<string | null>(null);

  const ativarNoPool = async (inst: Instancia) => {
    const estado = inst.estado_pool || "aguardando_templates";
    const isRetomar = estado === "pausado";
    if (!isRetomar) {
      if (!confirm(`Ativar "${inst.nome}" no pool? O ramp-up começa hoje (Dia 1 = 20 msg máx).`)) return;
    }
    setAtivandoPoolId(inst.id);
    const patch: Record<string, any> = isRetomar
      ? {
          estado_pool: "ativo",
          pausa_automatica_ate: null,
          pausa_automatica_motivo: null,
          // Retomada manual: libera envio mesmo com qualidade YELLOW/RED
          qualidade_liberada_manual: true,
          qualidade_liberada_em: new Date().toISOString(),
        }
      : {
          estado_pool: "ativo",
          data_ativacao_api: new Date().toISOString().slice(0, 10),
          fase_rampup: "fase1",
          pausa_automatica_ate: null,
          pausa_automatica_motivo: null,
        };
    const { error } = await (supabase as any)
      .from("meta_whatsapp_instances")
      .update(patch)
      .eq("id", inst.id);
    setAtivandoPoolId(null);
    if (error) {
      toast.error("Erro ao ativar: " + error.message);
      return;
    }
    toast.success(isRetomar ? `${inst.nome} retomado` : `${inst.nome} ativado no pool — Dia 1 iniciado`);
    await carregar();
  };

  const carregar = async () => {
    setLoading(true);
    const [i, t, u, bm] = await Promise.all([
      supabase.from("meta_whatsapp_instances").select("*").eq("ativo", true).order("nome"),
      supabase.from("meta_whatsapp_templates")
        .select("*")
        .order("nome_template"),


      (supabase as any).from("user_whatsapp_instances")
        .select("id, nome, telefone, ativo, server_url, instance_token")
        .eq("ativo", true)
        .order("nome"),
      (supabase as any).from("meta_business_managers")
        .select("id, nome, business_id")
        .order("nome"),
    ]);
    if (bm?.data) {
      const map: Record<string, string> = {};
      for (const b of bm.data as any[]) map[b.id] = b.nome || b.business_id || "—";
      setBmNomes(map);
    }
    if (i.data) {
      const tierParaNumero = (tag?: string | null): number | null => {
        if (!tag) return null;
        const t = String(tag).toUpperCase();
        if (t.includes("UNLIMITED")) return 100000;
        if (t.includes("100K")) return 100000;
        if (t.includes("10K")) return 10000;
        if (t.includes("2K")) return 2000;
        if (t.includes("1K")) return 1000;
        if (t.includes("250")) return 250;
        if (t.includes("50")) return 50;
        return null;
      };
      const mapped = (i.data as any[]).map((inst) => {
        const efetivo = tierParaNumero(inst.messaging_limit_manual) ?? tierParaNumero(inst.saude_tier);
        return { ...inst, tier_diario: efetivo ?? inst.tier_diario ?? 250 };
      });
      setInstancias(mapped as any);
    }
    if (t.data) setTemplates(t.data as any);
    if (u.data) setUazInstancias(u.data as any);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  // Carrega caixas de mensagens disponíveis para o usuário atual (RLS restringe)
  useEffect(() => {
    if (!user) {
      setFoldersDisponiveis([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase.from('meta_inbox_folders')
        .select('id, nome, cor')
        .order('nome');
      if (error) {
        console.error('[EnvioMeta] Erro ao carregar caixas de mensagens:', error);
        setFoldersDisponiveis([]);
        return;
      }
      setFoldersDisponiveis(((data as any) ?? []) as any);
    })();
  }, [user]);

  // Agrupa templates por (nome_template, idioma) — cada linha do dropdown é um "template lógico"
  // que pode existir em várias instâncias. `templateId` guarda a chave do grupo.
  type TemplateGroup = {
    key: string;
    nome: string;
    idioma: string;
    categoria: string | null;
    sample: Template;
    rows: Template[];
    instanciasAprovadasIds: Set<string>;
  };
  const templateGroups = useMemo<TemplateGroup[]>(() => {
    const map = new Map<string, TemplateGroup>();
    const base = instanciaIds.length === 0
      ? []
      : templates.filter((t) => instanciaIds.includes(t.instancia_id));
    for (const t of base) {
      // Trava anti-gasto: templates MARKETING não aparecem no dropdown de envio em massa.
      // A versão UTILITY do mesmo template continua disponível.
      if (String(t.categoria || '').toUpperCase() === 'MARKETING') continue;
      const key = `${t.nome_template}::${t.idioma}`;
      const g = map.get(key);
      if (g) {
        g.rows.push(t);
        if (t.status === "approved") g.instanciasAprovadasIds.add(t.instancia_id);
      } else {
        map.set(key, {
          key,
          nome: t.nome_template,
          idioma: t.idioma,
          categoria: t.categoria,
          sample: t,
          rows: [t],
          instanciasAprovadasIds: new Set(t.status === "approved" ? [t.instancia_id] : []),
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [templates, instanciaIds]);

  // Clear selected template if it disappears after instance change
  useEffect(() => {
    if (templateId && !templateGroups.some((g) => g.key === templateId)) {
      setTemplateId("");
    }
  }, [templateGroups, templateId]);


  const templateGroup = useMemo(
    () => templateGroups.find((g) => g.key === templateId) || null,
    [templateGroups, templateId],
  );
  // Usa o primeiro registro do grupo como "template" para preview/variáveis.
  const template = templateGroup?.sample ?? null;

  // Instâncias selecionadas que NÃO têm este template aprovado
  const instanciasIncompatíveis = useMemo(() => {
    if (!templateGroup) return [] as Instancia[];
    return instancias.filter(
      (i) => instanciaIds.includes(i.id) && !templateGroup.instanciasAprovadasIds.has(i.id),
    );
  }, [templateGroup, instanciaIds, instancias]);

  const recipients = useMemo(() => parseRecipients(recipientsRaw), [recipientsRaw]);

  const templateIdByInstance = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (!templateGroup) return map;
    for (const r of templateGroup.rows) {
      if (r.status === "approved" && instanciaIds.includes(r.instancia_id)) {
        map[r.instancia_id] = r.id;
      }
    }
    return map;
  }, [templateGroup, instanciaIds]);

  const SEM_BM = "__sem_bm__";
  const bmsDisponiveis = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; qtd: number }>();
    for (const i of instancias) {
      const key = i.meta_bm_id || SEM_BM;
      const nome = i.meta_bm_id ? (bmNomes[i.meta_bm_id] || "BM sem nome") : "Sem BM vinculada";
      const cur = map.get(key);
      if (cur) cur.qtd++;
      else map.set(key, { id: key, nome, qtd: 1 });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.id === SEM_BM) return 1;
      if (b.id === SEM_BM) return -1;
      return a.nome.localeCompare(b.nome);
    });
  }, [instancias, bmNomes]);

  const instanciasVisiveis = useMemo(() => {
    if (bmFiltro.length === 0) return instancias;
    return instancias.filter((i) => bmFiltro.includes(i.meta_bm_id || SEM_BM));
  }, [instancias, bmFiltro]);

  const toggleBmFiltro = (id: string) => {
    setBmFiltro((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleInstancia = (id: string) => {
    setInstanciaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };


  const enviar = async () => {
    if (!template || !templateGroup) return toast.error("Selecione um template aprovado");
    if (instanciaIds.length === 0) return toast.error("Selecione ao menos uma instância");
    if (String(templateGroup.categoria || '').toUpperCase() === 'MARKETING') {
      return toast.error(
        `Envio bloqueado: template "${templateGroup.nome}" é categoria MARKETING. Só templates UTILITY são permitidos. Peça ao admin liberar em Configurar Meta → Segurança de Custos.`,
      );
    }

    // Filtro automático: só remove instâncias RED/YELLOW que estejam realmente
    // pausadas/restritas pelo sistema. Se não há pausa ativa (sem botão "Retomar")
    // ou se você liberou manualmente, o envio é permitido.
    const badQuality = instanciaIds.filter((id) => {
      const inst = instancias.find((x) => x.id === id) as any;
      if (!inst) return false;
      if (inst.qualidade_liberada_manual) return false;
      const q = String(inst.saude_quality || "").toUpperCase();
      if (q !== "RED" && q !== "YELLOW") return false;
      const pausada = inst.pausa_automatica_ate && new Date(inst.pausa_automatica_ate) > new Date();
      const restrita = inst.estado_pool === "restrita" || inst.estado_pool === "pausado";
      return Boolean(pausada || restrita);
    });
    const filteredInstanciaIds = instanciaIds.filter((id) => !badQuality.includes(id));
    if (filteredInstanciaIds.length === 0) {
      return toast.error("Nenhuma instância disponível. As RED/YELLOW pausadas foram bloqueadas — clique em \"Retomar\" na instância para liberar o envio mesmo assim.");
    }
    if (badQuality.length > 0) {
      const nomes = badQuality
        .map((id) => instancias.find((x) => x.id === id)?.nome || id)
        .slice(0, 5)
        .join(", ");
      toast.warning(`${badQuality.length} instância(s) RED/YELLOW removidas automaticamente: ${nomes}`);
    }

    if (instanciasIncompatíveis.length > 0) {
      const incompativelFiltrado = instanciasIncompatíveis.filter((i) => filteredInstanciaIds.includes(i.id));
      if (incompativelFiltrado.length > 0) {
        return toast.error(
          `Este template não está aprovado em: ${incompativelFiltrado.map((i) => i.nome).join(", ")}. Remova essas instâncias ou sincronize/aprove o template nelas.`,
        );
      }
    }

    // Deduplica destinatários antes de qualquer coisa
    const dedup = dedupRecipientsRaw(recipientsRaw);
    if (dedup.duplicados > 0) {
      setRecipientsRaw(dedup.texto);
      toast.message(`${dedup.duplicados} duplicado(s) removido(s)`);
    }
    const recipientsDedup = parseRecipients(dedup.texto);
    if (recipientsDedup.length === 0) return toast.error("Cole ao menos um destinatário");

    // Fallback: se todas as instâncias marcadas estão fora do pool e há 1 destinatário só,
    // dispara em modo teste automaticamente (bypassa ramp-up / horário / domingo).
    const todasForaPool = filteredInstanciaIds.every((id) => {
      const inst = instancias.find((x) => x.id === id);
      return (inst?.estado_pool || "aguardando_templates") !== "ativo";
    });
    if (todasForaPool && recipientsDedup.length === 1) {
      toast.message("Nenhuma instância ativa no pool — enviando em modo teste");
      await enviarTeste();
      return;
    }
    if (todasForaPool) {
      return toast.error(
        "Nenhuma instância marcada está ativa no pool. Ative-as em Configurar Meta → Pool, ou use 'Enviar teste' para validar com 1 número.",
      );
    }


    const lo = Math.max(1, Number(minSec) || 1);
    const hi = Math.max(lo, Number(maxSec) || lo);

    let clientesFinal = recipientsDedup;
    let semWa: string[] = [];
    let erroVal: string[] = [];

    // Validação opcional via UAZAPI
    if (validadorId) {
      const validador = uazInstancias.find((x) => x.id === validadorId);
      if (!validador) return toast.error("Instância validadora inválida");

      setValidando(true);
      try {
        const numeros = recipientsDedup.map((r) => r.telefone);
        const { data: vData, error: vErr } = await supabase.functions.invoke("check-whatsapp-numbers", {
          body: {
            numbers: numeros,
            server_url: validador.server_url,
            instance_token: validador.instance_token,
          },
        });
        if (vErr) throw vErr;
        const validKeys = new Set<string>((vData?.valid || []).map((n: string) => normalizeTelKey(String(n))));
        semWa = (vData?.invalid || []).map((n: string) => String(n));
        erroVal = (vData?.errors || []).map((n: string) => String(n));
        const totalValid = vData?.total_valid ?? validKeys.size;
        const totalInvalid = vData?.total_invalid ?? semWa.length;
        const totalErr = vData?.total_errors ?? erroVal.length;

        if (totalValid === 0) {
          toast.error("Nenhum número com WhatsApp encontrado");
          setValidando(false);
          return;
        }

        const ok = confirm(
          `Validação concluída:\n\n` +
          `✅ ${totalValid} com WhatsApp\n` +
          `❌ ${totalInvalid} sem WhatsApp (descartados)\n` +
          `⚠️ ${totalErr} erros de validação (descartados)\n` +
          (dedup.duplicados > 0 ? `🔁 ${dedup.duplicados} duplicado(s) removido(s)\n` : "") +
          `\nDisparar template "${template.nome_template}" para ${totalValid} contatos em ${filteredInstanciaIds.length} instância(s), com delay ${lo}-${hi}s?`
        );
        if (!ok) { setValidando(false); return; }

        clientesFinal = recipientsDedup.filter((r) => validKeys.has(normalizeTelKey(r.telefone)));
      } catch (e: any) {
        toast.error("Erro na validação: " + (e?.message || e));
        setValidando(false);
        return;
      }
      setValidando(false);
    } else {
      const bloco = modoRajada
        ? `MODO RAJADA CONTROLADA — envio paralelo por instância, com limite seguro de mensagens por segundo.\n\n`
        : "";
      const delayLinha = modoRajada ? `${Math.max(1, Math.min(60, Number(msgsPorSegundo) || 1))} msg/s por instância` : `delay ${lo}-${hi}s`;
      if (!confirm(
        `${bloco}Disparar template "${template.nome_template}" para ${recipientsDedup.length} contatos em ${filteredInstanciaIds.length} instância(s), com ${delayLinha}?` +
        (dedup.duplicados > 0 ? `\n\n🔁 ${dedup.duplicados} duplicado(s) já foram removidos.` : "")
      )) return;
    
    }

    // Gate universal para modo rajada — vale para todos os caminhos acima
    if (modoRajada) {
      const digitou = prompt(`RAJADA CONTROLADA — confirma o disparo com limite de ${Math.max(1, Math.min(60, Number(msgsPorSegundo) || 1))} msg/s por instância?\nDigite RAJADA (maiúsculas) para prosseguir:`);
      if ((digitou || "").trim() !== "RAJADA") { toast.error("Confirmação cancelada"); return; }
    }



    // Mapa instância -> template_id específico daquela instância (mesmo nome/idioma)
    const templateIdByInstance: Record<string, string> = {};
    for (const r of templateGroup.rows) {
      if (r.status === "approved" && filteredInstanciaIds.includes(r.instancia_id)) {
        templateIdByInstance[r.instancia_id] = r.id;
      }
    }

    // ✅ Confirmação de custo — mostra R$ estimado e exige digitação do valor
    const okCusto = await pedirConfirmacaoCusto(
      clientesFinal.map((c) => c.telefone),
      filteredInstanciaIds,
      templateGroup.categoria,
    );
    if (!okCusto) return;

    const hasVars = Object.keys(varsByTel).length > 0;
    const varKey = (tel: string) => {
      const d = String(tel || "").replace(/\D/g, "");
      return d.length >= 8 ? d.slice(-8) : d;
    };
    const clientesComVars: ClienteRow[] = hasVars
      ? clientesFinal.map((c) => {
          const v = varsByTel[varKey(c.telefone)];
          return v ? { ...c, vars: v } : c;
        })
      : clientesFinal;

    await iniciar({
      template: { id: template.id, nome_template: template.nome_template },
      instanciaIds: filteredInstanciaIds,
      instancias: instancias.map((i) => ({ id: i.id, nome: i.nome })),
      clientes: clientesComVars,
      minSec: lo,
      maxSec: hi,
      semWhatsapp: semWa,
      erroValidacao: erroVal,
      templateIdByInstance,
      nomeCampanha: nomeCampanha.trim() || undefined,
      folderId: folderId === "__default__" ? null : folderId,
      modoRajada,
      msgsPorSegundo: modoRajada ? Math.max(1, Math.min(60, Number(msgsPorSegundo) || 1)) : undefined,
      onAfterEnvio: () => {
        carregar();
        custoRef.current?.refetch();
      },
    });

    // Libera o formulário imediatamente após iniciar. O acompanhamento
    // da campanha passa a acontecer apenas no botão flutuante "Campanhas".
    setRecipientsRaw("");
    setRecipientsHeaders([]);
    setVarsByTel({});
    setValidacaoPreview(null);
    setNomeCampanha("");
    setTimeout(() => { refreshStatus(); }, 1500);
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
    toast.success("Campanha iniciada. Acompanhe no botão Campanhas.");
  };

  const enviarTeste = async () => {
    if (!template || !templateGroup) return toast.error("Selecione um template aprovado");
    if (instanciaIds.length === 0) return toast.error("Marque ao menos uma instância no card 2");
    const dedup = dedupRecipientsRaw(recipientsRaw);
    const rows = parseRecipients(dedup.texto);
    if (rows.length === 0) return toast.error("Cole ao menos um destinatário");

    // usa 1ª instância marcada + 1º destinatário
    const instId = instanciaIds[0];
    const instInfo = instancias.find((i) => i.id === instId);
    const tplId = templateIdByInstance[instId] || template.id;
    const cliente = rows[0];

    setEnviandoTeste(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-meta", {
        body: { template_id: tplId, instancia_id: instId, cliente, modo_teste: true },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Teste enviado para ${cliente.telefone} via ${instInfo?.nome || instId} (wa_id: ${data.waId || "—"})`);
      } else {
        toast.error(`Falha no teste: ${data?.error || "erro desconhecido"}`);
      }
    } catch (e: any) {
      toast.error("Erro ao enviar teste: " + (e?.message || e));
    } finally {
      setEnviandoTeste(false);
    }
  };



  const variaveisDoTemplate = template?.variaveis
    ? Object.entries(template.variaveis)
        .filter(([k]) => !k.startsWith("_"))
        .sort(([a], [b]) => (Number(a) || 0) - (Number(b) || 0))
    : [];

  return (
    <AppLayout>
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Envio em massa — Meta WhatsApp</h1>
          <p className="text-muted-foreground mt-1">
            Dispare templates HSM aprovados via API oficial, com round-robin entre instâncias e delay aleatório.
          </p>
        </div>
        <Button variant="outline" onClick={carregar} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Atualizar
        </Button>
      </div>

      <CustoEnvioCard ref={custoRef} />

      <EnviosTotaisCards />





      <div className="grid md:grid-cols-2 gap-6">
        {/* Template */}
        <Card>
          <CardHeader>
            <CardTitle>1. Template HSM</CardTitle>
            <CardDescription>
              Selecione as instâncias ao lado — os templates disponíveis em cada instância selecionada aparecerão aqui, com badges indicando em quais instâncias existem.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {templateGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {instanciaIds.length === 0
                  ? "Selecione uma ou mais instâncias acima para ver os templates disponíveis."
                  : "Nenhum template encontrado para as instâncias selecionadas. Sincronize os templates em API Oficial Meta → Templates HSM."}
              </p>
            ) : (
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="h-10">
                  {templateGroup ? (
                    <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
                      <span className="truncate">{templateGroup.nome}</span>
                      <span className="text-xs text-muted-foreground shrink-0">({templateGroup.idioma})</span>
                      {templateGroup.categoria && (
                        <Badge variant={templateGroup.categoria === 'MARKETING' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 shrink-0">
                          {templateGroup.categoria === 'MARKETING' ? 'Marketing' : templateGroup.categoria === 'UTILITY' ? 'Utilidade' : templateGroup.categoria}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                        {templateGroup.instanciasAprovadasIds.size}/{instanciaIds.length} inst.
                      </Badge>
                    </div>
                  ) : (
                    <SelectValue placeholder="Selecione um template" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {templateGroups.map((g) => {
                    const total = instanciaIds.length;
                    const ok = g.instanciasAprovadasIds.size;
                    const full = ok === total && total > 0;
                    const rowsByInst = new Map(g.rows.map((r) => [r.instancia_id, r] as const));
                    const instBadges = instanciaIds
                      .map((id) => ({ inst: instancias.find((i) => i.id === id), row: rowsByInst.get(id) }))
                      .filter((x) => x.inst && x.row);
                    return (
                      <SelectItem key={g.key} value={g.key}>
                        <div className="flex flex-col gap-1 w-full">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{g.nome}</span>
                            <span className="text-xs text-muted-foreground">({g.idioma})</span>
                            {g.categoria && (
                              <Badge variant={g.categoria === 'MARKETING' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                {g.categoria === 'MARKETING' ? 'Marketing' : g.categoria === 'UTILITY' ? 'Utilidade' : g.categoria}
                              </Badge>
                            )}
                            <Badge
                              variant={full ? "default" : ok === 0 ? "destructive" : "secondary"}
                              className={`text-[10px] px-1.5 py-0 ${full ? "bg-green-600" : ok > 0 && !full ? "bg-amber-500 text-white" : ""}`}
                            >
                              {ok}/{total} instâncias
                            </Badge>
                          </div>
                          {instBadges.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {instBadges.map(({ inst, row }) => {
                                const aprov = row!.status === "approved";
                                return (
                                  <span
                                    key={inst!.id}
                                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                      aprov
                                        ? "bg-green-600/15 border-green-600/40 text-green-700 dark:text-green-400"
                                        : "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400"
                                    }`}
                                    title={aprov ? "Aprovado" : `Status: ${row!.status}`}
                                  >
                                    {inst!.nome}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}


            {templateGroup && String(templateGroup.categoria || '').toUpperCase() === 'MARKETING' && (
              <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm">
                <div className="flex items-start gap-2 text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">Template MARKETING — envio bloqueado</p>
                    <p className="mt-1 text-xs">
                      Este template está classificado como <strong>MARKETING</strong> pela Meta (~US$ 0,0625 por conversa).
                      A trava anti-gasto do sistema bloqueia esse envio para evitar recargas automáticas surpresa.
                      Use apenas templates de <strong>UTILIDADE</strong>. Se precisar liberar, o admin pode desativar a trava
                      em <em>Configurar Meta → Segurança de Custos</em>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {templateGroup && instanciasIncompatíveis.length > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">
                      Este template não está aprovado em {instanciasIncompatíveis.length} instância(s) selecionada(s):
                    </p>
                    <ul className="list-disc ml-5 mt-1">
                      {instanciasIncompatíveis.map((i) => (
                        <li key={i.id}>{i.nome}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs">
                      O envio está bloqueado para evitar erros. Remova as instâncias abaixo ou sincronize/aprovar o template nelas.
                    </p>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setInstanciaIds((prev) =>
                            prev.filter((id) => !instanciasIncompatíveis.some((x) => x.id === id)),
                          )
                        }
                      >
                        Remover instâncias incompatíveis
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          toast.info("Sincronizando templates das instâncias incompatíveis...");
                          for (const inst of instanciasIncompatíveis) {
                            try {
                              await supabase.functions.invoke("meta-sync-templates", {
                                body: { instancia_id: inst.id },
                              });
                            } catch {}
                          }
                          await carregar();
                          toast.success("Sincronização concluída");
                        }}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" /> Sincronizar templates dessas instâncias
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {template && (
              <div className="mt-2">
                <TemplateWhatsAppPreview
                  template={template}
                  imageUrlOverride={
                    templates
                      .filter((t: any) => t.nome_template === templateGroup?.nome && t.idioma === templateGroup?.idioma)
                      .map((t: any) => t?.variaveis?._header_image_url)
                      .find((u: any) => typeof u === 'string' && u.trim().length > 0) || undefined
                  }
                />
              </div>
            )}

            {template && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <strong>Variáveis:</strong>{" "}
                    {variaveisDoTemplate.length > 0
                      ? variaveisDoTemplate.map(([k, v]) => `{{${k}}}=${v}`).join(" · ")
                      : <span className="italic">nenhuma configurada</span>}
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditVarsOpen(true)}>
                    <Pencil className="h-3 w-3 mr-1" /> Editar variáveis
                  </Button>
                </div>
                <p>
                  Campos disponíveis:
                  <code className="ml-1">{"{nome} {primeiro_nome} {cpf} {atraso} {saldo} {avista} {parcelado}"}</code>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instâncias */}
        <Card>
          <CardHeader>
            <CardTitle>2. Instâncias</CardTitle>
            <CardDescription>Marque as instâncias para distribuir em round-robin.</CardDescription>
          </CardHeader>
          <CardContent>
            {instancias.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma instância ativa. Cadastre em "API Oficial Meta".
              </p>
            ) : (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm">
                  <div className="font-medium">
                    {instanciaIds.length} de {instancias.length} selecionadas
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Round-robin entre as instâncias marcadas.
                  </div>
                </div>
                <Button type="button" onClick={() => setInstanciasDialogOpen(true)}>
                  Acessar Instâncias
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={instanciasDialogOpen} onOpenChange={setInstanciasDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Instâncias</DialogTitle>
            <DialogDescription>Marque as instâncias para distribuir em round-robin.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={instanciasVisiveis.length === 0}
              onClick={() => {
                const visIds = instanciasVisiveis.map((i) => i.id);
                const todasMarcadas = visIds.every((id) => instanciaIds.includes(id));
                if (todasMarcadas) {
                  setInstanciaIds((prev) => prev.filter((id) => !visIds.includes(id)));
                } else {
                  setInstanciaIds((prev) => Array.from(new Set([...prev, ...visIds])));
                }
              }}
            >
              {instanciasVisiveis.length > 0 && instanciasVisiveis.every((i) => instanciaIds.includes(i.id)) ? "Limpar seleção" : "Selecionar todas"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={verificarSaude} disabled={checandoSaude || instancias.length === 0}>
              {checandoSaude ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <HeartPulse className="h-3.5 w-3.5 mr-1.5" />}
              Verificar saúde
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={sincronizarPerfis} disabled={sincronizandoPerfis || instancias.length === 0}>
              {sincronizandoPerfis ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Sincronizar perfis
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="outline" disabled={bmsDisponiveis.length === 0}>
                  <Building2 className="h-3.5 w-3.5 mr-1.5" />
                  {bmFiltro.length > 0 ? `BMs (${bmFiltro.length})` : "BMs"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-auto">
                <DropdownMenuLabel>Business Managers</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {bmsDisponiveis.map((bm) => (
                  <DropdownMenuCheckboxItem
                    key={bm.id}
                    checked={bmFiltro.includes(bm.id)}
                    onCheckedChange={() => toggleBmFiltro(bm.id)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    <span className="truncate">{bm.nome}</span>
                    <span className="ml-auto pl-2 text-xs text-muted-foreground">{bm.qtd}</span>
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setBmFiltro(bmsDisponiveis.map((b) => b.id)); }}>
                  Selecionar todas
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setBmFiltro([]); }}>
                  Limpar filtro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          </div>

          <div className="overflow-auto flex-1 -mx-1 px-1">
          {instanciaIds.length > 0 && instanciaIds.every((id) => (instancias.find((x) => x.id === id)?.estado_pool || "aguardando_templates") !== "ativo") && (
            <div className="mb-3 rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium mb-0.5">Nenhuma instância marcada está ativa no pool</div>
                <div>O disparo em massa está bloqueado. Ative as instâncias em Configurar Meta → Pool.</div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {instanciasVisiveis.map((i) => {
              const isEditing = editingId === i.id;
              return (
              <label key={i.id} className="flex items-center gap-3 p-2 rounded border hover:bg-muted/40 cursor-pointer">
                <Checkbox
                  checked={instanciaIds.includes(i.id)}
                  onCheckedChange={() => toggleInstancia(i.id)}
                />
                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarImage src={i.meta_profile_pic_url || undefined} alt={`Foto de perfil de ${i.meta_verified_name || i.nome}`} />
                  <AvatarFallback className="text-[11px]">
                    {(i.meta_verified_name || i.nome || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div
                      className="space-y-1.5"
                      onClick={(e) => e.preventDefault()}
                    >
                      <Input
                        value={editNome}
                        onChange={(e) => setEditNome(e.target.value)}
                        placeholder="Nome / apelido"
                        className="h-7 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="Telefone de exibição"
                        className="h-7 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="font-medium text-sm">{i.nome}</div>
                      {i.meta_verified_name && (
                        <div className="text-[11px] text-muted-foreground truncate">
                          Meta: {i.meta_verified_name}
                          {i.meta_name_status ? ` (${i.meta_name_status})` : ""}
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        {i.display_phone ? `${i.display_phone} • ` : ""}BM: {i.meta_bm_id ? (bmNomes[i.meta_bm_id] || "—") : "não vinculada"} • {i.enviados_hoje}/{i.tier_diario} hoje
                      </div>
                      {(i.saude_status || i.saude_quality) && (
                        <div className="flex flex-wrap gap-1 mt-1 items-center">
                          <SaudeBadgeStatus status={i.saude_status} />
                          <SaudeBadgeQuality quality={i.saude_quality} />
                          {i.saude_tier && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{i.saude_tier}</Badge>}
                          {i.saude_ban_info && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> BANIDO
                            </Badge>
                          )}
                          <button
                            type="button"
                            className="text-[10px] text-primary underline ml-1"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDetalheSaude(i); }}
                          >
                            detalhes
                          </button>
                          {i.saude_checked_at && (
                            <span className="text-[10px] text-muted-foreground ml-1">
                              {new Date(i.saude_checked_at).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {isEditing ? (
                  <div className="flex gap-1" onClick={(e) => e.preventDefault()}>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={savingEdit}
                      onClick={(e) => { e.stopPropagation(); salvarEdicao(i.id); }}
                      title="Salvar"
                    >
                      {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                      title="Cancelar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Badge variant={i.enviados_hoje >= i.tier_diario ? "destructive" : "secondary"}>
                      {Math.max(i.tier_diario - i.enviados_hoje, 0)} restantes
                    </Badge>
                    {(i.estado_pool || "aguardando_templates") !== "ativo" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="h-7 px-2 text-xs"
                        disabled={ativandoPoolId === i.id}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); ativarNoPool(i); }}
                        title={i.estado_pool === "pausado" ? "Retomar envio pelo pool" : "Ativar esta instância no pool (Dia 1 = 20 msg)"}
                      >
                        {ativandoPoolId === i.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            {i.estado_pool === "pausado" ? "Retomar" : "Ativar no pool"}
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEdit(i); }}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </label>
              );
            })}
          </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Destinatários */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>3. Destinatários ({recipients.length})</CardTitle>
              <CardDescription>
                Uma linha por contato. Formato: <code>telefone, nome, cpf, atraso, saldo</code>. Apenas <code>telefone</code> é obrigatório.
                Ou importe uma planilha Excel — ao importar, você poderá <strong>mapear cada coluna</strong> (Telefone, Nome, CPF/CNPJ, Atraso, Saldo).
              </CardDescription>
            </div>
            <div className="flex gap-2">

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importarExcel(f);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={!template}
                title={!template ? "Selecione um template antes de importar — assim as variáveis {{1}}, {{2}} do template aparecem no mapeamento." : "Importar planilha Excel"}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                Importar Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {recipientsHeaders.length > 0 && !editAsText ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Confira o mapeamento — cada coluna corresponde a um campo do template.
                </p>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditAsText(true)}>
                  Editar como texto
                </Button>
              </div>
              <div className="rounded-md border overflow-auto max-h-80">
                <table className="w-full text-xs font-mono">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {recipientsHeaders.map((h, i) => (
                        <th key={i} className="text-left px-2 py-1.5 border-b whitespace-nowrap font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recipientsRaw.split(/\r?\n/).filter(Boolean).map((linha, ri) => {
                      const cells = splitLinhaEnvio(linha);
                      return (
                        <tr key={ri} className="border-b last:border-0 hover:bg-muted/40">
                          {recipientsHeaders.map((_, ci) => (
                            <td key={ci} className="px-2 py-1 align-top max-w-[280px] truncate" title={cells[ci] || ""}>
                              {cells[ci] || <span className="text-muted-foreground/50">—</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {recipients.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Primeiro: <code>{recipients[0].telefone}</code>
                </p>
              )}
            </>
          ) : (
            <>
              <Textarea
                rows={10}
                value={recipientsRaw}
                onChange={(e) => {
                  setRecipientsRaw(e.target.value);
                  setValidacaoPreview(null);
                  setVarsByTel({});
                  setRecipientsHeaders([]);
                }}
                placeholder={"5562999999999, João Silva, 12345678900, 45, 1250.50\n5562988887777, Maria, 98765432100, 12, 540"}
                className="font-mono text-xs"
              />
              {recipientsHeaders.length > 0 && (
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditAsText(false)}>
                    Voltar para tabela
                  </Button>
                </div>
              )}
              {recipients.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Primeiro: <code>{recipients[0].telefone}</code>
                  {recipients[0].nome && <> • {recipients[0].nome}</>}
                  {recipients[0].cpf && <> • CNPJ/CPF: <code>{recipients[0].cpf}</code></>}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Custo estimado deste envio */}
      <CustoEstimadoEnvio
        telefones={recipients.map((r) => r.telefone)}
        instanciaIds={instanciaIds}
        categoria={templateGroup?.categoria ?? null}
      />




      {/* Agendamento multi-dia */}
      <AgendarCampanhaBox
        clientes={recipients}
        instanciaIds={instanciaIds}
        instancias={instancias.map((i) => ({ id: i.id, nome: i.nome }))}
        template={template ? { id: template.id, nome_template: template.nome_template } : null}
        templateIdByInstance={templateIdByInstance}
        minSec={Math.max(1, Number(minSec) || 1)}
        maxSec={Math.max(Math.max(1, Number(minSec) || 1), Number(maxSec) || 1)}
        disabled={enviando || validando || instanciasIncompatíveis.length > 0}
      />

      <CampanhasAgendadasList />

      {/* Envio */}
      <Card>
        <CardHeader>
          <CardTitle>4. Delay e disparo</CardTitle>
          <CardDescription>Delay aleatório entre envios (segundos). Recomendado 30-90s para volume seguro.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={modoRajada}
                onChange={(e) => setModoRajada(e.target.checked)}
              />
              <div className="text-sm">
                <div className="font-semibold text-red-700 dark:text-red-300">Modo Rajada controlada — envio paralelo com limite por instância</div>
                <div className="text-xs text-red-700/80 dark:text-red-300/80">
                  Workers paralelos por instância com token-bucket real. Use 1 msg/s para maior estabilidade;
                  se a Meta limitar, o contato volta para a fila e a retomada é automática em 1 msg/s.
                </div>
              </div>
            </label>
          </div>



          {modoRajada && instanciaIds.length === 1 && (recipients.length > 0 || (validacaoPreview?.valid.length ?? 0) > 0) && (() => {
            const total = validacaoPreview?.valid.length ?? recipients.length;
            if (total < 300) return null;
            const mps = Math.max(1, Math.min(60, Number(msgsPorSegundo) || 1));
            const minutos = Math.ceil(total / mps / 60);
            return (
              <div className="rounded-md border border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 p-3 text-xs text-yellow-900 dark:text-yellow-200">
                ⚠️ <strong>1 instância selecionada para {total.toLocaleString('pt-BR')} mensagens.</strong> A Meta limita o throughput por número — no teto de {mps} msg/s, esse envio levará ~{minutos} min. Para acelerar, selecione mais instâncias no card acima (o volume é dividido igualmente entre elas).
              </div>
            );
          })()}



          {modoRajada && instanciaIds.length > 0 && (recipients.length > 0 || (validacaoPreview?.valid.length ?? 0) > 0) && (() => {
            const total = validacaoPreview?.valid.length ?? recipients.length;
            const k = instanciaIds.length;
            const base = Math.floor(total / k);
            const resto = total % k;
            const selInst = instanciaIds
              .map((id) => instancias.find((i) => i.id === id))
              .filter(Boolean) as Instancia[];
            const maxQtd = base + (resto > 0 ? 1 : 0);
            return (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
                <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  ⚡ Divisão da rajada — {total.toLocaleString("pt-BR")} contatos ÷ {k} instância{k > 1 ? "s" : ""}
                </div>
                <div className="space-y-1.5">
                  {selInst.map((inst, i) => {
                    const qtd = base + (i < resto ? 1 : 0);
                    const pct = maxQtd > 0 ? (qtd / maxQtd) * 100 : 0;
                    return (
                      <div key={inst.id} className="flex items-center gap-2 text-xs">
                        <div className="min-w-0 flex-1 truncate">
                          <span className="font-medium">{inst.nome}</span>
                          {inst.display_phone && <span className="text-muted-foreground"> • {inst.display_phone}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 w-40">
                          <div className="h-1.5 flex-1 bg-amber-200 dark:bg-amber-900/50 rounded overflow-hidden">
                            <div className="h-full bg-amber-600" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="tabular-nums font-semibold text-amber-800 dark:text-amber-200 w-16 text-right">
                            {qtd.toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-[11px] text-amber-700/80 dark:text-amber-300/80">
                  Cada instância dispara em paralelo respeitando o limite abaixo (mensagens por segundo).
                </div>
                <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-amber-300/60 dark:border-amber-800/50">
                  <div className="min-w-[9rem]">
                    <Label className="text-xs">Velocidade MÁX. (msg/s por instância)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={msgsPorSegundo}
                      onChange={(e) => setMsgsPorSegundo(String(Math.max(1, Math.min(60, Number(e.target.value) || 1))))}
                      className="h-8"
                    />
                    <div className="text-[10px] text-amber-700/70 dark:text-amber-300/70 mt-0.5">
                      Recomendado: 1 msg/s. Se receber rate-limit, o sistema devolve o contato para a fila, pausa pelo tempo da Meta e retoma em 1 msg/s.
                    </div>
                  </div>
                  {(() => {
                    const mps = Math.max(1, Math.min(60, Number(msgsPorSegundo) || 1));
                    const k = instanciaIds.length;
                    const throughputTotal = mps * k;
                    const segundos = Math.max(1, Math.ceil(total / throughputTotal));
                    const min = Math.floor(segundos / 60);
                    const s = segundos % 60;
                    return (
                      <div className="text-xs text-amber-800 dark:text-amber-200">
                        <div className="font-semibold">⚡ Velocidade estimada</div>
                        <div className="tabular-nums">
                          {k} × {mps} msg/s = <span className="font-bold">{throughputTotal} msg/s</span>
                        </div>
                        <div className="tabular-nums">{total.toLocaleString("pt-BR")} msgs → ~ {min}m {s}s</div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })()}


          <div className={"grid grid-cols-2 gap-3 max-w-sm " + (modoRajada ? "opacity-50" : "")}>
            <div>
              <Label>Mín. (s)</Label>
              <Input type="number" min={1} value={minSec} onChange={(e) => setMinSec(e.target.value)} disabled={modoRajada} />
            </div>
            <div>
              <Label>Máx. (s)</Label>
              <Input type="number" min={1} value={maxSec} onChange={(e) => setMaxSec(e.target.value)} disabled={modoRajada} />
            </div>
          </div>

          <div className="max-w-md space-y-1.5">
            <Label>Validar WhatsApp antes do disparo (opcional)</Label>
            <Select value={validadorId || "__none__"} onValueChange={(v) => setValidadorId(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sem validação (envia para todos)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem validação (envia para todos)</SelectItem>
                {uazInstancias.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome} {u.telefone ? `• ${u.telefone}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Usa uma instância UAZAPI conectada para checar quem tem WhatsApp. Números sem WhatsApp e erros de validação são descartados antes do envio Meta.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={validarAgora}
                disabled={validando || !validadorId || recipients.length === 0}
              >
                {validando ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
                Validar agora
              </Button>
              {validacaoPreview && validacaoPreview.invalid.length > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={removerSemWhatsApp}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Remover {validacaoPreview.invalid.length} sem WhatsApp
                </Button>
              )}
              {validacaoPreview && validacaoPreview.valid.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const validSet = new Set(validacaoPreview.valid.map((t) => normalizeTelKey(t)));
                    const dedup = dedupRecipientsRaw(recipientsRaw);
                    const linhas = dedup.texto.split(/\r?\n/).filter(Boolean);
                    const usarHeaders = recipientsHeaders.length > 0;
                    const colHeaders = usarHeaders ? recipientsHeaders : ["Telefone", "Nome", "CPF/CNPJ", "Atraso", "Saldo"];
                    const dados: Record<string, any>[] = [];
                    for (const linha of linhas) {
                      const parts = splitLinhaEnvio(linha);
                      const tel = parts[0] || "";
                      if (!validSet.has(normalizeTelKey(tel))) continue;
                      const row: Record<string, any> = {};
                      colHeaders.forEach((h, i) => { row[h] = parts[i] ?? ""; });
                      dados.push(row);
                    }
                    if (dados.length === 0) { toast.error("Nada para exportar"); return; }
                    const { exportarParaExcel } = await import("@/lib/exportExcel");
                    const hoje = new Date().toISOString().slice(0, 10);
                    await exportarParaExcel(
                      dados,
                      colHeaders.map((h) => ({ chave: h, titulo: h })),
                      `contatos-com-whatsapp-${hoje}`
                    );
                    toast.success(`${dados.length} contatos exportados`);
                  }}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                  Baixar Excel ({validacaoPreview.valid.length} com WhatsApp)
                </Button>
              )}
            </div>
            {validacaoPreview && (
              <div className="mt-2 rounded-md border bg-muted/30 p-2 space-y-1.5">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge className="bg-green-600 text-white">✅ {validacaoPreview.valid.length} com WhatsApp</Badge>
                  <Badge variant="destructive">❌ {validacaoPreview.invalid.length} sem WhatsApp</Badge>
                  {validacaoPreview.errors.length > 0 && (
                    <Badge className="bg-amber-500 text-white">⚠️ {validacaoPreview.errors.length} erro(s)</Badge>
                  )}
                  {validacaoPreview.duplicados && validacaoPreview.duplicados > 0 ? (
                    <Badge variant="secondary">🔁 {validacaoPreview.duplicados} duplicado(s) removido(s)</Badge>
                  ) : null}
                </div>
                {validacaoPreview.invalid.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-red-600">Ver sem WhatsApp</summary>
                    <div className="max-h-32 overflow-auto font-mono mt-1 space-y-0.5">
                      {validacaoPreview.invalid.map((t, i) => <div key={i}>{t}</div>)}
                    </div>
                  </details>
                )}
                {validacaoPreview.errors.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-amber-600">Ver erros de validação</summary>
                    <div className="max-h-32 overflow-auto font-mono mt-1 space-y-0.5">
                      {validacaoPreview.errors.map((t, i) => <div key={i}>{t}</div>)}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>


          <div className="max-w-md space-y-1.5">
            <Label>Nome da campanha (opcional)</Label>
            <Input
              placeholder="Ex.: Certificado Digital — Lote 1"
              value={nomeCampanha}
              onChange={(e) => setNomeCampanha(e.target.value)}
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">
              Rótulo curto para identificar esta campanha no painel de campanhas ativas. Você pode iniciar várias campanhas em paralelo.
            </p>
          </div>

          <div className="max-w-md space-y-1.5">
            <Label>Caixa de mensagens do Inbox</Label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger>
                <SelectValue placeholder="Caixa padrão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Caixa padrão (visível para a equipe)</SelectItem>
                {foldersDisponiveis.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.cor }} />
                      {f.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              As conversas geradas por esta campanha aparecerão apenas na caixa selecionada do Inbox Meta.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={enviar} disabled={validando || enviandoTeste || instanciasIncompatíveis.length > 0} size="lg">
              {validando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {validando ? "Validando WhatsApp..." : `Disparar ${recipients.length > 0 ? `(${recipients.length})` : ""}`}
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>

    <Dialog open={!!detalheSaude} onOpenChange={(o) => !o && setDetalheSaude(null)}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Saúde — {detalheSaude?.nome}</DialogTitle>
          <DialogDescription>
            Dados retornados pela Graph API da Meta para este número.
          </DialogDescription>
        </DialogHeader>
        {detalheSaude && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><strong>Status:</strong> {detalheSaude.saude_status || "—"}</div>
              <div><strong>Qualidade:</strong> {detalheSaude.saude_quality || "—"}</div>
              <div><strong>Tier diário:</strong> {detalheSaude.saude_tier || "—"}</div>
              <div><strong>Nome verificado:</strong> {detalheSaude.saude_name_status || "—"}</div>
            </div>
            {detalheSaude.saude_ban_info && (
              <div className="rounded border border-destructive bg-destructive/10 p-3">
                <div className="font-semibold text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Conta WhatsApp banida pela Meta
                </div>
                <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(detalheSaude.saude_ban_info, null, 2)}</pre>
                <p className="text-xs text-muted-foreground mt-2">
                  Para apelar: business.facebook.com → WhatsApp Manager → Status da conta.
                </p>
              </div>
            )}
            {(detalheSaude.saude_status === "FLAGGED" || detalheSaude.saude_status === "RESTRICTED") && (
              <div className="rounded border border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs">
                <strong>Atenção:</strong> esta instância está {detalheSaude.saude_status}. A Meta está limitando ou bloqueando envios deste número. Reduza volume, pause envios de marketing e monitore o quality_rating.
              </div>
            )}
            {detalheSaude.saude_quality === "RED" && (
              <div className="rounded border border-red-500 bg-red-50 dark:bg-red-950/30 p-3 text-xs">
                <strong>Qualidade RED:</strong> alto risco de banimento. Pare envios em massa por 24-48h, revise template de marketing, peça aos destinatários para não bloquearem.
              </div>
            )}
            <details className="rounded border">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium">JSON cru da Meta</summary>
              <pre className="text-[10px] p-3 overflow-auto max-h-64">{JSON.stringify(detalheSaude.saude_raw, null, 2)}</pre>
            </details>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <AlertDialog
      open={custoDlg.open}
      onOpenChange={(o) => {
        if (!o && custoDlg.resolver) {
          custoDlg.resolver(false);
          setCustoDlg((prev) => ({ ...prev, open: false, resolver: null }));
        }
      }}
    >
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            💰 Confirme o custo deste envio
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2">
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Destinatários totais:</span><strong>{custoDlg.total.toLocaleString("pt-BR")}</strong></div>
                <div className="flex justify-between"><span>Grátis (janela 24h):</span><strong className="text-emerald-600">{custoDlg.gratis.toLocaleString("pt-BR")}</strong></div>
                <div className="flex justify-between"><span>Cobrados ({custoDlg.categoria}):</span><strong>{custoDlg.cobrados.toLocaleString("pt-BR")}</strong></div>
                <div className="flex justify-between border-t pt-1 mt-1"><span>Custo USD:</span><strong>{custoDlg.usd.toLocaleString("en-US", { style: "currency", currency: "USD" })}</strong></div>
                <div className="flex justify-between text-base"><span>Custo BRL:</span><strong className={custoDlg.brl > LIMITE_CUSTO_BRL_DEFAULT ? "text-red-600" : ""}>{custoDlg.brl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></div>
              </div>
              <div className="text-xs text-muted-foreground">
                Para confirmar, digite abaixo o valor exato em reais (ex.: <code>{custoDlg.brl.toFixed(2).replace(".", ",")}</code>).
                Isso protege contra envios acidentais de custo alto.
              </div>
              <Input
                autoFocus
                inputMode="decimal"
                placeholder="0,00"
                value={custoDlg.valorDigitado}
                onChange={(e) => setCustoDlg((p) => ({ ...p, valorDigitado: e.target.value }))}
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              custoDlg.resolver?.(false);
              setCustoDlg((prev) => ({ ...prev, open: false, resolver: null }));
            }}
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={(() => {
              const digitado = Number(String(custoDlg.valorDigitado).replace(/\./g, "").replace(",", "."));
              const alvo = Number(custoDlg.brl.toFixed(2));
              // aceita margem de 1 centavo
              return !Number.isFinite(digitado) || Math.abs(digitado - alvo) > 0.01;
            })()}
            onClick={() => {
              custoDlg.resolver?.(true);
              setCustoDlg((prev) => ({ ...prev, open: false, resolver: null }));
            }}
          >
            Confirmar disparo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
      <MapearColunasImportDialog
        open={mapDlg.open}
        onOpenChange={(v) => setMapDlg((p) => ({ ...p, open: v }))}
        rows={mapDlg.rows}
        template={template ? {
          nome_template: template.nome_template,
          body_text: (template as any).body_text || "",
          variaveis: template.variaveis || null,
        } : null}
        onConfirm={(linhas, stats, novosVars, headers) => {
          setRecipientsRaw(linhas.join("\n"));
          setRecipientsHeaders(headers || []);
          setEditAsText(false);
          setValidacaoPreview(null);
          setVarsByTel(novosVars || {});
          const varsCount = Object.keys(novosVars || {}).length;
          toast.success(
            `${stats.total} contato(s) importado(s)` +
            (stats.ignorados ? ` • ${stats.ignorados} ignorado(s)` : "") +
            (stats.duplicados ? ` • ${stats.duplicados} duplicado(s) removido(s)` : "") +
            (varsCount ? ` • variáveis do template preenchidas em ${varsCount} linha(s)` : "")
          );
        }}
      />
      <EditarVariaveisTemplateDialog
        open={editVarsOpen}
        onOpenChange={setEditVarsOpen}
        template={template as any}
        templates={(templateGroup?.rows.filter((r) => r.status === "approved" && instanciaIds.includes(r.instancia_id)) || []) as any}
        onSaved={() => carregar()}
      />


    </AppLayout>
  );
}


function DetalhesEnvioPainel({ detalhes, deliveryResumo, onRefresh }: {
  detalhes: {
    enviados: { telefone: string; instancia?: string; erro?: string; ts: number; deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed'; deliveryErro?: string }[];
    erros: { telefone: string; instancia?: string; erro?: string; ts: number }[];
    semWhatsapp: string[];
    erroValidacao: string[];
  };
  deliveryResumo: { aceito: number; entregue: number; lida: number; falhou: number; aguardando: number };
  onRefresh: () => Promise<void>;
}) {
  const copiar = (arr: string[], titulo: string) => {
    navigator.clipboard.writeText(arr.join("\n"));
    toast.success(`${titulo}: ${arr.length} números copiados`);
  };

  const exportarCSV = () => {
    const rows: string[] = ["telefone,status,instancia,delivery_status,delivery_erro,erro"];
    const esc = (s: string) => `"${(s || "").replace(/"/g, '""')}"`;
    detalhes.enviados.forEach((e) => rows.push(`${esc(e.telefone)},enviado,${esc(e.instancia || "")},${esc(e.deliveryStatus || "aguardando")},${esc(e.deliveryErro || "")},`));
    detalhes.erros.forEach((e) => rows.push(`${esc(e.telefone)},erro,${esc(e.instancia || "")},,,${esc(e.erro || "")}`));
    detalhes.semWhatsapp.forEach((t) => rows.push(`${esc(t)},sem_whatsapp,,,,`));
    detalhes.erroValidacao.forEach((t) => rows.push(`${esc(t)},erro_validacao,,,,`));
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `envio-meta-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const DeliveryBadge = ({ s, erro }: { s?: 'sent' | 'delivered' | 'read' | 'failed'; erro?: string }) => {
    if (!s) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Aguardando…</span>;
    if (s === 'sent') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Aceito</span>;
    if (s === 'delivered') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400">Entregue</span>;
    if (s === 'read') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-600 dark:text-green-400">Lida</span>;
    return (
      <span title={erro || 'Falhou'} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-600 dark:text-red-400">
        Falhou
      </span>
    );
  };

  const Section = ({ titulo, cor, count, children, onCopy, headerExtra }: { titulo: string; cor: string; count: number; children: React.ReactNode; onCopy?: () => void; headerExtra?: React.ReactNode }) => {
    const [aberto, setAberto] = useState<boolean>(count > 0 && count <= 20);
    return (
      <details
        className="rounded-md border bg-card"
        open={aberto}
        onToggle={(e) => setAberto((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center justify-between gap-2">
          <span className={cor}>
            {titulo} <span className="text-muted-foreground font-normal">({count})</span>
            {headerExtra}
          </span>
          {onCopy && count > 0 && (
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={(e) => { e.preventDefault(); onCopy(); }}>
              Copiar
            </Button>
          )}
        </summary>
        <div className="max-h-48 overflow-auto px-3 pb-3 font-mono text-xs space-y-0.5">
          {count === 0 ? <div className="text-muted-foreground italic">Nenhum</div> : children}
        </div>
      </details>
    );
  };

  const resumoText = detalhes.enviados.length > 0 ? (
    <span className="ml-2 text-[11px] font-normal text-muted-foreground">
      · {deliveryResumo.entregue} entregues · {deliveryResumo.lida} lidas
      {deliveryResumo.falhou > 0 && <> · <span className="text-red-600">{deliveryResumo.falhou} falharam</span></>}
      {deliveryResumo.aguardando > 0 && <> · {deliveryResumo.aguardando} aguardando</>}
    </span>
  ) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Detalhamento dos envios</h4>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => onRefresh()} title="Buscar status mais recente da Meta">
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Atualizar status
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={exportarCSV}>Exportar CSV</Button>
        </div>
      </div>

      <div className="rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-[11px] text-blue-700 dark:text-blue-300 leading-snug">
        <strong>Por que não vejo essas mensagens no WhatsApp do celular?</strong> Envios pela API oficial da Meta (Cloud API) são feitos direto pelos servidores da Meta e <u>não aparecem no aparelho do chip</u> — só existem no Meta Business Manager e no Inbox Meta interno. O status abaixo (Aceito → Entregue → Lida) vem direto da Meta via webhook.
      </div>

      <Section
        titulo="✅ Enviados"
        cor="text-green-600"
        count={detalhes.enviados.length}
        onCopy={() => copiar(detalhes.enviados.map((e) => e.telefone), "Enviados")}
        headerExtra={resumoText}
      >
        {detalhes.enviados.map((e, i) => (
          <div key={i} className="border-b last:border-b-0 py-1">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0">
                {e.telefone}
                <DeliveryBadge s={e.deliveryStatus} erro={e.deliveryErro} />
              </span>
              <span className="text-muted-foreground whitespace-nowrap">{e.instancia} · {new Date(e.ts).toLocaleTimeString()}</span>
            </div>
            {e.deliveryStatus === 'failed' && e.deliveryErro && (
              <div className="text-[10px] text-red-600/80 break-words pl-1">
                ⚠ {e.deliveryErro}
              </div>
            )}
          </div>
        ))}

      </Section>

      <Section
        titulo="❌ Erros no envio"
        cor="text-red-600"
        count={detalhes.erros.length}
        onCopy={() => copiar(detalhes.erros.map((e) => e.telefone), "Erros")}
      >
        {detalhes.erros.map((e, i) => (
          <div key={i} className="border-b last:border-b-0 py-1">
            <div className="flex items-center justify-between gap-2">
              <span>{e.telefone}</span>
              <span className="text-muted-foreground">{e.instancia}</span>
            </div>
            {e.erro && <div className="text-[10px] text-red-600/80 break-words">{e.erro}</div>}
          </div>
        ))}
      </Section>

      <Section
        titulo="🚫 Sem WhatsApp"
        cor="text-orange-600"
        count={detalhes.semWhatsapp.length}
        onCopy={() => copiar(detalhes.semWhatsapp, "Sem WhatsApp")}
      >
        {detalhes.semWhatsapp.map((t, i) => <div key={i}>{t}</div>)}
      </Section>

      <Section
        titulo="⚠️ Erro na validação"
        cor="text-amber-600"
        count={detalhes.erroValidacao.length}
        onCopy={() => copiar(detalhes.erroValidacao, "Erro de validação")}
      >
        {detalhes.erroValidacao.map((t, i) => <div key={i}>{t}</div>)}
      </Section>
    </div>
  );
}

function EnviosTotaisCards() {
  const { data, isLoading } = useMetaEnviosTotais();
  const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(n);
  const usd = (n: number) => `US$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const items = [
    { label: "Mensagens de saída hoje", value: data?.hoje ?? 0 },
    { label: "Mensagens de saída 7 dias", value: data?.ultimos7d ?? 0 },
    { label: "Mensagens de saída registradas", value: data?.total ?? 0 },
    { label: "Conversas cobradas Meta", value: data?.conversasCobradasMeta ?? 0, helper: usd(data?.custoOficialUsd ?? 0) },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{it.label}</div>
            <div className="text-2xl font-semibold mt-1">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : fmt(it.value)}
            </div>
            {it.helper && <div className="text-xs text-muted-foreground mt-1">{it.helper} custo oficial</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
