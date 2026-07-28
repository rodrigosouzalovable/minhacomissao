import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Download, MapPin, Phone, Search, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

interface Lead {
  id: string;
  busca_id: string;
  nome: string;
  telefone: string | null;
  telefone_internacional: string | null;
  endereco: string | null;
  categoria: string | null;
  site: string | null;
  avaliacao: number | null;
  total_avaliacoes: number | null;
}

interface Busca {
  id: string;
  categoria: string;
  localizacao: string;
  total_resultados: number;
  custo_estimado_usd: number | null;
  status: string;
  created_at: string;
}

export default function GoogleMapsLeads() {
  const qc = useQueryClient();
  const [categoria, setCategoria] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [maxResultados, setMaxResultados] = useState(60);
  const [buscando, setBuscando] = useState(false);
  const [buscaSel, setBuscaSel] = useState<string | null>(null);
  const [somenteComTel, setSomenteComTel] = useState(true);

  const { data: limite, refetch: refetchLimite } = useQuery({
    queryKey: ["gm-limite"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("verificar-limite-google-maps", { body: {} });
      if (error) throw error;
      return data as {
        pode_buscar: boolean;
        consumo_atual: number;
        limite_maximo: number;
        limite_bloqueio: number;
        alerta_percentual: number;
        percentual_consumido: number;
        data_reset: string;
        data_reset_br: string;
        nivel: "normal" | "alto" | "critico" | "bloqueado";
        mensagem: string;
      };
    },
    refetchInterval: 60_000,
  });

  const { data: buscas } = useQuery({
    queryKey: ["gm-buscas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_maps_buscas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Busca[];
    },
  });

  const { data: leads } = useQuery({
    queryKey: ["gm-leads", buscaSel],
    enabled: !!buscaSel,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_maps_leads")
        .select("*")
        .eq("busca_id", buscaSel)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const leadsFiltrados = (leads ?? []).filter((l) => (somenteComTel ? !!l.telefone : true));

  async function buscar() {
    if (!categoria.trim() || !localizacao.trim()) {
      toast.error("Informe categoria e localização");
      return;
    }
    setBuscando(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-maps-buscar-leads", {
        body: { categoria, localizacao, max_resultados: maxResultados },
      });
      if (error) throw error;
      toast.success(
        `Busca concluída: ${data.total} resultados (${data.com_telefone} com telefone) — custo ~US$${data.custo_estimado_usd}`,
      );
      setBuscaSel(data.busca_id);
      qc.invalidateQueries({ queryKey: ["gm-buscas"] });
    } catch (e: any) {
      toast.error("Falha na busca: " + (e?.message ?? "erro"));
    } finally {
      setBuscando(false);
    }
  }

  function exportarExcel() {
    if (!leadsFiltrados.length) {
      toast.error("Nada para exportar");
      return;
    }
    const rows = leadsFiltrados.map((l) => ({
      Nome: l.nome,
      Telefone: l.telefone ?? "",
      "Telefone Internacional": l.telefone_internacional ?? "",
      Endereço: l.endereco ?? "",
      Categoria: l.categoria ?? "",
      Site: l.site ?? "",
      Avaliação: l.avaliacao ?? "",
      "Nº Avaliações": l.total_avaliacoes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    const buscaAtual = buscas?.find((b) => b.id === buscaSel);
    const nomeArq = `leads-${(buscaAtual?.categoria ?? "gm").replace(/\s+/g, "-")}-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, nomeArq);
  }

  function copiarTelefones() {
    const tels = leadsFiltrados.map((l) => l.telefone_internacional ?? l.telefone).filter(Boolean);
    if (!tels.length) {
      toast.error("Nenhum telefone");
      return;
    }
    navigator.clipboard.writeText(tels.join("\n"));
    toast.success(`${tels.length} telefones copiados`);
  }

  async function excluirBusca(id: string) {
    if (!confirm("Excluir esta busca e todos os leads dela?")) return;
    const { error } = await supabase.from("google_maps_buscas").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Busca excluída");
    if (buscaSel === id) setBuscaSel(null);
    qc.invalidateQueries({ queryKey: ["gm-buscas"] });
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <MapPin className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Google Maps Leads</h1>
          <p className="text-sm text-muted-foreground">
            Extraia empresas do Google Maps por categoria e localização (nome + telefone).
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova busca</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-1">
            <Label>Categoria / Nicho</Label>
            <Input
              placeholder="ex: pizzaria, dentista, oficina"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Localização</Label>
            <Input
              placeholder="ex: Goiânia GO, Setor Bueno Goiânia"
              value={localizacao}
              onChange={(e) => setLocalizacao(e.target.value)}
            />
          </div>
          <div>
            <Label>Máx. resultados (até 60)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={maxResultados}
              onChange={(e) => setMaxResultados(Number(e.target.value) || 60)}
            />
          </div>
          <div className="md:col-span-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Custo estimado: ~US$ {(maxResultados * 0.032).toFixed(2)} nesta busca (Text Search Pro).
            </p>
            <Button onClick={buscar} disabled={buscando}>
              {buscando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buscas recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-auto">
            {(buscas ?? []).map((b) => (
              <div
                key={b.id}
                className={`p-3 rounded-md border cursor-pointer text-sm ${
                  buscaSel === b.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                }`}
                onClick={() => setBuscaSel(b.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium truncate">{b.categoria}</div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      excluirBusca(b.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground truncate">{b.localizacao}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary">{b.total_resultados} leads</Badge>
                  {b.status !== "concluida" && <Badge variant="outline">{b.status}</Badge>}
                </div>
              </div>
            ))}
            {!buscas?.length && <p className="text-xs text-muted-foreground">Nenhuma busca ainda.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Leads {buscaSel ? `(${leadsFiltrados.length})` : ""}
            </CardTitle>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={somenteComTel}
                  onCheckedChange={(v) => setSomenteComTel(!!v)}
                />
                Só com telefone
              </label>
              <Button size="sm" variant="outline" onClick={copiarTelefones} disabled={!leadsFiltrados.length}>
                <Phone className="h-4 w-4 mr-2" /> Copiar telefones
              </Button>
              <Button size="sm" onClick={exportarExcel} disabled={!leadsFiltrados.length}>
                <Download className="h-4 w-4 mr-2" /> Exportar Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!buscaSel && <p className="text-sm text-muted-foreground">Selecione uma busca ou crie uma nova.</p>}
            {buscaSel && (
              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">⭐</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leadsFiltrados.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.nome}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {l.telefone_internacional ?? l.telefone ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                          {l.endereco ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">{l.categoria ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">
                          {l.avaliacao ? `${l.avaliacao} (${l.total_avaliacoes ?? 0})` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!leadsFiltrados.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                          Nenhum lead {somenteComTel ? "com telefone" : ""} nesta busca.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
