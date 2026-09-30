# Corrigir escalada humana do IAGO

## Verificação dos achados

- **Caixas somente com administradores:** não alterar. O comportamento citado existe, mas corresponde à regra aprovada mais recente: administradores acompanham a caixa e não entram na distribuição automática; uma caixa sem atendente comum permanece sem atribuição. O alerta será encerrado como falso positivo.
- **Conversa escalada sem “Aguardando Humano”:** confirmado. A função encerra sem gravar a etiqueta quando não encontra atendente e ainda usa uma origem rejeitada pela restrição atual do banco.

## Implementação

1. Fazer a transferência do IAGO registrar **“Aguardando Humano” antes de procurar um atendente**, mantendo a conversa visível mesmo quando a fila está vazia.
2. Usar as origens já permitidas no banco: `auto_atendente` para a pessoa escolhida e `manual` para a espera humana.
3. Manter a ordem circular atual, a exclusão de administradores e todas as regras de acesso existentes.
4. Adicionar uma proteção no atendimento do IAGO para aplicar a etiqueta de espera antes da chamada de transferência.

## Validação

- Simular a função com uma conversa temporária sem atendente elegível e confirmar que retorna sem responsável, mas mantém “Aguardando Humano”.
- Confirmar que uma transferência com atendente continua gravando as duas etiquetas sem violar a restrição de origem.
- Publicar novamente o IAGO, verificar os registros da função e encerrar os dois alertas com seus resultados corretos.
