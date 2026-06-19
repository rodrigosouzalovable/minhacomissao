import { useEffect, useMemo, useState } from "react";
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
import { Loader2, Send, RefreshCw } from "lucide-react";

type Instancia = {
  id: string;
  nome: string;
  phone_number_id: string;
  display_phone: string | null;
  tier_diario: number;
  enviados_hoje: number;
  ativo: boolean;
};

type Template = {
  id: string;
  nome_template: string;
  body_text: string | null;
  status: string;
  idioma: string;
  variaveis: Record<string, string> | null;
  instancia_id: string;
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

  const carregar = async () => {
    setLoading(true);
    const [i, t] = await Promise.all([
      supabase.from("meta_whatsapp_instances").select("*").eq("ativo", true).order("nome"),
      supabase.from("meta_whatsapp_templates").select("*").eq("status", "approved").order("nome_template"),
    ]);
    if (i.data) setInstancias(i.data as any);
    if (t.data) setTemplates(t.data as any);
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

    if (!confirm(`Disparar template "${template.nome_template}" para ${recipients.length} contatos em ${instanciaIds.length} instância(s), com delay ${lo}-${hi}s?`)) return;

    setEnviando(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-meta", {
        body: {
          template_id: template.id,
          instancia_ids: instanciaIds,
          clientes: recipients,
          min_sec: lo,
          max_sec: hi,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha no envio");
      setResultado({ enviados: data.enviados || 0, erros: data.erros || 0, total: data.total || 0 });
      toast.success(`${data.enviados} enviados • ${data.erros} erros`);
      carregar();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    }
    setEnviando(false);
  };

  const variaveisDoTemplate = template?.variaveis
    ? Object.entries(template.variaveis).sort(([a], [b]) => Number(a) - Number(b))
    : [];

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
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
                      {t.nome_template} <span className="text-xs text-muted-foreground ml-2">({t.idioma})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {template && (
              <div className="bg-muted/40 border rounded p-3 text-sm whitespace-pre-wrap">
                {template.body_text || <em className="text-muted-foreground">Sem corpo</em>}
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
                {instancias.map((i) => (
                  <label key={i.id} className="flex items-center gap-3 p-2 rounded border hover:bg-muted/40 cursor-pointer">
                    <Checkbox
                      checked={instanciaIds.includes(i.id)}
                      onCheckedChange={() => toggleInstancia(i.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{i.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.display_phone || i.phone_number_id} • {i.enviados_hoje}/{i.tier_diario} hoje
                      </div>
                    </div>
                    <Badge variant={i.enviados_hoje >= i.tier_diario ? "destructive" : "secondary"}>
                      {Math.max(i.tier_diario - i.enviados_hoje, 0)} restantes
                    </Badge>
                  </label>
                ))}
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

          <Button onClick={enviar} disabled={enviando} size="lg">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Disparar {recipients.length > 0 ? `(${recipients.length})` : ""}
          </Button>

          {resultado && (
            <div className="text-sm">
              <Badge variant="default" className="bg-green-600 mr-2">{resultado.enviados} enviados</Badge>
              {resultado.erros > 0 && <Badge variant="destructive" className="mr-2">{resultado.erros} erros</Badge>}
              <span className="text-muted-foreground">de {resultado.total} contatos</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
