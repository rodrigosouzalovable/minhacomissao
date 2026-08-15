import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Trash2, Copy, CheckCircle2, XCircle, X, Power, AlertTriangle, ExternalLink, Pencil, Building2 } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem, DropdownMenuItem } from "@/components/ui/dropdown-menu";

import { MetaHealthStatusRow } from "@/components/meta/SaudeBadges";
import { AppLayout } from "@/components/layout/AppLayout";
import TemplatePreviewDialog from "@/components/meta/TemplatePreviewDialog";
import MetaGuardrailCard from "@/components/meta/MetaGuardrailCard";
import { DollarSign, FileText, CreditCard, Upload } from "lucide-react";
import { useMetaInstancePagamentos } from "@/hooks/useMetaInstancePagamentos";
import { useMetaBillingConciliacao } from "@/hooks/useMetaBillingConciliacao";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserPermissions } from "@/hooks/useUserPermissions";


const PROJECT_REF = "cymdrkeukockakfzjeen";
const WEBHOOK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/meta-whatsapp-webhook`;

type Instancia = {
  id: string;
  nome: string;
  phone_number_id: string;
  waba_id: string;
  business_id: string | null;
  display_phone: string | null;
  access_token: string;
  tier_diario: number;
  enviados_hoje: number;
  ativo: boolean;
  webhook_verify_token: string | null;
  criado_em: string;
  saude_tier?: string | null;
  saude_quality?: string | null;
  saude_status?: string | null;
  saude_ban_info?: any;
  saude_name_status?: string | null;
  saude_checked_at?: string | null;
  messaging_limit_manual?: string | null;
  messaging_limit_source?: string | null;
  messaging_limit_synced_at?: string | null;
  meta_bm_id?: string | null;
  webhook_saude_status?: string | null;
  webhook_saude_verificado_em?: string | null;
  webhook_ultimo_erro?: string | null;
  webhook_perda_suspeita?: any;
  meta_verified_name?: string | null;
  meta_name_status?: string | null;
  meta_profile_pic_url?: string | null;
  meta_profile_about?: string | null;
  meta_perfil_sync_em?: string | null;
};


type BM = {
  id: string;
  nome: string;
  business_id: string | null;
  ativo: boolean;
  padrao: boolean;
};

type Template = {
  id: string;
  instancia_id: string;
  nome_template: string;
  body_text: string | null;
  categoria: string | null;
  idioma: string;
  status: string;
  variaveis: any;
  sincronizado_em: string;
};



export default function ConfigurarMeta() {
  const { parceiroMeta } = useUserPermissions();
  const [instancias, setInstancias] = useState<Instancia[]>([]);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testando, setTestando] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState<string | null>(null);
  const [savingToken, setSavingToken] = useState(false);
  const [verifyToken, setVerifyToken] = useState("");
  const [previewTpl, setPreviewTpl] = useState<Template | null>(null);
  const [bms, setBms] = useState<BM[]>([]);
  const [editPhoneId, setEditPhoneId] = useState<string | null>(null);
  const [editPhoneValue, setEditPhoneValue] = useState("");
  const [verificandoWebhooks, setVerificandoWebhooks] = useState(false);

  // Aba BMs: seleção múltipla de Business Managers
  const [bmPickerOpen, setBmPickerOpen] = useState(false);
  const [bmBusca, setBmBusca] = useState("");
  const [bmSel, setBmSel] = useState<Set<string>>(new Set());
  const toggleBmSel = (key: string) =>
    setBmSel((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  const instanciasFiltradas = (() => {
    if (bmSel.size === 0) return instancias;
    return instancias.filter((i) =>
      (i.meta_bm_id && bmSel.has(i.meta_bm_id)) || (!i.meta_bm_id && bmSel.has("__none__"))
    );
  })();



  // Importação de PDF de fatura Meta
  const pag = useMetaInstancePagamentos();
  const conciliacao = useMetaBillingConciliacao(instancias, pag.pagamentos);
  const [importInstId, setImportInstId] = useState<string | null>(null);
  const [parsingPdf, setParsingPdf] = useState(false);
  const [confirmPag, setConfirmPag] = useState<null | {
    instance_id: string;
    valor_usd: string;
    numero_referencia: string;
    data_transacao: string;
    tipo_documento?: string;
    vinculo_confiavel?: boolean;
    detalhe_vinculo?: string | null;
    status?: "aprovado" | "pendente" | "falhou";
    status_raw?: string | null;
  }>(null);
  const [showHistId, setShowHistId] = useState<string | null>(null);

  const abrirImportPdf = (instId: string) => {
    setImportInstId(instId);
    // Dispara input file oculto criado abaixo
    const el = document.getElementById("meta-pdf-input") as HTMLInputElement | null;
    if (el) {
      el.value = "";
      el.click();
    }
  };

  const onPdfSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const instId = importInstId;
    if (!file || !instId) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Selecione um arquivo PDF");
      return;
    }
    setParsingPdf(true);
    try {
      const buf = await file.arrayBuffer();
      // base64
      let bin = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
      }
      const b64 = btoa(bin);
      const { data, error } = await supabase.functions.invoke("parse-meta-invoice-pdf", {
        body: { pdf_base64: b64 },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao ler PDF");
      const detectedStatus = (data.status as "aprovado" | "pendente" | "falhou") || "aprovado";
      if (detectedStatus === "falhou") {
        toast.error("A fatura consta como Falhou/Cancelada na Meta. Não será importada.");
        return;
      }
      if (detectedStatus === "pendente") {
        toast.warning("Fatura Pendente detectada — provável verificação de cartão (hold). Ela será salva, mas NÃO somará no total até virar Aprovada.", { duration: 8000 });
      }
      setConfirmPag({
        instance_id: instId,
        valor_usd: data.valor_usd != null ? String(data.valor_usd) : "",
        numero_referencia: data.numero_referencia || "",
        data_transacao: data.data_transacao || "",
        tipo_documento: data.tipo_documento || "atividade_pagamento",
        vinculo_confiavel: !!data.vinculo_confiavel,
        detalhe_vinculo: data.detalhe_vinculo || null,
        status: detectedStatus,
        status_raw: data.status_raw || null,
      });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao processar PDF");
    } finally {
      setParsingPdf(false);
      setImportInstId(null);
    }
  };

  const salvarPagamento = async () => {
    if (!confirmPag) return;
    const valor = Number(confirmPag.valor_usd);
    if (!valor || isNaN(valor)) return toast.error("Valor inválido");
    if (!confirmPag.numero_referencia) return toast.error("Número de referência obrigatório");
    if (!confirmPag.data_transacao) return toast.error("Data obrigatória");
    try {
      await pag.inserir.mutateAsync({
        instance_id: confirmPag.instance_id,
        valor_usd: valor,
        numero_referencia: confirmPag.numero_referencia.trim(),
        data_transacao: confirmPag.data_transacao,
        status: confirmPag.status || "aprovado",
      });
      toast.success(
        confirmPag.status === "pendente"
          ? "Fatura Pendente registrada (não soma no total)"
          : "Pagamento registrado",
      );
      setConfirmPag(null);
    } catch (err: any) {
      if (String(err?.message || "").includes("duplicate")) {
        toast.error("Esta fatura já foi importada (número de referência duplicado)");
      } else {
        toast.error(err?.message || "Erro ao salvar");
      }
    }
  };

  const abrirBillingHub = (inst: Instancia) => {
    const bm = bms.find((b) => b.id === inst.meta_bm_id);
    const bid = bm?.business_id || inst.business_id;
    if (!bid) {
      toast.error("Vincule uma BM com Business ID para abrir a atividade de pagamento");
      return;
    }
    const url = `https://business.facebook.com/latest/billing_hub/payment_activity/?business_id=${bid}&asset_id=${inst.waba_id}&placement=BILLING_HUB_WHATSAPP_ACCOUNT_LIST`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  

  const [assinando, setAssinando] = useState(false);
  const [resultadosAssinatura, setResultadosAssinatura] = useState<any[] | null>(null);
  const [reinscrevendo, setReinscrevendo] = useState<string | null>(null);
  const [diagnosticando, setDiagnosticando] = useState<string | null>(null);
  const [editInst, setEditInst] = useState<Instancia | null>(null);
  const [editForm, setEditForm] = useState({
    nome: "",
    phone_number_id: "",
    waba_id: "",
    business_id: "",
    access_token: "",
    tier_diario: "250",
  });
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    phone_number_id: "",
    waba_id: "",
    business_id: "",
    access_token: "",
    tier_diario: "250",
  });

  const carregar = async () => {
    setLoading(true);
    const [i, t, b] = await Promise.all([
      supabase.from("meta_whatsapp_instances").select("*").order("criado_em", { ascending: false }),
      supabase.from("meta_whatsapp_templates").select("*").order("sincronizado_em", { ascending: false }),
      supabase.from("meta_business_managers").select("id,nome,business_id,ativo,padrao").eq("ativo", true).order("padrao", { ascending: false }).order("nome", { ascending: true }),
    ]);
    if (i.data) setInstancias(i.data as Instancia[]);
    if (t.data) setTemplates(t.data as Template[]);
    if (b.data) setBms(b.data as BM[]);
    setLoading(false);
  };

  const carregarToken = async () => {
    if (parceiroMeta) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("meta_webhook_tokens" as any)
        .select("token")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setVerifyToken((data as any).token);
      return;
    }
    const { data } = await supabase
      .from("meta_whatsapp_config")
      .select("valor")
      .eq("chave", "webhook_verify_token")
      .maybeSingle();
    if (data) setVerifyToken(data.valor);
  };

  const salvarToken = async (novoToken: string) => {
    if (!novoToken.trim()) {
      toast.error("Digite ou gere um token antes de salvar");
      return;
    }
    setSavingToken(true);
    let error: any = null;
    if (parceiroMeta) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSavingToken(false);
        toast.error("Sessão expirada, entre novamente");
        return;
      }
      const res = await supabase
        .from("meta_webhook_tokens" as any)
        .upsert(
          { user_id: user.id, token: novoToken.trim(), atualizado_em: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      error = res.error;
    } else {
      const res = await supabase
        .from("meta_whatsapp_config")
        .upsert({ chave: "webhook_verify_token", valor: novoToken.trim() }, { onConflict: "chave" });
      error = res.error;
    }
    if (error) {
      toast.error("Erro ao salvar token: " + error.message);
    } else {
      setVerifyToken(novoToken.trim());
      toast.success("Verify Token salvo");
    }
    setSavingToken(false);
  };


  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    carregarToken();
  }, [parceiroMeta]);


  const copiar = (txt: string, label = "Copiado!") => {
    navigator.clipboard.writeText(txt);
    toast.success(label);
  };

  const gerarToken = () => {
    const t = "hk-" + crypto.randomUUID().replace(/-/g, "");
    return t;
  };

  const adicionar = async () => {
    if (!form.nome || !form.phone_number_id || !form.waba_id || !form.access_token) {
      toast.error("Preencha nome, Phone Number ID, WABA ID e Access Token");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: novaInst, error } = await supabase
      .from("meta_whatsapp_instances")
      .insert({
        user_id: user.id,
        nome: form.nome,
        phone_number_id: form.phone_number_id.trim(),
        waba_id: form.waba_id.trim(),
        business_id: form.business_id.trim() || null,
        access_token: form.access_token.trim(),
        tier_diario: parseInt(form.tier_diario) || 250,
        webhook_verify_token: gerarToken(),
      })
      .select("id")
      .single();
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Instância adicionada");
    setDialogOpen(false);
    setForm({ nome: "", phone_number_id: "", waba_id: "", business_id: "", access_token: "", tier_diario: "250" });
    carregar();

    // Auto-inscrever webhook para começar a receber mensagens
    if (novaInst?.id) {
      const toastId = toast.loading("Inscrevendo webhook na Meta...");
      try {
        const { data: sub } = await supabase.functions.invoke("meta-subscribe-waba", {
          body: { instancia_id: novaInst.id },
        });
        const r = sub?.resultados?.[0];
        if (r?.subscribe_ok) {
          toast.success("Webhook inscrito — mensagens recebidas passarão a aparecer no Inbox", { id: toastId });
          await marcarWebhookReinscrito(novaInst.id, r?.webhook_url);
        } else {

          const raw = r?.subscribe_raw?.error?.message || "";
          toast.error(
            "Instância salva, mas o webhook não foi inscrito. " + humanizarErroSubscribe(raw) +
            " Use o botão \"Reinscrever webhook\" no card após corrigir.",
            { id: toastId, duration: 12000 },
          );
        }
      } catch (e: any) {
        toast.error("Falha ao inscrever webhook: " + (e?.message || e), { id: toastId });
      }
    }
  };

  const abrirEdicao = (inst: Instancia) => {
    setEditInst(inst);
    setEditForm({
      nome: inst.nome || "",
      phone_number_id: inst.phone_number_id || "",
      waba_id: inst.waba_id || "",
      business_id: inst.business_id || "",
      access_token: "",
      tier_diario: String(inst.tier_diario || 250),
    });
  };

  const salvarEdicao = async () => {
    if (!editInst) return;
    if (!editForm.nome || !editForm.phone_number_id || !editForm.waba_id) {
      toast.error("Preencha nome, Phone Number ID e WABA ID");
      return;
    }
    setSalvandoEdit(true);
    const patch: any = {
      nome: editForm.nome.trim(),
      phone_number_id: editForm.phone_number_id.trim(),
      waba_id: editForm.waba_id.trim(),
      business_id: editForm.business_id.trim() || null,
      tier_diario: parseInt(editForm.tier_diario) || 250,
    };
    if (editForm.access_token.trim()) patch.access_token = editForm.access_token.trim();
    const { error } = await supabase
      .from("meta_whatsapp_instances")
      .update(patch)
      .eq("id", editInst.id);
    setSalvandoEdit(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Instância atualizada");
    setEditInst(null);
    carregar();
  };


  const humanizarErroSubscribe = (msg: string): string => {
    const m = (msg || "").toLowerCase();
    if (m.includes("does not exist") || m.includes("missing permissions")) {
      return "O Access Token permanente não tem acesso a essa WABA. Verifique se o token foi gerado pelo App/System User que administra a Business Manager dessa WABA e se possui as permissões whatsapp_business_management e whatsapp_business_messaging.";
    }
    if (m.includes("expired")) return "O Access Token expirou. Gere um novo token permanente na Meta.";
    if (m.includes("invalid oauth")) return "Access Token inválido. Confira se foi copiado por completo.";
    if (m.includes("permission")) return "Faltam permissões no token. Habilite whatsapp_business_management no App/System User.";
    return msg ? `Detalhe da Meta: ${msg}` : "Verifique WABA ID e Access Token.";
  };

  const marcarWebhookReinscrito = async (instId: string, callbackUrl?: string | null) => {
    await supabase
      .from("meta_whatsapp_instances")
      .update({
        webhook_saude_status: "reinscrito",
        webhook_saude_verificado_em: new Date().toISOString(),
        webhook_ultimo_erro: null,
        webhook_perda_suspeita: null,
        ...(callbackUrl ? { webhook_callback_url: callbackUrl } : {}),
      })
      .eq("id", instId);
    carregar();
  };

  const reinscreverWebhook = async (inst: Instancia) => {
    setReinscrevendo(inst.id);
    const toastId = toast.loading(`Inscrevendo webhook em ${inst.nome}...`);
    try {
      const { data, error } = await supabase.functions.invoke("meta-subscribe-waba", {
        body: { instancia_id: inst.id },
      });
      if (error) throw error;
      const r = data?.resultados?.[0];
      if (r?.subscribe_ok) {
        toast.success("Webhook inscrito — mensagens recebidas passarão a aparecer no Inbox", { id: toastId });
        await marcarWebhookReinscrito(inst.id, r?.webhook_url);
      } else {
        const raw = r?.subscribe_raw?.error?.message || "";
        toast.error(humanizarErroSubscribe(raw), { id: toastId, duration: 15000 });
      }
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e), { id: toastId });
    }
    setReinscrevendo(null);
  };


  const diagnosticar = async (inst: Instancia) => {
    setDiagnosticando(inst.id);
    const toastId = toast.loading(`Diagnosticando ${inst.nome}...`);
    try {
      const { data, error } = await supabase.functions.invoke("meta-diagnose-instance", {
        body: { instancia_id: inst.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha");
      const p = data.phone || {};
      const problems: string[] = data.problems || [];
      const msg =
        `Nome: ${p.verified_name || "-"} (${p.name_status || "?"})\n` +
        `Verificação: ${p.code_verification_status || "?"}\n` +
        `Qualidade: ${p.quality_rating || "?"} | Tier: ${p.messaging_limit_tier || p.throughput?.level || "?"}\n` +
        `Status: ${p.status || "?"}\n\n` +
        (problems.length ? `⚠️ Problemas:\n• ${problems.join("\n• ")}` : `✅ ${data.recommendation || "Sem problemas óbvios."}`);
      toast.message(`Diagnóstico ${inst.nome}`, {
        description: msg,
        duration: 25000,
        id: toastId,
      });
      console.log("[Diagnose]", inst.nome, data);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e), { id: toastId });
    }
    setDiagnosticando(null);
  };

  const verificarSaudeWebhooks = async () => {
    setVerificandoWebhooks(true);
    const toastId = toast.loading("Verificando saúde dos webhooks de todas as instâncias...");
    try {
      const { data, error } = await supabase.functions.invoke("meta-webhook-health", { body: {} });
      if (error) throw error;
      const res: any[] = data?.resultados || [];
      const okC = res.filter((r) => r.status === "ok").length;
      const rei = res.filter((r) => r.status === "reinscrito").length;
      const errC = res.filter((r) => r.status === "erro").length;
      const perda = res.filter((r) => r.status === "perda_suspeita").length;
      toast.success(
        `Verificação concluída — ${okC} OK · ${rei} reinscritas · ${perda} com perda suspeita · ${errC} com erro`,
        { id: toastId, duration: 12000 },
      );
      // Recarrega para atualizar badges
      const { data: fresh } = await supabase
        .from("meta_whatsapp_instances")
        .select("*")
        .order("criado_em", { ascending: false });
      if (fresh) setInstancias(fresh as any);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e), { id: toastId });
    }
    setVerificandoWebhooks(false);
  };




  const testar = async (inst: Instancia) => {
    setTestando(inst.id);
    try {
      const { data, error } = await supabase.functions.invoke("test-meta-connection", {
        body: { phone_number_id: inst.phone_number_id, access_token: inst.access_token },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Conectado: ${data.display_phone_number || inst.phone_number_id}`);
        if (data.display_phone_number) {
          await supabase.from("meta_whatsapp_instances")
            .update({ display_phone: data.display_phone_number })
            .eq("id", inst.id);
          carregar();
        }
      } else {
        toast.error(data?.error || "Falha na conexão");
      }
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
    setTestando(null);
  };

  const sincronizar = async (inst: Instancia) => {
    setSincronizando(inst.id);
    try {
      const { data, error } = await supabase.functions.invoke("meta-sync-templates", {
        body: { instancia_id: inst.id },
      });
      if (error) throw error;
      toast.success(`${data?.synced || 0} templates sincronizados`);
      carregar();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
    setSincronizando(null);
  };

  const sincronizarTodos = async () => {
    setSincronizando("__all__");
    let total = 0;
    let erros = 0;
    for (const inst of instancias.filter((i) => i.ativo)) {
      try {
        const { data, error } = await supabase.functions.invoke("meta-sync-templates", {
          body: { instancia_id: inst.id },
        });
        if (error) throw error;
        total += data?.synced || 0;
      } catch {
        erros++;
      }
    }
    if (erros) toast.error(`${total} sincronizados, ${erros} instâncias com erro`);
    else toast.success(`${total} templates sincronizados`);
    await carregar();
    setSincronizando(null);
  };

  const toggle = async (inst: Instancia) => {
    await supabase.from("meta_whatsapp_instances").update({ ativo: !inst.ativo }).eq("id", inst.id);
    carregar();
  };

  const excluir = async (inst: Instancia) => {
    if (!confirm(`Excluir instância "${inst.nome}"?`)) return;
    await supabase.from("meta_whatsapp_instances").delete().eq("id", inst.id);
    toast.success("Instância excluída");
    carregar();
  };

  const vincularBM = async (inst: Instancia, bmId: string) => {
    const val = bmId === "__none__" ? null : bmId;
    const { error } = await (supabase as any).from("meta_whatsapp_instances").update({ meta_bm_id: val }).eq("id", inst.id);
    if (error) { toast.error(error.message); return; }
    toast.success("BM vinculada");
    carregar();
  };

  const salvarDisplayPhone = async (inst: Instancia) => {
    const digits = editPhoneValue.replace(/\D+/g, "");
    if (digits.length < 10) { toast.error("Número inválido (mín. 10 dígitos)"); return; }
    const { error } = await (supabase as any).from("meta_whatsapp_instances").update({ display_phone: digits }).eq("id", inst.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Número atualizado — refletirá na aba Envio Meta");
    setEditPhoneId(null);
    setEditPhoneValue("");
    carregar();
  };

  const salvarTierManual = async (inst: Instancia, valor: string) => {
    const patch: any = valor === "__auto__"
      ? { messaging_limit_manual: null, messaging_limit_source: inst.saude_tier ? "meta_api" : "default" }
      : { messaging_limit_manual: valor, messaging_limit_source: "manual" };
    const { error } = await (supabase as any).from("meta_whatsapp_instances").update(patch).eq("id", inst.id);
    if (error) { toast.error(error.message); return; }
    toast.success(valor === "__auto__" ? "Override removido — usando sync automático" : `Tier definido: ${valor.replace("TIER_", "")}`);
    carregar();
  };

  const sincronizarSaude = async (inst: Instancia) => {
    const toastId = toast.loading(`Sincronizando ${inst.nome}...`);
    try {
      const { error } = await supabase.functions.invoke("check-meta-instance-health", { body: { instancia_id: inst.id } });
      if (error) throw error;
      toast.success("Saúde e limite atualizados", { id: toastId });
      carregar();
    } catch (e: any) {
      toast.error("Falhou: " + (e?.message || e), { id: toastId });
    }
  };

  const assinarWebhook = async () => {
    setAssinando(true);
    setResultadosAssinatura(null);
    try {
      const { data, error } = await supabase.functions.invoke("meta-subscribe-waba", { body: {} });
      if (error) throw error;
      setResultadosAssinatura(data?.resultados || []);
      const okList = (data?.resultados || []).filter((r: any) => r.subscribe_ok && r.callback_confirmado);
      const okCount = okList.length;
      const total = (data?.resultados || []).length;
      for (const r of okList) {
        await marcarWebhookReinscrito(r.id, r.webhook_url);
      }
      if (okCount === total) toast.success(`${okCount}/${total} WABAs assinadas e callback confirmado`);
      else toast.error(`${okCount}/${total} com callback confirmado — veja detalhes abaixo`);

    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
    setAssinando(false);
  };

  return (
    <AppLayout>
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">API Oficial Meta WhatsApp</h1>
        <p className="text-muted-foreground mt-1">
          Configuração das instâncias conectadas via HookCloud e Meta Cloud API
        </p>
      </div>




      <MetaGuardrailCard />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Webhook (configure no HookCloud / Meta)</CardTitle>
          <CardDescription>Use estes dados ao configurar o webhook no painel da HookCloud</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Callback URL</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={WEBHOOK_URL} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copiar(WEBHOOK_URL)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label>{parceiroMeta ? "Verify Token (seu token)" : "Verify Token (compartilhado)"}</Label>
            <p className="text-xs text-muted-foreground mt-1">
              {parceiroMeta
                ? "Este token é exclusivo dos seus números. Cole esse valor no campo \"Verify Token\" do webhook na Meta/HookCloud."
                : "Cole esse valor no campo \"Verify Token\" do webhook na HookCloud."}
            </p>

            <div className="flex gap-2 mt-1 flex-wrap">
              <Input
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                placeholder="Clique em Gerar para criar um token"
                className="font-mono text-xs flex-1 min-w-[200px]"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copiar(verifyToken, "Token copiado!")}
                disabled={!verifyToken}
                title="Copiar"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setVerifyToken(gerarToken())}
                disabled={savingToken}
              >
                Gerar
              </Button>
              <Button onClick={() => salvarToken(verifyToken)} disabled={savingToken || !verifyToken}>
                {savingToken ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const t = gerarToken();
                  setVerifyToken(t);
                  salvarToken(t);
                }}
                disabled={savingToken}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Resetar
              </Button>
            </div>
          </div>
          <div>
            <Label>Eventos a inscrever</Label>
            <p className="text-xs text-muted-foreground mt-1">
              <code>messages</code> (respostas recebidas), <code>smb_message_echoes</code> (respostas pelo celular/WhatsApp Web) e <code>message_template_status_update</code> (status de templates)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Assinar webhook nas WABAs</CardTitle>
          <CardDescription>
            Sem isso, a Meta não envia as mensagens recebidas para o nosso webhook.
            Rode 1x por número (e sempre que adicionar uma instância nova).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={assinarWebhook} disabled={assinando}>
            {assinando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Assinar todas as instâncias ativas
          </Button>
          {resultadosAssinatura && (
            <div className="space-y-2 text-xs">
              {resultadosAssinatura.map((r) => (
                <div key={r.id} className="border rounded p-2">
                  <div className="flex items-center gap-2 font-medium">
                    {r.subscribe_ok && r.callback_confirmado ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    {r.nome} <span className="text-muted-foreground font-mono">({r.phone_number_id})</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {r.subscribe_ok && r.callback_confirmado
                      ? "Assinado e callback do sistema confirmado pela Meta."
                      : "A Meta não confirmou o callback do sistema para esta WABA."}
                  </div>
                  {r.subscribe_ok && r.callback_confirmado && (
                    <div className="mt-2 flex gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>
                        Se as mensagens ainda não chegarem, confirme no app da Meta que os campos <strong>messages</strong> e <strong>smb_message_echoes</strong> estão marcados em Webhook Fields.
                      </span>
                    </div>
                  )}
                  {(!r.subscribe_ok || !r.callback_confirmado || r.subscriptions) && (
                    <pre className="mt-1 text-[10px] bg-muted p-2 rounded overflow-x-auto">
{JSON.stringify({ assinatura: r.subscribe_raw || r.error, inscricoes: r.subscriptions }, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>



      <Tabs defaultValue="instancias">
        <TabsList>
          <TabsTrigger value="instancias">Instâncias ({instanciasFiltradas.length})</TabsTrigger>
          <TabsTrigger value="templates">Templates HSM ({templates.length})</TabsTrigger>
          <TabsTrigger value="bms">BMs ({bms.length})</TabsTrigger>

        </TabsList>

        <TabsContent value="instancias">

          {/* Input escondido para importar PDF */}
          <input
            id="meta-pdf-input"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={onPdfSelected}
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              {bmSel.size === 0 ? (
                <span className="text-xs text-muted-foreground">Mostrando todas as instâncias.</span>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">Filtrado por:</span>
                  {bms
                    .filter((b) => bmSel.has(b.id))
                    .map((b) => (
                      <Badge key={b.id} variant="outline" className="gap-1 pr-1">
                        <Building2 className="h-3 w-3" />
                        {b.nome}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-4 w-4 p-0 ml-1"
                          onClick={() => toggleBmSel(b.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  {bmSel.has("__none__") && (
                    <Badge variant="outline" className="gap-1 pr-1">
                      Sem BM vinculada
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-4 w-4 p-0 ml-1"
                        onClick={() => toggleBmSel("__none__")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setBmSel(new Set())}
                  >
                    Limpar filtro
                  </Button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={verificarSaudeWebhooks}
                disabled={verificandoWebhooks}
                title="Verifica todos os webhooks na Meta, reinscreve os que estiverem incorretos e detecta possíveis mensagens perdidas"
              >
                {verificandoWebhooks ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Verificar saúde dos webhooks
              </Button>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Nova instância
              </Button>
            </div>
          </div>


          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : instanciasFiltradas.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              {bmSel.size > 0
                ? "Nenhuma instância encontrada para as BMs selecionadas."
                : "Nenhuma instância. Clique em \"Nova instância\" para começar."}
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {instanciasFiltradas.map((inst) => (
                <Card key={inst.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      {/* Header: nome + badges à esquerda, botões de ação à direita */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <Avatar className="h-9 w-9 flex-shrink-0">
                            <AvatarImage src={inst.meta_profile_pic_url || undefined} alt={`Foto de perfil de ${inst.meta_verified_name || inst.nome}`} />
                            <AvatarFallback className="text-[11px]">
                              {(inst.meta_verified_name || inst.nome || "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <h3 className="font-semibold truncate">{inst.nome}</h3>
                            {inst.meta_verified_name && (
                              <div className="text-[11px] text-muted-foreground truncate">
                                Meta: {inst.meta_verified_name}
                                {inst.meta_name_status ? ` (${inst.meta_name_status})` : ""}
                              </div>
                            )}
                          </div>

                          {inst.ativo ? (
                            <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Ativa</Badge>
                          ) : (
                            <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Inativa</Badge>
                          )}
                          {(() => {
                            const bm = bms.find((b) => b.id === inst.meta_bm_id);
                            return bm ? (
                              <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">
                                BM: {bm.nome}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-dashed text-muted-foreground cursor-help"
                                title="Vincular BM é opcional para receber mensagens. Só é necessário para faturamento consolidado."
                              >
                                Sem BM vinculada
                              </Badge>
                            );
                          })()}
                          <MetaHealthStatusRow inst={inst} />
                          {(() => {
                            const s = inst.webhook_saude_status;
                            if (!s) return null;
                            const map: Record<string, { label: string; cls: string; title: string }> = {
                              ok: { label: "Webhook OK", cls: "border-green-500/50 text-green-600", title: "Webhook inscrito no callback correto" },
                              reinscrito: { label: "Webhook reinscrito", cls: "border-blue-500/50 text-blue-600", title: "O sistema detectou callback incorreto e reinscreveu automaticamente" },
                              perda_suspeita: { label: "⚠ Possível perda", cls: "border-amber-500/60 text-amber-700 bg-amber-50", title: `Meta contou mais conversas iniciadas hoje do que chegaram ao Inbox. ${inst.webhook_perda_suspeita ? JSON.stringify(inst.webhook_perda_suspeita) : ""}` },
                              erro: { label: "Webhook com erro", cls: "border-red-500/60 text-red-600 bg-red-50", title: inst.webhook_ultimo_erro || "Erro ao verificar webhook" },
                            };
                            const m = map[s] || { label: s, cls: "", title: "" };
                            return (
                              <Badge variant="outline" className={`text-[10px] ${m.cls}`} title={m.title}>
                                {m.label}
                              </Badge>
                            );
                          })()}
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!inst.waba_id}
                            onClick={() => {
                              const bm = bms.find((b) => b.id === inst.meta_bm_id);
                              const bid = bm?.business_id || (inst as any).business_id;
                              if (!bid) {
                                toast.error("Vincule uma BM com Business ID para abrir o WhatsApp Manager correto");
                                return;
                              }
                              const url = `https://business.facebook.com/latest/whatsapp_manager/phone_numbers?business_id=${bid}&asset_id=${inst.waba_id}`;
                              window.open(url, "_blank", "noopener,noreferrer");
                            }}
                            title="Abrir no Gerenciador do WhatsApp da Meta (usa a BM vinculada)"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" /> WhatsApp Manager
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirBillingHub(inst)}
                            disabled={!inst.waba_id}
                            title="Abrir Atividade de pagamento no Meta Business"
                          >
                            <CreditCard className="h-3 w-3 mr-1" /> Faturamento
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirImportPdf(inst.id)}
                            disabled={parsingPdf}
                            title="Importar PDF de fatura e registrar valor pago"
                          >
                            {parsingPdf && importInstId === inst.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <><Upload className="h-3 w-3 mr-1" />Importar fatura</>
                            )}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => testar(inst)} disabled={testando === inst.id}>
                            {testando === inst.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Testar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reinscreverWebhook(inst)}
                            disabled={reinscrevendo === inst.id || !inst.waba_id}
                            title="Reinscrever a WABA no webhook desta plataforma (necessário para receber mensagens no Inbox)"
                          >
                            {reinscrevendo === inst.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <><RefreshCw className="h-3 w-3 mr-1" />Webhook</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => diagnosticar(inst)}
                            disabled={diagnosticando === inst.id}
                            title="Consultar Meta: name_status, quality, verificação e subscribed_apps"
                          >
                            {diagnosticando === inst.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "🔎 Diagnosticar"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => sincronizar(inst)} disabled={sincronizando === inst.id}>
                            {sincronizando === inst.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RefreshCw className="h-3 w-3 mr-1" />Templates</>}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => abrirEdicao(inst)} title="Editar informações da instância">
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toggle(inst)} title={inst.ativo ? "Desativar" : "Ativar"}>
                            <Power className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => excluir(inst)} title="Excluir">
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {/* Identificação: rótulo em cima, valor embaixo */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Telefone</span>
                          {editPhoneId === inst.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editPhoneValue}
                                onChange={(e) => setEditPhoneValue(e.target.value)}
                                className="h-7 text-xs w-full sm:w-40"
                                placeholder="5562..."
                              />
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => salvarDisplayPhone(inst)}>OK</Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setEditPhoneId(null); setEditPhoneValue(""); }}>✕</Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium">{inst.display_phone || "—"}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 px-1 text-[10px] text-muted-foreground hover:text-foreground"
                                onClick={() => { setEditPhoneId(inst.id); setEditPhoneValue(inst.display_phone || ""); }}
                              >
                                editar
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Phone ID</span>
                          <span className="text-xs font-mono truncate" title={inst.phone_number_id}>{inst.phone_number_id}</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">WABA</span>
                          <span className="text-xs font-mono truncate" title={inst.waba_id}>{inst.waba_id}</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Enviadas hoje</span>
                          <span className="text-xs font-medium">{inst.enviados_hoje}</span>
                        </div>
                      </div>

                      {/* Business Manager */}
                      <div className="pt-3 border-t border-border/60 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold">Business Manager:</span>
                        <Select
                          value={inst.meta_bm_id || "__none__"}
                          onValueChange={(v) => vincularBM(inst, v)}
                        >
                          <SelectTrigger className="h-7 w-full sm:w-[260px] text-xs">
                            <SelectValue placeholder="Selecionar BM" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Não vinculada —</SelectItem>
                            {bms.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.nome}{b.padrao ? " ⭐" : ""}{b.business_id ? ` (${b.business_id})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {bms.length === 0 && (
                          <span className="text-[10px] text-muted-foreground">Cadastre BMs em "Business Managers" para vincular</span>
                        )}
                      </div>

                      {/* Limite de mensagens */}
                      <div className="pt-3 border-t border-border/60 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold">Limite de mensagens:</span>
                        <Select
                          value={inst.messaging_limit_manual || "__auto__"}
                          onValueChange={(v) => salvarTierManual(inst, v)}
                        >
                          <SelectTrigger className="h-7 w-full sm:w-[240px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__auto__">
                              🔄 Automático {inst.saude_tier ? `(Meta: ${inst.saude_tier.replace("MESSAGING_LIMIT_TIER_", "").replace("MESSAGING_LIMIT_", "")})` : "(padrão TIER_1K)"}
                            </SelectItem>
                            <SelectItem value="TIER_250">✋ TIER_250 (250/dia)</SelectItem>
                            <SelectItem value="TIER_1K">✋ TIER_1K (1.000/dia)</SelectItem>
                            <SelectItem value="TIER_2K">✋ TIER_2K (2.000/dia)</SelectItem>
                            <SelectItem value="TIER_10K">✋ TIER_10K (10.000/dia)</SelectItem>
                            <SelectItem value="TIER_100K">✋ TIER_100K (100.000/dia)</SelectItem>
                            <SelectItem value="TIER_UNLIMITED">✋ Ilimitado</SelectItem>
                          </SelectContent>
                        </Select>
                        <Badge variant="outline" className="text-[10px]">
                          Fonte: {inst.messaging_limit_source === "manual" ? "manual" : inst.messaging_limit_source === "meta_api" ? "sync Meta" : "padrão"}
                        </Badge>
                        {inst.messaging_limit_synced_at && (
                          <span className="text-muted-foreground text-[10px]">
                            últ. sync: {new Date(inst.messaging_limit_synced_at).toLocaleString("pt-BR")}
                          </span>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => sincronizarSaude(inst)}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Sincronizar agora
                        </Button>
                      </div>

                      {/* Faturas Meta importadas — histórico + total */}
                      <div className="pt-3 border-t border-border/60">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            <FileText className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="font-semibold">Faturas importadas:</span>
                            <span className="font-bold text-emerald-700">
                              US$ {pag.totalPorInstancia(inst.id).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-muted-foreground">
                              ({pag.porInstancia(inst.id).filter((p) => (p.status || "aprovado") === "aprovado").length})
                            </span>
                            {pag.countPendentePorInstancia(inst.id) > 0 && (
                              <span
                                className="text-amber-700 dark:text-amber-400 text-[11px] font-medium"
                                title="Cobranças em status Pendente na Meta — geralmente autorizações de verificação de cartão (US$25) que costumam ser estornadas em 5-15 dias. Não somam no total."
                              >
                                · Pendente: US$ {pag.totalPendentePorInstancia(inst.id).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                {" "}({pag.countPendentePorInstancia(inst.id)})
                              </span>
                            )}
                          </div>
                          {pag.porInstancia(inst.id).length > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => setShowHistId(showHistId === inst.id ? null : inst.id)}
                            >
                              {showHistId === inst.id ? "Ocultar histórico" : "Ver histórico"}
                            </Button>
                          )}
                        </div>
                        {showHistId === inst.id && (
                          <div className="mt-2 rounded-md border border-border/60 overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Data</TableHead>
                                  <TableHead className="text-xs">Referência</TableHead>
                                  <TableHead className="text-xs">Status</TableHead>
                                  <TableHead className="text-xs text-right">Valor (US$)</TableHead>
                                  <TableHead className="w-20"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {pag.porInstancia(inst.id).map((p) => {
                                  const st = (p.status || "aprovado") as "aprovado" | "pendente" | "falhou";
                                  return (
                                  <TableRow key={p.id} className={st === "pendente" ? "opacity-70" : ""}>
                                    <TableCell className="text-xs">
                                      {new Date(p.data_transacao + "T00:00:00").toLocaleDateString("pt-BR")}
                                    </TableCell>
                                    <TableCell className="text-xs font-mono">{p.numero_referencia}</TableCell>
                                    <TableCell className="text-xs">
                                      {st === "pendente" ? (
                                        <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400 text-[10px]">Pendente</Badge>
                                      ) : st === "falhou" ? (
                                        <Badge variant="outline" className="border-destructive text-destructive text-[10px]">Falhou</Badge>
                                      ) : (
                                        <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-400 text-[10px]">Aprovada</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className={`text-xs text-right font-medium ${st !== "aprovado" ? "line-through text-muted-foreground" : ""}`}>
                                      {Number(p.valor_usd).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center justify-end gap-1">
                                        {st === "pendente" && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 px-1.5 text-[10px]"
                                            title="Marcar como Aprovada — passa a somar no total"
                                            onClick={async () => {
                                              try {
                                                await pag.atualizarStatus.mutateAsync({ id: p.id, status: "aprovado" });
                                                toast.success("Fatura marcada como Aprovada");
                                              } catch (e: any) {
                                                toast.error(e?.message || "Erro");
                                              }
                                            }}
                                          >
                                            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" /> Aprovar
                                          </Button>
                                        )}
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0"
                                          onClick={async () => {
                                            if (!confirm("Excluir este registro?")) return;
                                            try {
                                              await pag.remover.mutateAsync(p.id);
                                              toast.success("Removido");
                                            } catch (e: any) {
                                              toast.error(e?.message || "Erro");
                                            }
                                          }}
                                        >
                                          <Trash2 className="h-3 w-3 text-destructive" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>



              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates">
          <div className="flex justify-end mb-3">
            <Button
              size="sm"
              variant="outline"
              onClick={sincronizarTodos}
              disabled={sincronizando !== null || instancias.filter((i) => i.ativo).length === 0}
            >
              {sincronizando === "__all__" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar todos os templates
            </Button>
          </div>
          {templates.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              Nenhum template sincronizado. Clique em "Sincronizar todos os templates" acima ou em "Templates" em uma instância.
            </CardContent></Card>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                A coluna <strong>Cobertura</strong> mostra em quantas instâncias ativas o template está aprovado — só é seguro disparar em massa quando estiver 100%.
              </p>

              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Idioma</TableHead>
                      <TableHead>Cobertura</TableHead>
                      <TableHead>Corpo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const ativas = instancias.filter((i) => i.ativo);
                      const totalAtivas = ativas.length;
                      // Group by nome_template + idioma
                      const groupsMap = new Map<string, { chave: string; nome: string; idioma: string; categoria: string | null; body_text: string | null; rows: Template[]; sampleRow: Template }>();
                      for (const t of templates) {
                        const k = `${t.nome_template}::${t.idioma}`;
                        const g = groupsMap.get(k);
                        if (g) {
                          g.rows.push(t);
                        } else {
                          groupsMap.set(k, {
                            chave: k,
                            nome: t.nome_template,
                            idioma: t.idioma,
                            categoria: t.categoria,
                            body_text: t.body_text,
                            rows: [t],
                            sampleRow: t,
                          });
                        }
                      }
                      const groups = Array.from(groupsMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));

                      return groups.map((g) => {
                        const aprovadasIds = new Set(g.rows.filter((r) => r.status === "approved").map((r) => r.instancia_id));
                        const presentes = ativas.filter((i) => aprovadasIds.has(i.id));
                        const faltantes = ativas.filter((i) => !aprovadasIds.has(i.id));
                        const cobertura = presentes.length;
                        const cor =
                          totalAtivas === 0 ? "secondary" :
                          cobertura === 0 ? "destructive" :
                          cobertura === totalAtivas ? "default" : "secondary";
                        const badgeClass = cor === "default" ? "bg-green-600" : cor === "secondary" ? "bg-amber-500 text-white" : "";
                        return (
                          <TableRow key={g.chave} className="hover:bg-muted/50">
                            <TableCell
                              className="font-mono text-xs cursor-pointer"
                              onClick={() => setPreviewTpl(g.sampleRow)}
                            >
                              {g.nome}
                            </TableCell>
                            <TableCell>{g.categoria || "—"}</TableCell>
                            <TableCell>{g.idioma}</TableCell>
                            <TableCell>
                              <div
                                title={
                                  totalAtivas === 0
                                    ? "Nenhuma instância ativa"
                                    : `Aprovado em: ${presentes.map((i) => i.nome).join(", ") || "nenhuma"}\nFalta em: ${faltantes.map((i) => i.nome).join(", ") || "nenhuma"}`
                                }
                              >
                                <Badge variant={cor as any} className={badgeClass}>
                                  {cobertura}/{totalAtivas}
                                  {cobertura === totalAtivas && totalAtivas > 0 ? " ✓" : faltantes.length ? " ⚠" : ""}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell
                              className="max-w-md truncate text-xs cursor-pointer"
                              onClick={() => setPreviewTpl(g.sampleRow)}
                            >
                              {g.body_text}
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </>

          )}
        </TabsContent>

        <TabsContent value="bms">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium">Filtrar instâncias por Business Manager</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Selecione uma ou mais BMs. Os WhatsApps vinculados serão exibidos na aba "Instâncias".
                  </p>
                </div>
                <Popover open={bmPickerOpen} onOpenChange={setBmPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      <Building2 className="h-4 w-4 mr-2" />
                      Selecionar BMs
                      {bmSel.size > 0 && (
                        <Badge variant="secondary" className="ml-2">{bmSel.size}</Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[420px] p-0" align="end">
                    <div className="p-3 border-b space-y-2">
                      <Input
                        placeholder="Buscar BM..."
                        value={bmBusca}
                        onChange={(e) => setBmBusca(e.target.value)}
                        className="h-9"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 text-xs flex-1"
                          onClick={() => setBmSel(new Set(bms.map((b) => b.id)))}
                        >
                          Selecionar todas
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs flex-1"
                          onClick={() => setBmSel(new Set())}
                        >
                          Limpar
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="h-[480px]">
                      <div className="p-2">
                        {bms
                          .filter((b) => (b.nome || "").toLowerCase().includes(bmBusca.trim().toLowerCase()))
                          .map((b) => (
                            <label
                              key={b.id}
                              className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-muted cursor-pointer"
                            >
                              <Checkbox
                                checked={bmSel.has(b.id)}
                                onCheckedChange={() => toggleBmSel(b.id)}
                                className="mt-0.5"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm truncate">{b.nome}</span>
                                <span className="block text-[11px] text-muted-foreground font-mono truncate">
                                  {b.business_id || "sem Business ID"}
                                </span>
                              </span>
                            </label>
                          ))}
                        <label className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted cursor-pointer border-t mt-1 pt-2">
                          <Checkbox checked={bmSel.has("__none__")} onCheckedChange={() => toggleBmSel("__none__")} />
                          <span className="text-sm text-muted-foreground">Sem BM vinculada</span>
                        </label>
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>

              {bmSel.size > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">BMs selecionadas:</span>
                  {bms
                    .filter((b) => bmSel.has(b.id))
                    .map((b) => (
                      <Badge key={b.id} variant="outline" className="gap-1 pr-1">
                        <Building2 className="h-3 w-3" />
                        {b.nome}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-4 w-4 p-0 ml-1"
                          onClick={() => toggleBmSel(b.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  {bmSel.has("__none__") && (
                    <Badge variant="outline" className="gap-1 pr-1">
                      Sem BM vinculada
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-4 w-4 p-0 ml-1"
                        onClick={() => toggleBmSel("__none__")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setBmSel(new Set())}
                  >
                    Limpar seleção
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma BM selecionada. Clique em "Selecionar BMs" para começar.
                </p>
              )}

              {bmSel.size > 0 && (
                <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  {instanciasFiltradas.length} WhatsApp(s) encontrado(s) na(s) BM(s) selecionada(s). 
                  Vá para a aba "Instâncias" para visualizar e gerenciar.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova instância Meta WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome interno *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Novo Mundo Cobrança 01" />
            </div>
            <div>
              <Label>Phone Number ID *</Label>
              <Input value={form.phone_number_id} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })} placeholder="Ex: 123456789012345" />
            </div>
            <div>
              <Label>WABA ID (WhatsApp Business Account) *</Label>
              <Input value={form.waba_id} onChange={(e) => setForm({ ...form, waba_id: e.target.value })} placeholder="Ex: 987654321098765" />
            </div>
            <div>
              <Label>Business Manager ID (opcional)</Label>
              <Input value={form.business_id} onChange={(e) => setForm({ ...form, business_id: e.target.value })} />
            </div>
            <div>
              <Label>Access Token (permanente) *</Label>
              <Input type="password" value={form.access_token} onChange={(e) => setForm({ ...form, access_token: e.target.value })} placeholder="EAAxxxxx..." />
            </div>
            <div>
              <Label>Tier diário inicial</Label>
              <Input type="number" value={form.tier_diario} onChange={(e) => setForm({ ...form, tier_diario: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">Meta começa em 250 e escala para 1k → 10k → 100k</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={adicionar}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editInst} onOpenChange={(o) => !o && setEditInst(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar instância{editInst ? ` — ${editInst.nome}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome interno *</Label>
              <Input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
            </div>
            <div>
              <Label>Phone Number ID *</Label>
              <Input value={editForm.phone_number_id} onChange={(e) => setEditForm({ ...editForm, phone_number_id: e.target.value })} />
            </div>
            <div>
              <Label>WABA ID *</Label>
              <Input value={editForm.waba_id} onChange={(e) => setEditForm({ ...editForm, waba_id: e.target.value })} />
            </div>
            <div>
              <Label>Business Manager ID (opcional)</Label>
              <Input value={editForm.business_id} onChange={(e) => setEditForm({ ...editForm, business_id: e.target.value })} />
            </div>
            <div>
              <Label>Access Token (deixe em branco para manter o atual)</Label>
              <Input type="password" value={editForm.access_token} onChange={(e) => setEditForm({ ...editForm, access_token: e.target.value })} placeholder="EAAxxxxx..." />
              <p className="text-xs text-muted-foreground mt-1">Só preencha se quiser substituir o token permanente.</p>
            </div>
            <div>
              <Label>Tier diário</Label>
              <Input type="number" value={editForm.tier_diario} onChange={(e) => setEditForm({ ...editForm, tier_diario: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditInst(null)} disabled={salvandoEdit}>Cancelar</Button>
            <Button onClick={salvarEdicao} disabled={salvandoEdit}>
              {salvandoEdit ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TemplatePreviewDialog
        template={previewTpl}
        open={!!previewTpl}
        onOpenChange={(o) => !o && setPreviewTpl(null)}
        onSaved={carregar}
      />

      {/* Dialog de confirmação de pagamento importado */}
      <Dialog open={!!confirmPag} onOpenChange={(o) => !o && setConfirmPag(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar dados da fatura</DialogTitle>
          </DialogHeader>
          {confirmPag && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Confira os dados extraídos do PDF. Você pode ajustar antes de salvar. O PDF não será armazenado.
              </p>
              {(() => {
                const inst = conciliacao.data?.instancias.find((i) => i.id === confirmPag.instance_id);
                const valor = Number(confirmPag.valor_usd || 0);
                const suspeito25 = valor >= 24.5 && (!inst || inst.oficialUsd < 1);
                if (!suspeito25 && confirmPag.vinculo_confiavel) return null;
                return (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-muted-foreground">
                    <div className="font-semibold text-foreground flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4" /> Atenção antes de atribuir esta fatura
                    </div>
                    {!confirmPag.vinculo_confiavel && (
                      <p>O PDF parece ser atividade de pagamento/cobrança, mas não trouxe vínculo confiável com WABA ou telefone. Salve aqui apenas se você confirmou manualmente que pertence a esta instância.</p>
                    )}
                    {suspeito25 && (
                      <p className="mt-1">O valor está perto de US$25, mas o custo oficial identificado para esta instância é baixo. Isso pode ser limite/cobrança do cartão no nível da conta de pagamento, não consumo real desta WABA.</p>
                    )}
                    {confirmPag.detalhe_vinculo && <p className="mt-1">Vínculo detectado: {confirmPag.detalhe_vinculo}</p>}
                  </div>
                );
              })()}
              <div>
                <Label className="text-xs">Data da transação</Label>
                <Input
                  type="date"
                  value={confirmPag.data_transacao}
                  onChange={(e) => setConfirmPag({ ...confirmPag, data_transacao: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Número de referência</Label>
                <Input
                  value={confirmPag.numero_referencia}
                  onChange={(e) => setConfirmPag({ ...confirmPag, numero_referencia: e.target.value })}
                  placeholder="AX3HGVZLU2"
                />
              </div>
              <div>
                <Label className="text-xs">Valor pago (US$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={confirmPag.valor_usd}
                  onChange={(e) => setConfirmPag({ ...confirmPag, valor_usd: e.target.value })}
                  placeholder="1.22"
                />
              </div>
              <div>
                <Label className="text-xs">Status na Meta</Label>
                <Select
                  value={confirmPag.status || "aprovado"}
                  onValueChange={(v) => setConfirmPag({ ...confirmPag, status: v as any })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aprovado">Aprovada / Paga — soma no total</SelectItem>
                    <SelectItem value="pendente">Pendente — não soma (hold de cartão)</SelectItem>
                  </SelectContent>
                </Select>
                {confirmPag.status === "pendente" && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                    ⚠️ Cobranças "Pendente" na Meta costumam ser autorizações de verificação do cartão (US$25) que caem/são estornadas em 5-15 dias úteis. Não vamos somar no total — se depois virar Paga, use o botão "Aprovar" no histórico.
                  </p>
                )}
                {confirmPag.status_raw && (
                  <p className="text-[10px] text-muted-foreground mt-1">Detectado no PDF: "{confirmPag.status_raw}"</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPag(null)}>Cancelar</Button>
            <Button onClick={salvarPagamento} disabled={pag.inserir.isPending}>
              {pag.inserir.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AppLayout>

  );
}
