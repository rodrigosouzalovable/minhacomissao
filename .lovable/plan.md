# Alteração de vencimento e confirmação de pagamento por todos os usuários

## Resultado esperado

- Todo usuário autenticado poderá abrir acordos próprios e de outros usuários.
- Em qualquer acordo, poderá alterar a data de vencimento de parcelas pendentes.
- Em qualquer acordo, poderá marcar uma parcela como paga ou desfazer a baixa.
- Ao marcar como paga, a data do pagamento será preenchida com o dia atual; ao desfazer, será removida.
- Quando todas as parcelas forem pagas, o acordo ficará concluído; ao reabrir uma parcela, voltará para ativo.
- Dados sensíveis do acordo, valores, comissões e responsável continuarão protegidos.

## Implementação

1. **Permissão segura no banco**
   - Criar operações específicas para alterar somente o vencimento e para marcar/desmarcar pagamento.
   - Exigir usuário autenticado e validar a parcela e o acordo no servidor.
   - Permitir alteração de vencimento apenas em parcela pendente, preservando o histórico das pagas.
   - Atualizar parcela e situação do acordo na mesma operação, evitando estados divergentes.
   - Liberar execução somente para usuários autenticados e para o serviço interno; nenhum acesso anônimo.
   - Não ampliar a permissão genérica de atualização das tabelas, evitando que um usuário altere valor, comissão ou proprietário por requisição manual.

2. **Acesso aos acordos dos demais usuários**
   - Permitir que usuários autenticados consultem os acordos e parcelas necessários para executar essas ações.
   - Manter exclusão, transferência, edição de valores e demais alterações obedecendo às permissões atuais.

3. **Tela do acordo**
   - Exibir o lápis de vencimento nas parcelas pendentes para todos os usuários.
   - Exibir “Marcar como pago” e “Desmarcar pagamento” para todos os usuários.
   - Trocar as atualizações diretas pelas novas operações seguras.
   - Atualizar imediatamente a parcela e a situação do acordo após cada ação, com mensagens claras de sucesso ou erro.

4. **Permissão administrativa existente**
   - Remover a dependência visual da opção individual “Pode marcar parcelas como pago”, pois a ação passará a ser permitida para todos conforme solicitado.
   - Preservar as demais permissões individuais sem alteração.

5. **Validação**
   - Testar com usuário comum em acordo próprio e em acordo de outro usuário.
   - Confirmar alteração de vencimento em parcela pendente e bloqueio em parcela paga.
   - Confirmar marcar e desmarcar pagamento, incluindo a mudança automática do acordo entre ativo e concluído.
   - Tentar alterar valor, comissão ou responsável pela mesma chamada e confirmar que não é permitido.
   - Verificar a tela em computador e celular e confirmar o funcionamento sem erros.
