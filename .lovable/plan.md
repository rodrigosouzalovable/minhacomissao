# Edição de credor e seleção de parcelas

## O que muda
1. Nos acordos próprios, usuários poderão alterar somente o credor na tela de edição, escolhendo entre NOVO MUNDO e UME. Os demais campos dessa tela ficarão indisponíveis para eles. O seu acesso para editar todos os dados permanece; as ações já existentes de parcelas e pagamentos não mudam.
2. Ao clicar em **Selecionar todas** para excluir parcelas, somente as parcelas não pagas e permitidas serão selecionadas. Parcelas pagas permanecerão fora da seleção.

## Detalhes técnicos
- Manter a alteração de credor pela operação exclusiva existente, com registro de auditoria. Ajustar sua autorização no banco para aceitar o responsável pelo próprio acordo, mantendo a autorização administrativa atual e recusando acordos de terceiros; não liberar atualização direta da coluna nem ampliar permissões gerais de edição.
- Na tela de edição, separar o salvamento do credor do salvamento dos demais campos: usuários comuns chamam apenas a operação de alteração de credor, sem enviar nem regenerar dados ou parcelas; o administrador conserva o formulário completo e usa a mesma operação exclusiva quando mudar o credor. Atualizar o detalhamento e os acessos à edição para deixar claro o controle disponível a cada perfil.
- Na seleção em massa, filtrar explicitamente `status !== 'pago'`, sem modificar as ações individuais existentes; garantir que a confirmação e o envio da exclusão incluam apenas parcelas elegíveis.
- Validar com casos de acordo próprio, acordo de terceiro e administrador; edição do credor com e sem parcelas pagas; seleção mista de parcelas pagas e pendentes. Confirmar que o registro de auditoria é mantido e que as demais edições administrativas seguem funcionando.
