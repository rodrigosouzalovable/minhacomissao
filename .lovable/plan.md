

# Plano: Botão para editar data de vencimento do contrato

## O que será feito
Adicionar um botão de edição ao lado da data de vencimento de cada contrato na página `DevedorDetalhe.tsx`. Ao clicar, abre um popover/dialog com um input de data para alterar o `data_vencimento` do contrato na tabela `devedores`.

## Alterações

### `src/pages/DevedorDetalhe.tsx`
1. Adicionar estado para controlar qual contrato está sendo editado e o novo valor da data
2. Na linha do contrato (área do `CollapsibleTrigger`, ~linha 1007-1026), adicionar um ícone de lápis (`Pencil`) ao lado da data de vencimento
3. Ao clicar, abrir um `Popover` com input tipo `date` e botão "Salvar"
4. No submit, fazer `supabase.from('devedores').update({ data_vencimento: novaData }).eq('id', contrato.id)` e atualizar o estado local
5. Exibir toast de sucesso/erro

### Sem alterações no banco
A coluna `data_vencimento` já existe na tabela `devedores` e aceita updates.

