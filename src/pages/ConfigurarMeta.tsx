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
import { Loader2, Plus, RefreshCw, Trash2, Copy, CheckCircle2, XCircle, Power } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";

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
              <code>messages</code> (respostas) e <code>message_template_status_update</code> (status de templates)
            </p>
          </div>
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
          {templates.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              Nenhum template sincronizado. Clique em "Templates" em uma instância para sincronizar da Meta.
            </CardContent></Card>
          ) : (
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Idioma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Corpo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.nome_template}</TableCell>
                      <TableCell>{t.categoria || "—"}</TableCell>
                      <TableCell>{t.idioma}</TableCell>
                      <TableCell>
                        <Badge variant={t.status === "APPROVED" ? "default" : "secondary"}>
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate text-xs">{t.body_text}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
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
    </div>
    </AppLayout>
  );
}
