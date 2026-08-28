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
import { AlertTriangle, Clipboard, Globe, KeyRound, Loader2, Download, Map, MapPin, MessageCircle, Phone, Search, Shuffle, Sparkles, Table2, Trash2, Wand2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LeadsMapa, linkGoogleMaps, type LeadMapa } from "@/components/googlemaps/LeadsMapa";
import { AnalisarNichoCard } from "@/components/googlemaps/AnalisarNichoCard";
import { PromptSiteLeadDialog } from "@/components/googlemaps/PromptSiteLeadDialog";
import { NICHOS, NICHOS_DESTAQUE, TODOS_NICHOS, dicaDoNicho } from "@/components/googlemaps/nichos";

type SiteTipo = "sem_site" | "rede_social" | "com_site";

const REDES_SOCIAIS = ["instagram.com", "facebook.com", "fb.com", "linktr.ee", "linktree", "wa.me", "api.whatsapp.com", "linkedin.com", "tiktok.com", "youtube.com", "twitter.com", "x.com", "bit.ly"];

function classificarSite(site: string | null): SiteTipo {
  const url = (site ?? "").trim().toLowerCase();
  if (!url) return "sem_site";
  if (REDES_SOCIAIS.some((d) => url.includes(d))) return "rede_social";
  return "com_site";
}

/** Quanto maior, melhor o lead para prospecção de site (negócio ativo, sem site próprio). */
function pontuarLead(l: Lead): number {
  const tipo = classificarSite(l.site);
  let score = 0;
  if (tipo === "sem_site") score += 40;
  else if (tipo === "rede_social") score += 30;
  if (l.tem_whatsapp === true) score += 25;
  const av = l.total_avaliacoes ?? 0;
  score += Math.min(25, Math.round(av / 4));
  if ((l.avaliacao ?? 0) >= 4.3) score += 10;
  return score;
}

function mensagemProspeccao(l: Lead): string {
  const tipo = classificarSite(l.site);
  const primeiroNome = (l.nome ?? "").split(" ").slice(0, 4).join(" ");
  const prova = l.total_avaliacoes
    ? ` Vi que vocês têm ${l.total_avaliacoes} avaliações no Google${l.avaliacao ? ` com nota ${l.avaliacao}` : ""} — reputação muito boa.`
    : "";
  const gancho =
    tipo === "rede_social"
      ? "Notei que vocês aparecem no Google Maps mas o link é de rede social, sem um site próprio."
      : "Notei que vocês aparecem no Google Maps mas ainda não têm um site próprio.";
  return `Olá! Tudo bem? Falo com o responsável pela ${primeiroNome}?\n\n${gancho}${prova}\n\nEu crio sites profissionais para empresas como a sua: página com seus serviços, fotos, localização e botão direto para o WhatsApp — pronto em poucos dias, por R$ 500 (setup) e sem complicação.\n\nPosso te mandar um modelo já com o nome da ${primeiroNome} para você ver como ficaria?`;
}


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
  tem_whatsapp: boolean | null;
  whatsapp_verificado_em: string | null;
  latitude: number | null;
  longitude: number | null;
  place_id: string | null;
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
  const [somenteComWhats, setSomenteComWhats] = useState(false);
  const [somenteSemSite, setSomenteSemSite] = useState(false);
  const [ordenarPotencial, setOrdenarPotencial] = useState(false);
  const [modoVisualizacao, setModoVisualizacao] = useState<"tabela" | "mapa">("tabela");
  const [leadPrompt, setLeadPrompt] = useState<Lead | null>(null);
  const [dialogNichosAberto, setDialogNichosAberto] = useState(false);

  const [verificandoWhats, setVerificandoWhats] = useState(false);
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

  const leadsBase = (leads ?? []).filter((l) => (somenteComTel ? !!l.telefone : true));
  const leadsFiltrados = leadsBase
    .filter((l) => (somenteComWhats ? l.tem_whatsapp === true : true))
    .filter((l) => (somenteSemSite ? classificarSite(l.site) !== "com_site" : true))
    .slice()
    .sort((a, b) => (ordenarPotencial ? pontuarLead(b) - pontuarLead(a) : 0));
  const totComWhats = leadsBase.filter((l) => l.tem_whatsapp === true).length;
  const totSemWhats = leadsBase.filter((l) => l.tem_whatsapp === false).length;
  const totNaoVerif = leadsBase.filter((l) => l.tem_whatsapp === null && !!l.telefone).length;
  const totSemSite = leadsBase.filter((l) => classificarSite(l.site) === "sem_site").length;
  const totRedeSocial = leadsBase.filter((l) => classificarSite(l.site) === "rede_social").length;
  const totComSite = leadsBase.filter((l) => classificarSite(l.site) === "com_site").length;
  const leadsProspeccao = leadsBase.filter(
    (l) => classificarSite(l.site) !== "com_site" && l.tem_whatsapp === true,
  );


  async function verificarWhatsapp(buscaId: string, silencioso = false) {
    setVerificandoWhats(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-maps-verificar-whatsapp", {
        body: { busca_id: buscaId },
      });
      if (error) {
        const payload = await getFunctionErrorPayload(error);
        if (!silencioso) toast.error("Falha ao verificar WhatsApp: " + getFunctionErrorMessage(payload));
        return;
      }
      if (data?.error === "sem_instancia") {
        toast.warning(data.message ?? "Nenhuma instância WhatsApp conectada para verificar");
        return;
      }
      qc.invalidateQueries({ queryKey: ["gm-leads", buscaId] });
      if (data?.verificados) {
        toast.success(
          `WhatsApp verificado: ✅ ${data.com_whatsapp} com • ❌ ${data.sem_whatsapp} sem${data.erros ? ` • ⚠️ ${data.erros} erro(s)` : ""}`,
        );
      } else if (!silencioso) {
        toast.message("Nenhum número novo para verificar");
      }
    } catch (e) {
      if (!silencioso) toast.error("Falha ao verificar WhatsApp: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setVerificandoWhats(false);
    }
  }

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
      // Verificação automática de WhatsApp dos telefones encontrados
      if (data?.busca_id) void verificarWhatsapp(data.busca_id, true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "erro";
      toast.error("Falha na busca: " + message);
    } finally {
      setBuscando(false);
    }
  }



  function baixarPlanilha(rows: Record<string, string | number>[], prefixo: string) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    const buscaAtual = buscas?.find((b) => b.id === buscaSel);
    const nomeArq = `${prefixo}-${(buscaAtual?.categoria ?? "gm").replace(/\s+/g, "-")}-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, nomeArq);
  }

  const rotuloSite: Record<SiteTipo, string> = {
    sem_site: "Sem site",
    rede_social: "Só rede social",
    com_site: "Tem site",
  };

  function exportarExcel() {
    const comWhats = leadsFiltrados.filter((l) => l.tem_whatsapp === true);
    if (!comWhats.length) {
      toast.error("Nenhum lead com WhatsApp confirmado. Rode a verificação de WhatsApp antes de exportar.");
      return;
    }
    baixarPlanilha(
      comWhats.map((l) => ({
        Nome: l.nome,
        Telefone: l.telefone_internacional ?? l.telefone ?? "",
        Site: l.site ?? "",
        "Situação do site": rotuloSite[classificarSite(l.site)],
        Categoria: l.categoria ?? "",
        Nota: l.avaliacao ?? "",
        Avaliações: l.total_avaliacoes ?? "",
        Potencial: pontuarLead(l),
      })),
      "leads",
    );
  }

  function exportarProspeccao() {
    if (!leadsProspeccao.length) {
      toast.error("Nenhum lead sem site com WhatsApp confirmado nesta busca.");
      return;
    }
    const ordenados = leadsProspeccao.slice().sort((a, b) => pontuarLead(b) - pontuarLead(a));
    baixarPlanilha(
      ordenados.map((l) => ({
        Nome: l.nome,
        Telefone: l.telefone_internacional ?? l.telefone ?? "",
        Categoria: l.categoria ?? "",
        "Situação do site": rotuloSite[classificarSite(l.site)],
        Nota: l.avaliacao ?? "",
        Avaliações: l.total_avaliacoes ?? "",
        Potencial: pontuarLead(l),
        Mensagem: mensagemProspeccao(l),
      })),
      "prospeccao-sem-site",
    );
    toast.success(`${ordenados.length} leads exportados para prospecção`);
  }

  function copiarMensagem(l: Lead) {
    navigator.clipboard.writeText(mensagemProspeccao(l));
    toast.success("Mensagem de prospecção copiada");
  }

  function abrirWhatsApp(l: Lead) {
    const tel = (l.telefone_internacional ?? l.telefone ?? "").replace(/\D/g, "");
    if (!tel) {
      toast.error("Lead sem telefone");
      return;
    }
    const numero = tel.startsWith("55") ? tel : `55${tel}`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagemProspeccao(l))}`, "_blank");
  }

  function abrirBuscaNoMaps(busca: Busca | undefined) {
    if (!busca) return;
    const query = encodeURIComponent(`${busca.categoria} em ${busca.localizacao}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  }

  const localizacoesRecentes = Array.from(new Set((buscas ?? []).map((b) => b.localizacao.trim()).filter(Boolean))).slice(0, 6);
  const nichosFiltrados = TODOS_NICHOS
    .filter((n, index, all) => all.findIndex((item) => item.nome === n.nome) === index)
    .filter((n) => !categoria.trim() || n.nome.toLowerCase().includes(categoria.toLowerCase()))
    .slice(0, 8);

  function selecionarNicho(nicho: string) {
    setCategoria(nicho);
    setDialogNichosAberto(false);
  }

  function sortearNicho() {
    const nicho = TODOS_NICHOS[Math.floor(Math.random() * TODOS_NICHOS.length)];
    if (nicho) setCategoria(nicho.nome);
  }

  const leadsMapa = leadsFiltrados.map((l): LeadMapa => ({
    ...l,
    place_id: (l as Lead & { place_id?: string | null }).place_id ?? null,
    siteTipo: classificarSite(l.site),
  }));


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
            <div className="mt-2 flex flex-wrap gap-1.5">
              {nichosFiltrados.slice(0, 5).map((nicho) => (
                <TooltipProvider key={nicho.nome}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => selecionarNicho(nicho.nome)}>
                        {nicho.nome}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{nicho.dica}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={sortearNicho}>
                <Shuffle className="h-3 w-3 mr-1" /> Sortear nicho
              </Button>
              <Dialog open={dialogNichosAberto} onOpenChange={setDialogNichosAberto}>
                <DialogTrigger asChild>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs">Ver todos</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Ideias de nichos</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    {NICHOS.map((grupo) => (
                      <section key={grupo.grupo}>
                        <h3 className="mb-2 text-sm font-semibold">{grupo.grupo}</h3>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {grupo.itens.map((nicho) => (
                            <Button key={nicho.nome} type="button" variant="outline" className="h-auto justify-start whitespace-normal text-left" onClick={() => selecionarNicho(nicho.nome)}>
                              <span><span className="block text-sm">{nicho.nome}</span><span className="block text-xs font-normal text-muted-foreground">{nicho.dica}</span></span>
                            </Button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="md:col-span-2">
            <Label>Localização</Label>
            <Input
              placeholder="ex: Goiânia GO, Setor Bueno Goiânia"
              value={localizacao}
              onChange={(e) => setLocalizacao(e.target.value)}
            />
            {!!localizacoesRecentes.length && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="self-center text-xs text-muted-foreground">Recentes:</span>
                {localizacoesRecentes.map((local) => (
                  <Button key={local} type="button" size="sm" variant="outline" className="h-7 max-w-full truncate px-2 text-xs" onClick={() => setLocalizacao(local)}>{local}</Button>
                ))}
              </div>
            )}
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

      <AnalisarNichoCard
        buscaId={buscaSel}
        categoria={buscas?.find((b) => b.id === buscaSel)?.categoria}
        localizacao={buscas?.find((b) => b.id === buscaSel)?.localizacao}
        leads={leads ?? []}
      />

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
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">
                Leads {buscaSel ? `(${leadsFiltrados.length})` : ""}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={somenteComTel} onCheckedChange={(v) => setSomenteComTel(!!v)} />
                  Só com telefone
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={somenteComWhats} onCheckedChange={(v) => setSomenteComWhats(!!v)} />
                  Só com WhatsApp
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={somenteSemSite} onCheckedChange={(v) => setSomenteSemSite(!!v)} />
                  Só sem site
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={ordenarPotencial} onCheckedChange={(v) => setOrdenarPotencial(!!v)} />
                  Melhor potencial
                </label>
                <div className="flex items-center gap-1 rounded-md border p-1">
                  <Button size="sm" variant={modoVisualizacao === "tabela" ? "secondary" : "ghost"} onClick={() => setModoVisualizacao("tabela")} title="Visualização em tabela">
                    <Table2 className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant={modoVisualizacao === "mapa" ? "secondary" : "ghost"} onClick={() => setModoVisualizacao("mapa")} title="Visualização no mapa">
                    <Map className="h-4 w-4" />
                  </Button>
                </div>
                <Button size="sm" variant="outline" onClick={() => abrirBuscaNoMaps(buscas?.find((b) => b.id === buscaSel))} disabled={!buscaSel}>
                  <MapPin className="h-4 w-4 mr-2" /> Ver no Google Maps
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => buscaSel && verificarWhatsapp(buscaSel)}
                  disabled={!buscaSel || verificandoWhats}
                >
                  {verificandoWhats ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
                  Verificar WhatsApp
                </Button>
                <Button size="sm" variant="outline" onClick={copiarTelefones} disabled={!leadsFiltrados.length}>
                  <Phone className="h-4 w-4 mr-2" /> Copiar telefones
                </Button>
                <Button size="sm" variant="outline" onClick={exportarProspeccao} disabled={!leadsProspeccao.length}>
                  <Sparkles className="h-4 w-4 mr-2" /> Exportar prospecção
                </Button>
                <Button size="sm" onClick={exportarExcel} disabled={!leadsFiltrados.length}>
                  <Download className="h-4 w-4 mr-2" /> Exportar Excel
                </Button>
              </div>
            </div>
            {buscaSel && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="default">{totComSite} com site</Badge>
                <Badge variant="secondary">{totSemSite} sem site</Badge>
                {totRedeSocial > 0 && <Badge variant="outline">{totRedeSocial} só rede social</Badge>}
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{totComWhats} com WhatsApp</Badge>
                <Badge variant="secondary">{totSemWhats} sem WhatsApp</Badge>
                {totNaoVerif > 0 && <Badge variant="outline" className="border-amber-500 text-amber-600">{totNaoVerif} não verificado(s)</Badge>}
                {leadsProspeccao.length > 0 && <Badge variant="outline" className="border-primary text-primary">{leadsProspeccao.length} oportunidades</Badge>}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!buscaSel && <p className="text-sm text-muted-foreground">Selecione uma busca ou crie uma nova.</p>}
            {buscaSel && modoVisualizacao === "mapa" && (
              <LeadsMapa
                leads={leadsMapa}
                onCopiarMensagem={(id) => {
                  const lead = leadsFiltrados.find((l) => l.id === id);
                  if (lead) copiarMensagem(lead);
                }}
                onAbrirWhatsApp={(id) => {
                  const lead = leadsFiltrados.find((l) => l.id === id);
                  if (lead) abrirWhatsApp(lead);
                }}
              />
            )}
            {buscaSel && modoVisualizacao === "tabela" && (
              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">⭐</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leadsFiltrados.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.nome}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {l.telefone_internacional ?? l.telefone ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {classificarSite(l.site) === "com_site" ? (
                            <a href={l.site ?? undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline max-w-40 truncate" title={l.site ?? undefined}>
                              <Globe className="h-3 w-3 shrink-0" /> Site
                            </a>
                          ) : classificarSite(l.site) === "rede_social" ? (
                            <Badge variant="outline" className="border-amber-500 text-amber-600">Só rede social</Badge>
                          ) : (
                            <Badge variant="secondary">Sem site</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {!l.telefone ? <span className="text-muted-foreground">—</span> : l.tem_whatsapp === true ? (
                            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600"><MessageCircle className="h-3 w-3 mr-1" /> Sim</Badge>
                          ) : l.tem_whatsapp === false ? <Badge variant="secondary">Não</Badge> : (
                            <Badge variant="outline" className="border-amber-500 text-amber-600">?</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{l.categoria ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">
                          {l.avaliacao ? `${l.avaliacao} (${l.total_avaliacoes ?? 0})` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <a href={linkGoogleMaps({ place_id: (l as Lead & { place_id?: string | null }).place_id ?? null, nome: l.nome, endereco: l.endereco })} target="_blank" rel="noreferrer">
                              <Button size="icon" variant="ghost" title="Abrir no Google Maps"><MapPin className="h-4 w-4" /></Button>
                            </a>
                            {classificarSite(l.site) !== "com_site" && (
                              <Button size="icon" variant="ghost" title="Gerar prompt do site deste cliente" onClick={() => setLeadPrompt(l)}>
                                <Wand2 className="h-4 w-4" />
                              </Button>
                            )}
                            {classificarSite(l.site) !== "com_site" && l.tem_whatsapp === true && (
                              <>
                                <Button size="icon" variant="ghost" title="Copiar mensagem de prospecção" onClick={() => copiarMensagem(l)}>
                                  <Clipboard className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" title="Abrir WhatsApp com mensagem" onClick={() => abrirWhatsApp(l)}>
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                    {!leadsFiltrados.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                          Nenhum lead {somenteComTel ? "com telefone" : ""}{somenteSemSite ? " sem site" : ""} nesta busca.
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
      <PromptSiteLeadDialog
        lead={leadPrompt}
        buscaId={buscaSel}
        categoriaBusca={buscas?.find((b) => b.id === buscaSel)?.categoria}
        localizacao={buscas?.find((b) => b.id === buscaSel)?.localizacao}
        onClose={() => setLeadPrompt(null)}
      />
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
