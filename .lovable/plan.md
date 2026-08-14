# Borda vermelha para não qualificadas + alerta de tempo sem resposta

## 1. Conversa não qualificada: borda vermelha fixa (sem piscar)

- Hoje a conversa sem qualificação pisca em azul na lista.
- Passa a ter apenas uma **borda vermelha fixa** na lateral esquerda do card (sem animação).
- Continua valendo só para caixas com qualificação ativada e conversas que tiveram resposta do cliente.
- Ao qualificar, a borda desaparece na hora.

## 2. Novo alerta: cliente esperando resposta

Contagem a partir da **última mensagem recebida do cliente**, enquanto ninguém respondeu:

| Tempo sem resposta | Aparência do card na lista |
|---|---|
| menos de 15 min | normal |
| 15 a 30 min | fundo **amarelo piscando** (ciclo lento, ~2s) |
| mais de 30 min | fundo **vermelho piscando** |
| atendente respondeu | volta ao normal imediatamente |

- Uma conversa é considerada "esperando" quando a última mensagem da conversa é do cliente. Assim que sai qualquer mensagem nossa (inclusive do IAGO), o alerta zera.
- Como os dois sinais podem ocorrer juntos, o alerta de tempo aparece no fundo do card e a borda vermelha de "não qualificada" fica na lateral — não se sobrepõem.
- O card mostra dica ao passar o mouse: "Cliente aguardando resposta há Xmin".

## Detalhes técnicos

- `src/index.css`: substituir `pisca-qualificacao` por uma classe estática de borda vermelha (`inset 3px 0 0 0 hsl(var(--destructive)/…)`) e adicionar duas animações novas (`pisca-sla-amarelo`, `pisca-sla-vermelho`) usando tokens; ambas desligadas em `prefers-reduced-motion`.
- `src/pages/InboxMeta.tsx`: derivar o estado de espera do que já é buscado — `ultima_msg_entrada_em` e `ultima_mensagem_em` (esperando quando `ultima_mensagem_em <= ultima_msg_entrada_em`). Aplicar as classes no `className` do botão da conversa (linha ~1621).
- Um único `setInterval` de 30s (com guard de `document.visibilityState`) apenas para reavaliar os limites de 15/30 min — não faz consulta ao banco.
- Sem alteração de banco, sem novas consultas, sem novo canal Realtime: **custo Lovable Cloud inalterado**.
