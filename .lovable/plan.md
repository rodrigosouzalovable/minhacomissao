

## Mostrar todas as parcelas na ficha do cliente

### O que muda

Atualmente, o parser COBMAIS agrupa todas as linhas de um mesmo CPF+Contrato em um unico registro. Isso faz com que as parcelas individuais (com seus vencimentos e valores) sejam perdidas na importacao.

A solucao e **parar de agrupar** no parser COBMAIS, armazenando cada linha da planilha como um registro separado na tabela `devedores`. Assim:

- Na **lista de clientes** (pagina Clientes): continua agrupando visualmente por CPF (ja funciona assim)
- Na **ficha do cliente** (DevedorDetalhe): cada parcela aparece como um item separado com seu proprio vencimento e valor

### Exemplo pratico

Para ABADIA COSTA OLIVEIRA (CPF 2967906131):
- Hoje: 1 registro com valor total R$ 511,78
- Depois: 2 registros separados, cada um com R$ 255,89 e vencimentos 06/02/2025 e 06/03/2025

### Mudancas

**Arquivo: `src/pages/ImportarDevedores.tsx`**

1. Remover a logica de agrupamento (Map) do `parseCobmais`
2. Cada linha da planilha vira um `DevedorRow` individual
3. Usar coluna F (valor da parcela) como `valor_original` e `valor_atualizado` ao inves da coluna G (total)
4. Manter a resolucao de CPF com zeros a esquerda e telefones da Aba 2

**Arquivo: `src/pages/DevedorDetalhe.tsx`**

5. Ajustar o resumo recolhido de cada contrato para mostrar o valor da parcela (que agora e individual)
6. Nenhuma outra mudanca necessaria -- a pagina ja busca todos os registros com o mesmo CPF e exibe cada um como um item colapsavel com vencimento e valor

### Secao tecnica

**Mudanca em `parseCobmais` (linhas 177-214):**

```text
// DE: Map com agrupamento
const devedoresMap = new Map<string, DevedorRow>();
for (const row of rows1) {
  const key = `${cpf}|${contrato}`;
  if (!devedoresMap.has(key)) { ... }
}
return Array.from(devedoresMap.values());

// PARA: Array simples, cada linha = 1 registro
const devedores: DevedorRow[] = [];
for (const row of rows1) {
  const valor = parseNum(row['F']); // Valor da parcela individual
  devedores.push({ cpf, nome, contrato, atraso: vencimentoStr, valor_original: valor, valor_atualizado: valor, ... });
}
return devedores;
```

**Resultado na ficha do cliente:**
- Cada parcela aparece como um item colapsavel separado
- O resumo mostra: numero do contrato, dias de atraso e vencimento
- Ao expandir: valor original, valor atualizado, estagio
- O total no topo da secao Contratos soma todas as parcelas

**Impacto:**
- Unico arquivo principal modificado: `src/pages/ImportarDevedores.tsx`
- Ajuste menor em `src/pages/DevedorDetalhe.tsx` (opcional, para melhorar a visualizacao)
- Sem alteracoes no banco de dados
- Sem novas dependencias
- A proxima importacao COBMAIS criara registros individuais por parcela
