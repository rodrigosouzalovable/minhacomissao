

## Plano: Importação Inteligente Montreal (Atualização + Inserção)

### Problema
Ao reimportar uma planilha Montreal, o sistema atual insere TODOS os registros como novos, causando duplicação. O usuário precisa que o sistema identifique quais parcelas já existem e insira apenas as novas.

### Solução

Adicionar um novo layout **"Montreal (Atualização)"** na página de importação que funciona em 3 etapas:

**Arquivo: `src/pages/ImportarDevedores.tsx`**

1. **Novo tipo de layout**: Adicionar opção `montreal_atualizacao` ao `CredorLayout`

2. **Parser inteligente com cruzamento**:
   - Ler a planilha no formato Montreal (mesmas colunas: C=CNPJ/CPF, B=Razão Social, H=Nro Nota (contrato), I=Desdob (descrição), J=Valor, K=Dt Vencimento)
   - Para cada CPF encontrado na planilha, buscar registros existentes no banco (`devedores` com `credor = 'MONTREAL'` e `ativo = true`)
   - Comparar cada linha da planilha com o banco usando a chave: **CPF + contrato (Nro Nota) + descricao (Desdob) + data_vencimento**
   - Classificar cada linha como: "Já existe" ou "Nova parcela"

3. **Preview com status**:
   - Mostrar tabela com badge indicando o status de cada linha (verde = já existe, amarelo = nova parcela, azul = cliente novo)
   - Contador de resumo: X já existentes, Y novas parcelas, Z clientes novos

4. **Importação seletiva**:
   - Inserir apenas as linhas marcadas como "Nova parcela" ou "Cliente novo"
   - Não duplicar registros que já estão no sistema

### Detalhes técnicos

| Aspecto | Detalhe |
|---------|---------|
| Chave de duplicidade | `cpf` + `contrato` + `descricao` (desdob) + `data_vencimento` |
| Credor fixo | MONTREAL (automático) |
| Busca no banco | Query por CPFs únicos da planilha em `devedores` WHERE `credor = 'MONTREAL'` AND `ativo = true` |
| Telefones | Colunas D e E da planilha (FONE1, FONE2) |
| Mapeamento colunas | B=nome, C=CPF, D=fone1, E=fone2, H=contrato, I=descricao, J=valor, K=vencimento |

### Fluxo do usuário
1. Seleciona layout "Montreal (Atualização)"
2. Faz upload da planilha
3. Sistema cruza com dados existentes e mostra preview
4. Clica em "Importar" para inserir apenas as parcelas novas
5. Recebe feedback de quantas foram inseridas vs ignoradas

