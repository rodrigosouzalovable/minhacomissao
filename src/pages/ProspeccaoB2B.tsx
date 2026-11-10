import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Linkedin, Search, Eye, Mail, MessageCircle, Loader2 } from "lucide-react";

const STATUS = [
  { v: "novo", l: "Novo" },
  { v: "contatado", l: "Contatado" },
  { v: "respondeu", l: "Respondeu" },
  { v: "reuniao", l: "Reunião agendada" },
  { v: "carteira_teste", l: "Carteira teste" },
  { v: "fechado", l: "Fechou" },
  { v: "descartado", l: "Descartado" },
];

const PORTES = [
  { v: "11,50", l: "11–50" },
  { v: "51,200", l: "51–200" },
  { v: "201,500", l: "201–500" },
  { v: "501,1000", l: "501–1.000" },
  { v: "1001,5000", l: "1.001–5.000" },
  { v: "5001,100000", l: "5.000+" },
];

const MSG_PADRAO_EMAIL = `Olá, {nome}!

Vi seu trabalho à frente da área financeira da {empresa}. Hoje a maioria das assessorias ainda cobra por discador e ligação que o cliente não atende.

Na Souza & Ribeiro temos uma operação 100% digital pelo WhatsApp Oficial da Meta, com inteligência artificial e portal de autonegociação, que aumenta a recuperação e reduz quebra de acordos — com remuneração por resultado.

Podemos conversar 10 minutos nesta semana para eu mostrar como funciona?

Abraço,`;

const MSG_PADRAO_WA = `Olá, {nome}! Tudo bem? Aqui é da Souza & Ribeiro. Trabalhamos com recuperação de crédito 100% digital pelo WhatsApp Oficial e portal de autonegociação, com remuneração por resultado. Faz sentido conversarmos 10 minutos sobre a carteira da {empresa}?`;

type Lead = {
  id: string; nome: string | null; sobrenome: string | null; cargo: string | null; empresa: string | null;
  segmento: string | null; cidade: string | null; linkedin_url: string | null; email: string | null;
  email_status: string | null; telefone: string | null; revelado: boolean; status: string;
};

async function erroDetalhe(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try { const j = await error.context.json(); return typeof j.error === "string" ? j.error : JSON.stringify(j.error); } catch { /* */ }
  }
  return (error as Error)?.message ?? "Erro";
}

function preencher(t: string, l: Lead) {
  return t.split("{nome}").join(l.nome ?? "").split("{empresa}").join(l.empresa ?? "sua empresa").split("{cargo}").join(l.cargo ?? "");
}

export default function ProspeccaoB2B() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [cargos, setCargos] = useState("CFO, Diretor Financeiro, Gerente de Cobrança, Gerente de Crédito e Cobrança, Head de Crédito");
  const [locais, setLocais] = useState("Brazil");
  const [palavras, setPalavras] = useState("");
  const [portes, setPortes] = useState<string[]>(["51,200", "201,500"]);
  const [qtd, setQtd] = useState("25");
  const [pagina, setPagina] = useState(1);
  const [buscando, setBuscando] = useState(false);
  const [revelando, setRevelando] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [msgEmail, setMsgEmail] = useState(() => localStorage.getItem("b2b_msg_email") ?? MSG_PADRAO_EMAIL);
  const [msgWa, setMsgWa] = useState(() => localStorage.getItem("b2b_msg_wa") ?? MSG_PADRAO_WA);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["b2b-leads", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("prospeccao_b2b_leads").select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data as Lead[];
    },
  });

  const contagem = useMemo(() => {
    const c: Record<string, number> = {};
    leads.forEach((l) => { c[l.status] = (c[l.status] ?? 0) + 1; });
    return c;
  }, [leads]);
  const visiveis = filtroStatus === "todos" ? leads : leads.filter((l) => l.status === filtroStatus);

  const recarregar = () => qc.invalidateQueries({ queryKey: ["b2b-leads"] });

  async function buscar(pag = pagina) {
    const lista = cargos.split(",").map((s) => s.trim()).filter(Boolean);
    if (!lista.length) return toast.error("Informe ao menos um cargo");
    setBuscando(true);
    const { data, error } = await supabase.functions.invoke("prospeccao-b2b", {
      body: { acao: "buscar", cargos: lista, locais: locais.split(",").map((s) => s.trim()).filter(Boolean), palavras_chave: palavras || undefined, portes, pagina: pag, por_pagina: Number(qtd) },
    });
    setBuscando(false);
    if (error) return toast.error("Falha na busca: " + (await erroDetalhe(error)));
    toast.success(`${data.encontrados} decisores encontrados, ${data.novos} novos adicionados`);
    setPagina(pag + 1);
    recarregar();
  }

  async function revelar(ids: string[]) {
    const pend = ids.filter((id) => !leads.find((l) => l.id === id)?.revelado);
    if (!pend.length) return toast.info("Contatos já revelados");
    setRevelando(true);
    let total = 0;
    for (let i = 0; i < pend.length; i += 10) {
      const { data, error } = await supabase.functions.invoke("prospeccao-b2b", { body: { acao: "revelar", lead_ids: pend.slice(i, i + 10) } });
      if (error) { toast.error("Falha ao revelar: " + (await erroDetalhe(error))); break; }
      total += data.revelados ?? 0;
    }
    setRevelando(false);
    toast.success(`${total} contato(s) revelado(s)`);
    setSel(new Set());
    recarregar();
  }

  async function mudarStatus(id: string, status: string) {
    const { error } = await supabase.from("prospeccao_b2b_leads").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    recarregar();
  }

  async function marcarContato(l: Lead) {
    await supabase.from("prospeccao_b2b_leads").update({
      ultimo_contato_em: new Date().toISOString(), status: l.status === "novo" ? "contatado" : l.status,
    }).eq("id", l.id);
    recarregar();
  }

  function abrirEmail(l: Lead) {
    if (!l.email) return;
    const assunto = encodeURIComponent(`Recuperação de crédito digital para a ${l.empresa ?? "sua empresa"}`);
    window.open(`mailto:${l.email}?subject=${assunto}&body=${encodeURIComponent(preencher(msgEmail, l))}`);
    marcarContato(l);
  }
  function abrirWa(l: Lead) {
    if (!l.telefone) return;
    const tel = l.telefone.replace(/\D/g, "");
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(preencher(msgWa, l))}`, "_blank");
    marcarContato(l);
  }

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <Linkedin className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Prospecção B2B (LinkedIn)</h1>
            <p className="text-sm text-muted-foreground">Encontre decisores financeiros e proponha parceria de cobrança.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
          {STATUS.map((s) => (
            <Card key={s.v} className="cursor-pointer" onClick={() => setFiltroStatus(filtroStatus === s.v ? "todos" : s.v)}>
              <CardContent className={`p-3 ${filtroStatus === s.v ? "ring-2 ring-primary rounded-lg" : ""}`}>
                <div className="text-xs text-muted-foreground">{s.l}</div>
                <div className="text-xl font-bold">{contagem[s.v] ?? 0}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">1. Buscar decisores</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div><label className="text-xs text-muted-foreground">Cargos (separados por vírgula)</label><Input value={cargos} onChange={(e) => setCargos(e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">Localização</label><Input value={locais} onChange={(e) => setLocais(e.target.value)} placeholder="Brazil, Goiás, São Paulo" /></div>
              <div><label className="text-xs text-muted-foreground">Setor / palavra-chave</label><Input value={palavras} onChange={(e) => setPalavras(e.target.value)} placeholder="educação, varejo, fintech, saúde" /></div>
              <div><label className="text-xs text-muted-foreground">Quantidade por busca</label>
                <Select value={qtd} onValueChange={setQtd}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["10", "25", "50", "100"].map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Porte da empresa (funcionários)</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {PORTES.map((p) => (
                  <Badge key={p.v} variant={portes.includes(p.v) ? "default" : "outline"} className="cursor-pointer"
                    onClick={() => setPortes((x) => x.includes(p.v) ? x.filter((y) => y !== p.v) : [...x, p.v])}>{p.l}</Badge>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => { setPagina(1); buscar(1); }} disabled={buscando}>
                {buscando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Buscar decisores
              </Button>
              {pagina > 1 && <Button variant="outline" onClick={() => buscar(pagina)} disabled={buscando}>Buscar mais (página {pagina})</Button>}
            </div>
            <p className="text-xs text-muted-foreground">A busca é gratuita. Revelar e-mail/telefone consome créditos do Apollo, por isso só acontece quando você clicar em "Revelar".</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">2. Mensagens de abordagem</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div><label className="text-xs text-muted-foreground">E-mail — use {"{nome}"}, {"{empresa}"}, {"{cargo}"}</label>
              <Textarea rows={9} value={msgEmail} onChange={(e) => { setMsgEmail(e.target.value); localStorage.setItem("b2b_msg_email", e.target.value); }} /></div>
            <div><label className="text-xs text-muted-foreground">WhatsApp</label>
              <Textarea rows={9} value={msgWa} onChange={(e) => { setMsgWa(e.target.value); localStorage.setItem("b2b_msg_wa", e.target.value); }} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">3. Leads ({visiveis.length})</CardTitle>
            <Button size="sm" variant="secondary" disabled={!sel.size || revelando} onClick={() => revelar([...sel])}>
              {revelando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}Revelar selecionados ({sel.size})
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!isLoading && !visiveis.length && <p className="text-sm text-muted-foreground">Nenhum lead ainda. Faça uma busca acima.</p>}
            {visiveis.map((l) => (
              <div key={l.id} className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center">
                <Checkbox checked={sel.has(l.id)} onCheckedChange={() => toggle(l.id)} disabled={l.revelado} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{[l.nome, l.sobrenome].filter(Boolean).join(" ") || "—"} <span className="text-sm text-muted-foreground">· {l.cargo}</span></div>
                  <div className="text-sm text-muted-foreground">{l.empresa}{l.segmento ? ` · ${l.segmento}` : ""}{l.cidade ? ` · ${l.cidade}` : ""}</div>
                  <div className="text-xs">
                    {l.revelado
                      ? <>{l.email ?? "sem e-mail"}{l.email_status === "verified" && " ✓"} · {l.telefone ?? "sem telefone"}</>
                      : <span className="text-muted-foreground">Contatos ocultos</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {l.linkedin_url && <Button size="icon" variant="ghost" asChild><a href={l.linkedin_url} target="_blank" rel="noreferrer"><Linkedin className="h-4 w-4" /></a></Button>}
                  {!l.revelado && <Button size="sm" variant="outline" disabled={revelando} onClick={() => revelar([l.id])}><Eye className="mr-1 h-4 w-4" />Revelar</Button>}
                  {l.email && <Button size="icon" variant="ghost" onClick={() => abrirEmail(l)} title="Enviar e-mail"><Mail className="h-4 w-4" /></Button>}
                  {l.telefone && <Button size="icon" variant="ghost" onClick={() => abrirWa(l)} title="WhatsApp"><MessageCircle className="h-4 w-4" /></Button>}
                  <Select value={l.status} onValueChange={(v) => mudarStatus(l.id, v)}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
