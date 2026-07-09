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
import { Loader2, Plus, Send, Trash2, RefreshCw, X } from "lucide-react";
import TemplateWhatsAppPreview from "@/components/meta/TemplateWhatsAppPreview";

type Categoria = "UTILITY" | "MARKETING" | "AUTHENTICATION";
type BotaoTipo = "QUICK_REPLY" | "URL" | "PHONE_NUMBER";

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
  criado_em: string;
}

interface Instancia {
  id: string;
  nome: string;
  display_phone: string | null;
  ativo: boolean;
  waba_id: string | null;
}

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

function extractVars(text: string): number {
  const matches = Array.from(text.matchAll(/\{\{\s*(\d+)\s*\}\}/g));
  if (matches.length === 0) return 0;
  return Math.max(...matches.map((m) => Number(m[1])));
}

export default function MetaTemplates() {
  const [tab, setTab] = useState("criar");
  const [mestres, setMestres] = useState<Mestre[]>([]);
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [templInst, setTemplInst] = useState<TemplateInst[]>([]);
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
  const [salvando, setSalvando] = useState(false);

  // aplicar em lote
  const [selMestre, setSelMestre] = useState<string>("");
  const [selInst, setSelInst] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const [m, i, ti] = await Promise.all([
      supabase.from("meta_templates_mestre").select("*").order("criado_em", { ascending: false }),
      supabase.from("meta_whatsapp_instances").select("id, nome, display_phone, ativo, waba_id").order("nome"),
      supabase.from("meta_templates_instancia").select("id, template_mestre_id, instancia_id, status, erro, motivo_rejeicao, meta_template_id"),
    ]);
    setMestres((m.data as any) || []);
    setInstancias((i.data as any) || []);
    setTemplInst((ti.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    const ch = supabase.channel("meta-templates-inst")
      .on("postgres_changes", { event: "*", schema: "public", table: "meta_templates_instancia" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "meta_templates_mestre" }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const nVarsCorpo = useMemo(() => extractVars(corpo), [corpo]);

  useEffect(() => {
    setExemploBody((prev) => {
      const arr = [...prev];
      while (arr.length < nVarsCorpo) arr.push("");
      arr.length = nVarsCorpo;
      return arr;
    });
  }, [nVarsCorpo]);

  const validarSlug = (v: string) => /^[a-z0-9_]+$/.test(v);

  const salvarMestre = async () => {
    if (!validarSlug(nome)) {
      toast.error("Nome deve conter apenas letras minúsculas, números e sublinhado (ex: boleto_vencimento)");
      return;
    }
    if (!corpo.trim()) { toast.error("Corpo é obrigatório"); return; }
    if (nVarsCorpo > 0 && exemploBody.some((v) => !v.trim())) {
      toast.error("Preencha os exemplos das variáveis para a Meta aprovar");
      return;
    }

    setSalvando(true);
    const exemplo: any = {};
    if (nVarsCorpo > 0) exemplo.body_text = [exemploBody];

    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("meta_templates_mestre").insert({
      nome,
      categoria,
      idioma,
      corpo,
      cabecalho_tipo: cabecalhoTipo === "NONE" ? null : cabecalhoTipo,
      cabecalho_texto: cabecalhoTipo === "TEXT" ? cabecalhoTexto : null,
      rodape: rodape || null,
      botoes: botoes as any,
      exemplo,
      criado_por: user.user?.id,
    });
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Template mestre criado. Vá em 'Aplicar em lote'.");
    setNome(""); setCorpo(""); setRodape(""); setCabecalhoTexto("");
    setCabecalhoTipo("NONE"); setBotoes([]); setExemploBody([]);
    setTab("lote");
  };

  const addBotao = (tipo: BotaoTipo) => {
    if (botoes.length >= 3) { toast.error("Máximo 3 botões"); return; }
    setBotoes([...botoes, { type: tipo, text: "" }]);
  };

  const enviarLote = async () => {
    if (!selMestre) { toast.error("Selecione um template"); return; }
    if (selInst.size === 0) { toast.error("Selecione ao menos uma instância"); return; }

    setEnviando(true);
    const { data, error } = await supabase.functions.invoke("meta-criar-template-lote", {
      body: { mestre_id: selMestre, instancia_ids: Array.from(selInst) },
    });
    setEnviando(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.success === false) { toast.error((data as any).error || "Falha"); return; }
    toast.success(`Enviado: ${(data as any)?.sucessos ?? 0} sucesso(s), ${(data as any)?.falhas ?? 0} falha(s)`);
    carregar();
  };

  const reenviarFalhas = async (mestreId: string) => {
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke("meta-criar-template-lote", {
      body: { mestre_id: mestreId, apenas_falhas: true },
    });
    setEnviando(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Reenviado: ${(data as any)?.sucessos ?? 0} ok, ${(data as any)?.falhas ?? 0} falhas`);
    carregar();
  };

  const verificarStatus = async () => {
    const { error } = await supabase.functions.invoke("meta-verificar-status-templates", { body: {} });
    if (error) { toast.error(error.message); return; }
    toast.success("Verificação iniciada");
    setTimeout(carregar, 1500);
  };

  const deletarMestre = async (id: string) => {
    if (!confirm("Excluir template mestre e todos os registros por instância?")) return;
    const { error } = await supabase.from("meta_templates_mestre").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    carregar();
  };

  const contagemPorMestre = (mestreId: string): Record<string, number> => {
    const filhas = templInst.filter((t) => t.template_mestre_id === mestreId);
    const c: Record<string, number> = { total: filhas.length };
    filhas.forEach((f) => { c[f.status] = (c[f.status] || 0) + 1; });
    return c;
  };

  const instAtivas = instancias.filter((i) => i.ativo);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-4">
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
          </TabsList>

          {/* ===== Criar ===== */}
          <TabsContent value="criar" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Novo template mestre</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label>Nome (slug)</Label>
                    <Input value={nome} onChange={(e) => setNome(e.target.value.toLowerCase())}
                      placeholder="boleto_vencimento_novo_mundo" />
                    <p className="text-xs text-muted-foreground mt-1">apenas a-z, 0-9 e _</p>
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
                    <Select value={cabecalhoTipo} onValueChange={setCabecalhoTipo}>
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

                <div>
                  <Label>Corpo *</Label>
                  <Textarea rows={5} value={corpo} onChange={(e) => setCorpo(e.target.value)}
                    placeholder="Olá {{1}}, seu boleto de R$ {{2}} vence em {{3}}." />
                  <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                    <span>Use {"{{1}}"}, {"{{2}}"}... para variáveis. {nVarsCorpo} variável(is) detectada(s).</span>
                    <span>{corpo.length}/1024</span>
                  </div>
                </div>

                {nVarsCorpo > 0 && (
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

                <div>
                  <Label>Rodapé</Label>
                  <Input value={rodape} onChange={(e) => setRodape(e.target.value)} maxLength={60} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
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

                <Button onClick={salvarMestre} disabled={salvando}>
                  {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Salvar template mestre
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Lote ===== */}
          <TabsContent value="lote" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Aplicar template em várias instâncias</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Template mestre</Label>
                  <Select value={selMestre} onValueChange={setSelMestre}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {mestres.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.nome} ({m.categoria})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selInst.size === instAtivas.length && instAtivas.length > 0}
                      onCheckedChange={(v) => {
                        if (v) setSelInst(new Set(instAtivas.map((i) => i.id)));
                        else setSelInst(new Set());
                      }}
                    />
                    <Label>Todas as {instAtivas.length} instâncias ativas</Label>
                  </div>

                  <div className="max-h-96 overflow-y-auto rounded-md border">
                    {instAtivas.map((inst) => {
                      const t = templInst.find((x) => x.instancia_id === inst.id && x.template_mestre_id === selMestre);
                      const status = t?.status;
                      return (
                        <div key={inst.id} className="flex items-center gap-3 border-b last:border-0 p-2 hover:bg-muted/40">
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
                          {status && (
                            <div className="flex flex-col items-end gap-1 max-w-[260px]">
                              <Badge className={STATUS_COLORS[status] || ""}>{status}</Badge>
                              {(t?.erro || t?.motivo_rejeicao) && (
                                <span
                                  className="text-[11px] text-destructive text-right leading-tight line-clamp-2"
                                  title={t?.erro || t?.motivo_rejeicao || ""}
                                >
                                  {t?.erro || t?.motivo_rejeicao}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button onClick={enviarLote} disabled={enviando || !selMestre || selInst.size === 0}>
                  {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Enviar para Meta ({selInst.size})
                </Button>
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
                      <Button size="sm" variant="outline" onClick={() => reenviarFalhas(m.id)} disabled={enviando}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Reenviar falhas
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deletarMestre(m.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
                              <span className="flex-1">{inst?.nome || f.instancia_id} <span className="text-xs text-muted-foreground">{inst?.display_phone}</span></span>
                              <Badge className={STATUS_COLORS[f.status] || ""}>{f.status}</Badge>
                              {(f.erro || f.motivo_rejeicao) && (
                                <span className="text-xs text-destructive truncate max-w-xs" title={f.erro || f.motivo_rejeicao || ""}>
                                  {f.erro || f.motivo_rejeicao}
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
      </div>
    </AppLayout>
  );
}
