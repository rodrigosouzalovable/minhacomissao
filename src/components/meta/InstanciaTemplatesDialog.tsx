import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TemplateWhatsAppPreview from "@/components/meta/TemplateWhatsAppPreview";

type Row = {
  id: string;
  nome_template: string;
  body_text: string | null;
  categoria: string | null;
  idioma: string;
  status: string;
  variaveis: any;
  sincronizado_em: string | null;
};

interface Props {
  instancia: { id: string; nome: string; display_phone?: string | null } | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSincronizar?: () => Promise<void> | void;
}

const FILTROS = [
  { key: "todos", label: "Todos" },
  { key: "approved", label: "Aprovados" },
  { key: "pending", label: "Pendentes" },
  { key: "rejected", label: "Rejeitados" },
] as const;

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "default";
  if (s === "rejected") return "destructive";
  return "secondary";
}

export default function InstanciaTemplatesDialog({ instancia, open, onOpenChange, onSincronizar }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [marcados, setMarcados] = useState<{ nome_template: string; idioma: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<string>("todos");
  const [sel, setSel] = useState<Row | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  const carregar = async () => {
    if (!instancia) return;
    setLoading(true);
    const [t, m] = await Promise.all([
      supabase
        .from("meta_whatsapp_templates")
        .select("id, nome_template, body_text, categoria, idioma, status, variaveis, sincronizado_em")
        .eq("instancia_id", instancia.id)
        .order("nome_template"),
      supabase
        .from("meta_templates_mestre")
        .select("nome, idioma")
        .eq("injetar_em_novos", true),
    ]);
    if (t.error) toast.error("Erro ao carregar templates: " + t.error.message);
    setRows(((t.data as any[]) || []) as Row[]);
    setMarcados(
      (((m.data as any[]) || []) as any[]).map((r) => ({
        nome_template: r.nome as string,
        idioma: (r.idioma as string) || "pt_BR",
      }))
    );
    setSel(null);
    setLoading(false);
  };

  useEffect(() => {
    if (open) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, instancia?.id]);

  const chaves = useMemo(
    () => new Set(rows.map((r) => `${r.nome_template}|${r.idioma || "pt_BR"}`)),
    [rows]
  );
  const marcadosSet = useMemo(() => new Set(marcados.map((m) => m.nome_template)), [marcados]);
  const faltando = useMemo(
    () => marcados.filter((m) => !chaves.has(`${m.nome_template}|${m.idioma || "pt_BR"}`)),
    [marcados, chaves]
  );

  const aprovados = rows.filter((r) => String(r.status).toLowerCase() === "approved").length;

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      const s = String(r.status || "").toLowerCase();
      if (filtro !== "todos" && s !== filtro) return false;
      if (q && !r.nome_template.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, busca, filtro]);

  const sincronizar = async () => {
    if (!instancia) return;
    setSincronizando(true);
    try {
      if (onSincronizar) {
        await onSincronizar();
      } else {
        const { error } = await supabase.functions.invoke("meta-sync-templates", {
          body: { instancia_id: instancia.id },
        });
        if (error) throw error;
      }
      await carregar();
    } catch (err: any) {
      toast.error("Erro ao sincronizar: " + (err?.message || "falhou"));
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Templates de {instancia?.nome}
            {instancia?.display_phone ? ` · ${instancia.display_phone}` : ""}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {loading ? "Carregando..." : `${aprovados} aprovados de ${rows.length} vinculados a esta instância`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pelo nome..."
            className="h-8 text-xs max-w-[240px]"
          />
          {FILTROS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filtro === f.key ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setFiltro(f.key)}
            >
              {f.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" className="h-8 text-xs ml-auto" onClick={sincronizar} disabled={sincronizando}>
            {sincronizando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Sincronizar com a Meta
          </Button>
        </div>

        {faltando.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
            <div className="flex items-center gap-1 font-medium mb-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Modelos marcados para números novos que faltam aqui ({faltando.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {faltando.map((f) => (
                <Badge key={f.nome_template} variant="outline" className="text-[10px] font-mono">
                  {f.nome_template}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : lista.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum template encontrado para esta instância com os filtros atuais.
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {lista.map((r) => (
              <button
                key={r.id}
                onClick={() => setSel(sel?.id === r.id ? null : r)}
                className="w-full text-left px-3 py-2 hover:bg-muted/50 flex flex-wrap items-center gap-2"
              >
                <span className="text-xs font-medium font-mono">{r.nome_template}</span>
                <Badge variant={statusVariant(r.status)} className="text-[10px]">
                  {String(r.status).toLowerCase()}
                </Badge>
                {r.categoria && (
                  <Badge variant="outline" className="text-[10px]">
                    {r.categoria}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {r.idioma}
                </Badge>
                {marcadosSet.has(r.nome_template) && (
                  <Badge className="text-[10px] bg-orange-500 hover:bg-orange-500">Injetar em números novos</Badge>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {r.sincronizado_em ? new Date(r.sincronizado_em).toLocaleString("pt-BR") : "—"}
                </span>
              </button>
            ))}
          </div>
        )}

        {sel && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Prévia de {sel.nome_template}</div>
            <TemplateWhatsAppPreview template={sel as any} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
