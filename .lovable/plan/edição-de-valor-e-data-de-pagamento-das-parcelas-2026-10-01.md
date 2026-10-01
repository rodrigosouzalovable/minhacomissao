# Edição de valor e data de pagamento das parcelas

## Objetivo
Permitir que cada usuário altere, nos acordos que ele próprio lançou:

- o valor de parcelas pendentes e pagas;
- a data efetiva de pagamento das parcelas já pagas.

Administradores continuarão com acesso completo. Usuários não poderão alterar parcelas de acordos de outros operadores.

## Situação atual confirmada
- O proprietário já consegue alterar o valor e o vencimento de parcelas pendentes.
- O valor de parcelas pagas fica bloqueado para o proprietário.
- A data efetiva de pagamento atualmente só aparece para edição administrativa.
- O total do acordo e as comissões dependem dos valores das parcelas e precisam permanecer sincronizados.

## Implementação
1. Criar uma operação protegida no banco para editar uma parcela do próprio acordo.
   - Confirmar que o acordo pertence ao usuário autenticado.
   - Permitir ao proprietário alterar o valor tanto de parcela pendente quanto paga.
   - Permitir alterar `data_paga` somente quando a parcela estiver marcada como paga.
   - Rejeitar valores inválidos, datas vazias e tentativas sobre acordos de terceiros.
   - Manter o acesso administrativo existente.

2. Recalcular tudo de forma atômica após alteração de valor.
   - Atualizar o valor da parcela.
   - Recalcular a comissão da parcela preservando o percentual aplicável.
   - Recalcular o valor total e a comissão total do acordo usando todas as parcelas.
   - Retornar os valores persistidos para evitar diferença entre a tela e o banco.

3. Atualizar a tela de detalhes do acordo.
   - Exibir o lápis no valor de parcelas pendentes e pagas quando o usuário for o proprietário.
   - Exibir o lápis na data de pagamento das parcelas pagas do próprio acordo.
   - Salvar pelas operações protegidas, atualizar imediatamente os totais exibidos e mostrar erros claros.
   - Manter comissão e demais campos financeiros sem edição manual para usuários comuns.

4. Manter a tela geral de edição coerente.
   - Continuar permitindo a edição em lote das parcelas pendentes.
   - Indicar que valores de parcelas pagas e respectivas datas de pagamento são corrigidos na tela de detalhes.

## Validação
- Testar como usuário comum em acordo próprio: alterar valor de parcela pendente, valor de parcela paga e data paga.
- Confirmar o recálculo de valor total, comissão da parcela e comissão total.
- Tentar as mesmas alterações em acordo de outro usuário e confirmar bloqueio no banco, inclusive por chamada direta.
- Testar como administrador e confirmar que o acesso completo permanece funcionando.
- Confirmar que vencimentos, status pago/pendente, lembretes e relatórios continuam consistentes.
