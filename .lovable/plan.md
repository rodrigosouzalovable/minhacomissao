
Diagnóstico confirmado do problema:

1) O painel “Envios do dia” está somando a fila inteira do dia, não só o número selecionado em “WhatsApp Principal para Lembretes”.
- Em `src/components/LembretesSection.tsx`, a consulta atual busca `whatsapp_fila` apenas por data (`criado_em`) e sem filtro por instância/token.
- Por isso aparece “15 de 26”, misturando mensagens de outros tokens/telefones.

2) O número exibido no card representa quantidade de mensagens, não quantidade de contatos únicos.
- Ex.: 3 telefones podem receber 5 mensagens (parcelas diferentes, mais de uma mensagem para o mesmo contato).

Plano de correção (implementação):

1. Corrigir o escopo do card “WhatsApp Principal para Lembretes”
- Arquivo: `src/components/LembretesSection.tsx`
- Alterar `fetchStats` para filtrar por `instance_token` (e `server_url`) da instância selecionada no campo “WhatsApp Principal para Lembretes”.
- Se nada estiver selecionado (`none`), mostrar estado neutro com instrução para selecionar uma instância (em vez de mostrar total global).
- Ajustar também `handleRetryErros` para reprocessar erros somente da instância selecionada (hoje ele reprocessa todos).

2. Deixar explícito no UI o que está sendo contado
- Arquivo: `src/components/LembretesSection.tsx`
- Trocar o texto para “X mensagens enviadas” e adicionar “Y contatos únicos” para evitar confusão entre mensagens vs números.
- Exibir o nome/número da instância que está sendo monitorada no topo do card.

3. Alinhar disparo manual com a instância principal selecionada
- Arquivos: `src/components/LembretesSection.tsx` e `supabase/functions/check-payment-reminders/index.ts`
- No botão “Iniciar Envios”, enviar para a função os dados da instância principal selecionada.
- Na função `check-payment-reminders`, quando chamada manualmente com esse parâmetro, gravar a fila com esse token/servidor (evitando mistura com outras instâncias no disparo manual daquele painel).

Resultado esperado após correção:
- O card não mostrará mais “15 de 26” misturando outros telefones.
- O número exibido baterá com o WhatsApp 62982198675 (considerando mensagens, com contatos únicos apresentados separadamente).
- O reenvio de erros e o monitoramento ficarão restritos ao telefone principal de lembretes escolhido no seu usuário.
