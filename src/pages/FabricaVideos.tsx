import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ContasSociais } from "@/components/fabrica-videos/ContasSociais";
import { Clapperboard, Loader2, Sparkles, Trash2, Link2, CalendarClock, Rocket, CheckCircle2, Circle } from "lucide-react";

const MODELOS = [
  { v: "wan-3.0", l: "Wan 3.0 (econômico)", usd: 0.038 },
  { v: "kling-4.0-flash", l: "Kling 4.0 Flash", usd: 0.063 },
  { v: "seedance-2.5", l: "Seedance 2.5 (cinematográfico)", usd: 0.118 },
  { v: "kling-4.0", l: "Kling 4.0 (premium)", usd: 0.126 },
];
const REDES = ["youtube_shorts", "tiktok", "instagram_reels"];
const REDE_L: Record<string, string> = { youtube_shorts: "YouTube Shorts", tiktok: "TikTok", instagram_reels: "Instagram Reels" };
const STATUS_L: Record<string, string> = { rascunho: "Rascunho", aprovado: "Aprovado", gerando: "Gerando vídeo", pronto: "Pronto", publicado: "Publicado" };

type Cena = { segundos: string; prompt_visual: string; narracao: string };

export default function FabricaVideos() {
  const qc = useQueryClient();
  const [tema, setTema] = useState("");
  const [nicho, setNicho] = useState("GTA 6");
  const [duracao, setDuracao] = useState(30);
  const [modelo, setModelo] = useState("seedance-2.5");
  const [produtoId, setProdutoId] = useState<string>("nenhum");
  const [gerando, setGerando] = useState(false);
  const [prod, setProd] = useState({ nome: "", plataforma: "amazon", link: "", preco: "", comissao: "" });

  const roteiros = useQuery({
    queryKey: ["video_roteiros"], staleTime: 60_000,
    queryFn: async () => (await supabase.from("video_roteiros").select("*").order("created_at", { ascending: false }).limit(100)).data || [],
  });
  const produtos = useQuery({
    queryKey: ["video_produtos"], staleTime: 60_000,
    queryFn: async () => (await supabase.from("video_afiliado_produtos").select("*").order("created_at", { ascending: false })).data || [],
  });
  const postagens = useQuery({
    queryKey: ["video_postagens"], staleTime: 60_000,
    queryFn: async () => (await supabase.from("video_postagens").select("*, video_roteiros(tema)").order("agendado_para", { ascending: true }).limit(200)).data || [],
  });

  const contasSociais = useQuery({
    queryKey: ["video_contas_sociais"], staleTime: 5 * 60_000,
    queryFn: async () => (await supabase.from("video_contas_sociais").select("rede,status,pode_publicar")).data || [],
  });
  const redesConectadas = (contasSociais.data || []).filter((c: any) => c.status === "conectado" || c.status === "configurado").length;

  const custo = (MODELOS.find((m) => m.v === modelo)?.usd || 0) * duracao;

  async function gerar() {
    if (!tema.trim()) return toast.error("Informe o tema do vídeo.");
    setGerando(true);
    try {
      const p = produtos.data?.find((x: any) => x.id === produtoId);
      const { data, error } = await supabase.functions.invoke("video-roteiro-gerar", { body: { tema, nicho, duracao, produto: p?.nome || "" } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const { data: u } = await supabase.auth.getUser();
      const { error: e2 } = await supabase.from("video_roteiros").insert({
        tema, nicho, duracao_seg: duracao, modelo_video: modelo, produto_id: p?.id || null,
        gancho: data.gancho, roteiro: data.roteiro, cenas: data.cenas || [], cta: data.cta, legenda: data.legenda, hashtags: data.hashtags, criado_por: u.user?.id,
      });
      if (e2) throw e2;
      toast.success("Roteiro criado!");
      setTema("");
      qc.invalidateQueries({ queryKey: ["video_roteiros"] });
    } catch (e: any) { toast.error(e.message || "Falha ao gerar roteiro"); }
    finally { setGerando(false); }
  }

  async function mudarStatus(id: string, status: string) {
    await supabase.from("video_roteiros").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["video_roteiros"] });
  }
  async function excluirRoteiro(id: string) {
    await supabase.from("video_roteiros").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["video_roteiros"] });
  }
  async function agendar(id: string) {
    const base = new Date(); base.setDate(base.getDate() + 1); base.setHours(18, 0, 0, 0);
    const { error } = await supabase.from("video_postagens").insert(REDES.map((rede) => ({ roteiro_id: id, rede, agendado_para: base.toISOString() })));
    if (error) return toast.error(error.message);
    toast.success("Agendado nas 3 redes para amanhã 18h");
    qc.invalidateQueries({ queryKey: ["video_postagens"] });
  }
  async function salvarProduto() {
    if (!prod.nome || !/^https?:\/\//.test(prod.link)) return toast.error("Informe nome e link válido (https://).");
    const slug = prod.nome.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + "-" + Math.random().toString(36).slice(2, 6);
    const { error } = await supabase.from("video_afiliado_produtos").insert({
      nome: prod.nome, plataforma: prod.plataforma, link: prod.link, slug,
      preco: prod.preco ? Number(prod.preco.replace(",", ".")) : null, comissao_pct: prod.comissao ? Number(prod.comissao.replace(",", ".")) : null,
    });
    if (error) return toast.error(error.message);
    setProd({ nome: "", plataforma: "amazon", link: "", preco: "", comissao: "" });
    qc.invalidateQueries({ queryKey: ["video_produtos"] });
  }
  async function excluirProduto(id: string) {
    await supabase.from("video_afiliado_produtos").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["video_produtos"] });
  }
  async function excluirPost(id: string) {
    await supabase.from("video_postagens").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["video_postagens"] });
  }

  const checklist = [
    { ok: true, t: "Gerador de roteiros virais com IA" },
    { ok: (produtos.data?.length || 0) > 0, t: "Cadastrar produtos de afiliado (Amazon, Shopee, Mercado Livre)" },
    { ok: false, t: "Assinar Higgsfield e salvar a chave da API" },
    { ok: redesConectadas >= 3, t: `Conectar TikTok, YouTube e Instagram (${redesConectadas}/3 conectadas)` },
    { ok: false, t: "Ativar geração automática de cenas e postagem diária" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <Clapperboard className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Fábrica de Vídeos IA</h1>
            <p className="text-sm text-muted-foreground">Roteiros, cenas, produtos de afiliado e fila de postagem para Shorts, TikTok e Reels.</p>
          </div>
        </div>

        <Tabs defaultValue="roteiros">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="roteiros">Roteiros</TabsTrigger>
            <TabsTrigger value="afiliados">Afiliados</TabsTrigger>
            <TabsTrigger value="fila">Fila de postagem</TabsTrigger>
            <TabsTrigger value="contas">Contas conectadas</TabsTrigger>
            <TabsTrigger value="config">Configuração</TabsTrigger>
          </TabsList>

          <TabsContent value="roteiros" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Novo roteiro viral</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <Textarea className="md:col-span-2" placeholder="Ex: 5 detalhes escondidos no trailer do GTA 6 que ninguém percebeu" value={tema} onChange={(e) => setTema(e.target.value)} />
                <Input placeholder="Nicho" value={nicho} onChange={(e) => setNicho(e.target.value)} />
                <Input type="number" min={10} max={90} value={duracao} onChange={(e) => setDuracao(Number(e.target.value) || 30)} placeholder="Duração (s)" />
                <Select value={modelo} onValueChange={setModelo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MODELOS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l} — US$ {m.usd}/s</SelectItem>)}</SelectContent>
                </Select>
                <Select value={produtoId} onValueChange={setProdutoId}>
                  <SelectTrigger><SelectValue placeholder="Produto do CTA" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Sem produto específico</SelectItem>
                    {produtos.data?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Custo estimado da geração no Higgsfield: <b>US$ {custo.toFixed(2)}</b> por vídeo</span>
                  <Button onClick={gerar} disabled={gerando}>{gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Gerar roteiro</Button>
                </div>
              </CardContent>
            </Card>

            {roteiros.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
            {roteiros.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum roteiro ainda.</p>}
            {roteiros.data?.map((r: any) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{r.tema}</CardTitle>
                      <CardDescription>{r.nicho} · {r.duracao_seg}s · {r.modelo_video}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Select value={r.status} onValueChange={(v) => mudarStatus(r.id, v)}>
                        <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(STATUS_L).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" onClick={() => agendar(r.id)}><CalendarClock className="mr-1 h-4 w-4" />Agendar</Button>
                      <Button size="sm" variant="ghost" onClick={() => excluirRoteiro(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {r.gancho && <p><Badge className="mr-2">Gancho</Badge>{r.gancho}</p>}
                  {Array.isArray(r.cenas) && r.cenas.length > 0 && (
                    <div className="space-y-2">
                      {(r.cenas as Cena[]).map((c, i) => (
                        <div key={i} className="rounded-md border bg-muted/40 p-2">
                          <div className="text-xs font-semibold text-muted-foreground">Cena {i + 1} · {c.segundos}</div>
                          <div><b>Narração:</b> {c.narracao}</div>
                          <div className="text-xs text-muted-foreground"><b>Prompt visual:</b> {c.prompt_visual}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {r.cta && <p><Badge variant="secondary" className="mr-2">CTA</Badge>{r.cta}</p>}
                  {r.legenda && <p className="text-muted-foreground">{r.legenda} <span className="text-primary">{r.hashtags}</span></p>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="afiliados" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Cadastrar produto de afiliado</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <Input placeholder="Nome do produto" value={prod.nome} onChange={(e) => setProd({ ...prod, nome: e.target.value })} />
                <Select value={prod.plataforma} onValueChange={(v) => setProd({ ...prod, plataforma: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amazon">Amazon</SelectItem>
                    <SelectItem value="mercadolivre">Mercado Livre</SelectItem>
                    <SelectItem value="shopee">Shopee</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Link de afiliado (https://...)" value={prod.link} onChange={(e) => setProd({ ...prod, link: e.target.value })} />
                <Input placeholder="Preço (R$)" value={prod.preco} onChange={(e) => setProd({ ...prod, preco: e.target.value })} />
                <Input placeholder="Comissão (%)" value={prod.comissao} onChange={(e) => setProd({ ...prod, comissao: e.target.value })} />
                <Button onClick={salvarProduto}>Salvar produto</Button>
              </CardContent>
            </Card>
            <div className="grid gap-3 md:grid-cols-2">
              {produtos.data?.map((p: any) => (
                <Card key={p.id}>
                  <CardContent className="flex items-start justify-between gap-2 pt-4 text-sm">
                    <div className="min-w-0">
                      <div className="font-semibold">{p.nome} <Badge variant="outline" className="ml-1">{p.plataforma}</Badge></div>
                      <div className="text-muted-foreground">{p.preco ? `R$ ${Number(p.preco).toFixed(2)}` : "—"} · comissão {p.comissao_pct ?? "—"}%</div>
                      <a href={p.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-primary"><Link2 className="h-3 w-3" />{p.link}</a>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => excluirProduto(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="fila" className="space-y-2">
            {postagens.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma postagem agendada. Use "Agendar" em um roteiro.</p>}
            {postagens.data?.map((p: any) => (
              <Card key={p.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-4 text-sm">
                  <div>
                    <div className="font-semibold">{p.video_roteiros?.tema || "Roteiro"}</div>
                    <div className="text-muted-foreground">{REDE_L[p.rede] || p.rede} · {p.agendado_para ? new Date(p.agendado_para).toLocaleString("pt-BR") : "sem data"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{p.status}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => excluirPost(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <p className="text-xs text-muted-foreground">A publicação automática nas redes será ativada quando as contas forem conectadas.</p>
          </TabsContent>

          <TabsContent value="contas"><ContasSociais /></TabsContent>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Rocket className="h-5 w-5" />Checklist de lançamento</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {checklist.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {c.ok ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}{c.t}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Higgsfield</CardTitle><CardDescription>Plano recomendado: Plus (1.000 créditos ≈ 67 vídeos Seedance 2.5) ou API pré-paga a partir de US$ 5.</CardDescription></CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Quando assinar, peça aqui no chat para conectar a chave da API. Ela fica guardada com segurança no servidor e nunca aparece nesta tela.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
