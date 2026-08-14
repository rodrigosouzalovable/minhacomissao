# IAGO: identificar o CPF pelo telefone antes de perguntar

## Resposta à dúvida

Sim, o sistema já consegue. O IAGO hoje já tenta descobrir o CPF pelo telefone do contato antes de perguntar: ele procura o telefone na carteira de devedores e também na lista de telefones importados por CPF, comparando pelos últimos 8 dígitos.

O que verifiquei no banco agora:
- Lista de telefones vinculados a CPF (planilha importada): 125 números ativos, cobrindo 81 CPFs.
- Devedores com telefone preenchido no cadastro: 694 registros.
- Existem alguns números repetidos apontando para 2 CPFs diferentes (ex.: casos de familiares/mesmo aparelho).

Ou seja: a base de telefones vinculados ainda é pequena em relação à carteira, por isso na maioria das conversas ele acaba caindo no "pede o CPF". A busca funciona, o que falta é robustez e cobertura.

## O que será ajustado

1. Busca mais completa do CPF pelo telefone
   - Procurar em todas as fontes de telefone (telefones importados por CPF, cadastro do devedor e telefones registrados em acordos), sempre pelos últimos 8 dígitos.
   - Não descartar registros marcados como inativos na busca (hoje isso reduz os acertos), apenas priorizar os ativos.
   - Quando houver mais de um CPF para o mesmo telefone, priorizar o CPF que tem acordo ativo e, na falta disso, o que tem débitos em aberto.

2. IAGO não pergunta CPF quando já identificou
   - Ao identificar o cliente pelo telefone, o CPF fica gravado na conversa e o IAGO já entra com o nome e a proposta calculada, sem pedir documento.
   - Confirmação leve de identidade: ele cumprimenta usando o primeiro nome encontrado ("Falo com a Maria?") e segue a negociação; se o cliente disser que não é a pessoa, ele escala para humano.
   - Se o telefone aponta para mais de um CPF possível, ele confirma pelo nome antes de apresentar valores.

3. Pergunta o CPF só como fallback
   - Se nada for encontrado pelo telefone, mantém o comportamento atual: pede o CPF de forma natural, uma única vez.
   - Se o telefone foi identificado mas não há débitos em aberto para aquele CPF, ele informa que não localizou débitos e escala, em vez de ficar pedindo CPF em loop.

## Detalhes técnicos

- `supabase/functions/_shared/iago.ts`: reescrever `resolverCpfPorTelefone` para consultar `devedor_telefones`, `devedores` e `acordos` por sufixo de 8 dígitos, retornando o melhor candidato (acordo ativo > débito em aberto > mais recente) e a lista de candidatos com nome.
- `supabase/functions/iago-atendimento/index.ts`: gravar o CPF resolvido em `iago_conversa_estado.cpf` já na primeira interação (hoje só grava no update final) e passar ao prompt os sinais `cpf_identificado` / `nome_identificado` / `multiplos_candidatos`.
- Ajustar o prompt: proibir pedir CPF quando `cpf_identificado`; instruir confirmação por nome; instruir escalar quando o cliente negar a identidade.
- Sem mudanças de schema e sem novos cron/polling — nenhum impacto de custo em Cloud.
