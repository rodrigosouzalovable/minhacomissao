import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Building2, Smartphone, Copy, ExternalLink } from "lucide-react";

type Cliente = {
  id: string;
  nome: string;
  documento: string | null;
  responsavel_nome: string | null;
  responsavel_email: string | null;
  responsavel_telefone: string | null;
  ativo: boolean;
  access_token: string | null;
  token_expira_em: string | null;
  meta_app_id: string | null;
  meta_business_id: string | null;
  criado_em: string;
};

type Ativo = {
  business: { id: string; name: string };
  waba: { id: string; name: string; status?: string };
  phones: {
    id: string;
    display_phone_number: string;
    verified_name: string;
    name_status: string;
    quality_rating: string;
    messaging_limit_tier: string;
  }[];
};

declare global {
  interface Window {
    FB?: any;
  }
}

export default function ParceirosMetaTab() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", documento: "", responsavel_nome: "", responsavel_email: "", responsavel_telefone: "" });
  const [salvando, setSalvando] = useState(false);
  const [configId, setConfigId] = useState("");
  const [ativosMap, setAtivosMap] = useState<Record<string, Ativo[]>>({});
  const [carregandoAtivos, setCarregandoAtivos] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("meta_partner_clients").select("*").order("criado_em", { ascending: false });
    if (error) toast.error("Erro ao carregar clientes: " + error.message);
    else setClientes((data as Cliente[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    const saved = localStorage.getItem("meta_embedded_signup_config_id");
    if (saved) setConfigId(saved);
    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      document.body.appendChild(script);
    }
  }, []);

  const salvarConfigId = (val: string) => {
    setConfigId(val);
    localStorage.setItem("meta_embedded_signup_config_id", val);
  };

  const criarCliente = async () => {
    if (!form.nome.trim()) return toast.error("Nome do cliente é obrigatório");
    setSalvando(true);
    const { error } = await supabase.from("meta_partner_clients").insert({
      nome: form.nome.trim(),
      documento: form.documento.trim() || null,
      responsavel_nome: form.responsavel_nome.trim() || null,
      responsavel_email: form.responsavel_email.trim() || null,
      responsavel_telefone: form.responsavel_telefone.trim() || null,
      ativo: true,
    });
    if (error) toast.error("Erro ao criar cliente: " + error.message);
    else {
      toast.success("Cliente criado");
      setDialogOpen(false);
      setForm({ nome: "", documento: "", responsavel_nome: "", responsavel_email: "", responsavel_telefone: "" });
      carregar();
    }
    setSalvando(false);
  };

  const listarAtivos = async (clienteId: string) => {
    setCarregandoAtivos((p) => ({ ...p, [clienteId]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("meta-partner-listar-ativos", { body: { cliente_id: clienteId } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao listar ativos");
      setAtivosMap((p) => ({ ...p, [clienteId]: data.ativos || [] }));
    } catch (err: any) {
      toast.error(err?.message || "Erro ao listar ativos");
    }
    setCarregandoAtivos((p) => ({ ...p, [clienteId]: false }));
  };

  const refreshToken = async (clienteId: string) => {
    setRefreshing((p) => ({ ...p, [clienteId]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("meta-partner-refresh-token", { body: { cliente_id: clienteId } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao renovar token");
      toast.success("Token renovado até " + new Date(data.expira_em).toLocaleDateString("pt-BR"));
      carregar();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao renovar token");
    }
    setRefreshing((p) => ({ ...p, [clienteId]: false }));
  };

  const iniciarEmbeddedSignup = (clienteId: string) => {
    if (!configId.trim()) return toast.error("Configure o Config ID do Embedded Signup primeiro");
    if (!window.FB) return toast.error("SDK do Facebook não carregado. Aguarde ou recarregue a página.");
    window.FB.init({ appId: "1081283281394312", cookie: true, xfbml: true, version: "v21.0" });
    window.FB.login(
      async (response: any) => {
        if (response.authResponse?.code) {
          try {
          const { data, error } = await supabase.functions.invoke("meta-partner-onboarding", {
              body: {
                code: response.authResponse.code,
                cliente_id: clienteId,
                redirect_uri: window.location.origin + window.location.pathname,
              },
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || "Falha no onboarding");
            toast.success("Conta conectada! " + (data.ativos?.length || 0) + " ativo(s) encontrado(s).");
            carregar();
            listarAtivos(clienteId);
          } catch (err: any) {
            toast.error(err?.message || "Erro ao conectar conta");
          }
        } else {
          toast.error("Autorização cancelada ou não concluída");
        }
      },
      { config_id: configId.trim(), response_type: "code", override_default_response_type: true, extras: { setup: {} } }
    );
  };

  const copiar = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copiado");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Clientes do Parceiro Meta</CardTitle>
          <CardDescription>Gerencie empresas que compartilham ativos WhatsApp com o Meus Acordos via Solution Partner.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1 w-full">
              <Label htmlFor="meta-config-id">Config ID do Embedded Signup</Label>
              <Input id="meta-config-id" value={configId} onChange={(e) => salvarConfigId(e.target.value)} placeholder="Ex: 1234567890_1234567890" />
              <p className="text-xs text-muted-foreground mt-1">Crie o Config ID no painel da aplicação Meta (WhatsApp → Configuration → Embedded Signup).</p>
            </div>
            <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Novo cliente</Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : clientes.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Nenhum cliente cadastrado. Crie o primeiro para iniciar o embedded signup.</div>
          ) : (
            <div className="space-y-4">
              {clientes.map((c) => (
                <Card key={c.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-base">{c.nome}</h3>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {c.documento && <p>Doc: {c.documento}</p>}
                          {c.responsavel_nome && <p>Resp: {c.responsavel_nome}</p>}
                          {c.responsavel_email && <p>{c.responsavel_email}</p>}
                          {c.responsavel_telefone && <p>{c.responsavel_telefone}</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => listarAtivos(c.id)} disabled={carregandoAtivos[c.id]}>
                          {carregandoAtivos[c.id] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Smartphone className="h-4 w-4 mr-2" />}
                          Listar ativos
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => refreshToken(c.id)} disabled={refreshing[c.id]}>
                          {refreshing[c.id] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                          Renovar token
                        </Button>
                        <Button size="sm" onClick={() => iniciarEmbeddedSignup(c.id)}><ExternalLink className="h-4 w-4 mr-2" /> Conectar Meta</Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant={c.access_token ? "default" : "secondary"}>{c.access_token ? "Token configurado" : "Sem token"}</Badge>
                      {c.token_expira_em && (
                        <Badge variant={new Date(c.token_expira_em) < new Date() ? "destructive" : "outline"}>
                          Expira: {new Date(c.token_expira_em).toLocaleDateString("pt-BR")}
                        </Badge>
                      )}
                    </div>

                    {ativosMap[c.id]?.length > 0 && (
                      <div className="rounded border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Business</TableHead>
                              <TableHead>WABA</TableHead>
                              <TableHead>Número</TableHead>
                              <TableHead>Verificado</TableHead>
                              <TableHead>Qualidade</TableHead>
                              <TableHead>Tier</TableHead>
                              <TableHead className="w-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ativosMap[c.id].flatMap((a) =>
                              a.phones.length === 0
                                ? [<TableRow key={`${a.waba.id}-empty`}><TableCell>{a.business.name}</TableCell><TableCell>{a.waba.name}</TableCell><TableCell colSpan={5} className="text-muted-foreground text-xs">Nenhum número nesta WABA</TableCell></TableRow>]
                                : a.phones.map((p) => (
                                    <TableRow key={p.id}>
                                      <TableCell className="text-xs">{a.business.name}</TableCell>
                                      <TableCell className="text-xs">{a.waba.name}</TableCell>
                                      <TableCell className="font-mono text-xs">{p.display_phone_number}</TableCell>
                                      <TableCell className="text-xs">{p.verified_name}</TableCell>
                                      <TableCell className="text-xs">{p.quality_rating}</TableCell>
                                      <TableCell className="text-xs">{p.messaging_limit_tier}</TableCell>
                                      <TableCell><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copiar(p.display_phone_number)}><Copy className="h-3.5 w-3.5" /></Button></TableCell>
                                    </TableRow>
                                  ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo cliente do parceiro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome da empresa *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Amaral Cobranças" /></div>
            <div><Label>Documento (CNPJ/CPF)</Label><Input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} placeholder="00.000.000/0000-00" /></div>
            <div><Label>Nome do responsável</Label><Input value={form.responsavel_nome} onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value })} /></div>
            <div><Label>E-mail do responsável</Label><Input type="email" value={form.responsavel_email} onChange={(e) => setForm({ ...form, responsavel_email: e.target.value })} /></div>
            <div><Label>Telefone do responsável</Label><Input value={form.responsavel_telefone} onChange={(e) => setForm({ ...form, responsavel_telefone: e.target.value })} placeholder="62999999999" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={criarCliente} disabled={salvando}>{salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
