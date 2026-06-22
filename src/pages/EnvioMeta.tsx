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
import { Loader2, Send, RefreshCw, Pencil, Check, X, Pause, Play, StopCircle, HeartPulse, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AppLayout } from "@/components/layout/AppLayout";
import TemplateWhatsAppPreview from "@/components/meta/TemplateWhatsAppPreview";
import CustoEnvioCard, { type CustoEnvioCardHandle } from "@/components/meta/CustoEnvioCard";

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

function parseRecipients(input: string): ClienteRow[] {
  const linhas = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ClienteRow[] = [];
  for (const linha of linhas) {
    const parts = linha.split(/[,;\t]/).map((p) => p.trim());
    const telefone = parts[0] || "";
    if (!telefone.replace(/\D/g, "")) continue;
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

export default function EnvioMeta() {
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ enviados: number; erros: number; total: number } | null>(null);

  const [templateId, setTemplateId] = useState<string>("");
  const [instanciaIds, setInstanciaIds] = useState<string[]>([]);
  const [recipientsRaw, setRecipientsRaw] = useState<string>("");
  const [minSec, setMinSec] = useState<string>("30");
  const [maxSec, setMaxSec] = useState<string>("90");
  const [uazInstancias, setUazInstancias] = useState<UazInstancia[]>([]);
  const [validadorId, setValidadorId] = useState<string>("");
  const [validando, setValidando] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState<string>("");
  const [editPhone, setEditPhone] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [pausado, setPausado] = useState<boolean>(false);
  const [progresso, setProgresso] = useState<{
    enviados: number; erros: number; total: number;
    atualTelefone: string; atualInstancia: string; proximoEmSeg: number;
  } | null>(null);
  type EnvioItem = { telefone: string; instancia?: string; erro?: string; ts: number };
  const [detalhes, setDetalhes] = useState<{
    enviados: EnvioItem[];
    erros: EnvioItem[];
    semWhatsapp: string[];
    erroValidacao: string[];
  }>({ enviados: [], erros: [], semWhatsapp: [], erroValidacao: [] });
  const pausedRef = useRef<boolean>(false);
  const cancelRef = useRef<boolean>(false);
  const custoRef = useRef<CustoEnvioCardHandle>(null);
  const [checandoSaude, setChecandoSaude] = useState<boolean>(false);
  const [detalheSaude, setDetalheSaude] = useState<Instancia | null>(null);

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
      supabase.from("meta_whatsapp_templates").select("*").eq("status", "approved").order("nome_template"),
      (supabase as any).from("user_whatsapp_instances")
        .select("id, nome, telefone, ativo, server_url, instance_token")
        .eq("ativo", true)
        .order("nome"),
    ]);
    if (i.data) setInstancias(i.data as any);
    if (t.data) setTemplates(t.data as any);
    if (u.data) setUazInstancias(u.data as any);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const template = useMemo(
    () => templates.find((t) => t.id === templateId) || null,
    [templates, templateId]
  );

  const recipients = useMemo(() => parseRecipients(recipientsRaw), [recipientsRaw]);

  const toggleInstancia = (id: string) => {
    setInstanciaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const enviar = async () => {
    if (!template) return toast.error("Selecione um template aprovado");
    if (instanciaIds.length === 0) return toast.error("Selecione ao menos uma instância");
    if (recipients.length === 0) return toast.error("Cole ao menos um destinatário");

    const lo = Math.max(1, Number(minSec) || 1);
    const hi = Math.max(lo, Number(maxSec) || lo);

    let clientesFinal = recipients;
    setDetalhes({ enviados: [], erros: [], semWhatsapp: [], erroValidacao: [] });

    // Validação opcional via UAZAPI
    if (validadorId) {
      const validador = uazInstancias.find((x) => x.id === validadorId);
      if (!validador) return toast.error("Instância validadora inválida");

      setValidando(true);
      try {
        const numeros = recipients.map((r) => r.telefone);
        const { data: vData, error: vErr } = await supabase.functions.invoke("check-whatsapp-numbers", {
          body: {
            numbers: numeros,
            server_url: validador.server_url,
            instance_token: validador.instance_token,
          },
        });
        if (vErr) throw vErr;
        const validSet = new Set<string>((vData?.valid || []).map((n: string) => String(n)));
        const invalidArr: string[] = (vData?.invalid || []).map((n: string) => String(n));
        const errorArr: string[] = (vData?.errors || []).map((n: string) => String(n));
        const totalValid = vData?.total_valid ?? validSet.size;
        const totalInvalid = vData?.total_invalid ?? invalidArr.length;
        const totalErr = vData?.total_errors ?? errorArr.length;

        setDetalhes((d) => ({ ...d, semWhatsapp: invalidArr, erroValidacao: errorArr }));

        if (totalValid === 0) {
          toast.error("Nenhum número com WhatsApp encontrado");
          setValidando(false);
          return;
        }

        const ok = confirm(
          `Validação concluída:\n\n` +
          `✅ ${totalValid} com WhatsApp\n` +
          `❌ ${totalInvalid} sem WhatsApp (descartados)\n` +
          `⚠️ ${totalErr} erros de validação (descartados)\n\n` +
          `Disparar template "${template.nome_template}" para ${totalValid} contatos em ${instanciaIds.length} instância(s), com delay ${lo}-${hi}s?`
        );
        if (!ok) { setValidando(false); return; }

        clientesFinal = recipients.filter((r) => validSet.has(r.telefone));
      } catch (e: any) {
        toast.error("Erro na validação: " + (e?.message || e));
        setValidando(false);
        return;
      }
      setValidando(false);
    } else {
      if (!confirm(`Disparar template "${template.nome_template}" para ${recipients.length} contatos em ${instanciaIds.length} instância(s), com delay ${lo}-${hi}s?`)) return;
    }

    // Loop client-side com suporte a pausa/cancelamento
    setEnviando(true);
    setPausado(false);
    pausedRef.current = false;
    cancelRef.current = false;
    setResultado(null);

    let enviados = 0;
    let erros = 0;
    let rr = 0;
    const total = clientesFinal.length;
    setProgresso({ enviados: 0, erros: 0, total, atualTelefone: "", atualInstancia: "", proximoEmSeg: 0 });

    const instAtivas = [...instanciaIds];
    const instMap = new Map(instancias.map((i) => [i.id, i] as const));

    const sleepInterruptible = async (segs: number) => {
      const ate = Date.now() + segs * 1000;
      while (Date.now() < ate) {
        if (cancelRef.current) return;
        while (pausedRef.current && !cancelRef.current) {
          await new Promise((r) => setTimeout(r, 250));
        }
        const restanteMs = Math.max(0, ate - Date.now());
        setProgresso((p) => p ? { ...p, proximoEmSeg: Math.ceil(restanteMs / 1000) } : p);
        await new Promise((r) => setTimeout(r, Math.min(250, restanteMs)));
      }
    };

    let cancelado = false;
    for (let i = 0; i < clientesFinal.length; i++) {
      if (cancelRef.current) { cancelado = true; break; }
      while (pausedRef.current && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, 250));
      }
      if (cancelRef.current) { cancelado = true; break; }

      if (instAtivas.length === 0) { toast.error("Todas as instâncias atingiram o limite diário"); break; }
      const instId = instAtivas[rr % instAtivas.length];
      const instInfo = instMap.get(instId);
      rr++;

      const cliente = clientesFinal[i];
      setProgresso((p) => p ? {
        ...p,
        atualTelefone: cliente.telefone,
        atualInstancia: instInfo?.nome || "",
        proximoEmSeg: 0,
      } : p);

      try {
        const { data, error } = await supabase.functions.invoke("send-whatsapp-meta", {
          body: { template_id: template.id, instancia_id: instId, cliente },
        });
        if (error) throw error;
        if (data?.tier_full) {
          const idx = instAtivas.indexOf(instId);
          if (idx >= 0) instAtivas.splice(idx, 1);
          i--; continue;
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
      setProgresso((p) => p ? { ...p, enviados, erros } : p);

      if (i < clientesFinal.length - 1 && !cancelRef.current) {
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
    toast.success(`${enviados} enviados • ${erros} erros${cancelado ? " (cancelado)" : ""}`);
    carregar();
    custoRef.current?.refetch();
  };

  const togglePausa = () => {
    const novo = !pausedRef.current;
    pausedRef.current = novo;
    setPausado(novo);
    toast.info(novo ? "Envio pausado" : "Envio retomado");
  };

  const cancelar = () => {
    if (!confirm("Cancelar o envio? Os contatos restantes não serão disparados.")) return;
    cancelRef.current = true;
    pausedRef.current = false;
    setPausado(false);
    toast.warning("Cancelando envio...");
  };

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (enviando) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enviando]);

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

      <div className="grid md:grid-cols-2 gap-6">
        {/* Template */}
        <Card>
          <CardHeader>
            <CardTitle>1. Template HSM</CardTitle>
            <CardDescription>Apenas templates aprovados pela Meta aparecem aqui.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum template aprovado. Sincronize templates na tela "API Oficial Meta".
              </p>
            ) : (
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2 w-full">
                        <span>{t.nome_template}</span>
                        <span className="text-xs text-muted-foreground">({t.idioma})</span>
                        {t.categoria && (
                          <Badge variant={t.categoria === 'MARKETING' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                            {t.categoria === 'MARKETING' ? 'Marketing' : t.categoria === 'UTILITY' ? 'Utilidade' : t.categoria}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <CardTitle>2. Instâncias</CardTitle>
            <CardDescription>Marque as instâncias para distribuir em round-robin.</CardDescription>
          </CardHeader>
          <CardContent>
            {instancias.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma instância ativa. Cadastre em "API Oficial Meta".
              </p>
            ) : (
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
            )}
          </CardContent>
        </Card>
      </div>

      {/* Destinatários */}
      <Card>
        <CardHeader>
          <CardTitle>3. Destinatários ({recipients.length})</CardTitle>
          <CardDescription>
            Uma linha por contato. Formato: <code>telefone, nome, cpf, atraso, saldo</code>. Apenas <code>telefone</code> é obrigatório.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            rows={10}
            value={recipientsRaw}
            onChange={(e) => setRecipientsRaw(e.target.value)}
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={enviar} disabled={enviando || validando} size="lg">
              {(enviando || validando) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {validando ? "Validando WhatsApp..." : enviando ? "Enviando..." : `Disparar ${recipients.length > 0 ? `(${recipients.length})` : ""}`}
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
            <div className="text-sm">
              <Badge variant="default" className="bg-green-600 mr-2">{resultado.enviados} enviados</Badge>
              {resultado.erros > 0 && <Badge variant="destructive" className="mr-2">{resultado.erros} erros</Badge>}
              <span className="text-muted-foreground">de {resultado.total} contatos</span>
            </div>
          )}

          {(enviando || detalhes.enviados.length > 0 || detalhes.erros.length > 0 || detalhes.semWhatsapp.length > 0 || detalhes.erroValidacao.length > 0) && (
            <DetalhesEnvioPainel detalhes={detalhes} />
          )}
        </CardContent>
      </Card>
    </div>
    </AppLayout>
  );
}

function DetalhesEnvioPainel({ detalhes }: {
  detalhes: {
    enviados: { telefone: string; instancia?: string; erro?: string; ts: number }[];
    erros: { telefone: string; instancia?: string; erro?: string; ts: number }[];
    semWhatsapp: string[];
    erroValidacao: string[];
  };
}) {
  const copiar = async (linhas: string[], label: string) => {
    try {
      await navigator.clipboard.writeText(linhas.join("\n"));
      toast.success(`${label}: ${linhas.length} número(s) copiado(s)`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const exportarCSV = () => {
    const rows: string[] = ["telefone,status,instancia,erro"];
    const esc = (s: string) => `"${(s || "").replace(/"/g, '""')}"`;
    detalhes.enviados.forEach((e) => rows.push(`${esc(e.telefone)},enviado,${esc(e.instancia || "")},`));
    detalhes.erros.forEach((e) => rows.push(`${esc(e.telefone)},erro,${esc(e.instancia || "")},${esc(e.erro || "")}`));
    detalhes.semWhatsapp.forEach((t) => rows.push(`${esc(t)},sem_whatsapp,,`));
    detalhes.erroValidacao.forEach((t) => rows.push(`${esc(t)},erro_validacao,,`));
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `envio-meta-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Section = ({ titulo, cor, count, children, onCopy }: { titulo: string; cor: string; count: number; children: React.ReactNode; onCopy?: () => void }) => (
    <details className="rounded-md border bg-card" open={count > 0 && count <= 20}>
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center justify-between gap-2">
        <span className={cor}>{titulo} <span className="text-muted-foreground font-normal">({count})</span></span>
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Detalhamento dos envios</h4>
        <Button type="button" size="sm" variant="outline" onClick={exportarCSV}>Exportar CSV</Button>
      </div>

      <Section
        titulo="✅ Enviados"
        cor="text-green-600"
        count={detalhes.enviados.length}
        onCopy={() => copiar(detalhes.enviados.map((e) => e.telefone), "Enviados")}
      >
        {detalhes.enviados.map((e, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <span>{e.telefone}</span>
            <span className="text-muted-foreground">{e.instancia} · {new Date(e.ts).toLocaleTimeString()}</span>
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
