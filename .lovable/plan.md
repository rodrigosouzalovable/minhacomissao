# Corrigir clientes Odres que não aparecem em /odrescred

## Causa encontrada
O portal decide se um CPF é "Odres" ou "UME" olhando apenas uma lista de CPFs da Odres importada manualmente (≈35.900 CPFs, última atualização em 07/10). Quando o CPF não está nessa lista:
- Em **meusacordos.com.br**, a dívida da UME (consulta online) é mostrada como se fosse UME — por isso o cliente encontra.
- Em **/odrescred**, o sistema entende que o CPF "não é Odres" e só olha a base local, que está vazia — por isso aparece "Nenhuma pendência".

Os arquivos diários do SFTP já dizem qual é a carteira de cada CPF (carteira Odres = 217490215), mas o portal não usa essa informação.

## O que vai mudar
1. O portal passa a reconhecer como Odres todo CPF que esteja na lista atual **ou** na carteira Odres dos arquivos diários do SFTP.
2. Com isso, esses clientes passam a ver a dívida em **/odrescred** (como Odres) e deixam de aparecer como UME no portal principal, mantendo a separação total entre Odres e UME.
3. Clientes que existem nas duas carteiras continuam com a mensagem de "fale com nossa equipe" (regra atual, sem somar valores).
4. Nenhuma regra de desconto, parcelas, valores ou acordos muda.

## Verificação
- Antes: contar quantos CPFs Odres do SFTP estão fora da lista (confirma o tamanho do problema).
- Depois: testar um CPF Odres que estava fora da lista nos dois endereços.

## Detalhes técnicos
- Migration: alterar `portal_odres_identificado(p_cpf)` para retornar true também quando existir `ume_carteira_parcelas` com `carteira='217490215'` e `cpf in (p_cpf, ltrim(p_cpf,'0'))`; garantir índice em `ume_carteira_parcelas(cpf)` (sem custo recorrente; consulta pontual por CPF).
- Sem mudanças em `portal-consultar` nem na tela; `portalRemoteDecision` continua igual.
