# Corrigir recusa "fora da carteira" no portal (CPF 009.667.424-51)

## Causa confirmada
O registro novo mostrou o motivo: o portal exibiu a dívida do cliente na carteira **UME**, mas nos arquivos SFTP ele está na carteira **Odres Cred**. Como os dois códigos não batiam, o sistema recusou antes de falar com a UME. A UME aceita a proposta normalmente (simulação feita antes).

## O que será feito
1. Ao fechar o acordo pelo portal, usar a carteira real do cliente nos arquivos SFTP (UME ou Odres Cred), em vez de recusar quando o cliente veio pela outra aba. As duas carteiras usam a mesma API UME e o mesmo cadastro do cliente.
2. Lançar o acordo no sistema, no seu login, com o credor correto (o da carteira real), para os recebimentos ficarem separados certos.
3. Corrigir a consulta do portal para mostrar a dívida no credor certo, para não confundir o cliente.
4. Testar com o CPF dele apenas até a simulação, sem fechar acordo; depois ele tenta de novo no portal.

## Detalhes técnicos
- `portal-efetivar-acordo`: aceitar `cli.carteira` em `CARTEIRA` (qualquer um dos dois) e derivar `credorReal`; usar `credorReal` em `empresa`, rótulo e aviso.
- Verificar em `portal_consultar_carteira` por que o CPF aparece em UME quando a carteira SFTP é Odres, e alinhar.
