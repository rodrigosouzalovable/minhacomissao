import { useEffect, useMemo, useRef, useState } from "react";
import { normalizarDatasPlanilha } from "@/lib/planilhaDatas";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import BmInstanceFilter from "@/components/meta/BmInstanceFilter";
import TemplateApprovedInstances from '@/components/meta/TemplateApprovedInstances';
import { instanciaAptaParaTemplate } from '@/lib/metaTemplateApplyEligibility';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Send, RefreshCw, Pencil, Check, X, Pause, Play, StopCircle, HeartPulse, AlertTriangle, Upload, FileSpreadsheet, ShieldCheck, TestTube, CheckCircle2, Building2, Ban, CalendarClock, Power, PowerOff, Gauge, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AppLayout } from "@/components/layout/AppLayout";
import TemplateWhatsAppPreview from "@/components/meta/TemplateWhatsAppPreview";
import CustoEstimadoEnvio, { LIMITE_CUSTO_BRL_DEFAULT } from "@/components/meta/CustoEstimadoEnvio";
import { calcularCustoEstimado } from "@/hooks/useCustoEstimadoEnvio";
import { checkUazapiConnection, isResultConnected } from "@/lib/uazapiConnectionCache";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useMetaEnviosTotais } from "@/hooks/useMetaEnviosTotais";
import { useAuth } from "@/hooks/useAuth";
import { AgendarCampanhaBox, agendamentoParaISO, type AgendamentoState } from "@/components/meta/CampanhaAgendadaSection";
import { useEnvioMetaSending } from "@/contexts/EnvioMetaSendingContext";
import { Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import MapearColunasImportDialog from "@/components/meta/MapearColunasImportDialog";
import { CREDOR_MARCAS_LISTA, type CredorSlug } from "@/lib/credorMarcas";
import { recipientRecordLines, mappedRecipientFields } from "@/lib/metaRecipientRecords";
import { splitLinhaEnvio, parseNumeroBR } from "@/lib/valorBR";
import EditarVariaveisTemplateDialog from "@/components/meta/EditarVariaveisTemplateDialog";
import { SaudeBadgeStatus, SaudeBadgeQuality } from "@/components/meta/SaudeBadges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useBmCotas } from "@/hooks/useBmCotas";
import { separarPorAcordoAtivo, cpfNorm, sufixo8, type AcordoAtivoMatch } from "@/lib/filtroAcordoAtivo";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { TemplateFavoriteSelect } from "@/components/meta/TemplateFavoriteSelect";
import { catalogoUtility, situacaoUtility, type UtilityMaster, type UtilityGroup } from "@/lib/metaUtilityCatalog";
import { applyManualTemplate, type ManualTemplateResult } from "@/lib/metaManualTemplateApplication";
import { carregarUtilityMestres } from "@/lib/carregarUtilityMestres";
import { carregarTodosMetaTemplates } from "@/lib/carregarTodosMetaTemplates";
import { approvedGreenSelectionIds, isBrazilianInstance, isBannedInstance, instanceDisplayPhone, nationalInstanceCount, nationalMassSelection, nationalSelectionIds } from "@/lib/metaNationalInstances";
import { partitionRecipientLines, validRecipientPhone } from "@/lib/metaRecipientValidation";
import { resolveButtonUrlParam, snapshotMetaButtonVars, validateMetaButtonLink } from "../../supabase/functions/_shared/meta-button-url";
import { WhatsappLinkGenerator } from "@/components/meta/WhatsappLinkGenerator";

import CampaignImagePicker, { type CampaignImage } from '@/components/meta/CampaignImagePicker';
import { templateHasImage } from '../../supabase/functions/_shared/meta-campaign-image';

function motivoAplicacao(code: string): string {
  const motivos: Record<string, string> = {
    instancia_de_outro_proprietario: "Instância de outro proprietário",
    template_mestre_de_outro_proprietario: "Modelo de outro proprietário",
    copia_automatica_desativada: "Cópia de templates desativada nesta instância",
    instancia_de_parceiro: "Instância de parceiro não aceita esta aplicação",
    instancia_de_teste: "Instância de teste não aceita cópia automática",
    instancia_sem_credenciais: "Instância precisa ser reconectada",
    somente_admin: "Somente administradores podem aplicar modelos",
    somente_api_oficial: "Aplicação disponível somente para a API Oficial Meta",
  };
  return motivos[code] || code;
}

const NOVO_MUNDO_3144_INSTANCE_ID = "b103ac3e-5781-47c4-8e11-24a323f5f0ee";

const novoMundo3144Conectada = (inst: Pick<Instancia, "id" | "saude_status">) =>
  inst.id === NOVO_MUNDO_3144_INSTANCE_ID && String(inst.saude_status || "").toUpperCase() === "CONNECTED";

const restricaoInformativa3144 = (inst: Pick<Instancia, "pausa_automatica_motivo">) =>
  /nome de exibição|display name|quality=|qualidade|reputation/i.test(String(inst.pausa_automatica_motivo || ""));
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
  saude_restricoes?: any;
  saude_raw?: any;
  saude_checked_at?: string | null;
  meta_verified_name?: string | null;
  meta_name_status?: string | null;
  meta_profile_pic_url?: string | null;
  meta_profile_about?: string | null;
  meta_perfil_sync_em?: string | null;
  meta_bm_id?: string | null;
  observacao?: string | null;
  pool_fora_manual?: boolean;
  pool_fora_manual_em?: string | null;
  pausa_automatica_motivo?: string | null;
};



type Template = {
  id: string;
  nome_template: string;
  body_text: string | null;
  status: string;
  idioma: string;
  variaveis: Record<string, any> | null;
  instancia_id: string;
  categoria: string | null;
};

// Conta variáveis numéricas ({{1}}, {{2}}...) do cabeçalho TEXT + corpo do template.
function contarVariaveis(t: { body_text?: string | null; variaveis?: any } | null | undefined): number {
  if (!t) return 0;
  const comps: any[] = Array.isArray(t?.variaveis?._components) ? t.variaveis._components : [];
  const header = comps.find((c: any) => c?.type === "HEADER");
  const headerText = header?.format === "TEXT" ? String(header?.text || "") : "";
  const texto = `${headerText}\n${t.body_text || ""}`;
  const set = new Set<string>();
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) set.add(m[1]);
  return set.size;
}

type ClienteRow = {
  telefone: string;
  nome?: string;
  cpf?: string;
  atraso?: string;
  saldo?: number;
  vars?: Record<string, string>;
  credor?: string | null;
};

function normalizeTelKey(t: string): string {
  const input = String(t || "").trim();
  const d = input.replace(/\D+/g, "");
  if (!d) return "";
  if (input.startsWith("+") || input.startsWith("00")) return input.startsWith("00") ? d.slice(2) : d;
  // Meta test numbers exported without '+': +1 555 is already country-coded.
  if (/^1555\d{7}$/.test(d)) return d;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

// Sufixo de 8 dígitos — padrão de comparação de telefone do projeto.
function telSuffix8(t: string): string {
  const d = String(t || "").replace(/\D+/g, "");
  return d.length >= 8 ? d.slice(-8) : d;
}


function normalizeDocument(value: string): string {
  const d = String(value || "").replace(/\D/g, "");
  // Excel remove zeros à esquerda: recompõe CPF (11) / CNPJ (14).
  if (d.length >= 5 && d.length <= 11) return d.padStart(11, "0");
  if (d.length >= 12 && d.length <= 14) return d.padStart(14, "0");
  return "";
}



function parseRecipients(input: string, isentos?: Set<string>, roles?: string[]): ClienteRow[] {
  const linhas = recipientRecordLines(input);
  const rows: ClienteRow[] = [];
  const seen = new Set<string>();
  for (const linha of linhas) {
    const parts = splitLinhaEnvio(linha);
    const telefone = parts[0] || "";
    const secondAsDoc = normalizeDocument(parts[1] || "");
    const thirdAsDoc = normalizeDocument(parts[2] || "");
    const cpf = thirdAsDoc || (!parts[2] && secondAsDoc ? secondAsDoc : (parts[2] || "").replace(/\D/g, ""));
    const nome = !parts[2] && secondAsDoc ? "" : (parts[1] || "");
    const key = validRecipientPhone(telefone);
    if (!key) continue;
    // Números nossos (UAZAPI) são isentos de deduplicação: mantemos todas as repetições.
    if (seen.has(key) && !isentos?.has(telSuffix8(telefone))) continue;
    seen.add(key);
    const mapped = roles?.length ? mappedRecipientFields(parts, roles) : null;
    rows.push({
      ...(mapped || {}),
      telefone: key,
      nome: mapped?.nome ?? nome,
      cpf: mapped?.cpf ?? cpf,
      atraso: mapped?.atraso ?? (parts[3] || ""),
      saldo: mapped?.saldo ?? (parseNumeroBR(parts[4]) ?? 0),
    });
  }
  return rows;
}

// Reescreve o textarea sem duplicados, retornando quantos foram removidos.
// Telefones em `isentos` (números nossos da UAZAPI) nunca são removidos.
function dedupRecipientsRaw(raw: string, isentos?: Set<string>): { texto: string; duplicados: number; preservados: number } {
  const linhas = recipientRecordLines(raw);
  const seen = new Set<string>();
  const out: string[] = [];
  let dup = 0;
  let preservados = 0;
  for (const l of linhas) {
    const trimmed = l.trim();
    if (!trimmed) continue;
    const tel = splitLinhaEnvio(trimmed)[0] || "";
    const key = normalizeTelKey(tel);
    if (!key) { out.push(trimmed); continue; }
    if (seen.has(key)) {
      if (!isentos?.has(telSuffix8(tel))) { dup++; continue; }
      preservados++;
    }
    seen.add(key);
    out.push(trimmed);
  }
  return { texto: out.join("\n"), duplicados: dup, preservados };
}

export default function EnvioMeta() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { parceiroMeta } = useUserPermissions();
  const liberacaoTotalThiago = parceiroMeta && user?.id === "a3e72fe9-5522-42ce-a0ce-fc1113a45f20";
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
  const [qualidadeFiltro, setQualidadeFiltro] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [masterMediaUrl, setMasterMediaUrl] = useState<string | undefined>();
  const [mestres, setMestres] = useState<UtilityMaster[]>([]);
  const [filaTemplate, setFilaTemplate] = useState<Record<string, string>>({});
  const [resultadosAplicacao, setResultadosAplicacao] = useState<ManualTemplateResult[]>([]);
  const [aplicacaoProgress, setAplicacaoProgress] = useState({ done: 0, total: 0 });
  const aplicacaoRef = useRef(false);
  const [loading, setLoading] = useState(true);

  const [templateId, setTemplateId] = useState<string>("");
  const [campaignImage, setCampaignImage] = useState<CampaignImage | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  useEffect(() => { setCampaignImage(null); setImageUploading(false); }, [templateId]);
  // Variação de templates: chaves adicionais (além do principal) que entram no round-robin
  const [variantesExtraKeys, setVariantesExtraKeys] = useState<string[]>([]);

  const [instanciaIds, setInstanciaIds] = useState<string[]>([]);
  // Also removes stale selections when a phone is edited or instances reload.
  useEffect(() => {
    if (loading) return;
    setInstanciaIds((prev) => {
      const next = nationalSelectionIds(prev, instancias);
      return next.length === prev.length ? prev : next;
    });
  }, [instancias, loading]);
  const [recipientsRaw, setRecipientsRaw] = useState<string>("");
  const [recipientsHeaders, setRecipientsHeaders] = useState<string[]>([]);
  const [recipientRoles, setRecipientRoles] = useState<string[]>([]);
  const [importedTemplateKey, setImportedTemplateKey] = useState("");
  const [editAsText, setEditAsText] = useState<boolean>(false);
  // CPF obrigatório na importação — sempre começa ligado.
  const [cpfObrigatorio, setCpfObrigatorio] = useState<boolean>(false);
  // Credor obrigatório na importação — sempre começa ligado.
  const [credorObrigatorio, setCredorObrigatorio] = useState<boolean>(true);
  
  const [nomeCampanha, setNomeCampanha] = useState<string>("");
  const [folderId, setFolderId] = useState<string>("__default__"); // __default__ = caixa padrão
  const [foldersDisponiveis, setFoldersDisponiveis] = useState<Array<{ id: string; nome: string; cor: string }>>([]);
  const [minSec, setMinSec] = useState<string>("30");
  const [maxSec, setMaxSec] = useState<string>("90");
  const [modoRajada, setModoRajada] = useState<boolean>(false);
  const [blacklistAtiva, setBlacklistAtiva] = useState<boolean>(true);
  const [salvandoBlacklist, setSalvandoBlacklist] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("meta_envio_pool_config").select("blacklist_ativa").eq("id", 1).maybeSingle();
      if (data) setBlacklistAtiva((data as any).blacklist_ativa !== false);
    })();
  }, []);

  const salvarBlacklistAtiva = async (v: boolean) => {
    setSalvandoBlacklist(true);
    const { error } = await supabase
      .from("meta_envio_pool_config").update({ blacklist_ativa: v } as any).eq("id", 1);
    setSalvandoBlacklist(false);
    if (error) { toast.error("Não foi possível salvar: " + error.message); return; }
    setBlacklistAtiva(v);
    toast.success(v ? "Blacklist ativada — contatos bloqueados não recebem envio." : "Blacklist desativada.");
  };
  const [msgsPorSegundo, setMsgsPorSegundo] = useState<string>("1");
  const [uazInstancias, setUazInstancias] = useState<UazInstancia[]>([]);
  const [uazConectadasIds, setUazConectadasIds] = useState<string[] | null>(null);
  const [checandoUazConexao, setChecandoUazConexao] = useState<boolean>(false);
  // Validação de WhatsApp durante o disparo, usando todas as UAZAPI conectadas.
  const [validarNoEnvio] = useState<boolean>(false);

  // Checa conexão real das instâncias UAZAPI (cache de 5 min), em lotes de 5.
  const checarConexoesUaz = async (force = false) => {
    if (uazInstancias.length === 0) { setUazConectadasIds([]); return; }
    setChecandoUazConexao(true);
    const conectadas: string[] = [];
    try {
      for (let i = 0; i < uazInstancias.length; i += 5) {
        const lote = uazInstancias.slice(i, i + 5);
        const res = await Promise.all(
          lote.map(async (u) => {
            const r = await checkUazapiConnection(u.id, u.server_url, u.instance_token, { force });
            return isResultConnected(r) ? u.id : null;
          }),
        );
        for (const id of res) if (id) conectadas.push(id);
      }
      setUazConectadasIds(conectadas);
    } finally {
      setChecandoUazConexao(false);
    }
  };


  const uazDisponiveis = useMemo(
    () => (uazConectadasIds === null ? [] : uazInstancias.filter((u) => uazConectadasIds.includes(u.id))),
    [uazInstancias, uazConectadasIds],
  );



  const [validando, setValidando] = useState<boolean>(false);
  const [iniciandoCampanha, setIniciandoCampanha] = useState<boolean>(false);
  const [enviandoTeste, setEnviandoTeste] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState<string>("");
  const [editPhone, setEditPhone] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [instanciasDialogOpen, setInstanciasDialogOpen] = useState<boolean>(false);
  const [ativandoPoolTodos, setAtivandoPoolTodos] = useState<boolean>(false);
  const custoEstimativaRef = useRef<Awaited<ReturnType<typeof calcularCustoEstimado>> | null>(null);
  const [checandoSaude, setChecandoSaude] = useState<boolean>(false);
  const [detalheSaude, setDetalheSaude] = useState<Instancia | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validacaoPreview, setValidacaoPreview] = useState<{ valid: string[]; invalid: string[]; errors: string[]; duplicados?: number; bloqueados?: number } | null>(null);
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
    custoEstimativaRef.current = est;
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

  // Aplicação do template nas instâncias que ainda não o possuem.
  const [injetandoTemplate, setInjetandoTemplate] = useState(false);

  // Confirmação de risco: números com qualidade YELLOW/RED/sem leitura marcados à mão.

  const [riscoDlg, setRiscoDlg] = useState<{
    open: boolean;
    numeros: { id: string; nome: string; qualidade: string }[];
    ciente: boolean;
    resolver: ((ok: boolean) => void) | null;
  }>({ open: false, numeros: [], ciente: false, resolver: null });

  const pedirConfirmacaoRisco = async (
    arriscadas: { id: string; nome: string; qualidade: string }[],
  ): Promise<boolean> => {
    if (arriscadas.length === 0) return true;
    return await new Promise<boolean>((resolve) => {
      setRiscoDlg({ open: true, numeros: arriscadas, ciente: false, resolver: resolve });
    });
  };

  type EscolhaReenvio = "todos" | "ignorar" | "cancelar";
  type RecenteItem = { telefone: string; ultimoEnvio: string; campanha: string };
  const [reenvioDlg, setReenvioDlg] = useState<{
    open: boolean;
    total: number;
    recentes: number;
    dias: number;
    recentesLista: RecenteItem[];
    resolver: ((escolha: EscolhaReenvio) => void) | null;
  }>({ open: false, total: 0, recentes: 0, dias: 1, recentesLista: [], resolver: null });

  const pedirConfirmacaoReenvio = (
    total: number,
    recentes: number,
    dias: number,
    recentesLista: RecenteItem[] = [],
  ): Promise<EscolhaReenvio> => new Promise((resolve) => {
    setReenvioDlg({ open: true, total, recentes, dias, recentesLista, resolver: resolve });
  });

  const baixarRecentes = async () => {
    const lista = reenvioDlg.recentesLista;
    if (!lista.length) return;
    const { exportarParaExcel } = await import("@/lib/exportExcel");
    await exportarParaExcel(
      lista,
      [
        { chave: "telefone", titulo: "Telefone" },
        { chave: "ultimoEnvio", titulo: "Último envio" },
        { chave: "campanha", titulo: "Campanha" },
      ],
      `contatos-acionados-recentemente-${new Date().toISOString().slice(0, 10)}`,
    );
  };


  const [mapDlg, setMapDlg] = useState<{ open: boolean; rows: any[][]; origem: "excel" | "manual" | "clipboard" }>({ open: false, rows: [], origem: "excel" });
  const [varsByTel, setVarsByTel] = useState<Record<string, Record<string, string>>>({});
  const [credor, setCredor] = useState<string>("__none__");
  const [credorByTel, setCredorByTel] = useState<Record<string, CredorSlug>>({});
  const [editVarsOpen, setEditVarsOpen] = useState(false);
  const [buttonUrl, setButtonUrl] = useState("");
  const [salvandoButtonUrl, setSalvandoButtonUrl] = useState(false);

  // Antirrepetição — quantos números da lista já receberam mensagem de campanha
  // nos últimos N dias (padrão do sistema). Só informativo aqui; a remoção real
  // acontece no servidor ao iniciar a campanha.
  const contarJaEnviadosRecentes = async (
    telefones: string[],
  ): Promise<{ total: number; dias: number; lista: RecenteItem[] }> => {
    const suf = (t: string) => {
      const d = String(t || "").replace(/\D/g, "");
      return d.length >= 8 ? d.slice(-8) : d;
    };
    try {
      const { data: cfg } = await supabase
        .from("meta_envio_pool_config").select("antirrepeticao_dias").eq("id", 1).maybeSingle();
      const dias = Math.max(0, Math.min(60, Number((cfg as any)?.antirrepeticao_dias ?? 1)));
      if (dias === 0) return { total: 0, dias: 0, lista: [] };
      const desde = new Date(Date.now() - dias * 86400000).toISOString();
      const alvo = new Set(telefones.map(suf).filter(Boolean));
      const porSufixo = new Map<string, { telefone: string; processado_em: string; job_id: string | null }>();
      const PAGE = 1000;
      for (let from = 0; from < 60000; from += PAGE) {
        const { data, error } = await supabase
          .from("envio_meta_job_item")
          .select("telefone,processado_em,job_id")
          .eq("status", "enviado")
          .gte("processado_em", desde)
          .order("processado_em", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) break;
        (data || []).forEach((r: any) => {
          const s = suf(r.telefone);
          if (s && alvo.has(s) && !porSufixo.has(s)) {
            porSufixo.set(s, { telefone: r.telefone, processado_em: r.processado_em, job_id: r.job_id || null });
          }
        });
        if (!data || data.length < PAGE) break;
      }
      const jobIds = Array.from(new Set(Array.from(porSufixo.values()).map((r) => r.job_id).filter(Boolean))) as string[];
      const nomesJob = new Map<string, string>();
      for (let i = 0; i < jobIds.length; i += 200) {
        const { data: jobs } = await supabase
          .from("envio_meta_job")
          .select("id,nome_campanha")
          .in("id", jobIds.slice(i, i + 200));
        (jobs || []).forEach((j: any) => nomesJob.set(j.id, j.nome_campanha || ""));
      }
      const lista: RecenteItem[] = Array.from(porSufixo.values()).map((r) => ({
        telefone: r.telefone,
        ultimoEnvio: r.processado_em ? new Date(r.processado_em).toLocaleString("pt-BR") : "",
        campanha: (r.job_id && nomesJob.get(r.job_id)) || "",
      }));
      return { total: porSufixo.size, dias, lista };
    } catch {
      return { total: 0, dias: 0, lista: [] };
    }
  };

  const removerSemWhatsAppConhecidos = async (linhas: string[]) => {
    const sufixos = Array.from(new Set(
      linhas.map((linha) => telSuffix8(splitLinhaEnvio(linha.trim())[0] || "")).filter(Boolean),
    ));
    if (sufixos.length === 0) return { linhas, removidos: 0 };

    const bloqueados = new Set<string>();
    for (let i = 0; i < sufixos.length; i += 1000) {
      const { data, error } = await supabase.rpc("listar_sem_whatsapp_verificados", {
        _sufixos: sufixos.slice(i, i + 1000),
      });
      if (error) throw error;
      (data || []).forEach((row) => bloqueados.add(row.telefone_sufixo));
    }

    if (bloqueados.size === 0) return { linhas, removidos: 0 };
    const filtradas = linhas.filter((linha) => {
      const sufixo = telSuffix8(splitLinhaEnvio(linha.trim())[0] || "");
      return !bloqueados.has(sufixo);
    });
    return { linhas: filtradas, removidos: linhas.length - filtradas.length };
  };

  // Guarda a lista da última importação para alertar se a nova é praticamente a mesma.
  const ultimaListaRef = useRef<Set<string>>(new Set());

  const importarExcel = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellNF: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("Planilha vazia");
      normalizarDatasPlanilha(ws);
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, defval: "" });
      if (!rows || rows.length === 0) { toast.error("Planilha vazia"); return; }
      setMapDlg({ open: true, rows, origem: "excel" });
    } catch (e: any) {
      toast.error("Erro ao ler planilha: " + (e?.message || e));
    }
  };


  // Validação opcional antes do disparo: usa TODAS as instâncias UAZAPI conectadas.
  const validarAgora = async () => {
    // 1) Deduplica antes de tudo
    const { texto, duplicados } = dedupRecipientsRaw(recipientsRaw, isentosDedup);
    if (duplicados > 0) {
      setRecipientsRaw(texto);
      toast.message(`${duplicados} duplicado(s) removido(s) antes da validação`);
    }

    const numeros = parseRecipients(texto, isentosDedup, recipientRoles).map((r) => r.telefone);
    if (numeros.length === 0) return toast.error("Adicione destinatários primeiro");
    setValidando(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-validar-numeros", {
        body: { numbers: numeros },
      });
      if (error) throw error;
      if (data?.sem_validadores) {
        toast.error(data?.error || "Nenhum número UAZAPI conectado para validar");
        return;
      }
      const preview = {
        valid: (data?.valid || []).map((n: string) => String(n)),
        invalid: (data?.invalid || []).map((n: string) => String(n)),
        errors: (data?.errors || []).map((n: string) => String(n)),
        duplicados,
        bloqueados: 0,
      };
      if (preview.invalid.length > 0) {
        const { error: registrarError } = await supabase.rpc("registrar_sem_whatsapp_verificados", {
          _telefones: preview.invalid,
        });
        if (registrarError) throw registrarError;
        const invalidSet = new Set(preview.invalid.map((t) => normalizeTelKey(t)));
        const linhas = recipientRecordLines(texto).filter((linha) => {
          const tel = splitLinhaEnvio(linha.trim())[0] || "";
          return !invalidSet.has(normalizeTelKey(tel));
        });
        setRecipientsRaw(linhas.join("\n"));
        preview.bloqueados = preview.invalid.length;
      }
      setValidacaoPreview(preview);
      toast.success(`Validação: ✅ ${preview.valid.length} • 🚫 ${preview.bloqueados} bloqueado(s) sem WhatsApp • ⚠️ ${preview.errors.length}${duplicados ? ` • 🔁 ${duplicados}` : ""}`);
    } catch (e: any) {
      toast.error("Erro na validação: " + (e?.message || e));
    } finally {
      setValidando(false);
    }
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
      const inelegiveis = new Set(
        results
          .filter((r) => {
            const status = String(r.status || "").toUpperCase();
            return !!r.error || (status && status !== "CONNECTED") || r.restrito_meta === true;
          })
          .map((r) => String(r.instancia_id)),
      );
      if (inelegiveis.size > 0) {
        setInstanciaIds((prev) => prev.filter((id) => !inelegiveis.has(id)));
      }
      const comRestricao = results.filter((r) =>
        !r.error && (r.ban_info || r.restrito_meta === true ||
        ["FLAGGED", "RESTRICTED", "BANNED"].includes(String(r.status || "").toUpperCase())),
      );
      const inconclusivas = results.filter((r) => !!r.error).length;
      if (comRestricao.length > 0 || inconclusivas > 0) {
        toast.warning(`${results.length - comRestricao.length - inconclusivas} sem restrição confirmada, ${comRestricao.length} restrita(s) e ${inconclusivas} consulta(s) inconclusiva(s). Consultas inconclusivas não confirmam bloqueio.`);
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

  const retirarDoPool = async (inst: Instancia) => {
    if (!isAdmin && !parceiroMeta) return;
    if (!confirm(`Desativar o pool de "${inst.nome}"? Ela não será usada nos disparos até ser ativada novamente.`)) return;
    setAtivandoPoolId(inst.id);
    const { error } = await (supabase as any).rpc("retirar_meta_instancia_pool_manual", {
      p_instancia_id: inst.id,
    });
    setAtivandoPoolId(null);
    if (error) {
      toast.error("Não foi possível retirar do pool: " + error.message);
      return;
    }
    toast.success(`Pool desativado para ${inst.nome}`);
    await carregar();
  };

  const ativarNoPool = async (inst: Instancia) => {
    if (!isAdmin && !parceiroMeta) return;
    const estavaForaManual = inst.pool_fora_manual === true;
    const estado = inst.estado_pool || "aguardando_templates";
    const isRetomar = estado === "pausado";
    if (!isRetomar && !confirm(`Ativar o pool de "${inst.nome}"?${estavaForaManual ? " A saúde será validada na Meta antes da liberação." : " O ramp-up começa hoje (Dia 1 = 20 msg máx)."}`)) return;
    setAtivandoPoolId(inst.id);
    try {
      if (estavaForaManual) {
        const { data: healthData, error: healthError } = await supabase.functions.invoke(
          "check-meta-instance-health",
          { body: { instancia_id: inst.id } },
        );
        if (healthError) throw healthError;
        const resultado = healthData?.results?.[0];
        if (!resultado || resultado.error) {
          throw new Error(resultado?.error || "A Meta não confirmou a saúde desta instância");
        }
      }

      const { error } = await (supabase as any).rpc("ativar_meta_instancia_pool", {
        p_instancia_id: inst.id,
      });
      if (error) throw error;
      toast.success(isRetomar ? `${inst.nome} retomado` : `Pool ativado para ${inst.nome}`);
      await carregar();
    } catch (e: any) {
      toast.error("Não foi possível ativar o pool: " + (e?.message || e));
      await carregar();
    } finally {
      setAtivandoPoolId(null);
    }
  };

  const ativarTodosNoPool = async () => {
    if ((!isAdmin && !parceiroMeta) || ativandoPoolTodos) return;

    const jaAtivas = instancias.filter(
      (inst) => !inst.pool_fora_manual && (inst.estado_pool || "aguardando_templates") === "ativo",
    ).length;
    const paraAtivar = instancias.filter(
      (inst) => inst.pool_fora_manual || (inst.estado_pool || "aguardando_templates") !== "ativo",
    );

    if (paraAtivar.length === 0) {
      toast.success(`Todas as ${jaAtivas} instância(s) permitida(s) já estão no pool`);
      return;
    }

    if (!confirm(`Ativar o pool de ${paraAtivar.length} instância(s)? As retiradas manualmente terão a saúde consultada na Meta antes da tentativa.`)) return;

    setAtivandoPoolTodos(true);
    const falhas = new Map<string, string>();

    try {
      const retiradasManual = paraAtivar.filter((inst) => inst.pool_fora_manual);
      for (let inicio = 0; inicio < retiradasManual.length; inicio += 100) {
        const lote = retiradasManual.slice(inicio, inicio + 100);
        try {
          const { data, error } = await supabase.functions.invoke("check-meta-instance-health", {
            body: { instancia_ids: lote.map((inst) => inst.id) },
          });
          if (error) throw error;
          const resultados = new Map<string, any>(
            ((data?.results || []) as any[]).map((resultado) => [String(resultado.instancia_id), resultado]),
          );
          for (const inst of lote) {
            const resultado = resultados.get(inst.id);
            if (!resultado || resultado.error) {
              falhas.set(inst.id, resultado?.error || "A Meta não confirmou a saúde desta instância");
            }
          }
        } catch (error: any) {
          for (const inst of lote) falhas.set(inst.id, error?.message || "Falha ao consultar a saúde na Meta");
        }
      }

      const candidatas = paraAtivar.filter((inst) => !falhas.has(inst.id));
      let ativadas = 0;
      for (let inicio = 0; inicio < candidatas.length; inicio += 8) {
        const lote = candidatas.slice(inicio, inicio + 8);
        const resultados = await Promise.all(
          lote.map(async (inst) => {
            const { error } = await (supabase as any).rpc("ativar_meta_instancia_pool", {
              p_instancia_id: inst.id,
            });
            return { inst, error };
          }),
        );
        for (const { inst, error } of resultados) {
          if (error) falhas.set(inst.id, error.message || "Ativação recusada");
          else ativadas += 1;
        }
      }

      await carregar();
      const resumo = `${ativadas} ativada(s) • ${jaAtivas} já ativa(s) • ${falhas.size} não ativada(s)`;
      if (falhas.size > 0) {
        const primeirosNomes = paraAtivar
          .filter((inst) => falhas.has(inst.id))
          .slice(0, 3)
          .map((inst) => inst.nome)
          .join(", ");
        toast.warning(`${resumo}${primeirosNomes ? ` • Verifique: ${primeirosNomes}` : ""}`);
      } else {
        toast.success(resumo);
      }
    } finally {
      setAtivandoPoolTodos(false);
    }
  };

  const carregar = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
    const [i, t, u, bm, vp, modelos] = await Promise.all([
      supabase.from("meta_whatsapp_instances").select("*").eq("ativo", true).order("nome"),
      carregarTodosMetaTemplates<Template>("*"),


      (supabase as any).from("user_whatsapp_instances")
        .select("id, nome, telefone, ativo, server_url, instance_token")
        .eq("ativo", true)
        .order("nome"),
      (supabase as any).from("meta_business_managers")
        .select("id, nome, business_id")
        .is("arquivada_em", null)
        .order("nome"),
      (supabase as any).from("meta_instance_parceiros").select("instancia_id, user_id"),
      carregarUtilityMestres(user.id),
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
      // Exclui espelhos UAZAPI e números vinculados a outros parceiros
      const idsOutroParceiro = new Set(
        (((vp as any)?.data as any[]) ?? [])
          .filter((r) => r.user_id !== user?.id)
          .map((r) => r.instancia_id as string),
      );
      const mapped = (i.data as any[])
        .filter((inst) => (inst.provider ?? "meta") === "meta" && !idsOutroParceiro.has(inst.id))
        .map((inst) => {
        const efetivo = tierParaNumero(inst.messaging_limit_manual) ?? tierParaNumero(inst.saude_tier);
        return { ...inst, tier_diario: efetivo ?? inst.tier_diario ?? 250 };
      });
      setInstancias(mapped as any);
      setInstanciaIds((prev) => nationalSelectionIds(prev, mapped));
    }

    setTemplates(t);
    setMestres(modelos);
    if (u.data) setUazInstancias(u.data as any);
    } catch (e) {
      toast.error("Não foi possível atualizar os templates. Tente novamente.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    carregar();
  }, [user?.id]);

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
  type TemplateGroup = UtilityGroup;
  const templateGroups = useMemo<TemplateGroup[]>(() => catalogoUtility(
    templates, mestres, user?.id || "", instancias.map(i => i.id), instanciaIds, contarVariaveis,
  ), [templates, mestres, user?.id, instancias, instanciaIds]);

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
  useEffect(() => {
    setFilaTemplate({});
    if (!templateGroup?.mestreId || instanciaIds.length === 0) return;
    let ativo = true;
    (async () => {
      const { data, error } = await supabase.from("meta_templates_onboarding_fila")
        .select("instancia_id,status").eq("template_mestre_id", templateGroup.mestreId || "")
        .in("instancia_id", instanciaIds);
      if (ativo && !error) setFilaTemplate(Object.fromEntries((data || []).map(r => [r.instancia_id, r.status])));
    })();
    return () => { ativo = false; };
  }, [templateGroup?.mestreId, instanciaIds, templates]);
  useEffect(() => { setResultadosAplicacao([]); }, [templateId, instanciaIds]);
  // Usa o primeiro registro do grupo como "template" para preview/variáveis.
  const template = templateGroup?.sample ?? null;

  useEffect(() => {
    let active = true;
    setMasterMediaUrl(undefined);
    const master = mestres.find(m => m.id === templateGroup?.mestreId);
    if (template?.id || !master?.cabecalho_media_url) return;
    supabase.storage.from("meta-template-media").createSignedUrl(master.cabecalho_media_url, 3600)
      .then(({ data }) => { if (active) setMasterMediaUrl(data?.signedUrl); });
    return () => { active = false; };
  }, [templateId, template?.id, mestres]);

  // Detecta botão de URL dinâmica ({{1}} no final da URL registrada na Meta)
  const templateTemBotaoUrlDinamico = useMemo(() => {
    const comps: any[] = Array.isArray(template?.variaveis?._components) ? template.variaveis._components : [];
    const buttonsComp = comps.find((c: any) => String(c?.type || "").toUpperCase() === "BUTTONS");
    const buttons: any[] = Array.isArray(buttonsComp?.buttons) ? buttonsComp.buttons : [];
    return buttons.some(
      (b: any) => String(b?.type || "").toUpperCase() === "URL" && /\{\{\s*\d+\s*\}\}/.test(String(b?.url || "")),
    );
  }, [template]);

  // Carrega o link salvo do botão quando o template muda
  useEffect(() => {
    const salvo = template?.variaveis?._button_url;
    setButtonUrl(typeof salvo === "string" ? salvo : "");
  }, [templateId, template?.id]);

  const salvarButtonUrl = async (): Promise<boolean> => {
    if (!templateGroup || !templateTemBotaoUrlDinamico) return true;
    if (!templateGroup.sample.id) {
      toast.info("Aplique o template e aguarde a aprovação para salvar o link do botão.");
      return false;
    }
    const link = buttonUrl.trim();
    if (!link) {
      toast.error('Informe o link do botão (URL dinâmica) antes de enviar.');
      return false;
    }
    try {
      validateMetaButtonLink(link);
      for (const row of templateGroup.rows) {
        const components = Array.isArray(row.variaveis?._components) ? row.variaveis._components : [];
        for (const component of components) {
          if (String(component?.type).toUpperCase() !== 'BUTTONS') continue;
          for (const button of component.buttons || []) {
            if (String(button?.type).toUpperCase() === 'URL' && /\{\{/.test(String(button.url))) {
              resolveButtonUrlParam(String(button.url), link);
            }
          }
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Link do botão inválido.');
      return false;
    }
    setSalvandoButtonUrl(true);
    try {
      const { data, error } = await supabase.rpc('salvar_link_botao_meta', {
        _template_id: templateGroup.sample.id,
        _link: link,
      });
      if (error) throw error;
      const ids = new Set<string>(Array.isArray(data) ? data.map((row: { template_id: string }) => row.template_id) : []);
      if (ids.size === 0) throw new Error('Nenhum modelo foi atualizado.');
      setTemplates((prev) =>
        prev.map((t) =>
          ids.has(t.id)
            ? { ...t, variaveis: { ...(t.variaveis || {}), _button_url: link, _button_url_live: true } }
            : t,
        ),
      );
      return true;
    } catch (e: any) {
      toast.error("Erro ao salvar o link do botão: " + (e?.message || e));
      return false;
    } finally {
      setSalvandoButtonUrl(false);
    }
  };

  // Templates compatíveis para variação: mesma quantidade de variáveis do principal
  const instanciasGreenAprovadasIds = useMemo(() =>
    approvedGreenSelectionIds(instancias.filter(instanciaAptaParaTemplate), templateGroup?.todasInstanciasAprovadasIds ?? new Set<string>()),
  [instancias, templateGroup]);

  const variantesCompativeis = useMemo(() => {
    if (!templateGroup) return [] as TemplateGroup[];
    return templateGroups.filter((g) => g.key !== templateGroup.key && g.varsCount === templateGroup.varsCount);
  }, [templateGroups, templateGroup]);

  // Limpa variantes que deixaram de ser compatíveis/disponíveis
  useEffect(() => {
    setVariantesExtraKeys((prev) => {
      const validas = prev.filter((k) => variantesCompativeis.some((g) => g.key === k));
      return validas.length === prev.length ? prev : validas;
    });
  }, [variantesCompativeis]);

  // Grupos que entram no round-robin de templates (principal + extras)
  const variantesGroups = useMemo<TemplateGroup[]>(() => {
    if (!templateGroup) return [];
    const extras = variantesExtraKeys
      .map((k) => templateGroups.find((g) => g.key === k))
      .filter(Boolean) as TemplateGroup[];
    return [templateGroup, ...extras];
  }, [templateGroup, variantesExtraKeys, templateGroups]);

  // Quando os dois templates de acordo estão selecionados, a coluna Credor
  // roteia cada cliente para o template correto em vez de alternar por sorteio.
  const templatePorCredor = useMemo(() => {
    const nomes = new Set(variantesGroups.map((g) => g.nome));
    const temUme = nomes.has("autorizado_a_vista_ou_parcelado_ume");
    const temNovoMundo = nomes.has("autorizado_a_vista_ou_parcelado");
    return temUme && temNovoMundo;
  }, [variantesGroups]);

  const credorDoTemplate = (nome: string): CredorSlug | null => {
    if (nome === "autorizado_a_vista_ou_parcelado_ume") return "ume";
    if (nome === "autorizado_a_vista_ou_parcelado") return "novo_mundo";
    return null;
  };

  const toggleVariante = (key: string) => {
    setVariantesExtraKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  // Instâncias selecionadas que NÃO têm TODOS os templates selecionados aprovados
  const instanciasIncompatíveis = useMemo(() => {
    if (variantesGroups.length === 0) return [] as Instancia[];
    return instancias.filter(
      (i) => instanciaIds.includes(i.id) && !variantesGroups.every((g) => g.instanciasAprovadasIds.has(i.id)),
    );
  }, [variantesGroups, instanciaIds, instancias]);
  const faltantesAptas = useMemo(() => instanciasIncompatíveis.filter(instanciaAptaParaTemplate), [instanciasIncompatíveis]);
  const faltantesIgnoradas = instanciasIncompatíveis.length - faltantesAptas.length;

  // Sufixos (8 dígitos) dos nossos números conectados na UAZAPI — isentos de deduplicação.
  const isentosDedup = useMemo(() => {
    const s = new Set<string>();
    for (const u of uazInstancias as any[]) {
      const suf = telSuffix8(String(u?.telefone || ""));
      if (suf.length === 8) s.add(suf);
    }
    return s;
  }, [uazInstancias]);

  const recipients = useMemo(() => parseRecipients(recipientsRaw, isentosDedup, recipientRoles), [recipientsRaw, isentosDedup, recipientRoles]);

  // Motivos que impedem disparar/agendar — exibidos na tela para não travar o botão sem explicação.
  const motivosBloqueio = useMemo(() => {
    const m: string[] = [];
    if (!templateGroup) m.push("Selecione um template aprovado.");
    if (instanciaIds.length === 0) m.push("Selecione ao menos uma instância.");
    if (recipientsRaw.trim().length === 0) m.push("Importe a planilha com os destinatários.");
    if (templatePorCredor && recipients.length > 0) {
      const semCredor = recipients.filter((c) => !credorByTel[telSuffix8(c.telefone)]).length;
      if (semCredor > 0) m.push(`Mapeie a coluna Credor para ${semCredor} linha(s) — UME usa o template com sufixo _ume e Novo Mundo usa o template padrão.`);
    }
    if (instanciasIncompatíveis.length > 0) {
      m.push(
        `${instanciasIncompatíveis.length} instância(s) selecionada(s) não têm este template aprovado — remova-as ou troque o template.`,
      );
    }
    return m;
  }, [templateGroup, instanciaIds, recipientsRaw, recipients, credorByTel, templatePorCredor, instanciasIncompatíveis]);

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

  // Agendamento por data e hora (quando ativo, o botão "Disparar" passa a "Agendar")
  const [agendamento, setAgendamento] = useState<AgendamentoState>({ ativo: false, data: "", hora: "" });
  const agendarParaISO = agendamentoParaISO(agendamento);


  const SEM_BM = "__sem_bm__";
  const { cotaDaBm, semSaldo: bmSemSaldo, recarregar: recarregarCotas } = useBmCotas();
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

  const qualidadeDaInstancia = (i: Instancia): string => {
    const q = String(i.saude_quality || "").trim().toUpperCase();
    return ["GREEN", "YELLOW", "RED"].includes(q) ? q : "SEM_QUALIDADE";
  };

  const instanciasVisiveis = useMemo(() => {
    let lista = instancias;
    if (bmFiltro.length > 0) {
      lista = lista.filter((i) => bmFiltro.includes(i.meta_bm_id || SEM_BM));
    }
    if (qualidadeFiltro.length > 0) {
      lista = lista.filter((i) => qualidadeFiltro.includes(qualidadeDaInstancia(i)));
    }
    return lista;
  }, [instancias, bmFiltro, qualidadeFiltro]);

  const qualidadesDisponiveis = useMemo(() => {
    const contagem: Record<string, number> = { GREEN: 0, YELLOW: 0, RED: 0, SEM_QUALIDADE: 0 };
    for (const i of instancias) contagem[qualidadeDaInstancia(i)] = (contagem[qualidadeDaInstancia(i)] || 0) + 1;
    return contagem;
  }, [instancias]);

  const instanciasElegiveisSelecaoMassa = useMemo(() => {
    return nationalMassSelection(instanciasVisiveis, qualidadeFiltro.length > 0);
  }, [instanciasVisiveis, qualidadeFiltro]);

  const toggleInstancia = (inst: Instancia) => {
    const selecionada = instanciaIds.includes(inst.id);
    if (!selecionada && (!isBrazilianInstance(inst) || isBannedInstance(inst))) return;
    setInstanciaIds((prev) => selecionada ? prev.filter((x) => x !== inst.id) : [...prev, inst.id]);
  };


  const [preparandoDisparo, setPreparandoDisparo] = useState(false);
  const [filtroAcordo, setFiltroAcordo] = useState<null | { excluidos: number; restantes: number; wb: XLSX.WorkBook; textoOriginal: string; novoTexto: string }>(null);
  const enviar = async () => {
    if (preparandoDisparo || iniciandoCampanha) return;
    setPreparandoDisparo(true);
    // Deixa o botão mostrar "Carregando..." antes de qualquer verificação/confirmação.
    await new Promise((r) => setTimeout(r, 50));
    try {
      await enviarInterno();
    } finally {
      setPreparandoDisparo(false);
    }
  };
  const enviarInterno = async () => {
    if (imageUploading) return toast.info('Aguarde o carregamento da imagem.');
    if (!template || !templateGroup) return toast.error("Selecione um template aprovado");
    if (instanciaIds.length === 0) return toast.error("Selecione ao menos uma instância");
    if (nationalSelectionIds(instanciaIds, instancias).length !== instanciaIds.length) {
      setInstanciaIds((prev) => nationalSelectionIds(prev, instancias));
      return toast.error("Instâncias internacionais ou banidas foram removidas. Confira a seleção antes de iniciar ou agendar o disparo.");
    }
    const recipientLines = partitionRecipientLines(recipientsRaw);
    if (recipients.length === 0) {
      return toast.error(recipientLines.ignored > 0
        ? `Nenhum destinatário com telefone válido. ${recipientLines.ignored} número(s) incompleto(s) ou com DDI inválido foram ignorados. Nada foi enviado.`
        : "Importe a planilha com os destinatários");
    }
    if (recipientLines.ignored > 0) {
      toast.info(`${recipientLines.ignored} número(s) incompleto(s) ou com DDI inválido ignorado(s). O envio seguirá apenas para os demais destinatários válidos.`);
    }
    if (templateTemBotaoUrlDinamico && !(await salvarButtonUrl())) return;
    if (templatePorCredor) {
      const semCredor = recipients.filter((c) => !credorByTel[telSuffix8(c.telefone)]).length;
      if (semCredor > 0) {
        return toast.error(`A coluna Credor é obrigatória: ${semCredor} linha(s) não têm UME ou NOVO MUNDO reconhecido.`);
      }
    }
    if (instanciasIncompatíveis.length > 0) {
      return toast.error(
        `${instanciasIncompatíveis.length} instância(s) selecionada(s) não têm este template aprovado — remova-as ou troque o template.`,
      );
    }

    if (agendamento.ativo) {
      if (!agendarParaISO) return toast.error("Informe a data e a hora de início do agendamento");
      if (new Date(agendarParaISO).getTime() <= Date.now()) {
        return toast.error("A data e hora do agendamento precisam estar no futuro");
      }
    }
    if (String(templateGroup.categoria || '').toUpperCase() === 'MARKETING') {
      return toast.error(
        `Envio bloqueado: template "${templateGroup.nome}" é categoria MARKETING. Só templates UTILITY são permitidos. Peça ao admin liberar em Configurar Meta → Segurança de Custos.`,
      );
    }

    // A chave global de qualidade é validada no backend, que mantém os bloqueios
    // reais da Meta (banimento, restrição e cobrança). A tela não
    // remove YELLOW, RED ou sem leitura antes de enviar.
    const filteredInstanciaIds = instanciaIds;

    const foraDoPool = liberacaoTotalThiago ? [] : filteredInstanciaIds.filter((id) => {
      const inst = instancias.find((x) => x.id === id);
      if (!inst) return true;
      if (inst.pool_fora_manual === true) return true;
      const liberada3144 = novoMundo3144Conectada(inst) && restricaoInformativa3144(inst);
      return (inst.estado_pool || "aguardando_templates") !== "ativo" && !liberada3144;
    });
    if (foraDoPool.length > 0) {
      const nomes = foraDoPool
        .map((id) => instancias.find((x) => x.id === id)?.nome || id)
        .slice(0, 5)
        .join(", ");
      return toast.error(
        `Ative o pool antes de iniciar a campanha. ${foraDoPool.length} instância(s) selecionada(s) estão fora do pool: ${nomes}. A seleção foi mantida.`,
      );
    }

    // O estado do nome de exibição é informativo. A tentativa segue e qualquer
    // recusa real da Meta é registrada pelo envio.
    const idsOk = filteredInstanciaIds;



    // Cota por BM (janela de 24h): remove instâncias de BMs já esgotadas
    await recarregarCotas();
    const semCota = liberacaoTotalThiago ? [] : idsOk.filter((id) => {
      const inst = instancias.find((x) => x.id === id) as any;
      return inst ? bmSemSaldo(inst.meta_bm_id) : false;
    });
    if (semCota.length > 0) {
      const nomesBm = Array.from(new Set(semCota.map((id) => {
        const inst = instancias.find((x) => x.id === id) as any;
        return inst?.meta_bm_id ? (bmNomes[inst.meta_bm_id] || "BM") : "BM";
      }))).join(", ");
      toast.warning(`${semCota.length} instância(s) removidas: cota de 24h esgotada na(s) BM(s) ${nomesBm}.`);
    }
    const instanciasComCota = idsOk.filter((id) => !semCota.includes(id));

    if (instanciasComCota.length === 0) {
      return toast.error("Nenhuma instância disponível: a cota de 24h das BMs selecionadas está esgotada.");
    }

    // Aviso de saldo total das BMs envolvidas
    const bmsEnvolvidas = new Set<string>();
    for (const id of instanciasComCota) {
      const inst = instancias.find((x) => x.id === id) as any;
      if (inst?.meta_bm_id) bmsEnvolvidas.add(inst.meta_bm_id);
    }
    let saldoTotalBm = 0;
    let temIlimitada = false;
    for (const bmId of bmsEnvolvidas) {
      const c = cotaDaBm(bmId);
      if (!c) { temIlimitada = true; continue; }
      if (c.tier_ilimitado) { temIlimitada = true; continue; }
      saldoTotalBm += c.restantes;
    }



    if (instanciasIncompatíveis.length > 0) {
      const incompativelFiltrado = instanciasIncompatíveis.filter((i) => instanciasComCota.includes(i.id));
      if (incompativelFiltrado.length > 0) {
        return toast.error(
          `Este template não está aprovado em: ${incompativelFiltrado.map((i) => i.nome).join(", ")}. Remova essas instâncias ou sincronize/aprove o template nelas.`,
        );
      }
    }

    // Deduplica destinatários antes de qualquer coisa
    const dedup = dedupRecipientsRaw(recipientLines.validRaw, isentosDedup);
    if (dedup.duplicados > 0) {
      setRecipientsRaw(dedup.texto);
      toast.message(
        `${dedup.duplicados} duplicado(s) removido(s)` +
        (dedup.preservados ? ` • 🟦 ${dedup.preservados} linha(s) de números UAZAPI mantidas` : "")
      );
    }
    const recipientsDedup = parseRecipients(dedup.texto, isentosDedup, recipientRoles);
    if (recipientsDedup.length === 0) return toast.error("Cole ao menos um destinatário");

    // Varredura: retira quem já tem acordo em andamento (CPF ou telefone).
    {
      const linhas = recipientRecordLines(dedup.texto);
      const itens = linhas.map((linha) => ({ linha, r: parseRecipients(linha, isentosDedup, recipientRoles)[0] }));
      const cpfs = Array.from(new Set(itens.map((i) => cpfNorm(i.r?.cpf)).filter((c) => c.length >= 11)));
      const sufs = Array.from(new Set(itens.map((i) => sufixo8(i.r?.telefone)).filter((s) => s.length === 8)));
      const matches: AcordoAtivoMatch[] = [];
      try {
        const n = Math.max(Math.ceil(cpfs.length / 500), Math.ceil(sufs.length / 500));
        for (let k = 0; k < n; k++) {
          const { data, error } = await supabase.rpc("acordos_ativos_por_destinatarios" as any, {
            _cpfs: cpfs.slice(k * 500, k * 500 + 500),
            _sufixos: sufs.slice(k * 500, k * 500 + 500),
          });
          if (error) throw error;
          matches.push(...((data as AcordoAtivoMatch[]) || []));
        }
      } catch {
        return toast.error("Não foi possível verificar os acordos em andamento. Nada foi enviado; tente novamente.");
      }
      const comR = itens.filter((i) => i.r).map((i) => ({ ...i.r!, __linha: i.linha }));
      const { liberados, excluidos } = separarPorAcordoAtivo(comR, matches);
      if (excluidos.length > 0) {
        const semR = itens.filter((i) => !i.r).map((i) => i.linha);
        const novoTexto = [...liberados.map((l) => l.__linha), ...semR].join("\n");
        const ws = XLSX.utils.json_to_sheet(excluidos.map((e) => ({
          Nome: e.destinatario.nome || e.acordo.cliente_nome || "",
          CPF: e.destinatario.cpf || e.acordo.cpf || "",
          Telefone: e.destinatario.telefone,
          Credor: e.acordo.empresa || "",
          "Encontrado por": e.encontradoPor,
          "Responsável pelo acordo": e.acordo.responsavel || "",
          "Data do acordo": e.acordo.criado_em ? new Date(e.acordo.criado_em).toLocaleDateString("pt-BR") : "",
          "Situação": "Em andamento",
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Com acordo");
        setFiltroAcordo({ excluidos: excluidos.length, restantes: liberados.length, wb, textoOriginal: recipientsRaw, novoTexto });
        return;
      }
    }

    const lo = Math.max(1, Number(minSec) || 1);
    const hi = Math.max(lo, Number(maxSec) || lo);

    let clientesFinal = recipientsDedup;
    let semWa: string[] = [];
    let erroVal: string[] = [];

    // Antirrepetição: quantos desta lista já receberam mensagem nos últimos dias.
    const jaRecebidos = await contarJaEnviadosRecentes(recipientsDedup.map((c) => c.telefone));

    // A validação de WhatsApp acontece durante o disparo (não trava a campanha).
    {
      const avisoCota = !temIlimitada && bmsEnvolvidas.size > 0 && recipientsDedup.length > saldoTotalBm
        ? `⚠️ Saldo das BMs em 24h: ${saldoTotalBm} mensagens. A lista tem ${recipientsDedup.length} contatos — o excedente será bloqueado até a cota renovar.\n\n`
        : "";
      const bloco = avisoCota + (modoRajada
        ? `MODO RAJADA CONTROLADA — envio paralelo por instância, com limite seguro de mensagens por segundo.\n\n`
        : "");
      const delayLinha = modoRajada ? `${Math.max(1, Math.min(60, Number(msgsPorSegundo) || 1))} msg/s por instância` : `delay ${lo}-${hi}s`;
      const tplLinha = variantesGroups.length > 1
        ? `${variantesGroups.length} templates alternados (${variantesGroups.map((g) => g.nome).join(", ")})`
        : `template "${template.nome_template}"`;
      const acaoLinha = agendarParaISO
        ? `Agendar ${tplLinha} para iniciar em ${new Date(agendarParaISO).toLocaleString("pt-BR")}`
        : `Disparar ${tplLinha}`;
      if (!confirm(
        `${bloco}${acaoLinha} para ${recipientsDedup.length} contatos em ${instanciasComCota.length} instância(s), com ${delayLinha}?\nPrimeiro destino final: ${normalizeTelKey(recipientsDedup[0].telefone)}` +
        (validarNoEnvio ? `\n\n🔎 A checagem de WhatsApp será feita durante o envio pelos números UAZAPI conectados.` : "") +
        (dedup.duplicados > 0 ? `\n\n🔁 ${dedup.duplicados} duplicado(s) já foram removidos.` : "")
      )) return;
    }

    let permitirReenvioRecente = false;
    if (jaRecebidos.total > 0) {
      const escolhaReenvio = await pedirConfirmacaoReenvio(
        recipientsDedup.length,
        jaRecebidos.total,
        jaRecebidos.dias,
        jaRecebidos.lista,
      );
      if (escolhaReenvio === "cancelar") return;
      permitirReenvioRecente = escolhaReenvio === "todos";
    }


    // Gate universal para modo rajada — vale para todos os caminhos acima
    if (modoRajada) {
      const digitou = prompt(`RAJADA CONTROLADA — confirma o disparo com limite de ${Math.max(1, Math.min(60, Number(msgsPorSegundo) || 1))} msg/s por instância?\nDigite RAJADA (maiúsculas) para prosseguir:`);
      if ((digitou || "").trim() !== "RAJADA") { toast.error("Confirmação cancelada"); return; }
    }



    // Mapa instância -> template_id específico daquela instância (mesmo nome/idioma)
    const templateIdByInstance: Record<string, string> = {};
    for (const r of templateGroup.rows) {
      if (r.status === "approved" && instanciasComCota.includes(r.instancia_id)) {
        templateIdByInstance[r.instancia_id] = r.id;
      }
    }

    // Variação de templates: cada variante leva seu próprio mapa instância -> template_id
    const templateVariantes = variantesGroups.map((g) => {
      const byInst: Record<string, string> = {};
      for (const r of g.rows) {
        if (r.status === "approved" && instanciasComCota.includes(r.instancia_id)) {
          byInst[r.instancia_id] = r.id;
        }
      }
      return {
        template_id: g.sample.id,
        nome_template: g.nome,
        template_id_by_instance: byInst,
        credor: templatePorCredor ? credorDoTemplate(g.nome) : null,
      };
    });

    // ⚠️ Confirmação de risco — números com qualidade baixa marcados à mão
    const arriscadas = instanciasComCota
      .map((id) => instancias.find((i) => i.id === id))
      .filter((i): i is Instancia => !!i && ["YELLOW", "RED"].includes((i.saude_quality || "").toUpperCase()))
      .map((i) => ({
        id: i.id,
        nome: i.nome || i.display_phone || i.id,
        qualidade: (i.saude_quality || "").toUpperCase(),
      }));
    const okRisco = liberacaoTotalThiago || await pedirConfirmacaoRisco(arriscadas);
    if (!okRisco) { toast.error("Envio cancelado"); return; }

    // ✅ Confirmação de custo — mostra R$ estimado e exige digitação do valor

    const okCusto = await pedirConfirmacaoCusto(
      clientesFinal.map((c) => c.telefone),
      instanciasComCota,
      templateGroup.categoria,
    );
    if (!okCusto) return;

    const hasVars = Object.keys(varsByTel).length > 0;
    const varKey = (tel: string) => {
      const d = String(tel || "").replace(/\D/g, "");
      return d.length >= 8 ? d.slice(-8) : d;
    };
    const credorPadrao = credor === "__none__" ? null : credor;
    const clientesComVars: ClienteRow[] = clientesFinal.map((c) => {
      const k = varKey(c.telefone);
      const v = recipientRoles.length ? c.vars : hasVars ? varsByTel[k] : undefined;
      const credLinha = credorByTel[k] ?? credorPadrao ?? null;
      const out: ClienteRow = { ...c };
      if (v) out.vars = v;
      if (templateTemBotaoUrlDinamico) out.vars = snapshotMetaButtonVars(out.vars, buttonUrl.trim());
      if (campaignImage?.templateKey === templateId) out.vars = {
        ...(out.vars || {}), _campaign_image_path: campaignImage.path,
        _campaign_image_template: `${templateGroup.nome}|${templateGroup.idioma}`,
      };
      if (credLinha) out.credor = credLinha;
      return out;
    });

    if (parceiroMeta && folderId === "__default__") {
      toast.error("Escolha a caixa de mensagens antes de iniciar a campanha.");
      return;
    }
    setIniciandoCampanha(true);
    const jobIdCriado = await iniciar({
      template: { id: template.id, nome_template: template.nome_template },
      instanciaIds: instanciasComCota,
      instancias: instancias.map((i) => ({ id: i.id, nome: i.nome })),
      clientes: clientesComVars,
      minSec: lo,
      maxSec: hi,
      semWhatsapp: semWa,
      erroValidacao: erroVal,
      templateIdByInstance,
      templateVariantes: templateVariantes.length > 1 ? templateVariantes : undefined,

      nomeCampanha: nomeCampanha.trim() || undefined,
      folderId: folderId === "__default__" ? null : folderId,
      modoRajada,
      msgsPorSegundo: modoRajada ? Math.max(1, Math.min(60, Number(msgsPorSegundo) || 1)) : undefined,
      agendarPara: agendarParaISO,
      credor: credorPadrao,
      riscoQualidadeConfirmado: arriscadas.length > 0,
      permitirReenvioRecente,
      validarNoEnvio,
      custoEstimativa: custoEstimativaRef.current || undefined,


      onAfterEnvio: () => {
        carregar();
      },
    });
    setIniciandoCampanha(false);

    // Só confirma (e limpa o formulário) quando a campanha existe de verdade.
    // Se falhou, o motivo real já foi exibido e os destinatários continuam na tela.
    if (!jobIdCriado) return;

    setRecipientsRaw("");
    setRecipientsHeaders([]);
    setRecipientRoles([]);
    setImportedTemplateKey("");
    setVarsByTel({});
    setCredorByTel({});
    setValidacaoPreview(null);
    setNomeCampanha("");
    setTimeout(() => { refreshStatus(); }, 1500);
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
    if (agendarParaISO) {
      toast.success(`Campanha agendada para ${new Date(agendarParaISO).toLocaleString("pt-BR")}. Acompanhe no botão Campanhas.`);
      setAgendamento({ ativo: false, data: "", hora: "" });
    } else {
      toast.success("Campanha iniciada. Acompanhe no botão Campanhas.");
    }
  };

  const enviarTeste = async () => {
    if (imageUploading) return toast.info('Aguarde o carregamento da imagem.');
    if (!template || !templateGroup) return toast.error("Selecione um template aprovado");
    if (instanciaIds.length === 0) return toast.error("Marque ao menos uma instância no card 2");
    const dedup = dedupRecipientsRaw(recipientsRaw, isentosDedup);
    const rows = parseRecipients(dedup.texto, isentosDedup, recipientRoles);
    if (rows.length === 0) return toast.error("Cole ao menos um destinatário");
    if (templateTemBotaoUrlDinamico && !(await salvarButtonUrl())) return;

    // usa 1ª instância marcada + 1º destinatário
    const instId = instanciaIds[0];
    const instInfo = instancias.find((i) => i.id === instId);
    const tplId = templateIdByInstance[instId];
    if (!tplId) return toast.error("Este template ainda não está aprovado nessa instância.");
    const cliente = rows[0];
    if (campaignImage?.templateKey === templateId) cliente.vars = {
      ...(cliente.vars || {}), _campaign_image_path: campaignImage.path,
      _campaign_image_template: `${templateGroup.nome}|${templateGroup.idioma}`,
    };

    setEnviandoTeste(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-meta", {
        body: { template_id: tplId, instancia_id: instId, cliente, modo_teste: true, liberacao_total_parceiro: liberacaoTotalThiago, button_url: buttonUrl.trim() || undefined },
      });
      if (error) {
        const response = 'context' in error ? (error as { context?: Response }).context : undefined;
        const details = response ? await response.clone().json().catch(() => null) : null;
        throw new Error(details?.error || error.message);
      }
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

      <EnviosTotaisCards />





      <div className="grid md:grid-cols-2 gap-6">
        {/* Template */}
        <Card>
          <CardHeader>
            <CardTitle>1. Template HSM</CardTitle>
            <CardDescription>
              Templates de Utilidade
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {templateGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {loading ? "Carregando templates..." : "Nenhum template de Utilidade cadastrado disponível."}
              </p>
            ) : (
              <TemplateFavoriteSelect
                tipo="meta"
                searchContent
                searchPlaceholder="Pesquisar por nome ou conteúdo"
                value={templateId}
                onValueChange={setTemplateId}
                options={templateGroups.map((group) => ({
                  value: group.key,
                  nome: group.nome,
                  idioma: group.idioma,
                  descricao: group.sample.body_text?.trim() || "Texto do template indisponível — sincronize com a Meta",
                  meta: <>
                    {group.categoria && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{group.categoria === "UTILITY" ? "Utilidade" : group.categoria}</Badge>}
                    <Badge variant={group.todasInstanciasAprovadasIds.size === 0 ? "outline" : "secondary"} className="text-[10px] px-1.5 py-0 whitespace-normal">
                      {group.todasInstanciasAprovadasIds.size ? `${group.todasInstanciasAprovadasIds.size} instâncias com este template aprovado` : 'Nenhuma instância com este template aprovado'}
                    </Badge>
                  </>,
                }))}
              />
            )}

            {templateGroup && <div className="space-y-2">
              <TemplateApprovedInstances count={instanciasGreenAprovadasIds.length} disabled={loading || ativandoPoolTodos || ativandoPoolId !== null} onSelect={() => {
                setInstanciaIds(instanciasGreenAprovadasIds);
                setBmFiltro([]);
                setQualidadeFiltro([]);
              }} />
              {instanciaIds.length > 0 && <p className="text-xs text-muted-foreground">{templateGroup.instanciasAprovadasIds.size} de {instanciaIds.length} selecionadas com aprovação</p>}
            </div>}
            <Button size="sm" variant="outline" disabled={loading} onClick={carregar}>
              <RefreshCw className="h-3 w-3 mr-1" /> Atualizar disponibilidade
            </Button>
            {/* Variação de templates — só templates com a MESMA quantidade de variáveis */}
            {templateGroup && (
              <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium">Variação de templates (opcional)</p>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {templateGroup.varsCount} variável{templateGroup.varsCount === 1 ? "" : "is"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Marque outros templates para alternar a cada disparo. Só aparecem templates com a mesma
                  quantidade de variáveis do principal.
                </p>
                {variantesCompativeis.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">
                    Nenhum outro template com {templateGroup.varsCount} variável{templateGroup.varsCount === 1 ? "" : "is"} nas instâncias selecionadas.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-44 overflow-y-auto">
                    {variantesCompativeis.map((g) => {
                      const marcado = variantesExtraKeys.includes(g.key);
                      const ok = g.instanciasAprovadasIds.size;
                      return (
                        <label
                          key={g.key}
                          className="flex items-center gap-2 text-sm cursor-pointer rounded px-1.5 py-1 hover:bg-muted"
                        >
                          <Checkbox checked={marcado} onCheckedChange={() => toggleVariante(g.key)} />
                          <span className="truncate flex-1">{g.nome}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                            {ok}/{instanciaIds.length} inst.
                          </Badge>
                        </label>
                      );
                    })}
                  </div>
                )}
                {variantesGroups.length > 1 && (
                  <p className="text-xs text-primary">
                    {templatePorCredor
                      ? "Roteamento automático pela coluna Credor: UME → template _ume · Novo Mundo → template padrão"
                      : `${variantesGroups.length} templates selecionados · ${templateGroup.varsCount} variável${templateGroup.varsCount === 1 ? "" : "is"} · alternando a cada envio`}
                  </p>
                )}
              </div>
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
                      Este template não está aprovado em {faltantesAptas.length} instância(s) ativa(s) selecionada(s):
                    </p>
                    {faltantesIgnoradas > 0 && <p className="text-xs mt-1">{faltantesIgnoradas} banida(s), bloqueada(s) ou desconectada(s) ignorada(s) — remova-as da seleção.</p>}
                    <ul className="list-disc ml-5 mt-1">
                      {faltantesAptas.map((i) => (
                        <li key={i.id}>{i.nome} — {templateGroup ? situacaoUtility(templateGroup, i.id, filaTemplate[i.id]) : "Ausente"}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs">
                      O envio está bloqueado para evitar erros. Você pode aplicar este template nessas
                      instâncias, removê-las da seleção ou sincronizar/aprovar o template nelas.
                    </p>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        disabled={injetandoTemplate || !isAdmin || !templateGroup.mestreId}
                        onClick={async () => {
                          const mestreId = templateGroup?.mestreId;
                          if (!mestreId || aplicacaoRef.current) return;
                          const ids = faltantesAptas.map(i => i.id);
                          aplicacaoRef.current = true;
                          setInjetandoTemplate(true);
                          setResultadosAplicacao([]);
                          setAplicacaoProgress({ done: 0, total: ids.length });
                          const invoke = async (name: string, body: unknown) => {
                            const { data, error } = await supabase.functions.invoke(name, { body });
                            if (error) {
                              const response = "context" in error ? (error as { context?: Response }).context : undefined;
                              const details = response ? await response.clone().json().catch(() => null) : null;
                              throw new Error(details?.error || error.message);
                            }
                            if (!data || data.success !== true) throw new Error(data?.error || "Não foi possível confirmar a aplicação.");
                            return data;
                          };
                          try {
                            // The submission function synchronizes each number before creating a copy.
                            const results = await applyManualTemplate(mestreId, ids,
                              body => invoke("meta-criar-template-lote", body),
                              async deferredIds => {
                                const response = await invoke("meta-templates-onboarding-enfileirar", {
                                  instancia_ids: deferredIds, mestre_id: mestreId,
                                  template_nome: templateGroup.nome, idioma: templateGroup.idioma,
                                  manual_defer: true,
                                });
                                const failed = response.instancias?.find((r: any) => !r.ok);
                                if (failed) throw new Error(failed.erro || failed.motivo || "Falha ao manter a aplicação na fila.");
                              },
                              (results, done, total) => {
                                setResultadosAplicacao(results);
                                setAplicacaoProgress({ done, total });
                                const queue = Object.fromEntries(results.filter(r => ['PENDENTE', 'ENVIADO', 'FALHA_ENVIO'].includes(r.status)).map(r => [r.instancia_id, r.status]));
                                setFilaTemplate(prev => ({ ...prev, ...queue }));
                              });
                            const started = results.filter(r => r.status === 'ENVIADO').length;
                            const deferred = results.filter(r => r.status === 'PENDENTE').length;
                            const failed = results.filter(r => r.status === 'FALHA_ENVIO').length;
                            const summary = `${results.length} conferidas • ${started} aplicações iniciadas • ${deferred} na fila • ${failed} não aplicadas`;
                            if (failed) toast.warning(summary); else toast.success(summary);
                            await carregar();
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Falha ao aplicar o template.");
                          } finally {
                            aplicacaoRef.current = false;
                            setInjetandoTemplate(false);
                          }
                        }}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        {injetandoTemplate ? `Aplicando ${aplicacaoProgress.done}/${aplicacaoProgress.total}...` : "Aplicar nas instâncias selecionadas"}
                      </Button>

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
                    {!isAdmin && <p className="mt-2 text-xs">Somente administradores podem aplicar modelos.</p>}
                    {!templateGroup.mestreId && <p className="mt-2 text-xs">Cadastre este modelo na aba Template com seu usuário para aplicá-lo.</p>}

                  </div>
                </div>
              </div>
            )}

            {resultadosAplicacao.length > 0 && (
              <div className="mt-3 text-sm" role="status" aria-label="Resultado da aplicação">
                <p className="font-medium">Aplicação de templates — {aplicacaoProgress.done}/{aplicacaoProgress.total} conferidas</p>
                <p className="text-xs text-muted-foreground">Aplicação 24 horas, inclusive domingos; aprovação depende da Meta. Tier 250: até dois templates por número/dia.</p>
                <ul className="mt-2 max-h-64 overflow-y-auto space-y-1">
                  {resultadosAplicacao.map(r => <li key={r.instancia_id}>
                    {instancias.find(i => i.id === r.instancia_id)?.nome || "Instância"}: {motivoAplicacao(r.motivo || r.status)}
                  </li>)}
                </ul>
              </div>
            )}

            {template && (
              <div className="mt-2">
                {templateHasImage(template) && <CampaignImagePicker key={templateId} userId={user?.id || ''} templateKey={templateId} value={campaignImage} onChange={setCampaignImage} onBusyChange={setImageUploading} />}
                <TemplateWhatsAppPreview
                  template={template}
                  sampleVariables={importedTemplateKey === templateId ? recipients[0]?.vars : undefined}
                  preserveEmptyPlaceholders
                  imageUrlOverride={
                    (campaignImage?.templateKey === templateId ? campaignImage.url : undefined) || templates
                      .filter((t: any) => t.nome_template === templateGroup?.nome && t.idioma === templateGroup?.idioma)
                      .map((t: any) => t?.variaveis?._header_image_url)
                      .find((u: any) => typeof u === 'string' && u.trim().length > 0) || masterMediaUrl
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
                  <Button type="button" size="sm" variant="outline" disabled={!template.id} onClick={() => setEditVarsOpen(true)}>
                    <Pencil className="h-3 w-3 mr-1" /> Editar variáveis
                  </Button>
                </div>
                <p>
                  Campos disponíveis:
                  <code className="ml-1">{"{nome} {primeiro_nome} {cpf} {atraso} {saldo} {avista} {parcelado}"}</code>
                </p>
              </div>
            )}

            {template && templateTemBotaoUrlDinamico && (
              <div className="rounded-md border p-3 space-y-2">
                <Label htmlFor="button-url-dinamica" className="text-xs font-medium">
                  Link do botão (URL dinâmica)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="button-url-dinamica"
                    value={buttonUrl}
                    onChange={(e) => setButtonUrl(e.target.value)}
                    placeholder="https://exemplo.com/pagina"
                    className="h-8 text-xs font-mono"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs shrink-0"
                    disabled={salvandoButtonUrl || !template.id}
                    onClick={async () => {
                      if (await salvarButtonUrl()) toast.success('Link atualizado para os próximos envios e mensagens pendentes.');
                    }}
                  >
                    {salvandoButtonUrl ? "Salvando..." : "Salvar link"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Este template tem um botão com link dinâmico. O endereço acima será enviado no botão e fica salvo para os próximos envios.
                </p>
                <WhatsappLinkGenerator onGerar={setButtonUrl} />
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
                    {instanciaIds.length} de {nationalInstanceCount(instancias)} selecionadas
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
            <div className="flex items-center justify-between gap-3 pr-8">
              <DialogTitle>Instâncias</DialogTitle>
              {(isAdmin || parceiroMeta) && (
                <Button
                  type="button"
                  size="sm"
                  onClick={ativarTodosNoPool}
                  disabled={ativandoPoolTodos || instancias.length === 0}
                >
                  {ativandoPoolTodos ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Power className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Ativar pool
                </Button>
              )}
            </div>
            <DialogDescription>Marque as instâncias para distribuir em round-robin.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="outline"
              title={qualidadeFiltro.length > 0
                ? "Seleciona apenas instâncias nacionais não banidas visíveis no filtro de qualidade atual."
                : "Seleciona instâncias nacionais GREEN ou sem qualidade confirmada, excluindo banidas. Nacionais YELLOW e RED continuam disponíveis para seleção manual."}
              disabled={instanciasElegiveisSelecaoMassa.length === 0}
              onClick={() => {
                const idsVisiveis = instanciasVisiveis.map((i) => i.id);
                const idsElegiveis = instanciasElegiveisSelecaoMassa.map((i) => i.id);
                const todasMarcadas = idsElegiveis.length > 0 && idsElegiveis.every((id) => instanciaIds.includes(id));
                if (todasMarcadas) {
                  setInstanciaIds((prev) => prev.filter((id) => !idsVisiveis.includes(id)));
                } else {
                  setInstanciaIds((prev) => nationalSelectionIds(Array.from(new Set([...prev, ...idsElegiveis])), instancias));
                }
              }}
            >
              {instanciasElegiveisSelecaoMassa.length > 0 && instanciasElegiveisSelecaoMassa.every((i) => instanciaIds.includes(i.id))
                ? "Limpar seleção"
                : "Selecionar todas"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={verificarSaude} disabled={checandoSaude || instancias.length === 0}>
              {checandoSaude ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <HeartPulse className="h-3.5 w-3.5 mr-1.5" />}
              Verificar saúde
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={sincronizarPerfis} disabled={sincronizandoPerfis || instancias.length === 0}>
              {sincronizandoPerfis ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Sincronizar perfis
            </Button>
            <BmInstanceFilter
              selected={bmFiltro}
              onChange={setBmFiltro}
              bms={bmsDisponiveis.map((bm) => {
                const c = bm.id === SEM_BM ? null : cotaDaBm(bm.id);
                return {
                  ...bm,
                  exhausted: bm.id !== SEM_BM && bmSemSaldo(bm.id),
                  summary: c
                    ? c.tier_ilimitado ? `${bm.qtd} • ∞` : `${bm.qtd} • ${c.enviados_24h}/${c.tier_diario}`
                    : bm.qtd,
                };
              })}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="outline">
                  <Gauge className="h-3.5 w-3.5 mr-1.5" />
                  {qualidadeFiltro.length > 0 ? `Qualidade (${qualidadeFiltro.length})` : "Qualidade"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Qualidade da instância</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {([
                  { id: "GREEN", label: "GREEN" },
                  { id: "YELLOW", label: "YELLOW" },
                  { id: "RED", label: "RED" },
                  { id: "SEM_QUALIDADE", label: "Sem qualidade (sem leitura)" },
                ]).map((q) => {
                  const n = qualidadesDisponiveis[q.id] || 0;
                  return (
                    <DropdownMenuCheckboxItem
                      key={q.id}
                      checked={qualidadeFiltro.includes(q.id)}
                      onCheckedChange={() =>
                        setQualidadeFiltro((prev) =>
                          prev.includes(q.id) ? prev.filter((x) => x !== q.id) : [...prev, q.id],
                        )
                      }
                      onSelect={(e) => e.preventDefault()}
                    >
                      <span>{q.label}</span>
                      <span className="ml-auto pl-2 text-xs text-muted-foreground">{n}</span>
                    </DropdownMenuCheckboxItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setQualidadeFiltro([]); }}>
                  Limpar filtro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          </div>

          {liberacaoTotalThiago && (
            <div className="rounded-md border border-warning/50 bg-warning/10 p-3 text-xs text-foreground flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-warning" />
              <span>Todas as suas instâncias estão liberadas para tentativa. Os alertas continuam visíveis e a Meta ainda pode recusar o envio.</span>
            </div>
          )}

          <div className="overflow-auto flex-1 -mx-1 px-1">
          {!liberacaoTotalThiago && instanciaIds.length > 0 && instanciaIds.every((id) => (instancias.find((x) => x.id === id)?.estado_pool || "aguardando_templates") !== "ativo") && (
            <div className="mb-3 rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium mb-0.5">Nenhuma instância marcada está ativa no pool</div>
                <div>Essas instâncias continuam selecionadas, mas precisam ter o pool ativado antes do disparo.</div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {instanciasVisiveis.map((i) => {
              const isEditing = editingId === i.id;
              const nacional = isBrazilianInstance(i);
              const banida = isBannedInstance(i);
              const cotaBm = cotaDaBm(i.meta_bm_id);
              const semSaldoBm = bmSemSaldo(i.meta_bm_id);
              return (
              <label key={i.id} className={`flex items-center gap-3 p-2 rounded border hover:bg-muted/40 cursor-pointer ${semSaldoBm ? "border-destructive/50" : ""}`}>
                <Checkbox
                  checked={instanciaIds.includes(i.id)}
                  disabled={!nacional || banida || ativandoPoolTodos || ativandoPoolId === i.id}
                  aria-label={`Selecionar ${i.nome}`}
                  onCheckedChange={() => toggleInstancia(i)}
                />

                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarImage src={i.meta_profile_pic_url || undefined} alt={`Foto de perfil de ${i.meta_verified_name || i.nome}`} />
                  <AvatarFallback className="text-[11px]">
                    {(i.meta_verified_name || i.nome || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  {!nacional && <Badge variant="secondary">{instanceDisplayPhone(i) ? "Fora da seleção nacional" : "Telefone não identificado"}</Badge>}
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
                        {i.display_phone ? `${i.display_phone} • ` : ""}BM: {i.meta_bm_id ? (bmNomes[i.meta_bm_id] || "—") : "não vinculada"}
                        {cotaBm
                          ? ` • ${cotaBm.tier_ilimitado ? `${cotaBm.enviados_24h} enviadas (BM ilimitada)` : `${cotaBm.enviados_24h}/${cotaBm.tier_diario} da BM em 24h`}`
                          : " • sem cota de BM"}
                      </div>
                      {i.observacao && <div className="text-xs text-muted-foreground break-words mt-1">Observação: {i.observacao}</div>}
                      {(i.saude_status || i.saude_quality) && (
                        <div className="flex flex-wrap gap-1 mt-1 items-center">
                          <SaudeBadgeStatus status={i.saude_status} />
                          <SaudeBadgeQuality quality={i.saude_quality} />
                          {i.pool_fora_manual && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                              <Ban className="h-3 w-3" /> Fora do pool manualmente
                            </Badge>
                          )}
                           {!i.pool_fora_manual && i.estado_pool === "ativo" && (
                             <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/50 text-green-700 dark:text-green-400">
                               <CheckCircle2 className="h-3 w-3" /> Pronta para envio
                             </Badge>
                           )}
                           {!i.pool_fora_manual && i.estado_pool === "restrita" && (
                             <Badge variant="destructive" className="text-[10px] px-1.5 py-0 max-w-[360px] whitespace-normal" title={i.pausa_automatica_motivo || undefined}>
                               <Ban className="h-3 w-3" /> {i.pausa_automatica_motivo || "Restrição confirmada pela Meta"}
                             </Badge>
                           )}
                          {["YELLOW", "RED"].includes((i.saude_quality || "").toUpperCase()) && instanciaIds.includes(i.id) && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> RISCO — precisa confirmar
                            </Badge>
                          )}

                          {i.saude_tier && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{i.saude_tier}</Badge>}
                          {String(i.meta_name_status || "").toUpperCase() === "REJECTED" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Nome REJECTED — tentativa permitida
                            </Badge>
                          )}
                          {banida && (
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
                  <div className="flex max-w-[280px] flex-wrap items-center justify-end gap-1">
                    <Badge
                      variant={semSaldoBm ? "destructive" : "secondary"}
                      title={cotaBm ? `Cota compartilhada da BM ${cotaBm.nome} (janela de 24h)` : "Instância sem BM vinculada"}
                    >
                      {!cotaBm
                        ? "sem BM"
                        : cotaBm.tier_ilimitado
                          ? "ilimitado"
                          : `${cotaBm.restantes} restantes (BM)`}
                    </Badge>
                    {(isAdmin || parceiroMeta) && (i.pool_fora_manual || (i.estado_pool || "aguardando_templates") !== "ativo") && (
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="h-7 px-2 text-xs"
                        disabled={ativandoPoolTodos || ativandoPoolId === i.id}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); ativarNoPool(i); }}
                        title={i.pool_fora_manual ? "Verificar saúde na Meta e ativar o pool" : i.estado_pool === "pausado" ? "Retomar envio pelo pool" : "Ativar esta instância no pool (Dia 1 = 20 msg)"}
                      >
                        {ativandoPoolId === i.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Power className="h-3.5 w-3.5 mr-1" />
                            {i.estado_pool === "pausado" && !i.pool_fora_manual ? "Retomar Pool" : "Ativar Pool"}
                          </>
                        )}
                      </Button>
                    )}
                    {(isAdmin || parceiroMeta) && !i.pool_fora_manual && (i.estado_pool || "aguardando_templates") === "ativo" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={ativandoPoolTodos || ativandoPoolId === i.id}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); retirarDoPool(i); }}
                        title="Desativar esta instância no pool sem alterar a seleção da campanha"
                      >
                        {ativandoPoolId === i.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <><PowerOff className="h-3.5 w-3.5 mr-1" /> Desativar Pool</>
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
                  </div>
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
                Uma linha por contato, com as informações separadas por vírgula. Ao pressionar <strong>Enter</strong>, você poderá definir o que representa cada informação.
                A importação Excel usa o mesmo mapeamento (Telefone, Nome, CPF/CNPJ, Credor, Atraso, Saldo e variáveis do template). O CPF/CNPJ e o Credor vêm obrigatórios por padrão.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={cpfObrigatorio ? "default" : "outline"}
                onClick={() => setCpfObrigatorio((v) => !v)}
                title={cpfObrigatorio
                  ? "CPF obrigatório: a importação exige uma coluna marcada como CPF / CNPJ"
                  : "CPF opcional: a importação aceita planilha sem coluna de CPF"}
              >
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                {cpfObrigatorio ? "CPF obrigatório" : "CPF opcional"}
              </Button>

              <Button
                type="button"
                size="sm"
                variant={credorObrigatorio ? "default" : "outline"}
                onClick={() => setCredorObrigatorio((v) => !v)}
                title={credorObrigatorio
                  ? "Credor obrigatório: a importação exige uma coluna marcada como Credor (UME ou Novo Mundo)"
                  : "Credor opcional: a importação aceita planilha sem coluna de Credor"}
              >
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                {credorObrigatorio ? "Credor obrigatório" : "Credor opcional"}
              </Button>




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
                        <th key={i} className="text-left px-2 py-1.5 border-b min-w-[190px] max-w-[300px] whitespace-normal font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recipientRecordLines(recipientsRaw).map((linha, ri) => {
                      const cells = splitLinhaEnvio(linha);
                      return (
                        <tr key={ri} className="border-b last:border-0 hover:bg-muted/40">
                          {recipientsHeaders.map((_, ci) => (
                            <td key={ci} className="px-2 py-2 align-top min-w-[190px] max-w-[300px] whitespace-pre-wrap break-words" title={cells[ci] || ""}>
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

                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
                  const linhas = recipientRecordLines(recipientsRaw);
                  const ultimaLinha = linhas[linhas.length - 1] || "";
                  if (!ultimaLinha || !/[,;\t]/.test(ultimaLinha)) return;
                  e.preventDefault();
                  setMapDlg({
                    open: true,
                    rows: linhas.map((linha) => splitLinhaEnvio(linha)),
                    origem: "manual",
                  });
                }}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  if (!text) return;
                  const lines = recipientRecordLines(text);
                  if (lines.length === 0) return;
                  const isExcel = lines.some((line) => line.includes("\t"));
                  const rows = lines.map((line) => isExcel
                    ? line.split("\t").map((cell) => cell.trim())
                    : splitLinhaEnvio(line));
                  const hasMultipleColumns = isExcel || rows.some((row) => row.length > 1);
                  if (hasMultipleColumns) {
                    e.preventDefault();
                    const existingLines = recipientRecordLines(recipientsRaw);
                    const allRows = [...existingLines.map(l => splitLinhaEnvio(l)), ...rows];
                    setMapDlg({
                      open: true,
                      rows: allRows,
                      origem: existingLines.length > 0 ? "manual" : "clipboard",
                    });
                  } else {
                    e.preventDefault();
                    const textarea = e.currentTarget;
                    const selectionStart = textarea.selectionStart ?? recipientsRaw.length;
                    const selectionEnd = textarea.selectionEnd ?? selectionStart;
                    const textoComColagem = `${recipientsRaw.slice(0, selectionStart)}${text}${recipientsRaw.slice(selectionEnd)}`;
                    const linhasComColagem = recipientRecordLines(textoComColagem);
                    void removerSemWhatsAppConhecidos(linhasComColagem).then(({ linhas: filtradas, removidos }) => {
                      setRecipientsRaw(filtradas.join("\n"));
                      setValidacaoPreview(null);
                      if (removidos > 0) toast.warning(`${removidos} removido(s): já confirmados sem WhatsApp`);
                    }).catch(() => toast.error("Não foi possível consultar a blacklist de números sem WhatsApp"));
                  }
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




      {/* Agendamento por data e hora */}
      <AgendarCampanhaBox
        value={agendamento}
        onChange={setAgendamento}
      />


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

          <div className="rounded-md border p-3 flex items-start justify-between gap-3">
            <div className="text-sm">
              <div className="font-semibold flex items-center gap-2">
                <Ban className="h-4 w-4 text-destructive" /> Bloquear Blacklist
              </div>
              <div className="text-xs text-muted-foreground">
                Não dispara para contatos que pediram bloqueio (clicaram em "Bloquear contato" no template).
                Recomendado manter ativado.
              </div>
            </div>
            <Switch
              checked={blacklistAtiva}
              disabled={salvandoBlacklist}
              onCheckedChange={(v) => salvarBlacklistAtiva(v)}
            />
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
                {parceiroMeta ? (
                  <SelectItem value="__default__" disabled>Escolha uma das suas caixas</SelectItem>
                ) : (
                  <SelectItem value="__default__">Caixa padrão (visível para a equipe)</SelectItem>
                )}
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
            {parceiroMeta && folderId === "__default__" && (
              <p className="text-xs text-destructive">Escolha a caixa de mensagens para iniciar a campanha.</p>
            )}
            <p className="text-xs text-muted-foreground">
              As conversas geradas por esta campanha aparecerão apenas na caixa selecionada do Inbox Meta.
            </p>
          </div>




          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={enviar} disabled={preparandoDisparo || imageUploading || validando || enviandoTeste || iniciandoCampanha || motivosBloqueio.length > 0 || (parceiroMeta && folderId === "__default__")} size="lg">
              {preparandoDisparo || validando || iniciandoCampanha
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : agendamento.ativo
                  ? <CalendarClock className="h-4 w-4 mr-2" />
                  : <Send className="h-4 w-4 mr-2" />}
              {iniciandoCampanha
                ? "Revalidando instâncias na Meta..."
                : preparandoDisparo
                  ? "Carregando..."
                : validando
                  ? "Validando WhatsApp..."
                : `${agendamento.ativo ? "Agendar" : "Disparar"} ${recipients.length > 0 ? `(${recipients.length})` : ""}`}
            </Button>
          </div>
          {motivosBloqueio.length > 0 && (
            <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
              {motivosBloqueio.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}


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
      open={reenvioDlg.open}
      onOpenChange={(open) => {
        if (!open && reenvioDlg.resolver) {
          reenvioDlg.resolver("cancelar");
          setReenvioDlg((prev) => ({ ...prev, open: false, resolver: null }));
        }
      }}
    >
      <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-2xl overflow-hidden">
        <AlertDialogHeader className="min-w-0">
          <AlertDialogTitle>Contatos acionados recentemente</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="w-full min-w-0 space-y-3 pt-2">
              <p>
                {reenvioDlg.recentes.toLocaleString("pt-BR")} de {reenvioDlg.total.toLocaleString("pt-BR")} contato(s) já receberam mensagem nos últimos {reenvioDlg.dias} dia(s).
              </p>
              <div className="box-border w-full min-w-0 rounded-md border bg-muted/30 p-3 text-sm grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                <span className="min-w-0">Enviar para todos</span><strong className="text-right text-foreground">{reenvioDlg.total.toLocaleString("pt-BR")}</strong>
                <span className="min-w-0">Ignorar os recentes</span><strong className="text-right text-foreground">{Math.max(0, reenvioDlg.total - reenvioDlg.recentes).toLocaleString("pt-BR")}</strong>
              </div>
              <p className="text-xs text-muted-foreground">Escolha se deseja reenviar também para esses contatos ou manter a proteção contra repetição.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-wrap gap-2 sm:justify-between sm:space-x-0">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={!reenvioDlg.recentesLista.length}
              onClick={() => void baixarRecentes()}
              title="Baixar Excel com os números que já receberam mensagem recentemente"
            >
              <Download className="mr-1.5 h-4 w-4" />
              Baixar números
            </Button>
            <AlertDialogCancel
              onClick={() => {
                reenvioDlg.resolver?.("cancelar");
                setReenvioDlg((prev) => ({ ...prev, open: false, resolver: null }));
              }}
            >
              Cancelar
            </AlertDialogCancel>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                reenvioDlg.resolver?.("ignorar");
                setReenvioDlg((prev) => ({ ...prev, open: false, resolver: null }));
              }}
            >
              Ignorar recentes
            </Button>
            <AlertDialogAction
              onClick={() => {
                reenvioDlg.resolver?.("todos");
                setReenvioDlg((prev) => ({ ...prev, open: false, resolver: null }));
              }}
            >
              Enviar para todos
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog
      open={riscoDlg.open}
      onOpenChange={(o) => {
        if (!o && riscoDlg.resolver) {
          riscoDlg.resolver(false);
          setRiscoDlg((p) => ({ ...p, open: false, resolver: null }));
        }
      }}
    >
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            ⚠️ Números com qualidade baixa na seleção
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2">
              <div className="text-sm">
                Você marcou {riscoDlg.numeros.length} número(s) que não estão com qualidade GREEN.
                Enviar por eles aumenta o risco de queda de qualidade, bloqueio ou banimento pela Meta.
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1 max-h-48 overflow-auto">
                {riscoDlg.numeros.map((n) => (
                  <div key={n.id} className="flex justify-between gap-2">
                    <span className="truncate">{n.nome}</span>
                    <strong className={n.qualidade === "RED" ? "text-red-600" : "text-amber-600"}>{n.qualidade}</strong>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                Se a qualidade cair ainda mais durante a campanha, o número sai do envio automaticamente.
              </div>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={riscoDlg.ciente}
                  onCheckedChange={(v) => setRiscoDlg((p) => ({ ...p, ciente: v === true }))}
                />
                <span>Estou ciente do risco e quero enviar por esses números.</span>
              </label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              riscoDlg.resolver?.(false);
              setRiscoDlg((p) => ({ ...p, open: false, resolver: null }));
            }}
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!riscoDlg.ciente}
            onClick={() => {
              riscoDlg.resolver?.(true);
              setRiscoDlg((p) => ({ ...p, open: false, resolver: null }));
            }}
          >
            Confirmar e continuar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>


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
        firstRowIsData={mapDlg.origem === "manual"}
        requireCredor={credorObrigatorio || templatePorCredor}
        requireCpf={cpfObrigatorio}
        isentosDedup={isentosDedup}
        template={template ? {
          nome_template: template.nome_template,
          body_text: (template as any).body_text || "",
          variaveis: template.variaveis || null,
        } : null}
        onConfirm={async (linhas, stats, novosVars, headers, credByTel, roles) => {
          let linhasFiltradas = linhas;
          let removidosSemWhatsApp = 0;
          try {
            const filtragem = await removerSemWhatsAppConhecidos(linhas);
            linhasFiltradas = filtragem.linhas;
            removidosSemWhatsApp = filtragem.removidos;
          } catch {
            toast.error("Não foi possível consultar a blacklist de números sem WhatsApp");
            return;
          }
          setRecipientsRaw(linhasFiltradas.join("\n"));
          setRecipientsHeaders(headers || []);
          setRecipientRoles(roles || []);
          setImportedTemplateKey(templateId);
          setEditAsText(false);
          setValidacaoPreview(null);
          setVarsByTel(novosVars || {});
          setCredorByTel(credByTel || {});
          const varsCount = Object.keys(novosVars || {}).length;
          toast.success(
            `${linhasFiltradas.length} contato(s) importado(s)` +
            (stats.ignorados ? ` • ${stats.ignorados} ignorado(s)` : "") +
            (stats.duplicados ? ` • 🔁 ${stats.duplicados} duplicado(s) removido(s)` : "") +
            (stats.preservados ? ` • 🟦 ${stats.preservados} linha(s) de números UAZAPI mantidas` : "") +
            (varsCount ? ` • variáveis do template preenchidas em ${varsCount} linha(s)` : "") +
            (removidosSemWhatsApp ? ` • 🚫 ${removidosSemWhatsApp} já confirmados sem WhatsApp removidos` : "")
          );
          // Alerta se esta lista é praticamente a mesma da última campanha criada.
          (async () => {
            const suf = (t: string) => {
              const d = String(t || "").replace(/\D/g, "");
              return d.length >= 8 ? d.slice(-8) : d;
            };
            const nova = new Set(
              linhasFiltradas.map((l) => suf(splitLinhaEnvio(l.trim())[0] || "")).filter(Boolean),
            );
            ultimaListaRef.current = nova;
            if (nova.size === 0) return;
            try {
              const { data: ultimo } = await supabase
                .from("envio_meta_job")
                .select("id, nome_campanha, created_at")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              if (!ultimo?.id) return;
              const antiga = new Set<string>();
              for (let from = 0; from < 20000; from += 1000) {
                const { data, error } = await supabase
                  .from("envio_meta_job_item")
                  .select("telefone")
                  .eq("job_id", ultimo.id)
                  .range(from, from + 999);
                if (error) break;
                (data || []).forEach((r: any) => { const s = suf(r.telefone); if (s) antiga.add(s); });
                if (!data || data.length < 1000) break;
              }
              if (antiga.size === 0) return;
              let iguais = 0;
              nova.forEach((s) => { if (antiga.has(s)) iguais++; });
              const pct = Math.round((iguais / nova.size) * 100);
              if (pct >= 80) {
                toast.error(
                  `⚠️ Esta lista é ${pct}% igual à campanha "${ultimo.nome_campanha || "anterior"}" de ` +
                  `${new Date(ultimo.created_at).toLocaleDateString("pt-BR")}. Confirme se importou o arquivo certo antes de disparar.`,
                  { duration: 20000 },
                );
              }
            } catch { /* alerta apenas */ }
          })();
        }}
      />
      <EditarVariaveisTemplateDialog
        open={editVarsOpen}
        onOpenChange={setEditVarsOpen}
        template={template as any}
        templates={(templateGroup?.rows.filter((r) => r.status === "approved" && instanciaIds.includes(r.instancia_id)) || []) as any}
        onSaved={() => carregar()}
      />


      <Dialog open={!!filtroAcordo} onOpenChange={(o) => { if (!o) setFiltroAcordo(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clientes com acordo em andamento</DialogTitle>
            <DialogDescription>
              {filtroAcordo?.excluidos} cliente(s) retirado(s) porque já têm acordo em andamento (por CPF ou telefone).
              {" "}{filtroAcordo?.restantes} cliente(s) continuam na campanha.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={() => filtroAcordo && XLSX.writeFile(filtroAcordo.wb, `clientes-com-acordo-${new Date().toISOString().slice(0, 10)}.xlsx`)}>
              <Download className="h-4 w-4 mr-2" />Baixar planilha dos retirados
            </Button>
            <Button variant="ghost" onClick={() => setFiltroAcordo(null)}>Cancelar</Button>
            <Button
              disabled={!filtroAcordo || filtroAcordo.restantes === 0}
              onClick={() => {
                if (!filtroAcordo) return;
                setRecipientsRaw(filtroAcordo.novoTexto);
                setFiltroAcordo(null);
                toast.success("Clientes com acordo retirados da lista. Clique em Disparar para iniciar.");
              }}
            >Continuar sem eles</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}


function DetalhesEnvioPainel({ detalhes, deliveryResumo, onRefresh }: {
  detalhes: {
    enviados: { telefone: string; instancia?: string; erro?: string; ts: number; tentativas?: number; deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed'; deliveryErro?: string }[];
    erros: { telefone: string; instancia?: string; erro?: string; ts: number; tentativas?: number }[];
    tentandoNovamente: { telefone: string; instancia?: string; erro?: string; ts: number; tentativas?: number }[];
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
                {(e.tentativas || 0) > 0 && e.deliveryStatus !== 'failed' && (
                  <span className="text-[10px] text-green-600 dark:text-green-400">Entregue após nova tentativa</span>
                )}
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
        titulo="🔄 Tentando novamente"
        cor="text-amber-600"
        count={detalhes.tentandoNovamente.length}
      >
        {detalhes.tentandoNovamente.map((e, i) => (
          <div key={i} className="flex justify-between gap-2 border-b last:border-b-0 py-1">
            <span>{e.telefone}</span>
            <span className="text-muted-foreground">Próxima: {(e.tentativas || 0) + 1}ª tentativa</span>
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
            <div className="text-[10px] font-medium text-red-600">Falha final · {Math.max(1, e.tentativas || 0)} tentativa(s)</div>
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
