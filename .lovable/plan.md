
## Adicionar numero da parcela e vencimento nos cards de debito

### Arquivo: `src/pages/ConsultaResultado.tsx`

**Mudanca nos cards de debito (linhas 193-212):**

Adicionar em cada card:
- Numero da parcela (indice + 1, ex: "Parcela 1 de 6")
- Data de vencimento formatada (campo `data_vencimento` ja existe na interface `Debito`)

```
Parcela 1 de 6
Contrato: 60706294
Vencimento: 15/01/2026                    R$ 139,89
```

A data de vencimento sera formatada usando `format()` do date-fns com locale ptBR que ja estao importados no arquivo. Caso `data_vencimento` seja null, o campo nao sera exibido.
