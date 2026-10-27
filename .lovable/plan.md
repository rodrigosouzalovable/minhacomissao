# Corrigir erro ao editar acordo e padronizar nome, CPF e telefone

## Causa do erro
O acordo do MANOEL DA SILVA foi gravado com o CPF sem pontos e traço (`06230527332`) e o telefone sem máscara (`66992816024`). A tela "Editar Acordo" exige o CPF no formato `000.000.000-00` (14 caracteres) e, ao salvar, recusa com "CPF incompleto" — mesmo o CPF tendo os 11 dígitos. Acordos lançados pelo Inbox/UME e pelo portal gravam sem máscara, por isso o erro aparece ao tentar trocar o operador.

## O que será feito
1. **Tela Editar Acordo**
   - Ao abrir, o CPF já aparece como `062.305.273-32` e o telefone como `(66) 99281-6024`.
   - A validação passa a contar os 11 dígitos, sem depender da formatação.
   - O nome é convertido para MAIÚSCULAS ao digitar e ao salvar.
   - A troca de operador volta a funcionar.

2. **Padrão para todo acordo lançado ou editado** (Novo Acordo, Novo Acordo Admin, "+" da conversa, botão de boleto UME, portal e importações)
   - Uma regra no banco, aplicada sempre que um acordo é criado ou alterado:
     - Nome em MAIÚSCULAS e sem espaços sobrando.
     - CPF no formato `000.000.000-00`.
     - Telefone no formato `(00) 00000-0000` (ou `(00) 0000-0000` para fixo; números com 55 na frente perdem o 55).
   - Assim, nenhuma tela ou lançamento automático escapa do padrão.

3. **Acordos já existentes**
   - Corrigir de uma vez os acordos já gravados fora do padrão (nome, CPF e telefone), sem mexer em valores, parcelas, comissões ou operadores.

## Detalhes técnicos
- `src/pages/EditarAcordo.tsx`: aplicar `formatCpf`/`formatPhone` no carregamento; schema zod valida `replace(/\D/g,'').length === 11`; `toUpperCase()` no nome.
- Migração: função `acordos_normalizar_cliente()` + trigger `BEFORE INSERT OR UPDATE OF cliente_nome, cliente_cpf, cliente_telefone` em `public.acordos`. Buscas por CPF já usam `cpf_normalize`/dígitos, então a máscara não afeta comparações (será conferido nas RPCs antes de aplicar).
- Correção dos acordos antigos via atualização de dados (o trigger formata).
- Teste com Playwright: editar o acordo do Manoel trocando o operador e confirmar que salva.
