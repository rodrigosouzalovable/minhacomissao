# Verificação de WhatsApp automática nos leads do Google Maps

## Respondendo à sua pergunta

Hoje funciona só pela metade:

- Quando **você** faz a busca na tela, o sistema captura os números e a verificação de WhatsApp roda em seguida — quem tem fica "Sim", quem não tem fica "Não".
- Quando **o próprio sistema** capta leads sozinho (reabastecimento automático usado no aquecimento), a verificação **não** roda. Esses leads ficam sem verificação e é por isso que a coluna WhatsApp aparece com "—" nos 58 leads mais recentes (402 na base: 191 com WhatsApp, 100 sem, 58 sem verificação).
- O envio, sim, já é seguro: o aquecimento só usa leads com WhatsApp confirmado. Quem está com "—" nunca recebe mensagem — mas também fica parado sem ser aproveitado.

## O que vou fazer

1. **Verificação automática também na captação feita pelo sistema**: logo após cada reabastecimento automático, os números novos passam pela checagem de WhatsApp.
2. **Varredura de pendentes**: uma rotina diária limpa a fila de leads antigos que ficaram sem verificação (como esses 58), em lotes, usando os números conectados da UAZAPI. Sem custo do Google — a checagem não usa a API do Google Maps.
3. **Coluna WhatsApp mais clara** na "Base de leads captados": "Sim" (verde), "Não" (cinza), "Sem telefone" e "Aguardando verificação" (em vez do "—" ambíguo), com um botão para verificar os pendentes na hora.
4. **Excel** já traz a coluna "Tem WhatsApp"; ela passa a usar os mesmos rótulos ("Sim", "Não", "Aguardando verificação", "Sem telefone") logo depois de Telefone.
5. **Relatório das 20h** ganha uma linha com quantos leads ficaram sem verificação e o motivo (por exemplo, nenhum número UAZAPI conectado).

## Detalhes técnicos

- `google-maps-verificar-whatsapp`: aceitar chamada sem `busca_id` (modo varredura, com limite de lote) e permitir execução por service role/cron, mantendo a seleção de instância UAZAPI conectada já existente.
- `google-maps-leads-abastecer`: invocar a verificação com o `busca_id` recém-criado após a busca (hoje só há um comentário dizendo que isso acontece).
- Novo cron diário (1x/dia, fora do horário de pico) chamando a varredura de pendentes — impacto de custo mínimo, sem polling novo.
- `src/components/googlemaps/BaseLeadsCard.tsx`: rótulos da coluna WhatsApp, botão "Verificar pendentes" e mesmos rótulos no `baixarExcel`.
- `google-maps-leads-relatorio-diario`: incluir contagem de pendentes de verificação.

⚠️ Custo Lovable Cloud: o item 2 adiciona **um** cron diário. Nenhum polling ou Realtime novo.
