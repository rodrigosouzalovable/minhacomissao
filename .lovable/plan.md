# Retirar clientes com acordo em andamento antes de disparar campanhas UME e Odres Cred

## O que muda para você
Quando você clicar em **Disparar** no Envio Meta, o sistema vai verificar a lista antes de começar:

1. Procura cada cliente da lista entre os acordos do sistema **pelo CPF** e também **pelo telefone** (últimos 8 dígitos, a regra que o sistema já usa).
2. Quem tiver acordo **em andamento** sai da lista e não recebe a mensagem.
3. Aparece uma tela de resumo antes de começar:
   - "X clientes retirados porque já têm acordo em andamento"
   - "Y clientes continuam na campanha"
   - Botão **Baixar planilha dos retirados** (Excel com nome, CPF, telefone, credor, como foi encontrado — CPF ou telefone —, responsável pelo acordo, data e situação do acordo)
   - Botões **Continuar disparo** e **Cancelar**.
4. A campanha começa só com os clientes sem acordo, e a fatura da Meta fica menor porque esses números não são cobrados.

## Qual acordo bloqueia o envio
- **Bloqueia:** acordos com situação "ativo" (em andamento) — hoje são 2.394.
- **Não bloqueia:** acordos "quebrado" (340) e "concluído" (904); esses clientes podem receber nova proposta.
- A verificação vale para todas as empresas cadastradas: um cliente com acordo ativo na UME não recebe campanha da Odres, e o contrário também vale. Se preferir comparar só com o mesmo credor, me diga.

## Onde vale
- Na tela Envio Meta, para todas as campanhas (UME, Odres Cred e qualquer outra), no clique em **Disparar**. O envio de teste continua igual.
- Listas sem CPF são verificadas só pelo telefone.

## Detalhes técnicos
- Nova função no banco (security definer, chamada só por usuário logado) `acordos_ativos_por_destinatarios(cpfs text[], sufixos text[])`: retorna os acordos `status='ativo'` cuja `cliente_cpf` normalizada (`cpf_normalize`) bate com a lista ou cujo sufixo de 8 dígitos de `cliente_telefone` bate. Chamada em lotes de 500 para não estourar o tamanho da requisição.
- Índices: confirmar/criar índice em `cpf_normalize(cliente_cpf)` e no sufixo do telefone, ambos parciais em `status='ativo'` (consulta leve, sem custo recorrente — roda apenas no clique, sem agendamentos).
- `EnvioMeta.tsx`: no `enviar()`, antes da revalidação de instâncias, filtra `recipients`, abre um Dialog com o resumo e guarda a planilha (xlsx carregado sob demanda) em estado para download no clique, sem `await` antes do download.
- Lógica de comparação em `src/lib/filtroAcordoAtivo.ts` com testes: CPF com/sem pontuação, telefone com/sem 55, cliente encontrado pelos dois só aparece uma vez, quebrado/concluído não bloqueiam.
