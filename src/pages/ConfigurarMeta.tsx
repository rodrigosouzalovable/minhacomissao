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
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Trash2, Copy, CheckCircle2, XCircle, Power, AlertTriangle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import TemplatePreviewDialog from "@/components/meta/TemplatePreviewDialog";

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
  habilitado_envio_massa: boolean;
};

export default function ConfigurarMeta() {
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testando, setTestando] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState<string | null>(null);
  const [savingToken, setSavingToken] = useState(false);
  const [verifyToken, setVerifyToken] = useState("");
  const [previewTpl, setPreviewTpl] = useState<Template | null>(null);
  const [filtroInstancias, setFiltroInstancias] = useState<string[]>([]);

  const [assinando, setAssinando] = useState(false);
  const [resultadosAssinatura, setResultadosAssinatura] = useState<any[] | null>(null);
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
    const [i, t] = await Promise.all([
      supabase.from("meta_whatsapp_instances").select("*").order("criado_em", { ascending: false }),
      supabase.from("meta_whatsapp_templates").select("*").order("sincronizado_em", { ascending: false }),
    ]);
    if (i.data) setInstancias(i.data as Instancia[]);
    if (t.data) setTemplates(t.data as Template[]);
    setLoading(false);
  };

  const carregarToken = async () => {
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
    const { error } = await supabase
      .from("meta_whatsapp_config")
      .upsert({ chave: "webhook_verify_token", valor: novoToken.trim() }, { onConflict: "chave" });
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
    carregarToken();
  }, []);

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

    const { error } = await supabase.from("meta_whatsapp_instances").insert({
      user_id: user.id,
      nome: form.nome,
      phone_number_id: form.phone_number_id.trim(),
      waba_id: form.waba_id.trim(),
      business_id: form.business_id.trim() || null,
      access_token: form.access_token.trim(),
      tier_diario: parseInt(form.tier_diario) || 250,
      webhook_verify_token: gerarToken(),
    });
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Instância adicionada");
    setDialogOpen(false);
    setForm({ nome: "", phone_number_id: "", waba_id: "", business_id: "", access_token: "", tier_diario: "250" });
    carregar();
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

  const assinarWebhook = async () => {
    setAssinando(true);
    setResultadosAssinatura(null);
    try {
      const { data, error } = await supabase.functions.invoke("meta-subscribe-waba", { body: {} });
      if (error) throw error;
      setResultadosAssinatura(data?.resultados || []);
      const okCount = (data?.resultados || []).filter((r: any) => r.subscribe_ok && r.callback_confirmado).length;
      const total = (data?.resultados || []).length;
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
            <Label>Verify Token (compartilhado)</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Cole esse valor no campo "Verify Token" do webhook na HookCloud.
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
          <TabsTrigger value="instancias">Instâncias ({instancias.length})</TabsTrigger>
          <TabsTrigger value="templates">Templates HSM ({templates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="instancias">
          <div className="flex justify-end mb-3">
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nova instância
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : instancias.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              Nenhuma instância. Clique em "Nova instância" para começar.
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {instancias.map((inst) => (
                <Card key={inst.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{inst.nome}</h3>
                          {inst.ativo ? (
                            <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Ativa</Badge>
                          ) : (
                            <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Inativa</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                          <div><strong>Telefone:</strong> {inst.display_phone || "—"}</div>
                          <div><strong>Phone ID:</strong> <span className="font-mono">{inst.phone_number_id}</span></div>
                          <div><strong>WABA:</strong> <span className="font-mono">{inst.waba_id}</span></div>
                          <div><strong>Tier:</strong> {inst.enviados_hoje}/{inst.tier_diario} hoje</div>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">
                        <Button size="sm" variant="outline" onClick={() => testar(inst)} disabled={testando === inst.id}>
                          {testando === inst.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Testar"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => sincronizar(inst)} disabled={sincronizando === inst.id}>
                          {sincronizando === inst.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RefreshCw className="h-3 w-3 mr-1" />Templates</>}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggle(inst)}>
                          <Power className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => excluir(inst)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
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
                Marque os templates que devem aparecer na aba <strong>Envio Meta Massa</strong>. A coluna <strong>Cobertura</strong> mostra em quantas instâncias ativas o template está aprovado — só é seguro disparar em massa quando estiver 100%.
              </p>
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Massa</TableHead>
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
                      const groupsMap = new Map<string, { chave: string; nome: string; idioma: string; categoria: string | null; body_text: string | null; habilitado: boolean; rows: Template[]; sampleRow: Template }>();
                      for (const t of templates) {
                        const k = `${t.nome_template}::${t.idioma}`;
                        const g = groupsMap.get(k);
                        if (g) {
                          g.rows.push(t);
                          if (t.habilitado_envio_massa) g.habilitado = true;
                        } else {
                          groupsMap.set(k, {
                            chave: k,
                            nome: t.nome_template,
                            idioma: t.idioma,
                            categoria: t.categoria,
                            body_text: t.body_text,
                            habilitado: t.habilitado_envio_massa,
                            rows: [t],
                            sampleRow: t,
                          });
                        }
                      }
                      const groups = Array.from(groupsMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));

                      const toggleGrupo = async (g: typeof groups[number]) => {
                        const novo = !g.habilitado;
                        const ids = g.rows.map((r) => r.id);
                        const { error } = await supabase
                          .from("meta_whatsapp_templates")
                          .update({ habilitado_envio_massa: novo })
                          .in("id", ids);
                        if (error) { toast.error("Erro: " + error.message); return; }
                        toast.success(novo ? "Template liberado para Envio em Massa" : "Template removido do Envio em Massa");
                        setTemplates((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, habilitado_envio_massa: novo } : t));
                      };

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
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="h-4 w-4 cursor-pointer accent-primary"
                                checked={g.habilitado}
                                onChange={() => toggleGrupo(g)}
                                title={g.habilitado ? "Remover de Envio em Massa" : "Liberar para Envio em Massa"}
                              />
                            </TableCell>
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
      <TemplatePreviewDialog
        template={previewTpl}
        open={!!previewTpl}
        onOpenChange={(o) => !o && setPreviewTpl(null)}
        onSaved={carregar}
      />
    </div>
    </AppLayout>
  );
}
