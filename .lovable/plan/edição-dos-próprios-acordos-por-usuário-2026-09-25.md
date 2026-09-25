# Edição dos próprios acordos por usuário

## O que muda

- O usuário poderá abrir **Editar** apenas no acordo que ele lançou. Na edição, poderá trocar o **credor** (NOVO MUNDO/UME), corrigir o **telefone** do cliente e escolher **parcelas específicas ainda não pagas** para alterar o **valor** e a **data de vencimento**.
- O valor total do contrato acompanhará a soma das parcelas após a edição. Parcelas pagas, sua data de pagamento efetivo e seus valores permanecerão intactos.
- O operador vinculado, nome, CPF, quantidade de parcelas, demais dados e comissões não serão campos de edição livre para usuários comuns. O acesso administrativo continuará com a edição completa já existente.
- Um usuário não poderá editar o acordo de outro usuário, inclusive por link direto ou acesso compartilhado. A visualização de acordos de equipe e as ações administrativas permanecem como estão.

## Detalhes técnicos

- Na tela de edição, separar o fluxo administrativo existente do fluxo do dono: carregar as parcelas identificadas, permitir mudar só as pendentes e salvar apenas os campos alterados, sem recriar a sequência de parcelas nem reativar o acordo. Manter a troca de credor na operação exclusiva com auditoria.
- Salvar as mudanças de valor/vencimento de parcela e telefone em uma operação atômica que verifica o usuário autenticado como dono, confere novamente o estado das parcelas, rejeita parcelas pagas e calcula no servidor o novo total do acordo e os valores de comissão derivados conforme a regra já aplicada, sem mexer em pagamentos realizados.
- Revisar os caminhos existentes de atualização do acordo e das parcelas e restringir no banco alterações de acordos alheios para usuários comuns, inclusive compartilhados. Proteger a troca de operador contra requisições diretas e impedir que a nova permissão seja contornada por atualizações genéricas de campos não autorizados; preservar as ações existentes de parcelas/pagamentos que já sejam permitidas ao dono.
- Atualizar o botão **Editar** e os controles de valor/vencimento nos detalhes para respeitar o mesmo critério de dono ou administrador, sem oferecer edição de acordo alheio.

## Validação

- Testar um acordo próprio com parcelas pendentes e pagas: mudar telefone, credor, valor e vencimento de uma parcela pendente; confirmar total e comissão coerentes, sem alteração das pagas.
- Testar tentativas de edição de parcela paga, de operador e de acordo alheio pela tela e por requisição direta; todas devem ser recusadas. Conferir a edição integral de um administrador e a leitura dos acordos da equipe.
