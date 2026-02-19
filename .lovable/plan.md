

## Ajustar contratos e layout lado a lado

### Mudancas

1. **Remover nome do credor da linha resumida do contrato** (linhas 349-350): Retirar o traco e o `contrato.credor` ("MONTREAL") de cada parcela. A linha ficara apenas: `[bolinha] 1001118452 - Atraso: 298 Venc: 27/04/2025`

2. **Dividir a pagina em 50/50** (linha 315-317): Alterar o grid de `lg:grid-cols-3` com `lg:col-span-2` para `lg:grid-cols-2` com `lg:col-span-1`, distribuindo contratos e eventos igualmente na pagina

### Detalhes tecnicos

**Arquivo: `src/pages/DevedorDetalhe.tsx`**

- Linha 315: `grid-cols-1 lg:grid-cols-3` -> `grid-cols-1 lg:grid-cols-2`
- Linha 317: `lg:col-span-2` -> remover (fica `col-span-1` implicito)
- Linhas 349-350: Remover as linhas com `—` e `contrato.credor`

