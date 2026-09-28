import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

type Resumo = { dia: string; tentativas: number; enviados: number; falhas: number; instancias: number };
type Envio = { id: string; enviado_em: string; status: string; template: string | null; erro: string | null; destino_telefone: string; instancia_id: string; entregue_em: string | null; lido_em: string | null; respondeu_em: string | null };
const PAGE_SIZE = 20;
const diaBrt = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const dataLabel = (dia: string) => new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR");

export default function AquecimentoLeadsCampanhas({ registerRefresh }: { registerRefresh: (refresh: () => Promise<void>) => void }) {
  const { isAdmin } = useUserRole();
  const [resumos, setResumos] = useState<Resumo[]>([]);
  const [ultimoDia, setUltimoDia] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState("");
  const [detailsError, setDetailsError] = useState("");

  const fetchDetails = useCallback(async (dia: string, offset = 0) => {
    setLoadingDetails(true);
    setDetailsError("");
    try {
      const { data, error: queryError } = await supabase.from("meta_aquecimento_destino_log")
        .select("id,enviado_em,status,template,erro,destino_telefone,instancia_id,entregue_em,lido_em,respondeu_em")
        .eq("fonte", "lead").eq("dia", dia)
        .order("enviado_em", { ascending: false }).range(offset, offset + PAGE_SIZE);
      if (queryError) throw queryError;
      const items = (data || []) as Envio[];
      setEnvios(offset ? (current) => [...current, ...items.slice(0, PAGE_SIZE)] : items.slice(0, PAGE_SIZE));
      setHasMore(items.length > PAGE_SIZE);
      setPage(offset / PAGE_SIZE);
    } catch {
      setDetailsError("Não foi possível carregar os envios. Tente novamente.");
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const [{ data, error: summaryError }, { data: latest, error: latestError }] = await Promise.all([
        supabase.rpc("resumo_aquecimento_leads_campanhas"),
        supabase.from("meta_aquecimento_destino_log").select("dia")
          .eq("fonte", "lead").order("dia", { ascending: false }).limit(1),
      ]);
      if (summaryError || latestError) throw summaryError || latestError;
      setResumos((data || []) as Resumo[]);
      setUltimoDia(latest?.[0]?.dia || null);
      if (selected) await fetchDetails(selected);
    } catch {
      setError("Não foi possível atualizar o aquecimento. Tente novamente.");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [isAdmin, selected, fetchDetails]);

  registerRefresh(refresh);
  const initialRefresh = useRef(refresh);
  initialRefresh.current = refresh;
  useEffect(() => { if (isAdmin) void initialRefresh.current(); }, [isAdmin]);
  if (!isAdmin) return null;
  const hoje = diaBrt();
  const resumoHoje = resumos.find((r) => r.dia === hoje);
  return (
    <div className="border-t p-3 space-y-2 text-xs" aria-label="Aquecimento · Leads Google Maps">
      <div className="font-semibold text-sm">Aquecimento · Leads Google Maps</div>
      {loading && <div role="status" className="text-muted-foreground">Atualizando aquecimento…</div>}
      {error && <div role="alert" className="text-destructive">{error}</div>}
      {loaded && !loading && !error && !resumoHoje && <div className="text-muted-foreground">Nenhum envio hoje. {ultimoDia ? `Último envio: ${dataLabel(ultimoDia)}.` : "Nenhum envio registrado."}</div>}
      {resumos.map((r) => (
        <div key={r.dia} className="border rounded-md">
          <Button variant="ghost" className="h-auto min-h-10 w-full justify-between text-left px-2 py-2" onClick={() => {
            if (selected === r.dia) { setSelected(null); return; }
            setSelected(r.dia);
            setEnvios([]);
            void fetchDetails(r.dia);
          }} aria-expanded={selected === r.dia}>
            <span className="min-w-0 whitespace-normal">{dataLabel(r.dia)} · {r.enviados} enviados · {r.falhas} falhas<br /><span className="font-normal text-muted-foreground">{r.tentativas} tentativas · {r.instancias} instâncias</span></span>
            {selected === r.dia ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          </Button>
          {selected === r.dia && <div className="border-t p-2 space-y-2">
            {detailsError && <div role="alert" className="text-destructive">{detailsError}</div>}
            {detailsError && <Button size="sm" variant="outline" onClick={() => void fetchDetails(r.dia, page * PAGE_SIZE)}>Tentar novamente</Button>}
            {envios.map((item) => <div key={item.id} className="border-b pb-1 last:border-0 break-words">
              <div className="font-medium">{item.destino_telefone} · {item.status === "falha" ? "Falha" : item.respondeu_em ? "Respondeu" : item.lido_em ? "Lida" : item.entregue_em ? "Entregue" : "Enviada"}</div>
              <div className="text-muted-foreground">{new Date(item.enviado_em).toLocaleString("pt-BR")} · {item.template || "Sem template"} · Instância {item.instancia_id.slice(0, 8)}</div>
              {item.erro && <div className="text-destructive">{item.erro}</div>}
            </div>)}
            {loadingDetails && <div role="status" className="text-muted-foreground">Carregando envios…</div>}
            {!loadingDetails && hasMore && <Button size="sm" variant="outline" onClick={() => void fetchDetails(r.dia, (page + 1) * PAGE_SIZE)}>Carregar mais</Button>}
          </div>}
        </div>
      ))}
    </div>
  );
}
