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
import { Loader2, Send, RefreshCw, Pencil, Check, X, Pause, Play, StopCircle, HeartPulse, AlertTriangle, Upload, FileSpreadsheet, ShieldCheck, TestTube } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AppLayout } from "@/components/layout/AppLayout";
import TemplateWhatsAppPreview from "@/components/meta/TemplateWhatsAppPreview";
import CustoEnvioCard, { type CustoEnvioCardHandle } from "@/components/meta/CustoEnvioCard";
import CustoEstimadoEnvio, { LIMITE_CUSTO_BRL_DEFAULT } from "@/components/meta/CustoEstimadoEnvio";
import { calcularCustoEstimado } from "@/hooks/useCustoEstimadoEnvio";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import EscalonamentoPanel from "@/components/meta/escalonamento/EscalonamentoPanel";
import { AgendarCampanhaBox, CampanhasAgendadasList } from "@/components/meta/CampanhaAgendadaSection";
import { useEnvioMetaSending } from "@/contexts/EnvioMetaSendingContext";
import { Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

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
};

function normalizeTelKey(t: string): string {
  const d = String(t || "").replace(/\D+/g, "");
  if (!d) return "";
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

function parseRecipients(input: string): ClienteRow[] {
  const linhas = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ClienteRow[] = [];
  const seen = new Set<string>();
  for (const linha of linhas) {
    const parts = linha.split(/[,;\t]/).map((p) => p.trim());
    const telefone = parts[0] || "";
    const key = normalizeTelKey(telefone);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      telefone,
      nome: parts[1] || "",
      cpf: parts[2] || "",
      atraso: parts[3] || "",
      saldo: parts[4] ? Number(parts[4].replace(",", ".")) : 0,
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
    const tel = trimmed.split(/[,;\t]/)[0]?.trim() || "";
    const key = normalizeTelKey(tel);
    if (!key) { out.push(trimmed); continue; }
    if (seen.has(key)) { dup++; continue; }
    seen.add(key);
    out.push(trimmed);
  }
  return { texto: out.join("\n"), duplicados: dup };
}

export default function EnvioMeta() {
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
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const [templateId, setTemplateId] = useState<string>("");
  const [instanciaIds, setInstanciaIds] = useState<string[]>([]);
  const [recipientsRaw, setRecipientsRaw] = useState<string>("");
  const [minSec, setMinSec] = useState<string>("30");
  const [maxSec, setMaxSec] = useState<string>("90");
  const [uazInstancias, setUazInstancias] = useState<UazInstancia[]>([]);
  const [validadorId, setValidadorId] = useState<string>("");
  const [validando, setValidando] = useState<boolean>(false);
  const [enviandoTeste, setEnviandoTeste] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState<string>("");
  const [editPhone, setEditPhone] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const custoRef = useRef<CustoEnvioCardHandle>(null);
  const [checandoSaude, setChecandoSaude] = useState<boolean>(false);
  const [detalheSaude, setDetalheSaude] = useState<Instancia | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validacaoPreview, setValidacaoPreview] = useState<{ valid: string[]; invalid: string[]; errors: string[]; duplicados?: number } | null>(null);

  const importarExcel = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("Planilha vazia");
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, defval: "" });
      const linhas: string[] = [];
      const seen = new Set<string>();
      let ignorados = 0;
      let duplicados = 0;
      let cabecalhoPulado = false;
      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx] || [];
        const telRaw = String(r[0] ?? "").trim();
        const nomeRaw = String(r[1] ?? "").trim();
        const digitos = telRaw.replace(/\D/g, "");
        if (idx === 0 && !digitos && !cabecalhoPulado) { cabecalhoPulado = true; continue; }
        if (!digitos) { if (telRaw || nomeRaw) ignorados++; continue; }
        const key = normalizeTelKey(telRaw);
        if (seen.has(key)) { duplicados++; continue; }
        seen.add(key);
        linhas.push(nomeRaw ? `${telRaw}, ${nomeRaw}` : telRaw);
      }
      if (linhas.length === 0) { toast.error("Nenhum telefone válido encontrado"); return; }
      setRecipientsRaw(linhas.join("\n"));
      setValidacaoPreview(null);
      toast.success(
        `${linhas.length} contato(s) importado(s)` +
        (ignorados ? ` • ${ignorados} ignorado(s)` : "") +
        (duplicados ? ` • ${duplicados} duplicado(s) removido(s)` : "")
      );
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
    const rows = parseRecipients(recipientsRaw).filter((r) => !invalidSet.has(normalizeTelKey(r.telefone)));
    const linhas = rows.map((r) => [r.telefone, r.nome, r.cpf, r.atraso, r.saldo ? String(r.saldo) : ""].filter(Boolean).join(", "));
    setRecipientsRaw(linhas.join("\n"));
    setValidacaoPreview({ ...validacaoPreview, invalid: [] });
    toast.success(`${invalidSet.size} número(s) sem WhatsApp removido(s)`);
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

  const carregar = async () => {
    setLoading(true);
    const [i, t, u] = await Promise.all([
      supabase.from("meta_whatsapp_instances").select("*").eq("ativo", true).order("nome"),
      supabase.from("meta_whatsapp_templates")
        .select("*")
        .order("nome_template"),


      (supabase as any).from("user_whatsapp_instances")
        .select("id, nome, telefone, ativo, server_url, instance_token")
        .eq("ativo", true)
        .order("nome"),
    ]);
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
    if (instanciasIncompatíveis.length > 0) {
      return toast.error(
        `Este template não está aprovado em: ${instanciasIncompatíveis.map((i) => i.nome).join(", ")}. Remova essas instâncias ou sincronize/aprove o template nelas.`,
      );
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
    const todasForaPool = instanciaIds.every((id) => {
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
          `\nDisparar template "${template.nome_template}" para ${totalValid} contatos em ${instanciaIds.length} instância(s), com delay ${lo}-${hi}s?`
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
      if (!confirm(
        `Disparar template "${template.nome_template}" para ${recipientsDedup.length} contatos em ${instanciaIds.length} instância(s), com delay ${lo}-${hi}s?` +
        (dedup.duplicados > 0 ? `\n\n🔁 ${dedup.duplicados} duplicado(s) já foram removidos.` : "")
      )) return;
    }



    // Mapa instância -> template_id específico daquela instância (mesmo nome/idioma)
    const templateIdByInstance: Record<string, string> = {};
    for (const r of templateGroup.rows) {
      if (r.status === "approved" && instanciaIds.includes(r.instancia_id)) {
        templateIdByInstance[r.instancia_id] = r.id;
      }
    }

    await iniciar({
      template: { id: template.id, nome_template: template.nome_template },
      instanciaIds,
      instancias: instancias.map((i) => ({ id: i.id, nome: i.nome })),
      clientes: clientesFinal,
      minSec: lo,
      maxSec: hi,
      semWhatsapp: semWa,
      erroValidacao: erroVal,
      templateIdByInstance,
      onAfterEnvio: () => {
        carregar();
        custoRef.current?.refetch();
      },
    });
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

      <EscalonamentoPanel />



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
                <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
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
                <TemplateWhatsAppPreview template={template} />
              </div>
            )}

            {variaveisDoTemplate.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <strong>Variáveis:</strong>{" "}
                {variaveisDoTemplate.map(([k, v]) => `{{${k}}}=${v}`).join(" · ")}
                <p className="mt-1">
                  Use os campos abaixo nos placeholders mapeados:
                  <code className="ml-1">{"{nome} {primeiro_nome} {cpf} {atraso} {saldo} {avista} {parcelado}"}</code>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instâncias */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>2. Instâncias</CardTitle>
                <CardDescription>Marque as instâncias para distribuir em round-robin.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={instancias.length === 0}
                  onClick={() => {
                    if (instanciaIds.length === instancias.length) {
                      setInstanciaIds([]);
                    } else {
                      setInstanciaIds(instancias.map((i) => i.id));
                    }
                  }}
                >
                  {instanciaIds.length === instancias.length && instancias.length > 0 ? "Limpar seleção" : "Selecionar todas"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={verificarSaude} disabled={checandoSaude || instancias.length === 0}>
                  {checandoSaude ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <HeartPulse className="h-3.5 w-3.5 mr-1.5" />}
                  Verificar saúde
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {instancias.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma instância ativa. Cadastre em "API Oficial Meta".
              </p>
            ) : (
              <>
              {instanciaIds.length > 0 && instanciaIds.every((id) => (instancias.find((x) => x.id === id)?.estado_pool || "aguardando_templates") !== "ativo") && (
                <div className="mb-3 rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium mb-0.5">Nenhuma instância marcada está ativa no pool</div>
                    <div>O disparo em massa está bloqueado. Use <strong>"Enviar teste (1º número)"</strong> abaixo para validar o template com 1 contato, ou ative as instâncias em Configurar Meta → Pool.</div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {instancias.map((i) => {
                  const isEditing = editingId === i.id;
                  return (
                  <label key={i.id} className="flex items-center gap-3 p-2 rounded border hover:bg-muted/40 cursor-pointer">
                    <Checkbox
                      checked={instanciaIds.includes(i.id)}
                      onCheckedChange={() => toggleInstancia(i.id)}
                    />
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
                          <div className="text-xs text-muted-foreground">
                            {i.display_phone || i.phone_number_id} • {i.enviados_hoje}/{i.tier_diario} hoje
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
              </>
            )}

          </CardContent>
        </Card>
      </div>

      {/* Destinatários */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>3. Destinatários ({recipients.length})</CardTitle>
              <CardDescription>
                Uma linha por contato. Formato: <code>telefone, nome, cpf, atraso, saldo</code>. Apenas <code>telefone</code> é obrigatório.
                Ou importe uma planilha Excel com <strong>Coluna A = Telefone</strong> e <strong>Coluna B = Nome</strong>.
              </CardDescription>
            </div>
            <div>
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
              <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                Importar Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            rows={10}
            value={recipientsRaw}
            onChange={(e) => { setRecipientsRaw(e.target.value); setValidacaoPreview(null); }}
            placeholder={"5562999999999, João Silva, 12345678900, 45, 1250.50\n5562988887777, Maria, 98765432100, 12, 540"}
            className="font-mono text-xs"
          />
          {recipients.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Primeiro: <code>{recipients[0].telefone}</code> {recipients[0].nome && `• ${recipients[0].nome}`}
            </p>
          )}
        </CardContent>
      </Card>


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
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            <div>
              <Label>Mín. (s)</Label>
              <Input type="number" min={1} value={minSec} onChange={(e) => setMinSec(e.target.value)} />
            </div>
            <div>
              <Label>Máx. (s)</Label>
              <Input type="number" min={1} value={maxSec} onChange={(e) => setMaxSec(e.target.value)} />
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


          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={enviar} disabled={enviando || validando || enviandoTeste || instanciasIncompatíveis.length > 0} size="lg">
              {(enviando || validando) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {validando ? "Validando WhatsApp..." : enviando ? "Enviando..." : `Disparar ${recipients.length > 0 ? `(${recipients.length})` : ""}`}
            </Button>
            <Button
              onClick={enviarTeste}
              disabled={enviando || validando || enviandoTeste || !template || instanciaIds.length === 0 || recipients.length === 0}
              size="lg"
              variant="secondary"
              className="border-2 border-amber-500 bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-400 shadow-sm"
              title="Envia 1 mensagem para o primeiro destinatário via a primeira instância marcada, ignorando trava de ramp-up/horário. Útil para validar template e imagem antes do disparo em massa."
            >
              {enviandoTeste ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TestTube className="h-4 w-4 mr-2" />}
              {enviandoTeste ? "Enviando teste..." : "Enviar teste (1º número)"}
            </Button>

            {enviando && (
              <>
                <Button type="button" variant="secondary" size="lg" onClick={togglePausa}>
                  {pausado ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                  {pausado ? "Retomar" : "Pausar"}
                </Button>
                <Button type="button" variant="destructive" size="lg" onClick={cancelar}>
                  <StopCircle className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </>
            )}
            {!enviando && resultado && restantes > 0 && (
              <Button type="button" size="lg" onClick={reativar} className="bg-green-600 hover:bg-green-700 text-white">
                <Send className="h-4 w-4 mr-2" />
                Reativar envio ({restantes} restantes)
              </Button>
            )}
            {!enviando && (resultado || detalhes.enviados.length > 0 || detalhes.erros.length > 0 || detalhes.semWhatsapp.length > 0 || detalhes.erroValidacao.length > 0) && (
              <Button type="button" variant="outline" size="lg" onClick={limpar}>
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar resultados
              </Button>
            )}
          </div>

          {progresso && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {pausado ? "⏸ Pausado" : "Enviando"} — {progresso.enviados + progresso.erros}/{progresso.total}
                </span>
                <span className="text-muted-foreground text-xs">
                  ✅ {progresso.enviados} • ❌ {progresso.erros} • ⏳ {progresso.total - progresso.enviados - progresso.erros}
                </span>
              </div>
              <div className="h-2 w-full bg-muted rounded overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.round(((progresso.enviados + progresso.erros) / Math.max(progresso.total, 1)) * 100)}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                {progresso.atualTelefone && <div>Último: <code>{progresso.atualTelefone}</code> via <strong>{progresso.atualInstancia}</strong></div>}
                {progresso.proximoEmSeg > 0 && !pausado && <div>Próximo envio em {progresso.proximoEmSeg}s</div>}
              </div>
            </div>
          )}


          {resultado && (
            <div className="text-sm space-y-2">
              {resultado.enviados === 0 && resultado.statusMotivo && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
                  Nenhuma mensagem foi enviada: {resultado.statusMotivo}
                </div>
              )}
              <Badge variant="default" className="bg-green-600 mr-2">{resultado.enviados} enviados</Badge>
              {resultado.erros > 0 && <Badge variant="destructive" className="mr-2">{resultado.erros} erros</Badge>}
              <span className="text-muted-foreground">de {resultado.total} contatos</span>
            </div>
          )}

          {(enviando || detalhes.enviados.length > 0 || detalhes.erros.length > 0 || detalhes.semWhatsapp.length > 0 || detalhes.erroValidacao.length > 0) && (
            <DetalhesEnvioPainel detalhes={detalhes} deliveryResumo={deliveryResumo} onRefresh={refreshStatus} />
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
    </AppLayout>
  );
}

function SaudeBadgeStatus({ status }: { status?: string | null }) {
  if (!status) return null;
  const s = status.toUpperCase();
  const variant: any = s === "CONNECTED" ? "default" : (s === "FLAGGED" || s === "RESTRICTED" || s === "DISCONNECTED") ? "destructive" : "secondary";
  const cls = s === "CONNECTED" ? "bg-green-600 hover:bg-green-600 text-white" : "";
  return <Badge variant={variant} className={`text-[10px] px-1.5 py-0 ${cls}`}>{s}</Badge>;
}

function SaudeBadgeQuality({ quality }: { quality?: string | null }) {
  if (!quality) return null;
  const q = quality.toUpperCase();
  const cls = q === "GREEN" ? "bg-green-600 text-white" : q === "YELLOW" ? "bg-yellow-500 text-white" : q === "RED" ? "bg-red-600 text-white" : "";
  return <Badge className={`text-[10px] px-1.5 py-0 ${cls}`}>QUALIDADE {q}</Badge>;
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
