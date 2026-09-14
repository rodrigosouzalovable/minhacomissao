# Corrigir a reativação e os totais da campanha Novo Mundo1

## Diagnóstico confirmado

- A campanha `Novo Mundo1` aparece como concluída com o botão **Reativar (711)**.
- No banco, os 1.832 contatos já estão em estado final: **1.313 enviados** e **519 sem WhatsApp**.
- Não existe nenhum item pendente, processando, com erro ou falha para essa campanha neste momento.
- O botão aparece porque a tela calcula “restantes” apenas como `total - enviados - erros`, sem descontar `sem WhatsApp`, e os contadores gravados no cabeçalho da campanha também ficaram diferentes dos itens reais.
- Ao clicar, o controle verifica corretamente que não há pendentes e não inicia novos envios; por isso parece que nada aconteceu.
- O resumo de entrega também está excedendo o tempo de consulta por falta de índice no identificador da mensagem, o que prejudica a atualização visual.

## Alterações

1. Recalcular os contadores da campanha a partir dos itens reais, incluindo enviados, erros e sem WhatsApp.
2. Corrigir o cálculo de “restantes” em todas as telas para descontar também os contatos sem WhatsApp.
3. Fazer o botão **Reativar** consultar a quantidade real de itens pendentes antes de aparecer ou executar.
4. Quando não houver pendentes, atualizar os números da tela e informar claramente que a campanha já terminou, em vez de aparentar que o clique falhou.
5. Quando houver pendentes de verdade, reabrir a campanha, limpar travas antigas do worker e iniciar o processamento normalmente, preservando os já enviados para não duplicar mensagens.
6. Corrigir os contadores inconsistentes desta campanha com base nos 1.832 itens existentes; os 20 erros antigos só poderão ser reenviados se ainda houver itens realmente marcados com erro.
7. Adicionar o índice necessário para o resumo de entrega responder sem timeout.
8. Validar na campanha real que os totais fecham, o botão indevido desaparece e nenhuma mensagem já concluída volta para a fila.

## Segurança e custo

- Nenhum cron, polling ou canal em tempo real novo será criado.
- A correção evita reenvios duplicados e reduz consultas lentas; o impacto de custo na Lovable Cloud é desprezível.
- Bloqueios reais da Meta e instâncias já protegidas continuarão sendo respeitados.
