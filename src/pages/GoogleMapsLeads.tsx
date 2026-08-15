import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
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
import { AlertTriangle, Clipboard, KeyRound, Loader2, Download, MapPin, Phone, Search, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

interface FunctionErrorPayload {
  error?: string;
  message?: string;
  status?: number;
  details?: string;
  reason?: string;
  callerIp?: string;
  apiName?: string;
  methodName?: string;
  consumer?: string;
  next_steps?: string[];
}

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

async function getFunctionErrorPayload(error: unknown): Promise<FunctionErrorPayload> {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json();
      return payload as FunctionErrorPayload;
    } catch (_jsonError) {
      try {
        const text = await error.context.text();
        return { message: text };
      } catch (_textError) {
        return { message: error.message };
      }
    }
  }

  if (error instanceof Error) return { message: error.message };
  return { message: "erro" };
}

function getFunctionErrorMessage(payload: FunctionErrorPayload) {
  if (payload.message) return payload.message;
  if (payload.error) return payload.error;
  if (payload.details) return payload.details;
  return "erro";
}

export default function GoogleMapsLeads() {
  const qc = useQueryClient();
  const [categoria, setCategoria] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [maxResultados, setMaxResultados] = useState(60);
  const [buscando, setBuscando] = useState(false);
  const [buscaSel, setBuscaSel] = useState<string | null>(null);
  const [somenteComTel, setSomenteComTel] = useState(true);
  const [erroBusca, setErroBusca] = useState<FunctionErrorPayload | null>(null);

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
    setErroBusca(null);
    try {
      const { data, error } = await supabase.functions.invoke("google-maps-buscar-leads", {
        body: { categoria, localizacao, max_resultados: maxResultados },
      });
      if (error) {
        const payload = await getFunctionErrorPayload(error);
        setErroBusca(payload);
        toast.error("Falha na busca: " + getFunctionErrorMessage(payload));
        return;
      }
      if (data?.error === "limite_atingido") {
        setErroBusca({ error: data.error, message: data.message });
        toast.error(data.message ?? "Limite mensal atingido");
        refetchLimite();
        return;
      }
      setErroBusca(null);
      toast.success(
        `Busca concluída: ${data.total} resultados (${data.com_telefone} com telefone) — custo ~US$${data.custo_estimado_usd}`,
      );
      setBuscaSel(data.busca_id);
      qc.invalidateQueries({ queryKey: ["gm-buscas"] });
      refetchLimite();
    } catch (e) {
      const message = e instanceof Error ? e.message : "erro";
      toast.error("Falha na busca: " + message);
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

  function copiarDiagnostico() {
    if (!erroBusca) return;
    const texto = [
      `Erro: ${erroBusca.error ?? "google_maps"}`,
      erroBusca.reason ? `Motivo: ${erroBusca.reason}` : null,
      erroBusca.message ? `Mensagem: ${erroBusca.message}` : null,
      erroBusca.apiName ? `API: ${erroBusca.apiName}` : null,
      erroBusca.methodName ? `Método: ${erroBusca.methodName}` : null,
      erroBusca.consumer ? `Projeto: ${erroBusca.consumer}` : null,
      erroBusca.callerIp ? `IP: ${erroBusca.callerIp}` : null,
      erroBusca.next_steps?.length ? `Próximos passos:\n- ${erroBusca.next_steps.join("\n- ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(texto);
    toast.success("Diagnóstico copiado");
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
    <AppLayout>
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

      <ChaveApiCard />



      {limite && (() => {
        const pctBar = Math.min(100, (limite.consumo_atual / Math.max(limite.limite_maximo, 1)) * 100);
        const cor =
          limite.nivel === "bloqueado" ? "bg-muted-foreground" :
          limite.nivel === "critico" ? "bg-red-500" :
          limite.nivel === "alto" ? "bg-yellow-500" : "bg-green-500";
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Consumo do mês: {limite.consumo_atual} de {limite.limite_maximo} requisições Places (unidade que o Google usa para cobrar e para a franquia gratuita)</span>
                <Badge variant={limite.nivel === "bloqueado" ? "destructive" : "secondary"}>
                  {limite.percentual_consumido.toFixed(1)}%
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${cor} transition-all`} style={{ width: `${pctBar}%` }} />
              </div>
              {limite.nivel !== "normal" && (
                <Alert variant={limite.nivel === "bloqueado" || limite.nivel === "critico" ? "destructive" : "default"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>
                    {limite.nivel === "bloqueado" ? "Buscas bloqueadas" :
                     limite.nivel === "critico" ? "Consumo crítico" : "Consumo alto"}
                  </AlertTitle>
                  <AlertDescription>{limite.mensagem}</AlertDescription>
                </Alert>
              )}
              <p className="text-xs text-muted-foreground">
                Bloqueio automático em {limite.limite_bloqueio} requisições • O contador reinicia em {limite.data_reset_br}
              </p>
            </CardContent>
          </Card>
        );
      })()}

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
          <div className="md:col-span-4 flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {(() => {
                const reqs = Math.max(1, Math.ceil((Number(maxResultados) || 20) / 20));
                return `Estimativa: ${reqs} requisição${reqs > 1 ? "ões" : ""} Places (até 20 resultados cada) × ~US$ 0,032 = ~US$ ${(reqs * 0.032).toFixed(3)} (Text Search Pro). O Google cobra por requisição, não por resultado, e a franquia gratuita mensal do SKU pode zerar esse valor.`;
              })()}
            </p>
            <Button onClick={buscar} disabled={buscando || limite?.nivel === "bloqueado"} title={limite?.nivel === "bloqueado" ? limite.mensagem : undefined}>
              {buscando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              {limite?.nivel === "bloqueado" ? "Limite atingido" : "Buscar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {erroBusca && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {erroBusca.reason === "API_KEY_SERVICE_BLOCKED"
              ? "Places API (New) bloqueada na chave do servidor"
              : erroBusca.reason === "API_KEY_IP_ADDRESS_BLOCKED"
                ? "IP de saída bloqueado na chave do servidor"
                : "Falha na configuração do Google Maps"}
          </AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{getFunctionErrorMessage(erroBusca)}</p>
            {erroBusca.next_steps?.length && (
              <ol className="list-decimal pl-5 space-y-1">
                {erroBusca.next_steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
            {(erroBusca.apiName || erroBusca.methodName || erroBusca.consumer || erroBusca.callerIp) && (
              <div className="rounded-md border border-destructive/30 p-3 text-xs">
                {erroBusca.apiName && <div>API: {erroBusca.apiName}</div>}
                {erroBusca.methodName && <div>Método: {erroBusca.methodName}</div>}
                {erroBusca.consumer && <div>Projeto: {erroBusca.consumer}</div>}
                {erroBusca.callerIp && <div>IP informado pelo Google: {erroBusca.callerIp}</div>}
              </div>
            )}
            <Button size="sm" variant="outline" onClick={copiarDiagnostico}>
              <Clipboard className="h-4 w-4 mr-2" /> Copiar diagnóstico
            </Button>
          </AlertDescription>
        </Alert>
      )}

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
    </AppLayout>
  );
}

interface ChaveStatus {
  tem_chave: boolean;
  sufixo: string | null;
  atualizado_em: string | null;
}

function ChaveApiCard() {
  const qc = useQueryClient();
  const [novaChave, setNovaChave] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState<{ ok: boolean; message: string } | null>(null);

  const { data: status } = useQuery({
    queryKey: ["gm-chave-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-maps-chave", { body: { action: "status" } });
      if (error) throw error;
      return data as ChaveStatus;
    },
  });

  async function chamar(action: string, extra: Record<string, unknown> = {}) {
    const { data, error } = await supabase.functions.invoke("google-maps-chave", { body: { action, ...extra } });
    if (error) {
      const payload = await getFunctionErrorPayload(error);
      throw new Error(getFunctionErrorMessage(payload));
    }
    return data as any;
  }

  async function salvar() {
    if (!novaChave.trim()) {
      toast.error("Cole a chave da Places API (New)");
      return;
    }
    setSalvando(true);
    setResultadoTeste(null);
    try {
      await chamar("salvar", { api_key: novaChave.trim() });
      setNovaChave("");
      toast.success("Chave salva. As buscas passarão a usar essa chave.");
      qc.invalidateQueries({ queryKey: ["gm-chave-status"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar chave");
    } finally {
      setSalvando(false);
    }
  }

  async function testar() {
    setTestando(true);
    setResultadoTeste(null);
    try {
      const r = await chamar("testar", novaChave.trim() ? { api_key: novaChave.trim() } : {});
      setResultadoTeste({ ok: !!r.ok, message: r.message ?? (r.ok ? "Chave válida" : "Falha no teste") });
      if (r.ok) toast.success("Chave válida");
      else toast.error(r.message ?? "Chave recusada pelo Google");
      qc.invalidateQueries({ queryKey: ["gm-limite"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha no teste";
      setResultadoTeste({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setTestando(false);
    }
  }

  async function remover() {
    if (!confirm("Remover a chave própria e voltar a usar a conexão padrão?")) return;
    try {
      await chamar("remover");
      setResultadoTeste(null);
      toast.success("Chave removida");
      qc.invalidateQueries({ queryKey: ["gm-chave-status"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          Chave da Places API (New)
          {status && (
            <Badge variant={status.tem_chave ? "secondary" : "outline"}>
              {status.tem_chave ? `Configurada ····${status.sufixo}` : "Usando conexão padrão"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="gm-chave">Chave de API do Google Cloud</Label>
            <Input
              id="gm-chave"
              type="password"
              autoComplete="off"
              placeholder={status?.tem_chave ? "Cole uma nova chave para substituir" : "AIza..."}
              value={novaChave}
              onChange={(e) => setNovaChave(e.target.value)}
              maxLength={200}
            />
          </div>
          <Button onClick={salvar} disabled={salvando || !novaChave.trim()}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar chave"}
          </Button>
          <Button variant="outline" onClick={testar} disabled={testando || (!novaChave.trim() && !status?.tem_chave)}>
            {testando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Testar chave"}
          </Button>
          {status?.tem_chave && (
            <Button variant="ghost" onClick={remover} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Remover
            </Button>
          )}
        </div>

        {resultadoTeste && (
          <Alert variant={resultadoTeste.ok ? "default" : "destructive"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{resultadoTeste.ok ? "Chave funcionando" : "Chave recusada"}</AlertTitle>
            <AlertDescription>{resultadoTeste.message}</AlertDescription>
          </Alert>
        )}

        <p className="text-xs text-muted-foreground">
          A chave fica guardada apenas no backend (nunca é exibida de volta). Para uso no servidor, ela precisa ter a
          Places API (New) permitida e "Restrições de aplicativo" como "Nenhuma" (ou IPs liberados). O teste consome 1
          consulta do contador mensal.
        </p>
      </CardContent>
    </Card>
  );
}
