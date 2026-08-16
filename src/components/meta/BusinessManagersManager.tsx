import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Star, StarOff, Pencil, Check, X, Gauge } from "lucide-react";
import { useBmCotas } from "@/hooks/useBmCotas";
import { useUserRole } from "@/hooks/useUserRole";
import { Progress } from "@/components/ui/progress";


interface BM {
  id: string;
  nome: string;
  app_id: string;
  business_id: string | null;
  descricao: string | null;
  ativo: boolean;
  padrao: boolean;
  tier_diario: number | null;
  tier_ilimitado: boolean | null;
  tier_manual?: boolean | null;

  criado_em: string;
}

export default function BusinessManagersManager() {
  const [items, setItems] = useState<BM[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { cotaDaBm, recarregar: recarregarCotas } = useBmCotas();
  const { role } = useUserRole();
  const isAdmin = role === "admin";

  const [tierEditId, setTierEditId] = useState<string | null>(null);
  const [tierValor, setTierValor] = useState("");
  const [tierIlimitado, setTierIlimitado] = useState(false);

  const [nome, setNome] = useState("");
  const [appId, setAppId] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [descricao, setDescricao] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editAppId, setEditAppId] = useState("");
  const [editBusinessId, setEditBusinessId] = useState("");
  const [editDescricao, setEditDescricao] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("meta_business_managers")
      .select("*")
      .order("padrao", { ascending: false })
      .order("criado_em", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error("Falha ao carregar BMs: " + error.message);
      return;
    }
    setItems((data || []) as BM[]);
  }

  useEffect(() => { load(); }, []);

  async function adicionar() {
    if (!nome.trim() || !appId.trim()) {
      toast.error("Informe nome e App ID");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("meta_business_managers").insert({
      nome: nome.trim(),
      app_id: appId.trim(),
      business_id: businessId.trim() || null,
      descricao: descricao.trim() || null,
      ativo: true,
      padrao: isAdmin && items.length === 0, // primeira do admin vira padrão
    });
    setSaving(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("BM cadastrada");
    setNome(""); setAppId(""); setBusinessId(""); setDescricao("");
    load();
  }

  async function toggleAtivo(bm: BM) {
    const { error } = await supabase
      .from("meta_business_managers")
      .update({ ativo: !bm.ativo })
      .eq("id", bm.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function definirPadrao(bm: BM) {
    // limpar padrão anterior + marcar novo (unique index só permite 1)
    const { error: e1 } = await supabase
      .from("meta_business_managers")
      .update({ padrao: false })
      .eq("padrao", true);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase
      .from("meta_business_managers")
      .update({ padrao: true })
      .eq("id", bm.id);
    if (e2) return toast.error(e2.message);
    toast.success("BM padrão atualizada");
    load();
  }

  async function excluir(bm: BM) {
    if (!confirm(`Excluir BM "${bm.nome}"?`)) return;
    const { error } = await supabase
      .from("meta_business_managers")
      .delete()
      .eq("id", bm.id);
    if (error) return toast.error(error.message);
    toast.success("BM excluída");
    load();
  }

  async function salvarEdicao(bm: BM) {
    const novoNome = editNome.trim();
    const novoAppId = editAppId.trim();
    if (!novoNome) {
      toast.error("Informe um nome");
      return;
    }
    if (!novoAppId) {
      toast.error("Informe o App ID");
      return;
    }
    const { error } = await supabase
      .from("meta_business_managers")
      .update({
        nome: novoNome,
        app_id: novoAppId,
        business_id: editBusinessId.trim() || null,
        descricao: editDescricao.trim() || null,
      })
      .eq("id", bm.id);
    if (error) return toast.error(error.message);
    toast.success("BM atualizada");
    setEditingId(null);
    load();
  }

  function iniciarEdicao(bm: BM) {
    setEditingId(bm.id);
    setEditNome(bm.nome);
    setEditAppId(bm.app_id || "");
    setEditBusinessId(bm.business_id || "");
    setEditDescricao(bm.descricao || "");
  }

  async function salvarTier(bm: BM) {
    const valor = Math.max(0, Number(tierValor.replace(/\D/g, "")) || 0);
    if (!tierIlimitado && valor === 0) {
      toast.error("Informe o limite diário da BM (ou marque como ilimitado)");
      return;
    }
    const { error } = await (supabase as any)
      .from("meta_business_managers")
      .update({ tier_diario: valor, tier_ilimitado: tierIlimitado, tier_manual: true })
      .eq("id", bm.id);
    if (error) return toast.error(error.message);
    toast.success(`Limite da BM "${bm.nome}" atualizado — vale para todos os WhatsApps vinculados`);
    setTierEditId(null);
    await Promise.all([load(), recarregarCotas()]);
  }

  async function usarTierAutomatico(bm: BM) {
    const { error } = await (supabase as any)
      .from("meta_business_managers")
      .update({ tier_manual: false, tier_ilimitado: false })
      .eq("id", bm.id);
    if (error) return toast.error(error.message);
    toast.success(`Limite da BM "${bm.nome}" agora segue o maior tier dos WhatsApps vinculados`);
    setTierEditId(null);
    await Promise.all([load(), recarregarCotas()]);
  }

  function iniciarTier(bm: BM) {
    const c = cotaDaBm(bm.id);
    setTierEditId(bm.id);
    setTierValor(String(c?.tier_diario ?? bm.tier_diario ?? 0));
    setTierIlimitado((c?.tier_ilimitado ?? bm.tier_ilimitado) === true);
  }


  function cancelarEdicao() {
    setEditingId(null);
    setEditNome("");
    setEditAppId("");
    setEditBusinessId("");
    setEditDescricao("");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Nova Business Manager</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Nome (identificação interna)</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: BM Certificadora" />
            </div>
            <div>
              <Label>App ID</Label>
              <Input value={appId} onChange={(e) => setAppId(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex.: 2328366971280850" />
              <p className="text-xs text-muted-foreground mt-1">
                developers.facebook.com → seu app → Configurações → Básico → ID do Aplicativo
              </p>
            </div>
            <div>
              <Label>Business ID (opcional)</Label>
              <Input value={businessId} onChange={(e) => setBusinessId(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex.: 534024399567963" />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: BM para chips do time comercial" rows={1} />
            </div>
          </div>
          <Button onClick={adicionar} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Cadastrar BM
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business Managers cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma BM cadastrada.</p>
          ) : (
            <div className="space-y-2">
              {items.map((bm) => (
                <div key={bm.id} className="flex flex-col md:flex-row md:items-center gap-3 border rounded-lg p-3">
                  <div className="flex-1">
                    {editingId === bm.id ? (
                      <div className="space-y-2">
                        <div className="grid md:grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Nome</Label>
                            <Input
                              value={editNome}
                              onChange={(e) => setEditNome(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Escape") cancelarEdicao(); }}
                              className="h-8 text-sm"
                              autoFocus
                            />
                          </div>
                          <div>
                            <Label className="text-xs">App ID</Label>
                            <Input
                              value={editAppId}
                              onChange={(e) => setEditAppId(e.target.value.replace(/\D/g, ""))}
                              onKeyDown={(e) => { if (e.key === "Escape") cancelarEdicao(); }}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Business ID</Label>
                            <Input
                              value={editBusinessId}
                              onChange={(e) => setEditBusinessId(e.target.value.replace(/\D/g, ""))}
                              onKeyDown={(e) => { if (e.key === "Escape") cancelarEdicao(); }}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Descrição</Label>
                            <Textarea
                              value={editDescricao}
                              onChange={(e) => setEditDescricao(e.target.value)}
                              rows={1}
                              className="text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => salvarEdicao(bm)}>
                            <Check className="h-4 w-4 mr-1" /> Salvar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelarEdicao}>
                            <X className="h-4 w-4 mr-1" /> Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{bm.nome}</span>
                          {bm.padrao && <Badge className="bg-amber-500/15 text-amber-600">Padrão</Badge>}
                          {!bm.ativo && <Badge variant="outline">Inativa</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          App ID: <code>{bm.app_id}</code>
                          {bm.business_id && <> · Business ID: <code>{bm.business_id}</code></>}
                        </div>
                        {bm.descricao && (
                          <p className="text-xs text-muted-foreground mt-1">{bm.descricao}</p>
                        )}
                        {(() => {
                          const c = cotaDaBm(bm.id);
                          const manual = bm.tier_manual === true;
                          const ilimitado = (c?.tier_ilimitado ?? bm.tier_ilimitado) === true;
                          const tier = Number(c?.tier_diario ?? bm.tier_diario ?? 0);
                          const usados = c?.enviados_24h ?? 0;
                          const pct = ilimitado || tier <= 0 ? 0 : Math.min(100, Math.round((usados / tier) * 100));
                          return (
                            <div className="mt-2 space-y-1">
                              {tierEditId === bm.id ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    value={tierValor}
                                    onChange={(e) => setTierValor(e.target.value.replace(/\D/g, ""))}
                                    disabled={tierIlimitado}
                                    className="h-8 w-28 text-sm"
                                    placeholder="Ex.: 2000"
                                  />
                                  <label className="flex items-center gap-1 text-xs">
                                    Ilimitado
                                    <Switch checked={tierIlimitado} onCheckedChange={setTierIlimitado} />
                                  </label>
                                  <Button size="sm" onClick={() => salvarTier(bm)}>
                                    <Check className="h-4 w-4 mr-1" /> Salvar limite
                                  </Button>
                                  <Button size="sm" variant="secondary" onClick={() => usarTierAutomatico(bm)}>
                                    Automático (tier dos WhatsApps)
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setTierEditId(null)}>
                                    <X className="h-4 w-4 mr-1" /> Cancelar
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-xs">
                                  <Badge variant={!ilimitado && tier > 0 && usados >= tier ? "destructive" : "secondary"}>
                                    {ilimitado
                                      ? `Tier ilimitado · ${usados} enviadas em 24h`
                                      : tier > 0
                                        ? `Tier ${tier}/dia · ${usados} usadas · ${Math.max(tier - usados, 0)} restantes`
                                        : "Tier não definido"}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px]">
                                    {manual ? "manual" : "automático"}
                                  </Badge>
                                  <Button size="sm" variant="outline" className="h-7" onClick={() => iniciarTier(bm)}>
                                    <Gauge className="h-3.5 w-3.5 mr-1" /> Definir tier
                                  </Button>
                                </div>
                              )}
                              {!ilimitado && tier > 0 && <Progress value={pct} className="h-1.5" />}
                              <p className="text-[11px] text-muted-foreground">
                                Limite compartilhado por todos os WhatsApps desta BM (janela móvel de 24h).
                                {!manual && " Segue o maior tier configurado nos WhatsApps vinculados."}
                              </p>

                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs">
                      Ativa <Switch checked={bm.ativo} onCheckedChange={() => toggleAtivo(bm)} />
                    </div>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => iniciarEdicao(bm)}
                      title="Editar nome"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="outline" size="sm"
                        onClick={() => definirPadrao(bm)}
                        disabled={bm.padrao}
                        title="Definir como BM padrão"
                      >
                        {bm.padrao ? <Star className="w-4 h-4" /> : <StarOff className="w-4 h-4" />}
                      </Button>
                    )}

                    <Button variant="outline" size="sm" onClick={() => excluir(bm)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
