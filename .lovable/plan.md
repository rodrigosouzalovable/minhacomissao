Identifiquei que a tela está presa em "Carregando..." porque as chamadas ao backend estão falhando com timeout/Failed to fetch, inclusive renovação de sessão e consultas de Acordos/Retornos/Pagamentos. Também encontrei consultas pesadas e repetidas no carregamento da página de Acordos e no sino de lembretes do menu, que podem piorar ou provocar esse travamento quando o backend está sobrecarregado.

Plano de correção urgente:

1. Evitar tela infinita de "Carregando"
   - Adicionar timeout de segurança na autenticação inicial.
   - Se o backend não responder, parar o loading e exibir uma mensagem de erro com botão "Tentar novamente", em vez de deixar o sistema travado.
   - Manter o usuário logado quando houver sessão local, mas informar claramente quando os dados não puderem ser carregados.

2. Corrigir a página "Meus Acordos"
   - Trocar o carregamento atual por uma versão tolerante a falhas: se uma consulta auxiliar falhar, a tela ainda abre com o que foi possível carregar.
   - Adicionar botão "Recarregar" e mensagem objetiva quando houver falha.
   - Remover/limitar a consulta que varre todas as parcelas paginando em loop no carregamento inicial.
   - Buscar parcelas somente dos acordos carregados do usuário/admin compartilhado, reduzindo o volume de dados.
   - Selecionar apenas colunas necessárias em vez de `select('*')` onde for possível.

3. Reduzir sobrecarga dos lembretes globais do menu
   - O sino de lembretes roda em todas as páginas e hoje refaz consultas a cada 30 segundos, incluindo parcelas vencidas.
   - Aumentar o intervalo e/ou pausar refetch agressivo quando o popover não estiver aberto.
   - Limitar consultas de lembretes a dados realmente necessários para o alerta.
   - Garantir que falhas nesses lembretes não travem o layout principal.

4. Melhorar consultas e índices do banco
   - Criar índices complementares para os padrões críticos:
     - `pagamentos(status, data_prevista, acordo_id)`
     - `pagamentos(acordo_id, data_prevista, status)`
     - `acordos(user_id, criado_em desc)`
     - `retornos(status, data_retorno, user_id)`
     - `user_permissions(user_id)` se ainda não existir
   - Esses índices não alteram dados; apenas tornam as consultas mais rápidas e reduzem chance de timeout.

5. Revisar rotas/layout para isolamento de falhas
   - Proteger `AppLayout`, `PaymentReminders`, `RetornoAlertChecker` e hooks relacionados para que erro de uma consulta secundária não impeça a página principal de renderizar.
   - Adicionar tratamento consistente de erro nas consultas React Query.

6. Validação após implementação
   - Rodar build/teste local.
   - Consultar logs novamente.
   - Testar abertura de `/acordos` e confirmar que a tela não fica presa em "Carregando..." mesmo se alguma chamada falhar.

Aviso de custo Lovable Cloud: esta correção reduz consumo e carga no backend; os índices ocupam um pequeno espaço adicional de armazenamento, mas tendem a diminuir timeouts e processamento. Não vou adicionar cron, automação recorrente nem novas execuções automáticas.