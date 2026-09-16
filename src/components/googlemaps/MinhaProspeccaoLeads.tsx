import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, CheckCircle2, Clipboard, ExternalLink, Eye, Loader2, MapPin, Plus, Target, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ScriptVendasDialog } from "@/components/googlemaps/ScriptVendasDialog";
import { linkGoogleMaps } from "@/components/googlemaps/LeadsMapa";
import type { LeadPrompt } from "@/components/googlemaps/PromptSiteLeadDialog";

type Resultado = "interessado" | "sem_interesse" | "nao_respondeu" | "retorno_agendado";
type Filtro = "todos" | "pendentes" | "contatados" | Resultado;

interface Atribuicao {
  atribuicao_id: string;
  lead_id: string;
  nome: string;
  telefone: string | null;
  telefone_internacional: string | null;
  endereco: string | null;
  categoria: string | null;
  avaliacao: number | null;
  total_avaliacoes: number | null;
  atribuido_em: string;
  dia: string;
  contatado_em: string | null;
  resultado: Resultado | null;
  retorno_em: string | null;
}

const RESULTADOS: Array<{ value: Resultado; label: string }> = [
  { value: "interessado", label: "Interessado" },
  { value: "nao_respondeu", label: "Não respondeu" },
  { value: "retorno_agendado", label: "Retorno agendado" },
  { value: "sem_interesse", label: "Sem interesse" },
];

function telefoneLimpo(lead: Atribuicao) {
  return (lead.telefone_internacional ?? lead.telefone ?? "").replace(/\D/g, "");
}

function telefoneSemDdi(lead: Atribuicao) {
  const telefone = telefoneLimpo(lead);
  return telefone.startsWith("55") && telefone.length >= 12 ? telefone.slice(2) : telefone;
}

function hojeBrasilia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function MinhaProspeccaoLeads() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filtro, setFiltro] = useState<Filtro>("pendentes");
  const [salvando, setSalvando] = useState<string | null>(null);
  const [confirmarInteresse, setConfirmarInteresse] = useState<Atribuicao | null>(null);

  const { data: atendenteNome = "Fernanda" } = useQuery({
    queryKey: ["gm-atendente-nome", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("nome").eq("id", user?.id ?? "").maybeSingle();
      return data?.nome?.trim().split(/\s+/)[0] || "Fernanda";
    },
    staleTime: 300_000,
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["gm-minha-prospeccao"],
    queryFn: async () => {
      const { error: atribuicaoError } = await supabase.rpc("gm_atribuir_leads_diarios", { _limite: 10 });
      if (atribuicaoError) throw atribuicaoError;
      const { data, error } = await supabase.rpc("gm_meus_leads_prospeccao");
      if (error) throw error;
      return (data ?? []) as Atribuicao[];
    },
    staleTime: 60_000,
  });

  const trazer = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("gm_atribuir_leads_diarios", { _limite: 10 });
      if (error) throw error;
      return data?.[0] as { adicionados: number; total_hoje: number; estoque_restante: number } | undefined;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["gm-minha-prospeccao"] });
      if (!r?.adicionados) toast.message("Sua lista de hoje já está completa");
      else toast.success(`${r.adicionados} novo${r.adicionados === 1 ? " lead adicionado" : "s leads adicionados"}`);
    },
    onError: () => toast.error("Não foi possível trazer novos leads"),
  });

  async function atualizar(lead: Atribuicao, contatado: boolean, resultado: Resultado | null, retornoEm?: string | null) {
    setSalvando(lead.atribuicao_id);
    const { error } = await supabase.rpc("gm_atualizar_contato_lead", {
      _atribuicao_id: lead.atribuicao_id,
      _contatado: contatado,
      _resultado: resultado,
      _retorno_em: retornoEm ? new Date(retornoEm).toISOString() : null,
    });
    setSalvando(null);
    if (error) {
      toast.error(resultado === "retorno_agendado" ? "Informe a data do retorno" : "Não foi possível salvar");
      return;
    }
    qc.invalidateQueries({ queryKey: ["gm-minha-prospeccao"] });
    if (resultado === "interessado") {
      qc.invalidateQueries({ queryKey: ["gm-interessados-admin"] });
      qc.invalidateQueries({ queryKey: ["gm-resumo-prospeccao"] });
      toast.success(`${lead.nome} foi confirmado como interessado`);
    }
  }

  async function copiar(texto: string, mensagem: string) {
    await navigator.clipboard.writeText(texto);
    toast.success(mensagem);
  }

  function scriptAbertura(lead: Atribuicao) {
    return `Olá, bom dia! Meu nome é ${atendenteNome}. Eu estava pesquisando empresas da sua região e encontrei a ${lead.nome}. Falo com a responsável?`;
  }

  const hoje = hojeBrasilia();
  const hojeRecebidos = leads.filter((l) => l.dia === hoje).length;
  const contatados = leads.filter((l) => l.contatado_em).length;
  const interessados = leads.filter((l) => l.resultado === "interessado").length;
  const filtrados = useMemo(() => leads.filter((l) => {
    if (filtro === "pendentes") return !l.contatado_em;
    if (filtro === "contatados") return !!l.contatado_em;
    if (filtro !== "todos") return l.resultado === filtro;
    return true;
  }), [filtro, leads]);

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Target className="h-6 w-6 text-primary" /> Minha lista de prospecção</h1>
          <p className="text-sm text-muted-foreground">Empresas com WhatsApp confirmado e sem site próprio.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ScriptVendasDialog />
          <Button onClick={() => trazer.mutate()} disabled={trazer.isPending || hojeRecebidos >= 10}>
            {trazer.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Trazer 10 novos leads
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-2xl font-semibold">{hojeRecebidos}/10</div><div className="text-sm text-muted-foreground">Recebidos hoje</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-semibold">{contatados}</div><div className="text-sm text-muted-foreground">Contatados</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-semibold">{interessados}</div><div className="text-sm text-muted-foreground">Interessados</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Meus leads <Badge variant="secondary">{filtrados.length}</Badge></CardTitle>
          <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendentes">Pendentes</SelectItem><SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="contatados">Contatados</SelectItem><SelectItem value="interessado">Interessados</SelectItem>
              <SelectItem value="nao_respondeu">Não responderam</SelectItem><SelectItem value="retorno_agendado">Retornos</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Contato</TableHead><TableHead>Empresa</TableHead><TableHead>Nicho</TableHead><TableHead>Localização</TableHead><TableHead>Nota</TableHead><TableHead>Ações</TableHead><TableHead>Resultado</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtrados.map((lead) => {
                  const tel = telefoneSemDdi(lead);
                  const interessado = lead.resultado === "interessado";
                  return <TableRow key={lead.atribuicao_id}>
                    <TableCell><Checkbox checked={!!lead.contatado_em} disabled={salvando === lead.atribuicao_id} onCheckedChange={(v) => atualizar(lead, !!v, v ? lead.resultado : null, lead.retorno_em)} aria-label={`Marcar ${lead.nome} como contatado`} /></TableCell>
                    <TableCell><div className="font-medium">{lead.nome}</div><div className="flex items-center gap-1 text-xs text-muted-foreground"><span>{tel || "—"}</span>{tel && <Button size="icon" variant="ghost" className="h-7 w-7" title="Copiar telefone" onClick={() => copiar(tel, "Telefone copiado sem o DDI")}><Clipboard className="h-3.5 w-3.5" /></Button>}</div></TableCell>
                    <TableCell>{lead.categoria ?? "—"}</TableCell><TableCell className="max-w-64 truncate">{lead.endereco ?? "—"}</TableCell>
                    <TableCell>{lead.avaliacao ? `${lead.avaliacao} (${lead.total_avaliacoes ?? 0})` : "—"}</TableCell>
                    <TableCell><div className="flex gap-1"><Button size="icon" variant="ghost" title="Copiar script" onClick={() => copiar(scriptAbertura(lead), "Script de abertura copiado")}><Clipboard className="h-4 w-4" /></Button><Button size="icon" variant={interessado ? "secondary" : "ghost"} className="text-emerald-600" title={interessado ? "Interesse confirmado" : "Marcar como interessado"} disabled={interessado || salvando === lead.atribuicao_id} onClick={() => setConfirmarInteresse(lead)}><Check className="h-4 w-4" /></Button></div></TableCell>
                    <TableCell className="min-w-52"><Select value={lead.resultado ?? "sem_resultado"} onValueChange={(v) => atualizar(lead, v !== "sem_resultado", v === "sem_resultado" ? null : v as Resultado, lead.retorno_em)}><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger><SelectContent><SelectItem value="sem_resultado">Sem resultado</SelectItem>{RESULTADOS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select>{lead.resultado === "retorno_agendado" && <div className="mt-2 flex items-center gap-2"><CalendarClock className="h-4 w-4 text-muted-foreground" /><Input type="datetime-local" value={lead.retorno_em?.slice(0, 16) ?? ""} onChange={(e) => atualizar(lead, true, "retorno_agendado", e.target.value)} /></div>}</TableCell>
                  </TableRow>;
                })}
                {!isLoading && !filtrados.length && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 h-6 w-6" />Nenhum lead neste filtro.</TableCell></TableRow>}
                {isLoading && <TableRow><TableCell colSpan={7} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <AlertDialog open={!!confirmarInteresse} onOpenChange={(open) => !open && setConfirmarInteresse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirmar interesse?</AlertDialogTitle><AlertDialogDescription>Confirme que {confirmarInteresse?.nome} demonstrou interesse e gostaria de ver o site.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { const lead = confirmarInteresse; setConfirmarInteresse(null); if (lead) atualizar(lead, true, "interessado"); }}>Confirmar interesse</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export interface InteressadoAdmin extends LeadPrompt {
  atribuicao_id: string;
  lead_id: string;
  busca_id: string;
  colaborador_id: string;
  colaborador_nome: string;
  marcado_em: string;
  site: string | null;
  tem_whatsapp: boolean | null;
  whatsapp_verificado_em: string | null;
  place_id: string | null;
  instagram_url: string | null;
  instagram_username: string | null;
  instagram_seguidores: number | null;
  instagram_site: string | null;
}

export function ResumoProspeccaoAdmin({ onCriarSite }: { onCriarSite: (lead: InteressadoAdmin) => void }) {
  const [detalhe, setDetalhe] = useState<InteressadoAdmin | null>(null);
  const { data = [] } = useQuery({ queryKey: ["gm-resumo-prospeccao"], queryFn: async () => { const { data, error } = await supabase.rpc("gm_resumo_prospeccao_admin"); if (error) throw error; return data ?? []; }, staleTime: 60_000 });
  const { data: interessados = [], isLoading } = useQuery({ queryKey: ["gm-interessados-admin"], queryFn: async () => { const { data: rows, error } = await supabase.rpc("gm_leads_interessados_admin"); if (error) throw error; return (rows ?? []) as InteressadoAdmin[]; }, staleTime: 30_000 });
  return <div className="space-y-6">
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Leads interessados <Badge>{interessados.length}</Badge></CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Atendente</TableHead><TableHead>Empresa</TableHead><TableHead>Contato</TableHead><TableHead>Marcado em</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{interessados.map((lead) => <TableRow key={lead.atribuicao_id}><TableCell>{lead.colaborador_nome}</TableCell><TableCell><div className="font-medium">{lead.nome}</div><div className="text-xs text-muted-foreground">{lead.categoria ?? "—"}</div></TableCell><TableCell className="font-mono text-xs">{lead.telefone_internacional ?? lead.telefone ?? "—"}</TableCell><TableCell className="text-xs">{new Date(lead.marcado_em).toLocaleString("pt-BR")}</TableCell><TableCell><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" title="Ver detalhes" onClick={() => setDetalhe(lead)}><Eye className="h-4 w-4" /></Button><a href={linkGoogleMaps(lead)} target="_blank" rel="noreferrer"><Button size="icon" variant="ghost" title="Abrir Google Maps"><MapPin className="h-4 w-4" /></Button></a><Button size="icon" variant="ghost" title="Criar site" onClick={() => onCriarSite(lead)}><Wand2 className="h-4 w-4" /></Button></div></TableCell></TableRow>)}{!isLoading && !interessados.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum lead foi marcado como interessado.</TableCell></TableRow>}{isLoading && <TableRow><TableCell colSpan={5} className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
    {!!data.length && <Card><CardHeader><CardTitle className="text-base">Prospecção da equipe</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Entregues</TableHead><TableHead>Contatados</TableHead><TableHead>Interessados</TableHead><TableHead>Retornos</TableHead><TableHead>Sem interesse</TableHead><TableHead>Não responderam</TableHead></TableRow></TableHeader><TableBody>{data.map((r: any) => <TableRow key={r.colaborador_id}><TableCell className="font-medium">{r.colaborador_nome}</TableCell><TableCell>{r.entregues}</TableCell><TableCell>{r.contatados}</TableCell><TableCell>{r.interessados}</TableCell><TableCell>{r.retornos}</TableCell><TableCell>{r.sem_interesse}</TableCell><TableCell>{r.nao_responderam}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>}
    <Dialog open={!!detalhe} onOpenChange={(open) => !open && setDetalhe(null)}><DialogContent><DialogHeader><DialogTitle>{detalhe?.nome}</DialogTitle></DialogHeader>{detalhe && <div className="grid gap-3 text-sm sm:grid-cols-2"><div><span className="text-muted-foreground">Atendente</span><p className="font-medium">{detalhe.colaborador_nome}</p></div><div><span className="text-muted-foreground">Telefone</span><p>{detalhe.telefone_internacional ?? detalhe.telefone ?? "—"}</p></div><div className="sm:col-span-2"><span className="text-muted-foreground">Endereço</span><p>{detalhe.endereco ?? "—"}</p></div><div><span className="text-muted-foreground">Categoria</span><p>{detalhe.categoria ?? "—"}</p></div><div><span className="text-muted-foreground">Avaliações</span><p>{detalhe.avaliacao ? `${detalhe.avaliacao} (${detalhe.total_avaliacoes ?? 0})` : "—"}</p></div><div><span className="text-muted-foreground">WhatsApp</span><p>{detalhe.tem_whatsapp ? "Confirmado" : "Não confirmado"}</p></div><div><span className="text-muted-foreground">Instagram</span><p>{detalhe.instagram_username ? `@${detalhe.instagram_username}` : "—"}</p></div><div className="sm:col-span-2 flex flex-wrap gap-2 pt-2"><a href={linkGoogleMaps(detalhe)} target="_blank" rel="noreferrer"><Button variant="outline"><ExternalLink className="mr-2 h-4 w-4" /> Ver perfil e fotos no Google</Button></a><Button onClick={() => { setDetalhe(null); onCriarSite(detalhe); }}><Wand2 className="mr-2 h-4 w-4" /> Criar site</Button></div></div>}</DialogContent></Dialog>
  </div>;
}