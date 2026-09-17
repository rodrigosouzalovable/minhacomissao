# Credor editável nos cards de Acordos da Equipe

## Objetivo

Exibir claramente **NOVO MUNDO** ou **UME** em cada card de cliente na aba **Acordos da Equipe** e permitir que somente o acesso de **RODRIGO RIBEIRO DE SOUZA** altere o credor diretamente no card.

A alteração usará os valores já adotados pelo sistema:

- `ume_novo_mundo` → **NOVO MUNDO**
- `mundo_da_moda` → **UME**

## Como ficará no card

- Manter uma TAG visível de credor em todos os cards, inclusive pagos, negociados, próximos, realizados e vencidos.
- Para os demais usuários, a TAG será apenas informativa.
- No acesso exclusivo autorizado, a TAG funcionará como seletor entre **NOVO MUNDO** e **UME**.
- A troca pedirá confirmação, mostrando o cliente, o credor atual e o novo credor, para evitar alterações acidentais.
- Enquanto salva, o seletor ficará bloqueado e mostrará o andamento; em caso de erro, o card voltará ao valor anterior.
- O clique no seletor não abrirá a página de detalhes do acordo.

## Reflexo nos valores dos operadores

Ao confirmar a troca:

- atualizar o credor gravado no acordo, preservando operador, parcelas, pagamentos, status e demais dados;
- atualizar imediatamente o card e os dados já carregados da tela;
- renovar ranking mensal, metas, histórico e telas de comissões para que cada parcela paga passe a compor o credor correto;
- manter o total geral do operador inalterado: somente a divisão entre NOVO MUNDO e UME muda;
- aplicar a nova classificação também aos meses anteriores, pois os cálculos existentes consultam o credor atual do acordo e a data real de pagamento.

## Segurança

- A permissão será validada no banco pelo identificador interno do acesso de RODRIGO, não por texto de e-mail no navegador.
- Criar uma operação exclusiva para trocar apenas o campo de credor.
- Impedir que outros administradores, gestores, funcionários ou acessos compartilhados alterem o credor por outro caminho, mantendo as demais permissões atuais de edição.
- Registrar a mudança com acordo, credor anterior, credor novo, autor e data para auditoria.
- Manter a leitura da TAG disponível conforme as permissões atuais dos acordos.

## Detalhes técnicos

- Ajustar o card reutilizado em `Acordos.tsx` para receber a ação de troca e invalidar as consultas financeiras relacionadas.
- Adicionar uma função protegida no banco para validar o usuário autorizado, alterar `acordos.empresa` e gravar a auditoria de forma atômica.
- Adicionar proteção no banco contra mudança de `empresa` por atualizações genéricas, sem bloquear a edição dos demais campos do acordo.
- Não recalcular nem sobrescrever valores de parcelas ou percentuais de comissão; os painéis já agregam os pagamentos pela empresa do acordo.

## Validação

- Testar a troca NOVO MUNDO → UME e UME → NOVO MUNDO no acesso autorizado.
- Confirmar que a TAG muda no card sem recarregar a página.
- Confirmar que o valor sai de um credor e entra no outro para o mesmo operador, mantendo o total geral idêntico.
- Conferir ranking do mês, histórico, metas e comissões do operador após a troca.
- Testar com acordo sem pagamento e com acordo contendo pagamentos em mais de um mês.
- Confirmar que outro administrador, funcionário e acesso compartilhado visualizam a TAG, mas não conseguem alterar o credor nem contornar a restrição.
- Verificar os cards em computador e celular, sem cortar nome, TAG ou valores.
