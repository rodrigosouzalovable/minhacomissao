
## Criar Layout de Importacao COBMAIS

### Resumo

Adicionar um novo layout de importacao chamado "COBMAIS" na pagina Importar Devedores. A planilha COBMAIS possui 4 abas com estruturas distintas. O parser combinara dados das abas relevantes para montar os registros de devedores.

### Estrutura da Planilha COBMAIS (4 abas)

**Aba 1 - Clientes (principal):**
- A = CPF/CNPJ
- B = Cod. Cliente
- C = Cliente (nome)
- D = Credor
- E = Contrato
- F = Atraso
- M = Risco (valor devido)

**Aba 2 - Telefones:**
- A = CPF/CNPJ
- C = Numero
- D = Tipo (Residencial, Comercial, Referencia)
- I = Ativo (SIM/NAO)

**Aba 3 - Titulos:**
- A = CPF/CNPJ
- H = Vencimento
- I = Valor

**Aba 4 - Dados Pessoais:**
- A = CPF/CNPJ
- D = Nascimento

### Logica de parsing

1. Ler a Aba 1 como fonte principal de registros (cada linha = 1 devedor)
2. Ler a Aba 2 para extrair o primeiro telefone ativo (onde coluna I = "SIM") de cada CPF
3. Ler a Aba 4 para extrair a data de nascimento de cada CPF
4. Combinar os dados por CPF/CNPJ
5. Usar a coluna M (Risco) da Aba 1 como valor_original e valor_atualizado
6. Desduplicar por CPF (a aba 1 pode ter linhas repetidas) - somar valores se houver multiplos registros

### Alteracoes em `src/pages/ImportarDevedores.tsx`

**1. Atualizar o tipo `CredorLayout`**
```
type CredorLayout = 'padrao' | 'montreal' | 'cobmais';
```

**2. Adicionar descricao do layout COBMAIS no objeto `DESCRICOES`**
```
cobmais: 'Aba 1: CPF/CNPJ, Cliente, Credor, Contrato, Atraso, Risco | Aba 2: Telefones | Aba 4: Nascimento'
```

**3. Adicionar opcao "COBMAIS" no Select de layout**

Novo `SelectItem` com value "cobmais" e label "COBMAIS".

**4. Criar funcao `parseCobmais`**

Nova funcao que:
- Recebe o `workbook` inteiro (nao apenas a primeira aba)
- Le a Aba 1 (SheetNames[0]) para dados principais
- Le a Aba 2 (SheetNames[1]) para telefones, filtrando apenas registros com coluna I = "SIM"
- Le a Aba 4 (SheetNames[3]) para nascimento
- Cruza os dados por CPF
- Retorna array de `DevedorRow`

**5. Ajustar `handleFile` para passar o workbook completo quando layout for COBMAIS**

Em vez de sempre ler apenas `SheetNames[0]`, quando o layout for "cobmais", passa o workbook inteiro para a funcao `parseCobmais`.

**6. Adicionar colunas especificas no preview da tabela para COBMAIS**

Exibir: CPF/CNPJ, Nome, Credor, Contrato, Atraso, Risco (R$), Telefone - similar ao layout padrao mas com telefone.

**7. Ajustar `handleImport` para mapear corretamente os campos COBMAIS**

O campo `descricao` recebera o credor, e `data_vencimento` recebera a data de nascimento (mesmo comportamento do layout padrao).

### Preview das colunas no COBMAIS

| CPF/CNPJ | Nome | Credor | Contrato | Atraso | Risco (R$) | Telefone |
|----------|------|--------|----------|--------|------------|----------|

### Secao tecnica

- Arquivo modificado: `src/pages/ImportarDevedores.tsx`
- Sem novas dependencias
- Sem alteracoes no banco de dados
- A leitura de multiplas abas usa `workbook.Sheets[workbook.SheetNames[index]]` ja disponivel via biblioteca `xlsx`
- Telefones sao filtrados por Ativo = "SIM" para importar apenas numeros validos
- CPFs sao normalizados (apenas digitos) antes do cruzamento entre abas
