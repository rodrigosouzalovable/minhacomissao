import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ExternalLink, Search, Filter, Link2, Clapperboard, Upload, BarChart3 } from "lucide-react";

const FONTES = [
  { l: "Amazon Movers & Shakers (EUA)", u: "https://www.amazon.com/gp/movers-and-shakers", d: "Produtos que mais subiram em vendas nas últimas 24h." },
  { l: "Amazon Best Sellers – Home & Kitchen", u: "https://www.amazon.com/Best-Sellers-Home-Kitchen/zgbs/home-garden", d: "Os mais vendidos de casa e cozinha." },
  { l: "Amazon Best Sellers – Electronics", u: "https://www.amazon.com/Best-Sellers-Electronics/zgbs/electronics", d: "Gadgets e acessórios mais vendidos." },
  { l: "Amazon Most Wished For", u: "https://www.amazon.com/gp/most-wished-for", d: "Mais adicionados à lista de desejos." },
  { l: "TikTok #amazonfinds", u: "https://www.tiktok.com/tag/amazonfinds", d: "Veja quais produtos estão viralizando agora." },
  { l: "TikTok #tiktokmademebuyit", u: "https://www.tiktok.com/tag/tiktokmademebuyit", d: "Produtos que as pessoas compraram por causa de vídeos." },
];

const FILTROS = [
  "Efeito \"UAU\" visível nos primeiros 3 segundos de vídeo",
  "Preço entre US$ 15 e US$ 45 (compra por impulso)",
  "Nota 4.0+ estrelas e mais de 1.000 avaliações",
  "Entrega Prime (1–2 dias nos EUA)",
  "Sem tamanho/numeração (evite roupas, sapatos, perfumes)",
  "Já existe vídeo dele com 500 mil+ views na última semana",
];

const PASSOS = [
  { i: Search, t: "1. Minerar (15 min/dia)", d: "Abra as fontes acima. Anote 5 a 10 candidatos. No TikTok, filtre vídeos da última semana com 500 mil+ visualizações — se viralizou lá, está quente." },
  { i: Filter, t: "2. Filtrar", d: "Passe cada candidato pelo checklist dos 6 filtros. Só aprove o que marcar todos. Fique com os 3 melhores." },
  { i: Link2, t: "3. Gerar o link de afiliado", d: "Na Amazon.com logado, abra o produto. Na barra SiteStripe (topo), clique em \"Get Link → Text\", confira o Tracking ID topviralfin07-20 e copie o link amzn.to." },
  { i: Link2, t: "4. Cadastrar aqui", d: "Preencha o formulário abaixo com nome, link amzn.to, preço em US$ e comissão (casa/cozinha ~3%, beleza ~3%, luxo até 10%)." },
  { i: Clapperboard, t: "5. Criar o roteiro e o vídeo", d: "Na aba Roteiros, escolha o produto e gere o roteiro em inglês. Monte o vídeo (15–30s) no CapCut com clipes do produto e a narração." },
  { i: Upload, t: "6. Postar nas 3 redes", d: "Poste o mesmo vídeo no TikTok, YouTube Shorts e Instagram Reels. Coloque os links na bio (Linktree/Beacons) e comente \"Link in bio!\". Meta: 1 a 3 vídeos por dia." },
  { i: BarChart3, t: "7. Medir e repetir", d: "Após 7 dias, veja no painel Associates quais produtos tiveram cliques e vendas. Faça mais vídeos dos vencedores e troque os que não venderam." },
];

export function GuiaAfiliados() {
  const [ok, setOk] = useState<boolean[]>(FILTROS.map(() => false));
  const aprovado = ok.every(Boolean);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Passo a passo: do produto à primeira comissão</CardTitle>
          <CardDescription>Tracking ID: <b>topviralfin07-20</b> · Perfis: <b>@topviralfindsusa</b></CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {PASSOS.map((p) => (
            <div key={p.t} className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="mb-1 flex items-center gap-2 font-semibold"><p.i className="h-4 w-4 text-primary" />{p.t}</div>
              <p className="text-muted-foreground">{p.d}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Onde encontrar produtos</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {FONTES.map((f) => (
              <a key={f.u} href={f.u} target="_blank" rel="noreferrer" className="block rounded-md border p-2 hover:bg-muted">
                <div className="flex items-center gap-1 font-medium text-primary">{f.l}<ExternalLink className="h-3 w-3" /></div>
                <div className="text-muted-foreground">{f.d}</div>
              </a>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">Checklist do produto {aprovado ? <Badge>Aprovado</Badge> : <Badge variant="outline">{ok.filter(Boolean).length}/{FILTROS.length}</Badge>}</CardTitle>
            <CardDescription>Marque para cada candidato. Só cadastre se passar em todos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {FILTROS.map((f, i) => (
              <label key={f} className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={ok[i]} onCheckedChange={(v) => setOk(ok.map((x, j) => (j === i ? !!v : x)))} />
                <span>{f}</span>
              </label>
            ))}
            <button className="text-xs text-primary underline" onClick={() => setOk(FILTROS.map(() => false))}>Limpar para o próximo produto</button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
