

## Remover "Nascimento" do portal de negociacao

### Problema
Na pagina de resultado da consulta do portal de negociacao, esta sendo exibida a data de nascimento do cliente ao lado do CPF, informacao desnecessaria.

### Solucao
Remover o bloco que exibe "Nascimento: ..." no arquivo `src/pages/ConsultaResultado.tsx`.

### Detalhes tecnicos

**Arquivo:** `src/pages/ConsultaResultado.tsx`

- Remover o estado `nascimentoCliente` e a linha que o define no `useEffect`
- Remover o trecho condicional que renderiza "Nascimento: {formatDateBR(nascimentoCliente)}"
- Opcionalmente remover a funcao `formatDateBR` se nao for usada em outro lugar do arquivo

