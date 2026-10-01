# Corrigir o aviso travado e completar Templates HSM Utility

## Resultado esperado

- O aviso **“Nenhum modelo aprovado disponível para copiar agora”** deixa de exibir o ícone girando e desaparece automaticamente.
- Ao clicar em **Sincronizar todos os templates**, o sistema atualiza os Templates HSM reais de cada instância e, depois, confere a cobertura dos modelos **Utility aprovados**.
- Instâncias próprias, ativas, conectadas e com qualidade **GREEN** recebem na fila os modelos Utility aprovados que ainda não possuem.
- Instâncias **YELLOW**, **RED** ou sem GREEN confirmado ficam somente no relatório de ignoradas e não recebem templates até voltarem a GREEN.

## Implementação

1. **Encerrar corretamente o aviso do card**
   - Ao terminar a tentativa de aplicação sem itens novos, fechar explicitamente o aviso de carregamento.
   - Exibir em seguida uma mensagem comum, com duração limitada e sem indicador girando.
   - Garantir o mesmo encerramento nos caminhos de sucesso e erro.

2. **Sincronizar antes de comparar**
   - Manter a leitura paginada de todos os templates reais diretamente na Meta, instância por instância.
   - Uma falha em uma instância não interrompe as demais; o resultado continua informando as ressalvas.

3. **Completar somente Utility aprovados**
   - Na ação manual **Sincronizar todos os templates**, formar a referência com modelos mestre Utility que estejam aprovados em pelo menos uma instância do mesmo proprietário.
   - Comparar por **nome + idioma**, sem misturar modelos ou instâncias de proprietários diferentes.
   - Não propagar Marketing, Authentication, modelos reclassificados como Marketing, parceiros ou números inativos.
   - Não reenviar modelos já aprovados, pendentes, em análise ou já presentes na fila.

4. **Aplicação gradual e proteção de qualidade**
   - Enfileirar apenas os ausentes nas instâncias GREEN e CONNECTED.
   - Reutilizar a fila gradual já existente, incluindo janela de horário, domingo, limites por tier, intervalos e pausa por bloqueio/reprovação.
   - Fazer uma última conferência antes de cada envio para impedir duplicidade caso o modelo tenha aparecido depois da sincronização.
   - A igualdade será alcançada conforme a Meta aprovar os modelos enfileirados; aprovação não será apresentada como imediata.

5. **Retorno claro na tela**
   - Ao concluir a sincronização manual, mostrar quantos templates foram lidos, quantos itens foram enfileirados, quantas instâncias foram afetadas e quantas foram ignoradas por qualidade ou bloqueio.
   - Atualizar a lista e a cobertura da aba Templates HSM após a operação.

## Custo e frequência

A verificação será executada **somente ao clicar no botão existente**, sem novo agendamento, polling ou rotina recorrente. O impacto esperado é baixo a moderado por execução, pois consulta cada instância na Meta e só envia os modelos realmente ausentes.

## Validação

- Reproduzir o caso sem modelos disponíveis e confirmar que o aviso fecha sem permanecer girando.
- Testar a sincronização manual com instâncias GREEN e YELLOW/RED, confirmando que apenas GREEN entra na fila.
- Conferir que modelos existentes não são duplicados e que Marketing não entra no lote.
- Validar o resumo, a atualização da cobertura e a tela em desktop e celular, sem disparar mensagens para clientes.
