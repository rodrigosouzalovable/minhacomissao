# Equipes de operadores e conta UME por operador

## O que muda na aba Usuários
- Nova coluna **Equipe** em cada login, com um seletor:
  - **Souza e Ribeiro** (seus operadores, padrão)
  - **Equipe Thiago (Amaral)**
- Filtro no topo da lista: Todos / Meus operadores / Equipe Thiago, para ver cada grupo separado.
- Selo colorido ao lado do nome indicando a equipe.
- Somente administradores podem alterar a equipe.

## Efeito para a Equipe Thiago
- Operadores marcados passam a usar a API UME da Amaral em:
  - Calculadora UME (consulta, simulação e fechamento de acordo)
  - Boleto/PIX gerados no Inbox
- O Thiago continua no grupo dele automaticamente.
- IAGO nos números do Thiago continua usando a conta Amaral (sem mudança).
- Nunca há troca entre contas: operador Amaral nunca cai na conta da empresa e vice‑versa.

## Efeito para seus operadores
- Continuam 100% na conta UME Souza e Ribeiro, sem nenhuma alteração.

## Detalhes técnicos
- Nova coluna `equipe_ume` (texto, padrão `padrao`) em `user_permissions`, valores `padrao` | `amaral`; atualização protegida por admin via RPC.
- `_shared/ume-conta.ts`: `contaUmeDoUsuario` passa a ler `equipe_ume` (mantendo Thiago como `amaral`); remove o mapeamento fixo por ID para usuários.
- Teste: operador marcado `amaral` usa conta Amaral; operador `padrao` usa conta da empresa.
- Reimplantar funções UME (boleto, parcela em atraso, acordo, calculadora, IAGO).
- Sem novas rotinas automáticas nem custo adicional.
