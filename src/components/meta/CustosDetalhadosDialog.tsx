import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

// Preços por categoria (Brasil, rate card Meta 07/2026)
const PRECO_USD: Record<string, number> = {
  MARKETING: 0.0625,
  UTILITY: 0.0068,
  AUTHENTICATION: 0.0068,
  SERVICE: 0,
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const usdFmt = (v: number) =>
  `US$ ${(v || 0).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;

type Snapshot = {
  waba_id: string;
  dia: string;
  conversation_category: string;
  conversation_type: string | null;
  conversations_count: number;
  cost_usd: number;
  cost_brl: number;
  fx_rate: number;
};

type EnvioLog = {
  id: string;
  instancia_id: string;
  telefone: string;
  template_nome: string | null;
  status: string;
  enviado_em: string;
  foi_gratis: boolean | null;
  pricing_category: string | null;
  pricing_type: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function CustosDetalhadosDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [envios, setEnvios] = useState<EnvioLog[]>([]);
  const [dataFiltro, setDataFiltro] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [busca, setBusca] = useState("");
  const [paginaMsg, setPaginaMsg] = useState(0);
  const PAGE = 100;

  const carregar = async () => {
    setLoading(true);
    try {
      const inicio = `${dataFiltro}T00:00:00-03:00`;
      const fim = `${dataFiltro}T23:59:59-03:00`;

      const [sn, ev] = await Promise.all([
        supabase
          .from("meta_billing_snapshot")
          .select("*")
          .order("dia", { ascending: false })
          .limit(500),
        supabase
          .from("meta_whatsapp_envios_log")
          .select("id, instancia_id, telefone, template_nome, status, enviado_em, foi_gratis, pricing_category, pricing_type")
          .gte("enviado_em", inicio)
          .lte("enviado_em", fim)
          .order("enviado_em", { ascending: false })
          .limit(5000),
      ]);
      setSnapshots((sn.data as any) || []);
      setEnvios((ev.data as any) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setPaginaMsg(0);
      carregar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dataFiltro]);

  const sincronizar = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-billing-sync", {
        body: { days: 35 },
      });
      if (error) throw error;
      toast.success(`Sincronizado (${data?.upserted || 0} registros)`);
      await carregar();
    } catch (e: any) {
      toast.error("Falha ao sincronizar: " + (e?.message || e));
    } finally {
      setSyncing(false);
    }
  };

  // --- ABA 1: por dia ---
  const porDia = useMemo(() => {
    const map = new Map<string, { total_brl: number; total_usd: number; conv: number; itens: Snapshot[] }>();
    for (const s of snapshots) {
      const cur = map.get(s.dia) || { total_brl: 0, total_usd: 0, conv: 0, itens: [] };
      cur.total_brl += Number(s.cost_brl || 0);
      cur.total_usd += Number(s.cost_usd || 0);
      cur.conv += Number(s.conversations_count || 0);
      cur.itens.push(s);
      map.set(s.dia, cur);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [snapshots]);

  // fx_rate do dia filtrado (fallback 5.5)
  const fxRateDia = useMemo(() => {
    const s = snapshots.find((x) => x.dia === dataFiltro);
    return s ? Number(s.fx_rate || 5.5) : 5.5;
  }, [snapshots, dataFiltro]);

  const custoUnitario = (cat: string | null, foiGratis: boolean | null) => {
    if (foiGratis) return { usd: 0, brl: 0 };
    const catUp = String(cat || "").toUpperCase();
    const usd = PRECO_USD[catUp] ?? 0;
    return { usd, brl: usd * fxRateDia };
  };

  // --- ABA 2: por conversa (agrupada por telefone+categoria no dia) ---
  const porConversa = useMemo(() => {
    const map = new Map<string, { telefone: string; categoria: string; tipo: string; foi_gratis: boolean; qtd: number; primeira: string; custo_brl: number; custo_usd: number }>();
    for (const e of envios) {
      const cat = String(e.pricing_category || "").toUpperCase() || "—";
      const key = `${e.telefone}|${cat}`;
      const cur = map.get(key) || {
        telefone: e.telefone,
        categoria: cat,
        tipo: e.pricing_type || "",
        foi_gratis: !!e.foi_gratis,
        qtd: 0,
        primeira: e.enviado_em,
        custo_brl: 0,
        custo_usd: 0,
      };
      cur.qtd++;
      if (e.enviado_em < cur.primeira) cur.primeira = e.enviado_em;
      // custo por CONVERSA é cobrado 1x pela Meta — atribuímos ao primeiro envio da conversa
      if (cur.qtd === 1) {
        const c = custoUnitario(cat, e.foi_gratis);
        cur.custo_usd = c.usd;
        cur.custo_brl = c.brl;
      }
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => (a.primeira < b.primeira ? 1 : -1));
  }, [envios, fxRateDia]);

  // --- ABA 3: por mensagem ---
  const enviosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return envios;
    return envios.filter(
      (e) =>
        e.telefone?.toLowerCase().includes(q) ||
        (e.template_nome || "").toLowerCase().includes(q),
    );
  }, [envios, busca]);

  const enviosPagina = useMemo(
    () => enviosFiltrados.slice(paginaMsg * PAGE, (paginaMsg + 1) * PAGE),
    [enviosFiltrados, paginaMsg],
  );

  // Totais do rodapé (dia filtrado)
  const totais = useMemo(() => {
    let brlLog = 0, usdLog = 0, gratis = 0, pagas = 0;
    // custo real = soma por conversa (não por mensagem)
    for (const c of porConversa) {
      if (c.foi_gratis) gratis += c.qtd;
      else pagas += c.qtd;
      brlLog += c.custo_brl;
      usdLog += c.custo_usd;
    }
    // custo Meta real (snapshot) para o mesmo dia
    const snapDia = snapshots.filter((s) => s.dia === dataFiltro);
    const brlMeta = snapDia.reduce((a, s) => a + Number(s.cost_brl || 0), 0);
    const divergencia = brlMeta > 0 ? ((brlLog - brlMeta) / brlMeta) * 100 : 0;
    return { brlLog, usdLog, gratis, pagas, brlMeta, divergencia };
  }, [porConversa, snapshots, dataFiltro]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Custos detalhados — Meta WhatsApp</DialogTitle>
          <DialogDescription>
            Controle minucioso: por dia (real cobrado pela Meta), por conversa e por mensagem enviada.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Data:</label>
            <Input
              type="date"
              value={dataFiltro}
              onChange={(e) => setDataFiltro(e.target.value)}
              className="w-[160px] h-8"
            />
          </div>
          <Button size="sm" variant="outline" onClick={sincronizar} disabled={syncing}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Sincronizar com Meta
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/admin/meta-billing">
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ver histórico completo
            </Link>
          </Button>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <div className="ml-auto text-xs text-muted-foreground">
            Câmbio USD→BRL: <span className="font-mono">{fxRateDia.toFixed(4)}</span>
          </div>
        </div>

        <Tabs defaultValue="dia" className="flex-1 flex flex-col overflow-hidden">
          <TabsList>
            <TabsTrigger value="dia">Por dia</TabsTrigger>
            <TabsTrigger value="conversa">Por conversa ({porConversa.length})</TabsTrigger>
            <TabsTrigger value="mensagem">Por mensagem ({enviosFiltrados.length})</TabsTrigger>
          </TabsList>

          {/* ABA 1 */}
          <TabsContent value="dia" className="flex-1 overflow-auto mt-2">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Dia</TableHead>
                  <TableHead className="text-right">Conversas</TableHead>
                  <TableHead className="text-right">USD</TableHead>
                  <TableHead className="text-right">BRL</TableHead>
                  <TableHead className="text-right">Câmbio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porDia.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                    Nenhum dado. Clique em "Sincronizar com Meta".
                  </TableCell></TableRow>
                )}
                {porDia.map(([dia, info]) => (
                  <>
                    <TableRow key={dia} className="cursor-pointer" onClick={() => setDataFiltro(dia)}>
                      <TableCell className="font-medium">
                        {new Date(dia + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{info.conv}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{usdFmt(info.total_usd)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{brl(info.total_brl)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                        {info.itens[0]?.fx_rate ? Number(info.itens[0].fx_rate).toFixed(4) : "-"}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/20">
                      <TableCell colSpan={5} className="py-1">
                        <div className="flex flex-wrap gap-1 text-xs">
                          {info.itens.map((it, i) => (
                            <Badge key={i} variant="outline" className="font-mono">
                              {it.conversation_category}{it.conversation_type ? `/${it.conversation_type}` : ""}: {it.conversations_count} · {brl(Number(it.cost_brl))}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  </>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* ABA 2 */}
          <TabsContent value="conversa" className="flex-1 overflow-auto mt-2">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Início</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Msgs</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porConversa.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                    Nenhuma conversa em {new Date(dataFiltro + "T00:00:00").toLocaleDateString("pt-BR")}.
                  </TableCell></TableRow>
                )}
                {porConversa.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs tabular-nums">
                      {new Date(c.primeira).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.telefone}</TableCell>
                    <TableCell>
                      <Badge variant={c.categoria === "MARKETING" ? "destructive" : c.categoria === "UTILITY" ? "default" : "secondary"}>
                        {c.categoria}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.foi_gratis ? <Badge className="bg-emerald-600">GRÁTIS (CSW)</Badge> : c.tipo || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.qtd}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="font-semibold">{brl(c.custo_brl)}</span>
                      <div className="text-[10px] text-muted-foreground">{usdFmt(c.custo_usd)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* ABA 3 */}
          <TabsContent value="mensagem" className="flex-1 overflow-auto mt-2 space-y-2">
            <div className="flex items-center gap-2 sticky top-0 bg-background z-10 py-1">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por telefone ou template..."
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setPaginaMsg(0); }}
                className="h-8 text-sm"
              />
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {enviosFiltrados.length} msgs · pg {paginaMsg + 1}/{Math.max(1, Math.ceil(enviosFiltrados.length / PAGE))}
              </div>
              <Button size="sm" variant="outline" disabled={paginaMsg === 0} onClick={() => setPaginaMsg(p => Math.max(0, p - 1))}>‹</Button>
              <Button size="sm" variant="outline" disabled={(paginaMsg + 1) * PAGE >= enviosFiltrados.length} onClick={() => setPaginaMsg(p => p + 1)}>›</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enviosPagina.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                    Nenhuma mensagem.
                  </TableCell></TableRow>
                )}
                {enviosPagina.map((e) => {
                  const c = custoUnitario(e.pricing_category, e.foi_gratis);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs tabular-nums">
                        {new Date(e.enviado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{e.telefone}</TableCell>
                      <TableCell className="text-xs">{e.template_nome || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {(e.pricing_category || "—").toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {e.foi_gratis ? <Badge className="bg-emerald-600 text-[10px]">GRÁTIS</Badge> : (e.pricing_type || "—")}
                      </TableCell>
                      <TableCell className="text-xs">{e.status}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        <span>{brl(c.brl)}</span>
                        <div className="text-[10px] text-muted-foreground">{usdFmt(c.usd)}</div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>

        {/* Rodapé com totais */}
        <div className="border-t pt-3 mt-2 flex flex-wrap gap-4 items-center text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Custo estimado (log)</div>
            <div className="font-bold tabular-nums">{brl(totais.brlLog)}</div>
            <div className="text-[10px] text-muted-foreground">{usdFmt(totais.usdLog)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Custo real (Meta)</div>
            <div className="font-bold tabular-nums">{brl(totais.brlMeta)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Grátis / Pagas</div>
            <div className="font-bold tabular-nums">
              <span className="text-emerald-600">{totais.gratis}</span> / <span className="text-amber-600">{totais.pagas}</span>
            </div>
          </div>
          {totais.brlMeta > 0 && Math.abs(totais.divergencia) > 15 && (
            <div className="ml-auto text-xs text-amber-600 max-w-sm">
              ⚠️ Divergência {totais.divergencia.toFixed(0)}% entre log e Meta. Sincronize novamente ou aguarde a Meta fechar as conversas.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
