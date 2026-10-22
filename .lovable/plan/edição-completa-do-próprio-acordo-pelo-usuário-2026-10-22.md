# Edição completa do próprio acordo pelo usuário

## O que muda
Na tela **Editar** de um acordo que o próprio usuário lançou, ele poderá alterar:
- **Nome do cliente**
- **CPF**
- **Telefone**
- **Quantidade de parcelas** (aumentar ou diminuir)
- **Valor** e **data de vencimento** de cada parcela

Regras que continuam valendo:
- Só o dono do acordo (ou admin) edita; acordos de outros operadores seguem bloqueados.
- Parcelas **pagas** não são apagadas. Ao diminuir a quantidade, só parcelas pendentes do fim são removidas; não é possível ficar com menos parcelas do que as já pagas.
- Valor e data de pagamento das parcelas pagas continuam corrigidos na tela de detalhes, como hoje.
- Total do acordo, valor médio da parcela e comissões são recalculados automaticamente pela soma das parcelas, mantendo o percentual de comissão atual.
- Ao trocar o CPF, vale a mesma checagem de duplicidade do novo acordo: funcionário não pode usar CPF que já tenha acordo ativo de outro (exceto se o último estiver quebrado).
- Operador vinculado, dias de atraso e percentual de comissão continuam sem edição livre para funcionários. Admins mantêm a edição completa atual.

## Detalhes técnicos
- Nova migração: amplia `editar_acordo_proprio` (nova assinatura com `p_nome`, `p_cpf`, `p_quantidade`) mantendo verificação de dono, validação de nome (mín. 3 letras) e CPF (11 dígitos, regra de duplicidade via `cpf_normalize`), criação de parcelas pendentes novas (valor/data enviados, comissão pelo percentual do acordo) e remoção apenas de pendentes excedentes; recalcula `parcelas`, `valor_total`, `valor_parcela`, `comissao_total` atomicamente. Revisar o trigger de proteção de `acordos`/`pagamentos` para aceitar essas mudanças só dentro da operação autorizada.
- `EditarAcordo.tsx`: no fluxo do dono, liberar campos nome/CPF, adicionar seletor de quantidade e lista editável (valor/vencimento) de todas as parcelas pendentes, incluindo as novas; pagas aparecem só para leitura.
- Teste em `tests/` cobrindo: quantidade mínima = parcelas pagas e recálculo do total pela soma.
- Sem cron, polling ou custo extra.

## Validação
- Como funcionário, em acordo próprio: mudar nome, CPF, telefone, aumentar e diminuir parcelas, alterar valores/datas; conferir total e comissão.
- Tentar em acordo de outro usuário e remover parcela paga: deve ser recusado.
