# Botão "Gerar prompt do site" por lead sem site

Objetivo: na tabela do Google Maps Leads, cada lead classificado como **Sem site** ganha um botão com ícone (varinha mágica) que gera na hora um prompt completo e personalizado daquela empresa, pronto para copiar e colar no Lovable ou Claude e criar o site de demonstração.

## Como vai funcionar

1. Novo ícone na coluna **Ação** de cada linha "Sem site" (e "Só rede social", que também são clientes potenciais de site), ao lado dos botões de mensagem/WhatsApp.
2. Ao clicar, abre um diálogo **"Prompt do site — [Nome da empresa]"** com:
   - Textarea com o prompt já gerado e personalizado;
   - Botões **Copiar prompt** e **Baixar .txt**;
   - Selo indicando que é gratuito (sem chamada de IA).
3. O prompt é montado no próprio navegador com todos os dados do lead: nome, categoria, endereço, telefone/WhatsApp, nota e quantidade de avaliações do Google, cidade da busca.
4. Se já existir uma **análise de nicho salva** daquela busca (do card "Analisar nicho"), o prompt incorpora automaticamente as seções recomendadas, paleta e tom observados no nicho — sem custo novo, só leitura do cache.
5. O prompt segue o padrão do modelo que você aprovou (estilo do site de nutricionista gerado pelo Claude): HTML + Tailwind em arquivo único, checklist de personalização, SEO local, botão flutuante de WhatsApp com o número do lead, provas sociais com a nota real do Google, e textos-base em português adaptados à categoria da empresa.

## Detalhes técnicos

- Novo componente `src/components/googlemaps/PromptSiteLeadDialog.tsx`: recebe o lead, a busca (categoria/localização) e a análise de nicho em cache (se houver) e monta o prompt com uma função pura `montarPromptSite(lead, contexto)`.
- Em `src/pages/GoogleMapsLeads.tsx`: novo botão ícone (`Wand2`) na coluna Ação, visível quando `classificarSite(l.site) !== "com_site"`, abrindo o diálogo com o lead selecionado.
- O diálogo lê a última análise de `google_maps_nicho_analises` da busca selecionada (query já existente, cacheada pelo React Query).
- Sem nova tabela, sem nova edge function, sem chamada de IA.

## Aviso de custo (Lovable Cloud)

Nenhum impacto: a geração é 100% no navegador. A única leitura extra é o cache da análise de nicho já existente (1 query leve por abertura, deduplicada pelo React Query).
