# Esboço do site em PDF por lead

Objetivo: no mesmo diálogo do prompt (varinha mágica), um botão **"Baixar esboço em PDF"** que gera na hora um mockup visual do site daquele cliente — pronto para enviar no WhatsApp antes de o cliente contratar, sem gastar créditos de IA nem criar o site.

## Como vai funcionar

1. No diálogo "Prompt do site — [Empresa]", duas abas: **Prompt** (como está hoje) e **Esboço do site**.
2. Na aba Esboço aparece a pré-visualização do mockup renderizada na tela, no estilo do site da Carol Costa Nutri: hero com nome da empresa e cidade, botão de WhatsApp, cards de serviços, seção sobre, prova social com a nota real do Google, "como funciona" em 3 passos, FAQ, contato com endereço e rodapé.
3. Seletor de **estilo visual** (Moderno/minimalista, Clássico/confiança, Colorido/energia) e de **paleta** — se existir análise de nicho salva daquela busca, a paleta e as seções vêm dela automaticamente.
4. Botão **Baixar esboço em PDF**: gera um PDF A4 multipágina (capa + páginas do site + página final "Como contratar" com seu contato e o valor do serviço).
5. Todos os textos são gerados localmente a partir dos dados do lead (nome, categoria, endereço, telefone, nota e avaliações) com variações por categoria; marcadores discretos indicam onde entram fotos reais.
6. A capa traz "Proposta de site — [Empresa]", a data e a observação de que é um esboço ilustrativo.

## Detalhes técnicos

- Novo componente `src/components/googlemaps/EsbocoSitePreview.tsx`: renderiza o mockup em um container de largura fixa (1000px) usando apenas HTML/Tailwind e tokens de cor inline vindos da paleta escolhida (mockup é conteúdo gerado, não UI do app, então cores inline são intencionais).
- Novo módulo `src/components/googlemaps/esbocoSite.ts`: funções puras `montarConteudoEsboco(lead, ctx)` (títulos, serviços, FAQ, depoimentos por categoria) e `paletaPorEstilo(estilo, paletaNicho)`.
- Novo módulo `src/components/googlemaps/esbocoPdf.ts`: captura o container com `html2canvas` (nova dependência; `jspdf` já existe no projeto) em escala 2, fatia a imagem em páginas A4 e monta o PDF com jsPDF. Nome do arquivo: `esboco-site-<empresa>.pdf`.
- `PromptSiteLeadDialog.tsx` passa a usar `Tabs` (Prompt | Esboço), mantendo Copiar prompt e Baixar .txt intactos; o preview do esboço só monta quando a aba é aberta, para não pesar a tabela de leads.
- Imports de `html2canvas` e `jspdf` via `import()` dinâmico apenas no clique/abertura da aba, para não aumentar o bundle inicial.

## Aviso de custo (Lovable Cloud)

Zero impacto de custo: geração 100% no navegador, sem edge function, sem IA, sem cron, sem novas queries além do cache de análise de nicho já usado hoje.
