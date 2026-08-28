# Google Maps Leads: sugestões de nichos e visualização no mapa

## 1. Ideias de nichos no campo "Nova busca"

- Abaixo do campo **Categoria / Nicho**, uma linha de chips clicáveis com nichos de alto potencial para venda de site (clínica odontológica, estética, advocacia, arquitetura, academia, pet shop, buffet/eventos, oficina mecânica, barbearia, materiais de construção, contabilidade, fisioterapia, restaurante, floricultura, imobiliária).
- Clicar no chip preenche o campo. Ao digitar, os chips filtram pelo texto (autocomplete simples).
- Botão **"Sortear nicho"** para quem quer explorar sem pensar, e um botão **"Ver todos"** que abre a lista completa agrupada por segmento (Saúde e estética, Serviços, Comércio, Alimentação, Casa e reforma, Automotivo).
- Cada nicho traz uma dica curta em tooltip (por que costuma converter), sem inventar números.

Também é sugerido, no mesmo card, uma lista de localizações usadas recentemente (a partir das buscas já salvas), para repetir bairro/cidade em um clique.

## 2. Visualizar as empresas no Google Maps

Duas formas, ambas sem custo adicional de API:

- **Por lead**: novo ícone de pino em cada linha da tabela que abre o local no Google Maps em outra aba (usa o `place_id` quando existe, senão nome + endereço).
- **Visão geral em mapa**: alternador **Tabela | Mapa** acima da lista. No modo Mapa, um mapa interativo com um pino por lead filtrado, com cor por status de site (vermelho = sem site, amarelo = só rede social, cinza = tem site). Clicar no pino mostra nome, nota, telefone e os botões de copiar mensagem / abrir WhatsApp.
- Botão **"Abrir todos no Google Maps"** que abre a busca original (categoria + localização) direto no Maps.

## Detalhes técnicos

- Apenas `src/pages/GoogleMapsLeads.tsx`, mais um componente novo `src/components/googlemaps/LeadsMapa.tsx`.
- Mapa renderizado com Leaflet + tiles OpenStreetMap (`react-leaflet`), usando `latitude`/`longitude` já salvos em `google_maps_leads` — não consome a API paga do Google e não exige chave. Leads sem coordenadas ficam de fora do mapa com aviso de contagem.
- Links diretos: `https://www.google.com/maps/place/?q=place_id:<place_id>` e fallback `https://www.google.com/maps/search/?api=1&query=<nome+endereço>`.
- Nichos em constante local no arquivo; localizações recentes derivadas da lista de buscas já carregada.
- Nenhuma migração, nenhuma mudança em edge functions, nenhuma chamada extra ao Google.
