import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Clipboard, Download, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

const ESTILOS = [
  { valor: "moderno", label: "Moderno / minimalista" },
  { valor: "classico", label: "Clássico / confiança" },
  { valor: "colorido", label: "Colorido / energia" },
];

interface LeadSimples {
  id: string;
  nome: string;
  site: string | null;
}

interface Resumo {
  resumo_nicho?: string;
  secoes_recomendadas?: string[];
  paleta?: string[];
  tipografia?: string | null;
  tom?: string | null;
  ctas?: string[];
  integracoes?: string[];
  faltas_comuns?: string[];
  sites?: Array<{ nome: string; site: string }>;
}

interface Analise {
  id: string;
  categoria: string;
  localizacao: string;
  estilo: string | null;
  sites_lidos: number;
  sites_falharam: number;
  resumo: Resumo | null;
  prompt: string | null;
  created_at: string;
}

interface Props {
  buscaId: string | null;
  categoria?: string;
  localizacao?: string;
  leads: LeadSimples[];
}

export function AnalisarNichoCard({ buscaId, categoria, localizacao, leads }: Props) {
  const qc = useQueryClient();
  const [limiteSites, setLimiteSites] = useState(8);
  const [estilo, setEstilo] = useState("moderno");
  const [leadAlvo, setLeadAlvo] = useState<string>("nenhum");
  const [analisando, setAnalisando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [promptEditado, setPromptEditado] = useState<string | null>(null);

  const { data: analise } = useQuery({
    queryKey: ["gm-nicho-analise", buscaId],
    enabled: !!buscaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_maps_nicho_analises")
        .select("*")
        .eq("busca_id", buscaId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Analise) ?? null;
    },
  });

  const REDES = ["instagram.com", "facebook.com", "fb.com", "linktr.ee", "linktree", "wa.me", "api.whatsapp.com", "linkedin.com", "tiktok.com", "youtube.com", "twitter.com", "x.com", "bit.ly"];
  const comSite = leads.filter((l) => {
    const url = (l.site ?? "").trim().toLowerCase();
    return !!url && !REDES.some((d) => url.includes(d));
  });
  const semSite = leads.filter((l) => !(l.site ?? "").trim());
  const quantidade = Math.min(limiteSites, comSite.length);

  const prompt = promptEditado ?? analise?.prompt ?? "";
  const resumo = analise?.resumo ?? null;

  async function analisar() {
    if (!buscaId) return;
    setAnalisando(true);
    setProgresso(8);
    const timer = setInterval(() => setProgresso((p) => (p < 90 ? p + Math.random() * 8 : p)), 900);
    try {
      const { data, error } = await supabase.functions.invoke("google-maps-analisar-nicho", {
        body: {
          busca_id: buscaId,
          limite_sites: limiteSites,
          estilo,
          lead_alvo_id: leadAlvo === "nenhum" ? null : leadAlvo,
        },
      });
      if (error) {
        let detalhe = error.message;
        const ctx = (error as { context?: { text?: () => Promise<string> } }).context;
        if (ctx?.text) {
          try {
            const raw = await ctx.text();
            const parsed = JSON.parse(raw) as { message?: string; error?: string };
            detalhe = parsed.message ?? parsed.error ?? raw;
          } catch { /* mantém mensagem original */ }
        }
        throw new Error(detalhe);
      }
      if ((data as { message?: string })?.message && !(data as { analise?: unknown })?.analise) {
        throw new Error((data as { message: string }).message);
      }
      setProgresso(100);
      setPromptEditado(null);
      await qc.invalidateQueries({ queryKey: ["gm-nicho-analise", buscaId] });
      toast.success("Análise do nicho concluída");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao analisar o nicho");
    } finally {
      clearInterval(timer);
      setAnalisando(false);
      setTimeout(() => setProgresso(0), 1200);
    }
  }

  function copiar() {
    if (!prompt) return;
    navigator.clipboard.writeText(prompt);
    toast.success("Prompt copiado — cole no Lovable ou Claude");
  }

  function baixar() {
    if (!prompt) return;
    const blob = new Blob([prompt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prompt-site-${(categoria ?? "nicho").replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wand2 className="h-4 w-4" /> Analisar nicho e gerar prompt do site
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!buscaId ? (
          <p className="text-sm text-muted-foreground">Selecione uma busca para analisar os sites do nicho.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              O sistema lê os sites das empresas deste nicho, entende o padrão (seções, layout, paleta, textos) e devolve um
              prompt pronto para você colar no Lovable ou Claude e gerar o site de demonstração.
            </p>

            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <Label>Sites a ler (2 a 15)</Label>
                <Input
                  type="number"
                  min={2}
                  max={15}
                  value={limiteSites}
                  onChange={(e) => setLimiteSites(Math.min(Math.max(Number(e.target.value) || 8, 2), 15))}
                />
                <p className="mt-1 text-xs text-muted-foreground">{comSite.length} lead(s) com site próprio nesta busca.</p>
              </div>
              <div>
                <Label>Estilo do site</Label>
                <Select value={estilo} onValueChange={setEstilo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTILOS.map((e) => <SelectItem key={e.valor} value={e.valor}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Empresa alvo (opcional)</Label>
                <Select value={leadAlvo} onValueChange={setLeadAlvo}>
                  <SelectTrigger><SelectValue placeholder="Genérico do nicho" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Genérico do nicho</SelectItem>
                    {semSite.slice(0, 50).map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Escolha uma empresa sem site para personalizar o prompt.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={analisar} disabled={analisando || comSite.length === 0}>
                {analisando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {analise ? "Gerar outra versão" : "Analisar nicho"}
              </Button>
              <span className="text-xs text-muted-foreground">
                {comSite.length === 0
                  ? "Nenhum lead com site próprio para analisar."
                  : `Serão lidos até ${quantidade} site(s) + 1 chamada de IA.`}
              </span>
            </div>

            {analisando && (
              <div className="space-y-1">
                <Progress value={progresso} />
                <p className="text-xs text-muted-foreground">Lendo sites do nicho e montando o prompt...</p>
              </div>
            )}

            {analise && (
              <div className="space-y-4 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary">{analise.sites_lidos} site(s) lido(s)</Badge>
                  {analise.sites_falharam > 0 && <Badge variant="outline">{analise.sites_falharam} falharam</Badge>}
                  {analise.estilo && <Badge variant="outline">Estilo: {analise.estilo}</Badge>}
                  <span className="text-muted-foreground">
                    {new Date(analise.created_at).toLocaleString("pt-BR")} · {analise.categoria} em {analise.localizacao}
                  </span>
                </div>

                {resumo?.resumo_nicho && (
                  <div>
                    <h4 className="text-sm font-semibold">Resumo do nicho</h4>
                    <p className="text-sm text-muted-foreground">{resumo.resumo_nicho}</p>
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  {!!resumo?.secoes_recomendadas?.length && (
                    <div>
                      <h4 className="text-sm font-semibold">Seções recomendadas</h4>
                      <ol className="list-decimal pl-5 text-sm text-muted-foreground">
                        {resumo.secoes_recomendadas.map((s) => <li key={s}>{s}</li>)}
                      </ol>
                    </div>
                  )}
                  <div className="space-y-3">
                    {!!resumo?.paleta?.length && (
                      <div>
                        <h4 className="text-sm font-semibold">Paleta observada</h4>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {resumo.paleta.map((c) => (
                            <span key={c} className="flex items-center gap-1 rounded border px-2 py-0.5 text-xs">
                              <span className="h-3 w-3 rounded-sm border" style={{ backgroundColor: c }} />
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {resumo?.tipografia && (
                      <p className="text-sm"><span className="font-semibold">Tipografia:</span> <span className="text-muted-foreground">{resumo.tipografia}</span></p>
                    )}
                    {resumo?.tom && (
                      <p className="text-sm"><span className="font-semibold">Tom de voz:</span> <span className="text-muted-foreground">{resumo.tom}</span></p>
                    )}
                    {!!resumo?.integracoes?.length && (
                      <p className="text-sm"><span className="font-semibold">Integrações comuns:</span> <span className="text-muted-foreground">{resumo.integracoes.join(", ")}</span></p>
                    )}
                    {!!resumo?.ctas?.length && (
                      <p className="text-sm"><span className="font-semibold">CTAs mais usados:</span> <span className="text-muted-foreground">{resumo.ctas.join(" · ")}</span></p>
                    )}
                  </div>
                </div>

                {!!resumo?.faltas_comuns?.length && (
                  <div>
                    <h4 className="text-sm font-semibold">O que costuma faltar (sua vantagem)</h4>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground">
                      {resumo.faltas_comuns.map((f) => <li key={f}>{f}</li>)}
                    </ul>
                  </div>
                )}

                {!!resumo?.sites?.length && (
                  <p className="text-xs text-muted-foreground">
                    Sites analisados: {resumo.sites.map((s) => s.nome).join(", ")}
                  </p>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold">Prompt gerado</h4>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={copiar}><Clipboard className="h-4 w-4 mr-2" /> Copiar prompt</Button>
                      <Button size="sm" variant="ghost" onClick={baixar}><Download className="h-4 w-4 mr-2" /> Baixar .txt</Button>
                    </div>
                  </div>
                  <Textarea
                    className="min-h-[260px] font-mono text-xs"
                    value={prompt}
                    onChange={(e) => setPromptEditado(e.target.value)}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
