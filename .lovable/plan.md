## Objetivo

Permitir que qualquer usuário (não apenas admin) lance um novo acordo quando o CPF já existir no sistema, **desde que TODOS os acordos anteriores desse CPF estejam com status `quebrado`**. Nos demais casos (existe algum acordo `ativo` ou `finalizado`), continua valendo a regra atual: só admin pode lançar.

## Contexto

Hoje o trigger `acordos_block_duplicate_cpf` bloqueia qualquer duplicidade de CPF para não-admins, sem exceção. A memória do projeto (`excecao-cpf-duplicado-quebra`) já previa essa exceção de "quebra", mas ela foi removida na última mudança e agora precisa voltar — só que de forma mais estrita: **todos** os acordos anteriores precisam estar quebrados, não apenas o último.

## Mudança

Migração SQL substituindo a função do trigger `acordos_block_duplicate_cpf` por:

```text
Se o usuário é admin → permite (comportamento atual).
Se NÃO é admin:
  - Conta acordos existentes com o mesmo cliente_cpf onde status <> 'quebrado'.
  - Se count > 0 → bloqueia com mensagem clara ("CPF já possui acordo ativo/finalizado. Apenas admin pode lançar.").
  - Se count = 0 e existir ao menos um acordo quebrado → permite (novo acordo pós-quebra).
  - Se não existir nenhum acordo → permite (fluxo normal).
```

Normalização do CPF (só dígitos) mantida como no trigger atual.

## Fora do escopo

- Nenhuma mudança de UI. O aviso em tempo real de CPF duplicado no formulário continua igual; o backend passa a aceitar o lançamento quando o único histórico é de quebra.
- Nenhuma mudança em RLS, storage ou outras telas.

## Verificação pós-migração

1. Como não-admin, tentar lançar acordo para CPF cujo único acordo anterior está `quebrado` → deve permitir.
2. Como não-admin, tentar lançar para CPF com acordo `ativo` → deve bloquear.
3. Como admin, ambos os cenários → deve permitir.
