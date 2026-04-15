

## Importar Acordos via Layout "UME APORTE"

### O que sera feito

Criar um novo layout de importacao "UME APORTE" na pagina Importar Devedores que:
1. Le a planilha com colunas: A=CPF, B=Nome, C=Telefone, D=Nro Parcela, E=Data Vencimento, F=Valor Parcela
2. Agrupa por CPF para formar acordos completos
3. Cruza com acordos existentes no sistema (por CPF) e marca quais ja existem
4. Para os que NAO existem, cria automaticamente o acordo na tabela `acordos` + parcelas na tabela `pagamentos`
5. Preenche: nome, CPF (pad 11 digitos), telefone, valor total (soma parcelas), numero de parcelas, valor primeira parcela, valor demais, data primeiro pagamento, dias em atraso (data primeiro vencimento - hoje, minimo 0)
6. Comissao calculada automaticamente pela tabela UME | NOVO MUNDO
7. Credor de destino fixo: UME | NOVO MUNDO

### Alteracoes

#### 1. `src/pages/ImportarDevedores.tsx`

**Novo tipo e estado:**
- Adicionar `'ume_aporte'` ao tipo `CredorLayout`
- Nova interface `UmeAporteGroup` com campos agrupados por CPF (nome, telefone, parcelas[], valorTotal, numParcelas, dataPrimeiroPagamento, diasAtraso, jaTemAcordo)
- Novo estado `umeAporteGroups`

**Novo parser `parseUmeAporte`:**
- Coluna A: CPF (pad com zeros ate 11 digitos)
- Coluna B: Nome
- Coluna C: Telefone
- Coluna D: Numero da parcela
- Coluna E: Data vencimento (parse Excel date)
- Coluna F: Valor parcela
- Agrupa por CPF, ordena parcelas por numero
- Calcula: valorTotal = soma dos valores, numParcelas = contagem, dataPrimeiroPagamento = menor data, diasAtraso = max(0, hoje - dataPrimeiroPagamento)
- Cruza CPFs com `acordos` existentes (status ativo/concluido) para marcar `jaTemAcordo`

**Nova funcao `handleImportUmeAporte`:**
- Filtra apenas grupos onde `jaTemAcordo === false`
- Para cada grupo:
  - Calcula comissao via `calcularComissao()` (tabela UME | NOVO MUNDO)
  - Insere na tabela `acordos` com empresa='ume_novo_mundo', credor implicitamente via empresa
  - Gera parcelas via `gerarParcelas()` com datas e valores reais da planilha
  - Insere na tabela `pagamentos`
- Registra importacao na tabela `importacoes`

**UI:**
- Adicionar `<SelectItem value="ume_aporte">UME APORTE</SelectItem>` no dropdown
- Adicionar descricao: `'A = CPF, B = Nome, C = Telefone, D = Nº Parcela, E = Data Vencimento, F = Valor Parcela — Cria acordos automaticamente'`
- Quando `ume_aporte` selecionado, credor de destino fixo "UME | NOVO MUNDO" (automatico, sem dropdown)
- Preview agrupado por CPF mostrando: nome, CPF, telefone, qtd parcelas, valor total, dias atraso
- Badge verde "Ja tem acordo" nos que existem (serao ignorados)
- Badge azul "Novo acordo" nos que serao importados
- Resumo: X acordos novos a criar, Y ja existem no sistema

### O que NAO muda
- Tabelas do banco (usa acordos e pagamentos existentes)
- Nenhuma migration necessaria
- Lembretes funcionam automaticamente pois se baseiam na tabela pagamentos
- Sem aumento de custo

