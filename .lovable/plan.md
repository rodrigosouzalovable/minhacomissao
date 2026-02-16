

## Adicionar seletor de Credor na importacao de devedores

### Resumo
Adicionar um campo Select antes do upload de arquivo para o usuario escolher o credor. Cada credor tera um mapeamento diferente de colunas da planilha. O layout padrao (atual) sera mantido, e o layout MONTREAL seguira o mapeamento especificado.

### Interface atualizada

O formulario de importacao tera:
1. Um seletor de credor (obrigatorio, deve ser selecionado antes do upload)
2. O campo de upload do arquivo
3. A descricao das colunas muda dinamicamente conforme o credor selecionado

Opcoes do seletor:
- **Padrao** (layout atual: A=CPF, B=Nascimento, C=Cliente, D=Credor, E=Contrato, F=Atraso, G=Risco)
- **MONTREAL** (A=CPF/CNPJ, B=Nome/Razao Social, C=Num Contrato, F=Tipo Contrato, H=Parcela, I=Vencimento, J=Valor, L=Tel Residencial, M=Tel Comercial)

### Mapeamento MONTREAL

| Coluna Excel | Campo | Destino no banco |
|---|---|---|
| A | CPF/CNPJ | cpf |
| B | Nome/Razao Social | nome |
| C | Numero Contrato | contrato |
| F | Tipo de Contrato | descricao |
| H | Parcela | atraso (info de parcela) |
| I | Vencimento | data_vencimento |
| J | Valor | valor_original e valor_atualizado |
| L | Telefone Residencial | telefone (prioridade 1) |
| M | Telefone Comercial | telefone (fallback se L vazio) |

O credor sera automaticamente definido como "MONTREAL" no registro.

### Alteracoes tecnicas

**Arquivo: `src/pages/ImportarDevedores.tsx`**

1. Adicionar state `credorSelecionado` com opcoes `'padrao' | 'montreal'`
2. Adicionar interface `DevedorRow` com campo `telefone` opcional
3. Refatorar `handleFile` para usar o `credorSelecionado` ao mapear colunas:
   - Se `padrao`: mapeamento atual (A-G)
   - Se `montreal`: mapeamento A, B, C, F, H, I, J, L, M
4. No `handleImport`, incluir o campo `telefone` no registro enviado ao banco
5. Atualizar a descricao do card dinamicamente conforme o credor
6. Atualizar a tabela de preview para mostrar colunas relevantes ao credor selecionado (incluindo telefone para MONTREAL)
7. Ao trocar o credor, limpar os dados carregados (rows e file)

