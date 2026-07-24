Minha opinião: sim, faz sentido automatizar isso. Eu só mudaria um ponto: rate limit não deve aparecer como “erro final” para o usuário, porque é uma pausa temporária da Meta. Ele deve virar “aguardando/retry”, voltar para a fila e o sistema deve reduzir a velocidade sozinho.

Plano de implementação:

1. Ajustar o motor do Modo Rajada
- Quando a Meta retornar `Rate limit exceeded`, o item volta para `pendente` imediatamente.
- O campo `erro` desse item será limpo ou marcado só internamente como tentativa temporária, para não aparecer na lista vermelha de erros.
- O contador de erros da campanha não será aumentado por rate limit.
- A instância respeitará o `Retry after` informado pela Meta antes de tentar novamente.

2. Tornar a redução de velocidade mais conservadora
- Ao detectar rate limit, a taxa da instância cairá para `1 msg/segundo`.
- Depois de várias janelas sem rate limit, o sistema poderá subir lentamente, mas nunca “explodir” de volta de uma vez.
- Remover o reset agressivo que hoje pode voltar direto para o teto do slider após alguns minutos, porque isso pode causar novo bloqueio.

3. Reprocessar automaticamente sem botão manual
- O worker continuará se auto-reinvocando depois do tempo de pausa.
- Os contatos que bateram em rate limit serão reenfileirados e enviados novamente automaticamente.
- O botão “Tentar novamente” continuará existindo para erros reais, mas rate limit deixará de alimentar essa lista.

4. Melhorar a tela da campanha
- Trocar a mensagem vermelha de rate limit por um aviso temporário no progresso, como “Meta pausou esta instância por X segundos; retomando a 1 msg/s”.
- A lista “Erros” ficará reservada para falhas definitivas: número inválido, template recusado, instância bloqueada/restrita, falha após tentativas etc.
- O progresso continuará mostrando enviados, aceitos, entregues e pendentes de forma limpa.

5. Verificar dados de campanhas já em andamento
- Para campanhas que já ficaram com itens em `erro` por rate limit, o plano é permitir que o botão atual “Tentar novamente” continue limpando esses erros e devolvendo para a fila.
- Para novos rate limits, eles não entrarão mais como erro final.

Detalhes técnicos:
- Arquivos principais: `supabase/functions/envio-meta-massa-burst/index.ts`, `supabase/functions/send-whatsapp-meta/index.ts`, `supabase/functions/envio-meta-massa-retry-erros/index.ts` e `src/components/meta/CampanhaDetalheDialog.tsx`.
- Não pretendo criar cron novo, polling novo ou tabela pesada; a alteração reaproveita o worker atual e o campo `rate_limit_ate`, então o impacto de custo deve ser mínimo.
- Se for necessário persistir um aviso visual por instância/campanha, farei com campos existentes quando possível; só proporia migração se o esquema atual não suportar.