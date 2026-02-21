

## Corrigir parsing de CPF numerico no layout COBMAIS

### Problema raiz

O Excel armazena CPFs como numeros na aba Cobranca, removendo zeros a esquerda. Exemplo:
- CPF real: `02967906131` (11 digitos)
- Excel armazena como numero: `29679061` (8 digitos, sem zeros)

A linha `if (cpf.length < 11) continue` descarta **todos os registros** porque nenhum CPF numerico tem 11 digitos apos a conversao para string.

Na aba Telefones, os CPFs aparecem corretos (ex: `02967906131`) porque estao formatados como texto.

### Solucao

**Arquivo: `src/pages/ImportarDevedores.tsx`**

**1. Adicionar funcao de normalizacao de CPF/CNPJ**

Criar uma funcao utilitaria que, apos remover caracteres nao numericos, preenche com zeros a esquerda para completar 11 digitos (CPF) ou 14 digitos (CNPJ):

```text
function normalizeCpfCnpj(raw):
  digits = remover nao-numericos de raw
  se digits esta vazio: retornar ''
  se digits tem ate 11 caracteres: preencher com zeros ate 11
  senao: preencher com zeros ate 14
  retornar resultado
```

**2. Aplicar normalizacao em todos os pontos de leitura de CPF**

Substituir `String(row['A'] ?? '').replace(/\D/g, '')` por `normalizeCpfCnpj(row['A'])` nos 3 locais dentro de `parseCobmais`:
- Leitura da aba Telefones (linha 151)
- Leitura da aba Dados Pessoais/Clientes (linha 162)
- Leitura da aba Cobranca (linha 172)

**3. Ajustar validacao de comprimento**

Manter o filtro `if (cpf.length < 11) continue` como esta -- apos a normalizacao, CPFs validos terao exatamente 11 digitos e passarao pelo filtro.

### Por que funciona

- CPF `29679061` (8 digitos no Excel) sera normalizado para `02967906131`... na verdade, `padStart(11, '0')` daria `00029679061`. Hmm, isso nao reconstroi o CPF original.

Na verdade, a melhor abordagem e relaxar o filtro para aceitar CPFs com 8+ digitos (CPFs numericos podem ter ate 3 zeros iniciais removidos) e fazer o padStart:

```text
digits = remover nao-numericos
se vazio: pular
se length >= 8 e <= 11: padStart(11, '0')  -> CPF
se length >= 12 e <= 14: padStart(14, '0') -> CNPJ
se length < 8: pular (invalido)
```

Isso transforma `29679061` em `00029679061` -- mas o CPF real e `02967906131`. O padStart nao consegue reconstruir a posicao correta dos zeros.

**Abordagem correta**: Usar o CPF da aba Telefones (que esta como texto, com zeros preservados) como referencia. A aba Telefones tem os CPFs corretos. Entao:

1. Primeiro, construir um mapa de CPF numerico -> CPF texto usando a aba Telefones
2. Usar esse mapa para corrigir os CPFs da aba Cobranca

**OU** a abordagem mais simples e robusta:

Usar `{raw: true}` ou `{rawNumbers: false}` no sheet_to_json para que o XLSX preserve o valor original da celula. Alternativamente, usar a opcao `cellText: true` no `XLSX.read`.

**Abordagem final (mais simples e confiavel):**

Passar a opcao `cellText: true` no `XLSX.read()` para que o XLSX preserve a formatacao de texto das celulas, mantendo os zeros a esquerda dos CPFs:

```typescript
const workbook = XLSX.read(data, { type: 'binary', cellText: true });
```

E ao ler as celulas, usar o campo `w` (texto formatado) em vez do campo `v` (valor). Porem, `sheet_to_json` ja usa o valor formatado quando disponivel.

**Na verdade**, a solucao mais pragmatica:

1. Construir mapa de CPF real a partir da aba Telefones (que tem CPFs como texto)
2. Na aba Cobranca, fazer padStart nos CPFs numericos
3. Cruzar com o mapa de telefones para validar

**Decisao final - abordagem hibrida:**

1. Ler os CPFs da aba Telefones primeiro (ja sao texto correto)
2. Construir um mapa `cpfNumerico -> cpfCompleto` comparando o final dos digitos
3. Na aba Cobranca, tentar resolver o CPF via esse mapa
4. Como fallback, usar padStart(11, '0')

Essa abordagem e complexa demais. A solucao mais simples:

**Usar `cellDates: true` e formatar celulas como texto:**

Na verdade, o caminho mais direto: ler a aba Cobranca com `XLSX.utils.sheet_to_json` usando `{header: 'A', raw: false}` em vez de `{header: 'A'}`. A opcao `raw: false` faz o XLSX usar o texto formatado da celula, que pode preservar zeros.

Mas se a celula nao tem formato de texto no Excel, `raw: false` nao ajuda.

**SOLUCAO DEFINITIVA E SIMPLES:**

O mais pragmatico: usar `padStart(11, '0')` para CPFs e aceitar que pode haver imprecisao nos zeros, MAS cruzar com a aba Telefones (que tem os CPFs corretos como texto) para obter o CPF real:

1. Construir mapa invertido: ultimos N digitos do CPF real -> CPF completo (da aba Telefones)
2. Para cada CPF numerico da aba Cobranca, procurar match no mapa

Isso tambem e complexo. A VERDADEIRA solucao simples:

**Usar a aba Clientes (indice 3) como fonte principal em vez da aba Cobranca.** A aba Clientes provavelmente tem CPFs como texto. E os dados financeiros podem ser cruzados da aba Cobranca agrupando por outro campo.

Vou simplificar drasticamente:

### Solucao simplificada

**Arquivo: `src/pages/ImportarDevedores.tsx`**

1. Ao ler o workbook, usar a opcao `cellText: true` no `XLSX.read()` e tentar ler as celulas de CPF preservando a formatacao
2. Para a aba Cobranca, ler os dados usando `sheet_to_json` com `{header: 'A', raw: false}` que retorna valores formatados como string, preservando zeros a esquerda quando a celula tem formato de texto
3. Se o CPF ainda tiver menos de 11 digitos apos a conversao, aplicar `padStart(11, '0')` como fallback
4. Para a aba Telefones, manter a leitura atual (CPFs ja vem como texto correto)

### Alteracoes no codigo

**Funcao auxiliar `normalizeCpfCnpj`:**
```text
funcao normalizeCpfCnpj(valor):
  digitos = String(valor).replace(nao-digitos, '')
  se vazio: retornar ''
  se tamanho <= 11: retornar padStart(11, '0')
  se tamanho <= 14: retornar padStart(14, '0')
  retornar digitos
```

**Aplicar em `parseCobmais`:**
- Linha 151 (telefones): trocar para `normalizeCpfCnpj(row['A'])`
- Linha 162 (dados pessoais): trocar para `normalizeCpfCnpj(row['A'])`  
- Linha 172 (cobranca): trocar para `normalizeCpfCnpj(row['A'])`

**Manter filtro `cpf.length < 11`** - apos normalizacao, CPFs validos terao 11+ digitos.

Nota: `padStart(11, '0')` em CPFs como `29679061` (8 digitos) resultara em `00029679061`, que nao e o CPF original (`02967906131`). No entanto, isso garante consistencia: todos os registros da mesma pessoa terao o mesmo CPF normalizado (tanto na Cobranca quanto nos Telefones), pois o Excel remove zeros da mesma forma em ambas as abas numericas. A aba Telefones, por ter CPFs como texto, servira como fonte confiavel dos telefones, e o cruzamento funcionara desde que usemos a mesma normalizacao.

**IMPORTANTE**: Na aba Telefones, os CPFs ja estao corretos (11 digitos com zeros). Entao o cruzamento `phoneMap.get(cpf)` falharia se a aba Cobranca produz `00029679061` e a aba Telefones produz `02967906131`.

### Solucao correta e definitiva

Usar a **aba Telefones como fonte dos CPFs reais** e construir um mapa reverso:

1. Da aba Telefones, para cada CPF texto (ex: `02967906131`), guardar tambem uma versao sem zeros a esquerda (ex: `2967906131`) como chave alternativa
2. Da aba Cobranca, pegar o CPF numerico (ex: `2967906131`) e procurar no mapa reverso para obter o CPF real (`02967906131`)

**Implementacao:**

```text
// 1. Processar aba Telefones - guardar CPF real e mapa reverso
cpfRealMap = novo Map()  // cpfSemZeros -> cpfReal
phoneMap = novo Map()    // cpfReal -> telefone

para cada linha da aba Telefones:
  cpfReal = String(coluna A).remover nao-digitos  // "02967906131"
  cpfSemZeros = cpfReal.remover zeros iniciais     // "2967906131"  
  cpfRealMap.set(cpfSemZeros, cpfReal)
  // ... manter logica de telefone existente usando cpfReal

// 2. Processar aba Cobranca
para cada linha da aba Cobranca:
  cpfRaw = String(coluna A).remover nao-digitos    // "2967906131" (sem zeros)
  cpfSemZeros = cpfRaw.remover zeros iniciais
  cpf = cpfRealMap.get(cpfSemZeros) ?? cpfRaw.padStart(11, '0')  // fallback
  se cpf.length < 11: pular
  // ... resto da logica existente
```

### Resumo das alteracoes

**Arquivo: `src/pages/ImportarDevedores.tsx`**

1. Na funcao `parseCobmais`, processar a aba Telefones primeiro para construir um mapa `cpfSemZeros -> cpfReal`
2. Ao processar a aba Cobranca, usar esse mapa para resolver o CPF real a partir do CPF numerico
3. Aplicar `padStart(11, '0')` como fallback para CPFs que nao estejam na aba Telefones
4. Usar a mesma normalizacao para a aba Dados Pessoais (indice 3)
5. Manter a validacao de toast "Nenhum registro encontrado" ja implementada

**Nenhuma outra alteracao necessaria** - os mapeamentos de colunas (C=CLIENTE, D=CREDOR, E=CONTRATO, F=ATRASO, M=RISCO) estao corretos para a aba Cobranca conforme confirmado pelas screenshots.

### Secao tecnica

- Unico arquivo modificado: `src/pages/ImportarDevedores.tsx`
- Sem alteracoes no banco de dados
- Sem novas dependencias
- A normalizacao de CPF resolve o problema de zeros a esquerda removidos pelo Excel em celulas numericas
- O cruzamento reverso via aba Telefones garante CPFs corretos na maioria dos casos
- Performance: processar 184K linhas de telefones para o mapa e viavel em JS (operacao O(n) simples)
