# Análise de nicho + prompt pronto para gerar o site

Objetivo: a partir dos leads de uma busca (ex.: nutricionista em Goiânia), o sistema lê os sites das empresas que já têm site, entende o padrão do nicho e devolve um prompt pronto para colar no Lovable/Claude e gerar o HTML de demonstração.

## Como vai funcionar na tela

Na aba Google Maps Leads, um novo card "Analisar nicho e gerar prompt":

1. Botão **"Analisar nicho"** (usa a busca selecionada). Mostra quantos sites serão lidos (só leads classificados como "tem site", limite configurável, padrão 8).
2. Barra de progresso durante a leitura ("lendo site 3 de 8...").
3. Resultado em duas partes:
   - **Resumo do nicho**: seções mais usadas (hero, serviços, sobre, planos, depoimentos, FAQ, contato/agendamento), paleta e estilo visual predominante, tom de voz, chamadas de ação, provas sociais, integrações comuns (WhatsApp, Instagram, agendamento), o que costuma faltar (pontos onde você pode ser melhor).
   - **Prompt gerado** em textarea, com botão **Copiar prompt** e **Baixar .txt**.
4. Seletor de **lead alvo** (opcional): ao escolher uma empresa sem site, o prompt já vem personalizado com nome, categoria, endereço, telefone/WhatsApp e nota do Google dessa empresa.
5. Botão **"Gerar outra versão"** (varia o estilo: moderno/minimalista, clássico/confiança, colorido/energia).
6. Análises ficam salvas por busca — reabrir a busca mostra a última análise sem custo novo.

O prompt gerado inclui: contexto do negócio, público, objetivo de conversão, estrutura de seções na ordem recomendada, referências de layout/paleta/tipografia observadas no nicho, textos-base em português, requisitos técnicos (HTML+Tailwind em um arquivo, responsivo, SEO básico, botão flutuante de WhatsApp) e o que evitar.

## Detalhes técnicos

- Nova edge function `google-maps-analisar-nicho`: recebe `busca_id`, `limite_sites`, `estilo`, `lead_alvo_id`.
  - Lê os leads da busca com `site` classificado como site próprio.
  - Busca o conteúdo de cada site (leitura de HTML com timeout de 12s, extração de texto/títulos/seções, cores de CSS inline e meta tags). Falhas são ignoradas e contabilizadas.
  - Envia o material consolidado ao Lovable AI (`google/gemini-2.5-flash`) com tool calling para retornar `{ resumo_nicho, secoes_recomendadas, paleta, tom, faltas_comuns, prompt_final }`.
  - Trata 429/402 do gateway com mensagem amigável, igual às outras functions.
- Nova tabela `google_maps_nicho_analises` (busca_id, user_id, categoria, localizacao, sites_lidos, sites_falharam, resumo jsonb, prompt text, estilo, created_at), com GRANTs, RLS por `user_id` e leitura para admin.
- Frontend: novo componente `src/components/googlemaps/AnalisarNichoCard.tsx` usado em `src/pages/GoogleMapsLeads.tsx`. Nenhuma mudança na busca do Google Places.

## Aviso de custo (Lovable Cloud)

- Não há novo cron, polling ou Realtime: a análise só roda quando você clica no botão.
- Custo por análise: 1 chamada de IA (Gemini Flash, texto) + leitura de até 8 páginas HTML na edge function. Sem custo adicional na API do Google Maps.
- Resultado é salvo em cache por busca para evitar reprocessar.

Se preferir leitura de sites mais robusta (sites com JavaScript), posso usar o conector Firecrawl em vez do fetch simples — isso consome créditos do Firecrawl e precisa da sua confirmação.
