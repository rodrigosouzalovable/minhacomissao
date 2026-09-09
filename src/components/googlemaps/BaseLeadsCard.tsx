import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Database, Download, Loader2, Search } from "lucide-react";

const PAGE_SIZE = 50;

type LeadBase = {
  id: string;
  nome: string | null;
  telefone: string | null;
  categoria: string | null;
  endereco: string | null;
  site: string | null;
  avaliacao: number | null;
  total_avaliacoes: number | null;
  tem_whatsapp: boolean | null;
  usado_aquecimento_em: string | null;
  resultado_aquecimento: string | null;
  instagram_username: string | null;
  instagram_seguidores: number | null;
  created_at: string;
};

const COLUNAS =
  "id, nome, telefone, categoria, endereco, site, avaliacao, total_avaliacoes, tem_whatsapp, usado_aquecimento_em, resultado_aquecimento, instagram_username, instagram_seguidores, created_at";

function aplicarFiltros(
  q: any,
  f: { busca: string; soWhats: boolean; soUsados: boolean; soResponderam: boolean; nicho: string },
) {
  if (f.soWhats) q = q.eq("tem_whatsapp", true);
  if (f.soUsados) q = q.not("usado_aquecimento_em", "is", null);
  if (f.soResponderam) q = q.eq("resultado_aquecimento", "respondeu");
  if (f.nicho.trim()) q = q.ilike("categoria", `%${f.nicho.trim()}%`);
  const b = f.busca.trim();
  if (b) q = q.or(`nome.ilike.%${b}%,telefone.ilike.%${b}%,endereco.ilike.%${b}%`);
  return q;
}

function rotuloWhatsapp(l: LeadBase) {
  if (!l.telefone) return "Sem telefone";
  if (l.tem_whatsapp === true) return "Sim";
  if (l.tem_whatsapp === false) return "Não";
  return "Aguardando verificação";
}

export function BaseLeadsCard() {
  const [busca, setBusca] = useState("");
  const [nicho, setNicho] = useState("");
  const [soWhats, setSoWhats] = useState(false);
  const [soUsados, setSoUsados] = useState(false);
  const [soResponderam, setSoResponderam] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [baixando, setBaixando] = useState(false);

  const filtros = useMemo(
    () => ({ busca, nicho, soWhats, soUsados, soResponderam }),
    [busca, nicho, soWhats, soUsados, soResponderam],
  );

  const { data, isFetching } = useQuery({
    queryKey: ["gm-base-leads", filtros, pagina],
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("google_maps_leads")
        .select(COLUNAS, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(pagina * PAGE_SIZE, pagina * PAGE_SIZE + PAGE_SIZE - 1);
      q = aplicarFiltros(q, filtros);
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as LeadBase[], total: count ?? 0 };
    },
  });

  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function reset(fn: () => void) {
    fn();
    setPagina(0);
  }

  async function baixarExcel() {
    setBaixando(true);
    try {
      const XLSX = await import("xlsx");
      const linhas: LeadBase[] = [];
      for (let p = 0; p < 40; p++) {
        let q = supabase
          .from("google_maps_leads")
          .select(COLUNAS)
          .order("created_at", { ascending: false })
          .range(p * 1000, p * 1000 + 999);
        q = aplicarFiltros(q, filtros);
        const { data, error } = await q;
        if (error) throw error;
        const bloco = (data ?? []) as unknown as LeadBase[];
        linhas.push(...bloco);
        if (bloco.length < 1000) break;
      }
      if (!linhas.length) {
        toast.error("Nenhum lead para exportar com esses filtros.");
        return;
      }
      const rows = linhas.map((l) => ({
        Empresa: l.nome ?? "",
        Telefone: l.telefone ?? "",
        "Tem WhatsApp": rotuloWhatsapp(l),
        Nicho: l.categoria ?? "",
        Endereço: l.endereco ?? "",
        Site: l.site ?? "",
        Avaliação: l.avaliacao ?? "",
        "Nº avaliações": l.total_avaliacoes ?? "",
        Instagram: l.instagram_username ? `@${l.instagram_username}` : "",
        Seguidores: l.instagram_seguidores ?? "",
        "Usado no aquecimento": l.usado_aquecimento_em
          ? new Date(l.usado_aquecimento_em).toLocaleDateString("pt-BR")
          : "",
        "Resultado do aquecimento": l.resultado_aquecimento ?? "",
        "Captado em": new Date(l.created_at).toLocaleDateString("pt-BR"),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Base de leads");
      XLSX.writeFile(wb, `base-leads-google-maps-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${rows.length} leads exportados`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Base de leads captados {total > 0 && <Badge variant="secondary">{total}</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={verificarPendentes} disabled={verificando}>
              {verificando ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-2" />
              )}
              Verificar pendentes
            </Button>
            <Button size="sm" onClick={baixarExcel} disabled={baixando}>
              {baixando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Baixar Excel
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 w-56"
              placeholder="Empresa, telefone ou cidade"
              value={busca}
              onChange={(e) => reset(() => setBusca(e.target.value))}
            />
          </div>
          <Input
            className="w-44"
            placeholder="Nicho (ex.: clínica)"
            value={nicho}
            onChange={(e) => reset(() => setNicho(e.target.value))}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={soWhats} onCheckedChange={(v) => reset(() => setSoWhats(!!v))} />
            Só com WhatsApp
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={soUsados} onCheckedChange={(v) => reset(() => setSoUsados(!!v))} />
            Já usados no aquecimento
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={soResponderam} onCheckedChange={(v) => reset(() => setSoResponderam(!!v))} />
            Só quem respondeu
          </label>
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Nicho</TableHead>
                <TableHead>Cidade / endereço</TableHead>
                <TableHead className="text-right">⭐</TableHead>
                <TableHead>Instagram</TableHead>
                <TableHead>Aquecimento</TableHead>
                <TableHead>Captado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rows ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium max-w-[220px] truncate">{l.nome}</TableCell>
                  <TableCell className="whitespace-nowrap">{l.telefone ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {!l.telefone ? (
                      <span className="text-xs text-muted-foreground">Sem telefone</span>
                    ) : l.tem_whatsapp === true ? (
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Sim</Badge>
                    ) : l.tem_whatsapp === false ? (
                      <Badge variant="secondary">Não</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-500">
                        Aguardando verificação
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate">{l.categoria ?? "—"}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-muted-foreground">{l.endereco ?? "—"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {l.avaliacao ? `${l.avaliacao} (${l.total_avaliacoes ?? 0})` : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {l.instagram_username
                      ? `@${l.instagram_username}${l.instagram_seguidores ? ` · ${l.instagram_seguidores}` : ""}`
                      : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {l.usado_aquecimento_em ? (
                      <span className="text-xs">
                        {new Date(l.usado_aquecimento_em).toLocaleDateString("pt-BR")}
                        {l.resultado_aquecimento ? ` · ${l.resultado_aquecimento}` : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">nunca usado</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(l.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
              {!isFetching && !(data?.rows ?? []).length && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                    Nenhum lead encontrado com esses filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {pagina + 1} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pagina + 1 >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
