import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Clock, Search } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

const JANELA_24H_MS = 24 * 60 * 60 * 1000;
const ALERTA_1H_MS = 60 * 60 * 1000;

type ContatoJanela = {
  id: string;
  instancia_id: string;
  telefone: string;
  nome: string | null;
  ultima_msg_entrada_em: string;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  instancias: { id: string; nome: string; display_phone: string | null }[];
  onImportar?: (contatos: ContatoJanela[]) => void;
  onSelectConversa?: (contato: ContatoJanela) => void;
  mode?: "importar" | "abrir";
};

export default function Janela24hDialog({ open, onOpenChange, instancias, onImportar, onSelectConversa, mode = "importar" }: Props) {
  const [loading, setLoading] = useState(false);
  const [contatos, setContatos] = useState<ContatoJanela[]>([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "verde" | "amarelo">("todas");
  const [instFiltro, setInstFiltro] = useState<string>("todas");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [nowTick, setNowTick] = useState(Date.now());

  const carregar = async () => {
    setLoading(true);
    const desde = new Date(Date.now() - JANELA_24H_MS).toISOString();
    const { data, error } = await (supabase as any)
      .from("meta_whatsapp_contatos")
      .select("id, instancia_id, telefone, nome, ultima_msg_entrada_em")
      .not("ultima_msg_entrada_em", "is", null)
      .gte("ultima_msg_entrada_em", desde)
      .eq("arquivado", false)
      .order("ultima_msg_entrada_em", { ascending: false })
      .limit(2000);
    setLoading(false);
    if (error) {
      toast.error("Erro ao carregar: " + error.message);
      return;
    }
    setContatos((data || []) as ContatoJanela[]);
  };

  useEffect(() => {
    if (!open) return;
    carregar();
    setSelecionados(new Set());
    const id = setInterval(() => {
      if (document.visibilityState === "visible") setNowTick(Date.now());
    }, 30_000);
    return () => clearInterval(id);
  }, [open]);

  const instMap = useMemo(() => {
    const m = new Map<string, { nome: string; display_phone: string | null }>();
    for (const i of instancias) m.set(i.id, { nome: i.nome, display_phone: i.display_phone });
    return m;
  }, [instancias]);

  const enriquecidos = useMemo(() => {
    return contatos.map((c) => {
      const fim = new Date(c.ultima_msg_entrada_em).getTime() + JANELA_24H_MS;
      const msRestante = fim - nowTick;
      const status: "verde" | "amarelo" | "fechada" =
        msRestante <= 0 ? "fechada" : msRestante <= ALERTA_1H_MS ? "amarelo" : "verde";
      return { ...c, fim, msRestante, status };
    }).filter((c) => c.status !== "fechada");
  }, [contatos, nowTick]);

  const totalVerde = enriquecidos.filter((c) => c.status === "verde").length;
  const totalAmarelo = enriquecidos.filter((c) => c.status === "amarelo").length;

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return enriquecidos.filter((c) => {
      if (filtro === "verde" && c.status !== "verde") return false;
      if (filtro === "amarelo" && c.status !== "amarelo") return false;
      if (instFiltro !== "todas" && c.instancia_id !== instFiltro) return false;
      if (b) {
        const hay = `${c.nome || ""} ${c.telefone}`.toLowerCase();
        if (!hay.includes(b)) return false;
      }
      return true;
    });
  }, [enriquecidos, filtro, instFiltro, busca]);

  const todosSelecionados = filtrados.length > 0 && filtrados.every((c) => selecionados.has(c.id));
  const toggleTodos = () => {
    if (todosSelecionados) {
      const next = new Set(selecionados);
      filtrados.forEach((c) => next.delete(c.id));
      setSelecionados(next);
    } else {
      const next = new Set(selecionados);
      filtrados.forEach((c) => next.add(c.id));
      setSelecionados(next);
    }
  };
  const toggleUm = (id: string) => {
    const next = new Set(selecionados);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelecionados(next);
  };

  const importar = () => {
    const escolhidos = enriquecidos.filter((c) => selecionados.has(c.id));
    if (escolhidos.length === 0) {
      toast.error("Selecione ao menos um contato");
      return;
    }
    onImportar?.(escolhidos);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Conversas na janela de 24h
          </DialogTitle>
          <DialogDescription>
            Contatos que responderam nas últimas 24h — envio de texto livre está liberado (sem custo de template).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => setFiltro("todas")}
            className={`px-3 py-1 rounded-full text-xs border ${filtro === "todas" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
          >
            Todas ({enriquecidos.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltro("verde")}
            className={`px-3 py-1 rounded-full text-xs border flex items-center gap-1.5 ${filtro === "verde" ? "bg-green-600 text-white border-green-600" : "bg-background hover:bg-muted"}`}
          >
            <span className="h-2 w-2 rounded-full bg-green-500" /> Aberta ({totalVerde})
          </button>
          <button
            type="button"
            onClick={() => setFiltro("amarelo")}
            className={`px-3 py-1 rounded-full text-xs border flex items-center gap-1.5 ${filtro === "amarelo" ? "bg-yellow-500 text-white border-yellow-500" : "bg-background hover:bg-muted"}`}
          >
            <span className="h-2 w-2 rounded-full bg-yellow-400" /> Fecha em breve ({totalAmarelo})
          </button>
          <select
            className="ml-auto text-xs border rounded-md px-2 py-1 bg-background"
            value={instFiltro}
            onChange={(e) => setInstFiltro(e.target.value)}
          >
            <option value="todas">Todas instâncias</option>
            {instancias.map((i) => (
              <option key={i.id} value={i.id}>{i.nome}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="pl-7 h-8 text-xs"
          />
        </div>

        <div className="flex-1 overflow-auto border rounded-md min-h-[240px]">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Nenhuma conversa {filtro !== "todas" ? "nesse filtro" : "dentro da janela de 24h"}.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  {mode === "importar" && (
                    <th className="px-2 py-1.5 w-8">
                      <Checkbox checked={todosSelecionados} onCheckedChange={toggleTodos} />
                    </th>
                  )}
                  <th className="text-left px-2 py-1.5">Contato</th>
                  <th className="text-left px-2 py-1.5">Instância</th>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">Fecha em</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => {
                  const inst = instMap.get(c.instancia_id);
                  const handleRowClick = () => {
                    if (mode === "abrir") {
                      onSelectConversa?.(c);
                      onOpenChange(false);
                    } else {
                      toggleUm(c.id);
                    }
                  };
                  return (
                    <tr
                      key={c.id}
                      className="border-t hover:bg-muted/40 cursor-pointer"
                      onClick={handleRowClick}
                    >
                      {mode === "importar" && (
                        <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selecionados.has(c.id)} onCheckedChange={() => toggleUm(c.id)} />
                        </td>
                      )}
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${c.status === "verde" ? "bg-green-500" : "bg-yellow-400"}`} />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{c.nome || c.telefone}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{c.telefone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[180px]">
                        {inst?.nome || "—"}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <Badge variant="outline" className={c.status === "amarelo" ? "border-yellow-500 text-yellow-700 dark:text-yellow-400" : ""}>
                          {formatDistanceToNowStrict(new Date(c.fim), { locale: ptBR })}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            {mode === "importar"
              ? (selecionados.size > 0 ? `${selecionados.size} selecionado(s)` : `${filtrados.length} contato(s) listado(s)`)
              : `${filtrados.length} conversa(s) na janela · clique para abrir`}
          </div>
          <div className="flex gap-2">
            {mode === "importar" && (
              <Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())} disabled={selecionados.size === 0}>
                Limpar
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={carregar} disabled={loading}>
              Atualizar
            </Button>
            {mode === "importar" && (
              <Button size="sm" onClick={importar} disabled={selecionados.size === 0}>
                Importar para destinatários ({selecionados.size})
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
