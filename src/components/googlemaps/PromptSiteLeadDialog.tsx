import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Clipboard, Download, Wand2 } from "lucide-react";
import { toast } from "sonner";

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

  function fechar(open: boolean) {
    if (!open) {
      setEditado(null);
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

  return (
    <Dialog open={!!lead} onOpenChange={fechar}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" /> Prompt do site — {lead?.nome}
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
          <Textarea
            className="min-h-[360px] font-mono text-xs"
            value={prompt}
            onChange={(e) => setEditado(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={copiar}><Clipboard className="h-4 w-4 mr-2" /> Copiar prompt</Button>
            <Button variant="outline" onClick={baixar}><Download className="h-4 w-4 mr-2" /> Baixar .txt</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
