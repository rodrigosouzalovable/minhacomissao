

## Plano: Corrigir erro de formato de data na importacao

### Problema

O campo "Nascimento" (coluna B) esta sendo salvo na coluna `data_vencimento` (tipo `date`) com formato "DD/MM/YYYY" (ex: "14/06/1978"), que o PostgreSQL nao reconhece. O banco espera formato "YYYY-MM-DD".

### Solucao

No arquivo `src/pages/ImportarDevedores.tsx`, converter a data do formato "DD/MM/YYYY" para "YYYY-MM-DD" antes de inserir no banco. Caso a conversao falhe (valor invalido), salvar como `null`.

### Alteracao

**Arquivo:** `src/pages/ImportarDevedores.tsx`

Na funcao `handleImport`, ao montar os `records`, converter `data_vencimento`:

```typescript
// Converter "DD/MM/YYYY" para "YYYY-MM-DD"
function parseDate(raw: string): string | null {
  if (!raw) return null;
  const parts = raw.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (day && month && year && year.length === 4) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  return null;
}
```

Aplicar no mapeamento: `data_vencimento: parseDate(r.nascimento)` em vez de `data_vencimento: r.nascimento || null`.

