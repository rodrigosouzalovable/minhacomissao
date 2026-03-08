

# Novo layout de importação: Pesquisa Cliente

## Objetivo
Adicionar um novo layout `pesquisa` ao importador que mapeia: A = CPF, B = Nome, C = Telefone. A planilha enviada segue esse formato simples de 3 colunas.

## Mudanças em `src/pages/ImportarDevedores.tsx`

1. **Adicionar tipo ao union**: `type CredorLayout = 'padrao' | 'montreal' | 'cobmais' | 'pesquisa'`

2. **Adicionar descrição**: `pesquisa: 'A = CPF/CNPJ, B = Nome, C = Telefone'`

3. **Adicionar opção no Select**: `<SelectItem value="pesquisa">Pesquisa Cliente</SelectItem>`

4. **Criar parser `parsePesquisa`**:
   - Coluna A → CPF (limpar para apenas dígitos, filtrar >= 11)
   - Coluna B → Nome
   - Coluna C → Telefone (limpar dígitos)
   - Valores financeiros ficam zerados (sem dados de valor na planilha)

5. **Chamar o parser** no `handleFile` junto aos demais layouts

6. **Adicionar preview na tabela**: Colunas CPF, Nome, Telefone (similar ao layout Montreal/Cobmais)

7. **Ajustar `handleImport`**: Garantir que o campo `telefone` seja mapeado corretamente no insert, como já é feito nos outros layouts

