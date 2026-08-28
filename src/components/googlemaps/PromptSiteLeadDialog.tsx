import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clipboard, Download, FileDown, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { EsbocoSitePreview } from "./EsbocoSitePreview";
import { ESTILOS_ESBOCO, montarConteudoEsboco, paletaPorEstilo, type EstiloEsboco } from "./esbocoSite";
import { gerarPdfEsboco } from "./esbocoPdf";


export interface LeadPrompt {
  id: string;
  nome: string;
  telefone: string | null;
  telefone_internacional: string | null;
  endereco: string | null;
  categoria: string | null;
  avaliacao: number | null;
  total_avaliacoes: number | null;
}

interface ResumoNicho {
  resumo_nicho?: string;
  secoes_recomendadas?: string[];
  paleta?: string[];
  tipografia?: string;
  tom?: string;
  ctas?: string[];
  integracoes?: string[];
}

function soDigitos(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

function whatsappInternacional(l: LeadPrompt): string {
  const num = soDigitos(l.telefone_internacional ?? l.telefone);
  if (!num) return "";
  return num.startsWith("55") ? num : `55${num}`;
}

function whatsappExibicao(l: LeadPrompt): string {
  return l.telefone_internacional ?? l.telefone ?? "—";
}

/** Monta o prompt completo do site, pronto para colar no Lovable/Claude. 100% local, sem IA. */
export function montarPromptSite(
  lead: LeadPrompt,
  ctx: { categoriaBusca?: string; localizacao?: string; resumo?: ResumoNicho | null },
): string {
  const categoria = lead.categoria ?? ctx.categoriaBusca ?? "prestador de serviços";
  const cidade = ctx.localizacao ?? "sua cidade";
  const waNum = whatsappInternacional(lead);
  const waLink = waNum ? `https://wa.me/${waNum}` : "(inserir link wa.me)";
  const prova =
    lead.avaliacao != null
      ? `${lead.avaliacao} de 5 estrelas no Google${lead.total_avaliacoes ? `, com ${lead.total_avaliacoes} avaliações reais` : ""}`
      : "boa reputação no Google";

  const blocoNicho = ctx.resumo
    ? `
PADRÃO DO NICHO (análise real de concorrentes da região):
${ctx.resumo.resumo_nicho ? `- Resumo do nicho: ${ctx.resumo.resumo_nicho}\n` : ""}${ctx.resumo.secoes_recomendadas?.length ? `- Seções recomendadas (nesta ordem): ${ctx.resumo.secoes_recomendadas.join(" → ")}\n` : ""}${ctx.resumo.paleta?.length ? `- Paleta de cores observada no nicho: ${ctx.resumo.paleta.join(", ")}\n` : ""}${ctx.resumo.tipografia ? `- Tipografia sugerida: ${ctx.resumo.tipografia}\n` : ""}${ctx.resumo.tom ? `- Tom de voz: ${ctx.resumo.tom}\n` : ""}${ctx.resumo.ctas?.length ? `- CTAs mais usados: ${ctx.resumo.ctas.join(" | ")}\n` : ""}${ctx.resumo.integracoes?.length ? `- Integrações comuns no nicho: ${ctx.resumo.integracoes.join(", ")}\n` : ""}`
    : "";

  return `Crie um site completo, moderno e responsivo para a empresa abaixo. Entregue o site em HTML + Tailwind em um único arquivo (index.html), pronto para publicar.

DADOS DA EMPRESA:
- Nome: ${lead.nome}
- Categoria: ${categoria}
- Cidade/região: ${cidade}
- Endereço: ${lead.endereco ?? "—"}
- Telefone/WhatsApp: ${whatsappExibicao(lead)}${waNum ? ` (link: ${waLink})` : ""}
- Reputação: ${prova}
${blocoNicho}
OBJETIVO DO SITE:
Converter visitantes em contatos no WhatsApp. Todo o site deve levar o visitante a clicar no botão de WhatsApp ou de agendamento/orçamento.

ESTRUTURA OBRIGATÓRIA (nesta ordem):
1. Header fixo com nome da empresa, menu âncora e botão de WhatsApp em destaque.
2. Hero com título forte que inclua "${categoria}" e "${cidade}" (SEO local), subtítulo com a proposta de valor, e CTA principal para o WhatsApp.
3. Seção de serviços/especialidades em cards com ícones (use Lucide ou SVG inline).
4. Seção "Sobre" com texto acolhedor, credenciais e diferenciais.
5. Prova social: destacar a nota ${lead.avaliacao ?? "5"} no Google${lead.total_avaliacoes ? ` e as ${lead.total_avaliacoes} avaliações reais` : ""}. Inclua 3 depoimentos com placeholder [DEPOIMENTO — substituir por reais] e aviso de que precisam ser autorizados.
6. Planos/valores OU "Como funciona" em 3 passos (o que fizer mais sentido para ${categoria}).
7. FAQ com 4 a 6 perguntas reais que um cliente de ${categoria} faria.
8. Seção de contato com endereço (${lead.endereco ?? "endereço"}), horário de atendimento placeholder, e iframe placeholder do Google Maps.
9. Rodapé simples com nome, CNPJ placeholder e links.
10. Botão flutuante de WhatsApp fixo no canto inferior direito apontando para ${waLink}, com mensagem pré-preenchida: "Olá! Vi o site da ${lead.nome} e quero saber mais."

REQUISITOS TÉCNICOS:
- Um único arquivo HTML com Tailwind via CDN (https://cdn.tailwindcss.com) e config inline de cores.
- Totalmente responsivo (mobile-first).
- SEO básico: <title> com "${categoria} em ${cidade}", meta description, Open Graph, canonical placeholder.
- Sem dependências de build: abrir o arquivo no navegador já deve funcionar.
- No topo do arquivo, inclua um comentário HTML "CHECKLIST DE PERSONALIZAÇÃO" listando os pontos a editar antes de publicar (WhatsApp, endereço, fotos, depoimentos, domínio), com marcadores [EDITAR] no código.

TOM E ESTILO:
- Textos em português do Brasil, tom profissional e acolhedor, focado em benefícios e não em jargão técnico.
- Visual limpo e confiável, adequado para ${categoria}.
- Evite: promessas milagrosas, preços inventados sem placeholder, fotos de banco com marca d'água, e textos genéricos de IA ("soluções inovadoras", "excelência" vazio).

Gere o arquivo completo agora, sem me pedir confirmações.`;
}

interface Props {
  lead: LeadPrompt | null;
  buscaId: string | null;
  categoriaBusca?: string;
  localizacao?: string;
  onClose: () => void;
}

export function PromptSiteLeadDialog({ lead, buscaId, categoriaBusca, localizacao, onClose }: Props) {
  const [editado, setEditado] = useState<string | null>(null);
  const [aba, setAba] = useState("prompt");
  const [estilo, setEstilo] = useState<EstiloEsboco>("moderno");
  const [usarPaletaNicho, setUsarPaletaNicho] = useState("nicho");
  const [gerando, setGerando] = useState(false);
  const esbocoRef = useRef<HTMLDivElement>(null);

  const { data: analise } = useQuery({
    queryKey: ["gm-nicho-analise", buscaId],
    enabled: !!buscaId && !!lead,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_maps_nicho_analises")
        .select("resumo")
        .eq("busca_id", buscaId as string)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as { resumo: ResumoNicho | null } | null) ?? null;
    },
  });

  const promptBase = useMemo(() => {
    if (!lead) return "";
    return montarPromptSite(lead, { categoriaBusca, localizacao, resumo: analise?.resumo ?? null });
  }, [lead, categoriaBusca, localizacao, analise]);

  const prompt = editado ?? promptBase;

  const conteudo = useMemo(() => {
    if (!lead) return null;
    return montarConteudoEsboco(lead, {
      categoriaBusca,
      localizacao,
      secoesNicho: analise?.resumo?.secoes_recomendadas ?? null,
    });
  }, [lead, categoriaBusca, localizacao, analise]);

  const paleta = useMemo(
    () => paletaPorEstilo(estilo, usarPaletaNicho === "nicho" ? analise?.resumo?.paleta ?? null : null),
    [estilo, usarPaletaNicho, analise],
  );

  function fechar(open: boolean) {
    if (!open) {
      setEditado(null);
      setAba("prompt");
      onClose();
    }
  }

  function copiar() {
    if (!prompt) return;
    navigator.clipboard.writeText(prompt);
    toast.success("Prompt copiado — cole no Lovable ou Claude");
  }

  function baixar() {
    if (!prompt || !lead) return;
    const blob = new Blob([prompt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prompt-site-${lead.nome.replace(/\s+/g, "-").toLowerCase().slice(0, 40)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function baixarPdf() {
    if (!esbocoRef.current || !lead) return;
    setGerando(true);
    try {
      await gerarPdfEsboco(esbocoRef.current, lead.nome);
      toast.success("PDF do esboço gerado — pronto para enviar ao cliente");
    } catch (e) {
      toast.error(`Não foi possível gerar o PDF: ${(e as Error).message}`);
    } finally {
      setGerando(false);
    }
  }

  return (
    <Dialog open={!!lead} onOpenChange={fechar}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" /> Prompt e esboço do site — {lead?.nome}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">Gerado localmente · sem custo de IA</Badge>
            {analise?.resumo ? (
              <Badge variant="outline">Com análise do nicho salva</Badge>
            ) : (
              <span className="text-muted-foreground">Sem análise de nicho salva — usando dados do lead</span>
            )}
          </div>

          <Tabs value={aba} onValueChange={setAba}>
            <TabsList>
              <TabsTrigger value="prompt">Prompt</TabsTrigger>
              <TabsTrigger value="esboco">Esboço do site</TabsTrigger>
            </TabsList>

            <TabsContent value="prompt" className="space-y-3">
              <Textarea
                className="min-h-[360px] font-mono text-xs"
                value={prompt}
                onChange={(e) => setEditado(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={copiar}><Clipboard className="h-4 w-4 mr-2" /> Copiar prompt</Button>
                <Button variant="outline" onClick={baixar}><Download className="h-4 w-4 mr-2" /> Baixar .txt</Button>
              </div>
            </TabsContent>

            <TabsContent value="esboco" className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Estilo visual</span>
                  <Select value={estilo} onValueChange={(v) => setEstilo(v as EstiloEsboco)}>
                    <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ESTILOS_ESBOCO.map((e) => (
                        <SelectItem key={e.valor} value={e.valor}>{e.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Paleta</span>
                  <Select value={usarPaletaNicho} onValueChange={setUsarPaletaNicho}>
                    <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nicho" disabled={!analise?.resumo?.paleta?.length}>
                        Cores observadas no nicho
                      </SelectItem>
                      <SelectItem value="estilo">Cores do estilo escolhido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={baixarPdf} disabled={gerando || !conteudo}>
                  {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                  Baixar esboço em PDF
                </Button>
              </div>

              {aba === "esboco" && lead && conteudo && (
                <div className="max-h-[60vh] overflow-auto rounded-md border bg-muted/30 p-3">
                  <div className="origin-top-left" style={{ transform: "scale(0.72)", width: 1000, transformOrigin: "top left", marginBottom: -700 }}>
                    <EsbocoSitePreview ref={esbocoRef} lead={lead} conteudo={conteudo} paleta={paleta} />
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                O PDF sai em A4 com capa, todas as seções do site e a página final "Como contratar" (investimento R$ 500,00).
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );

}
