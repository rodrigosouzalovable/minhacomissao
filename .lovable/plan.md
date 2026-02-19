
## Ordenar contratos por vencimento (do mais antigo ao mais recente)

### O que sera feito

Ordenar a lista de contratos exibida na pagina do devedor pela data de vencimento em ordem crescente: o contrato com vencimento mais antigo (maior atraso) aparece primeiro, e o mais recente (menor atraso) aparece por ultimo.

### Detalhes tecnicos

**Arquivo: `src/pages/DevedorDetalhe.tsx`**

Na linha 336, onde os contratos sao renderizados com `contratos.map(...)`, adicionar um `.sort()` antes do `.map()` para ordenar por `data_vencimento` em ordem crescente:

```
[...contratos]
  .sort((a, b) => {
    if (!a.data_vencimento && !b.data_vencimento) return 0;
    if (!a.data_vencimento) return 1;
    if (!b.data_vencimento) return -1;
    return a.data_vencimento.localeCompare(b.data_vencimento);
  })
  .map((contrato) => { ... })
```

Contratos sem data de vencimento ficam no final da lista. Nenhuma outra alteracao necessaria.
