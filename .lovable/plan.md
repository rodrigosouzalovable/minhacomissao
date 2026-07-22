Plano para corrigir o envio Meta:

1. Corrigir o botão de parada/cancelamento
- Fazer o backend devolver imediatamente para `pendente` qualquer item que esteja `processando` quando a campanha for cancelada.
- Limpar `atual_telefone`, `atual_instancia` e `proximo_em` no cancelamento para a tela refletir que parou.
- Ajustar os workers para checarem o status do job antes de reservar lote, antes de cada envio e antes de se auto-reagendar.
- No modo rajada, reduzir o tamanho do lote reservado para evitar que muitos contatos fiquem presos como `processando` depois de clicar em parar.

2. Impedir que workers antigos continuem após “Parar”
- Hoje o worker da rajada só valida `status='rodando'` no início; se o usuário cancela durante o loop, ele pode continuar enviando até acabar o lote/tempo da função.
- Vou adicionar checagens rápidas no loop e no `selfInvoke`, para que qualquer execução em andamento pare no próximo ponto seguro, sem continuar a fila.
- Observação: se uma mensagem já foi enviada para a Meta no exato instante do clique, ela não pode ser “desenviada”; mas nenhum novo contato deve ser puxado depois da parada.

3. Ajustar o Rate Limit da rajada
- Diminuir o teto de `Msgs/segundo` aceito no modo rajada para uma faixa mais segura.
- Alterar o padrão recomendado para mais conservador, começando com 1 msg/segundo por instância.
- Quando a Meta retornar `Rate limit exceeded`, devolver o contato para `pendente`, pausar a instância pelo `Retry-After` e retomar com intervalo mais seguro.

4. Melhorar a ação “Tentar novamente”
- Ao reenfileirar erros, garantir que os itens com erro voltem para `pendente` e que itens `processando` de uma campanha cancelada também não fiquem travados.
- Se a campanha for rajada, reabrir usando a regra controlada e mais lenta.

5. Validar
- Conferir por código que `cancelar` não deixa `pendente/processando` sendo enviado após a mudança.
- Verificar que os erros de Rate Limit continuam visíveis, mas não explodem a fila em paralelo.