import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronLeft, ChevronRight, Eye, Search } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import CampanhaDetalheDialog from "@/components/meta/CampanhaDetalheDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useEnvioMetaSending } from "@/contexts/EnvioMetaSendingContext";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 20;

type Delivery = { job_id: string; aceito: number; entregue: number; lida: number; falhou: number; aguardando: number };

const statusLabels: Record<string, string> = {
  rodando: "Rodando", pausado: "Pausada", concluido: "Concluída", cancelado: "Cancelada", erro: "Erro",
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "concluido") return "default";
  if (status === "erro") return "destructive";
  if (status === "rodando" || status === "pausado") return "secondary";
  return "outline";
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "—";
}

function formatMoney(value: unknown) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CampanhasMeta() {
  const { user } = useAuth();
  const { ensureJobLoaded } = useEnvioMetaSending();
  const [page, setPage] = useState(0);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("todos");
  const [folderId, setFolderId] = useState("todas");
  const [instanciaId, setInstanciaId] = useState("todas");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [jobAberto, setJobAberto] = useState<string | null>(null);

  const { data: folders = [] } = useQuery({
    queryKey: ["campanhas-meta-folders", user?.id],
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("meta_inbox_folders").select("id,nome,cor").order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: instances = [] } = useQuery({
    queryKey: ["campanhas-meta-instances", user?.id],
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("meta_whatsapp_instances").select("id,nome,display_phone").order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["campanhas-meta-history", user?.id, page, busca, status, folderId, instanciaId, de, ate],
    enabled: Boolean(user),
    placeholderData: (old) => old,
    queryFn: async () => {
      if (!user) return { rows: [] as any[], count: 0, delivery: new Map<string, Delivery>() };
      let query = supabase
        .from("envio_meta_job")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const termo = busca.trim();
      if (termo) query = query.ilike("nome_campanha", `%${termo.replace(/[%_]/g, "")}%`);
      if (status !== "todos") query = query.eq("status", status);
      if (folderId === "sem") query = query.is("folder_id", null);
      else if (folderId !== "todas") query = query.eq("folder_id", folderId);
      if (instanciaId !== "todas") query = query.contains("instancia_ids", [instanciaId]);
      if (de) query = query.gte("created_at", new Date(`${de}T00:00:00`).toISOString());
      if (ate) query = query.lte("created_at", new Date(`${ate}T23:59:59`).toISOString());
      const { data: rows, count, error: queryError } = await query;
      if (queryError) throw queryError;
      const ids = (rows || []).map((row: any) => row.id);
      const delivery = new Map<string, Delivery>();
      if (ids.length) {
        const { data: summaries } = await (supabase as any).rpc("envio_meta_jobs_delivery_resumo", { _job_ids: ids });
        for (const summary of summaries || []) delivery.set(summary.job_id, summary as Delivery);
      }
      return { rows: rows || [], count: count || 0, delivery };
    },
  });

  const folderNames = useMemo(() => new Map(folders.map((f: any) => [f.id, f.nome])), [folders]);
  const instanceNames = useMemo(() => new Map(instances.map((i: any) => [i.id, [i.nome, i.display_phone].filter(Boolean).join(" · ")])), [instances]);
  const rows = data?.rows || [];
  const count = data?.count || 0;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const totals = rows.reduce((acc: { enviados: number; erros: number; custo: number }, row: any) => ({
    enviados: acc.enviados + Number(row.enviados || 0),
    erros: acc.erros + Number(row.erros || 0),
    custo: acc.custo + Number(row.custo_brl || 0),
  }), { enviados: 0, erros: 0, custo: 0 });

  const abrirDetalhes = async (id: string) => {
    await ensureJobLoaded(id);
    setJobAberto(id);
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><BarChart3 className="h-6 w-6" /> Campanhas</h1>
            <p className="text-sm text-muted-foreground">Histórico e resultados das campanhas iniciadas pelo seu login.</p>
          </div>
          <Badge variant="secondary">{count.toLocaleString("pt-BR")} campanhas</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Enviadas nesta página</p><p className="text-2xl font-semibold">{totals.enviados.toLocaleString("pt-BR")}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Erros nesta página</p><p className="text-2xl font-semibold">{totals.erros.toLocaleString("pt-BR")}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Custo calculado nesta página</p><p className="text-2xl font-semibold">{formatMoney(totals.custo)}</p></CardContent></Card>
        </div>

        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
            <div className="relative xl:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Nome da campanha" value={busca} onChange={(e) => { setBusca(e.target.value); setPage(0); }} /></div>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os status</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            <Select value={folderId} onValueChange={(v) => { setFolderId(v); setPage(0); }}><SelectTrigger><SelectValue placeholder="Caixa do Inbox" /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as pastas</SelectItem><SelectItem value="sem">Caixa padrão / não informada</SelectItem>{folders.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent></Select>
            <Select value={instanciaId} onValueChange={(v) => { setInstanciaId(v); setPage(0); }}><SelectTrigger><SelectValue placeholder="Instância Meta" /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as instâncias</SelectItem>{instances.map((i: any) => <SelectItem key={i.id} value={i.id}>{[i.nome, i.display_phone].filter(Boolean).join(" · ")}</SelectItem>)}</SelectContent></Select>
            <div className="grid grid-cols-2 gap-2"><Input aria-label="Data inicial" title="Data inicial" type="date" value={de} onChange={(e) => { setDe(e.target.value); setPage(0); }} /><Input aria-label="Data final" title="Data final" type="date" value={ate} onChange={(e) => { setAte(e.target.value); setPage(0); }} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Campanha</TableHead><TableHead>Período</TableHead><TableHead>Caixa / instâncias</TableHead><TableHead>Envio</TableHead><TableHead>Entrega</TableHead><TableHead>Blacklist</TableHead><TableHead>Custo</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Carregando campanhas…</TableCell></TableRow>}
                  {!isLoading && error && <TableRow><TableCell colSpan={8} className="py-10 text-center text-destructive">Não foi possível carregar as campanhas.</TableCell></TableRow>}
                  {!isLoading && !error && rows.length === 0 && <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Nenhuma campanha encontrada.</TableCell></TableRow>}
                  {rows.map((row: any) => {
                    const delivery = data?.delivery.get(row.id);
                    const names = (row.instancia_ids || []).map((id: string) => instanceNames.get(id) || id);
                    const blacklist = Array.isArray(row.bloqueados_blacklist) ? row.bloqueados_blacklist.length : 0;
                    return <TableRow key={row.id}>
                      <TableCell className="min-w-[220px]"><div className="font-medium">{row.nome_campanha || row.template_nome || "Campanha sem nome"}</div><div className="mt-1 flex flex-wrap gap-1"><Badge variant={statusVariant(row.status)}>{statusLabels[row.status] || row.status}</Badge>{row.template_nome && <Badge variant="outline" className="font-mono text-[10px]">{row.template_nome}</Badge>}</div></TableCell>
                      <TableCell className="min-w-[170px] text-xs"><div>{formatDate(row.iniciado_em || row.created_at)}</div><div className="text-muted-foreground">até {formatDate(row.concluido_em)}</div></TableCell>
                      <TableCell className="min-w-[210px] text-xs"><div>{row.folder_id ? (folderNames.get(row.folder_id) || "Pasta não disponível") : "Caixa padrão / não informada"}</div><div className="mt-1 max-w-[260px] truncate text-muted-foreground" title={names.join(" • ")}>{names.length ? names.join(" • ") : "Sem instância registrada"}</div></TableCell>
                      <TableCell className="text-xs"><div><strong>{Number(row.enviados || 0).toLocaleString("pt-BR")}</strong> / {Number(row.total || 0).toLocaleString("pt-BR")}</div><div className="text-muted-foreground">{Number(row.erros || 0)} erros · {Number(row.sem_whatsapp || 0)} sem WhatsApp</div></TableCell>
                      <TableCell className="text-xs"><div>{Number(delivery?.entregue || 0)} entregues</div><div className="text-muted-foreground">{Number(delivery?.lida || 0)} lidas</div></TableCell>
                      <TableCell>{blacklist.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-xs">{row.custo_brl == null ? <span className="text-muted-foreground">Indisponível</span> : <><strong>{formatMoney(row.custo_brl)}</strong><div className="text-muted-foreground">US$ {Number(row.custo_usd || 0).toFixed(2)}</div></>}</TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => void abrirDetalhes(row.id)}><Eye className="mr-1.5 h-4 w-4" /> Ver detalhes</Button></TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
              <span>{isFetching && !isLoading ? "Atualizando…" : `Página ${page + 1} de ${pages}`}</span>
              <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft className="h-4 w-4" /> Anterior</Button><Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Próxima <ChevronRight className="h-4 w-4" /></Button></div>
            </div>
          </CardContent>
        </Card>
      </div>
      <CampanhaDetalheDialog jobId={jobAberto} open={Boolean(jobAberto)} onOpenChange={(open) => { if (!open) setJobAberto(null); }} />
    </AppLayout>
  );
}