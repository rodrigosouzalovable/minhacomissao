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
import { Loader2, Plus, Trash2, Star, StarOff } from "lucide-react";

interface BM {
  id: string;
  nome: string;
  app_id: string;
  business_id: string | null;
  descricao: string | null;
  ativo: boolean;
  padrao: boolean;
  criado_em: string;
}

export default function BusinessManagersManager() {
  const [items, setItems] = useState<BM[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState("");
  const [appId, setAppId] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [descricao, setDescricao] = useState("");

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
      padrao: items.length === 0, // primeira vira padrão
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
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs">
                      Ativa <Switch checked={bm.ativo} onCheckedChange={() => toggleAtivo(bm)} />
                    </div>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => definirPadrao(bm)}
                      disabled={bm.padrao}
                      title="Definir como BM padrão"
                    >
                      {bm.padrao ? <Star className="w-4 h-4" /> : <StarOff className="w-4 h-4" />}
                    </Button>
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
