

## Mostrar o credor no grupo empresarial

### Problema

Ao consolidar membros de um grupo empresarial, o campo `credor` e sempre definido como `null` (linha 145 de Clientes.tsx), exibindo "-" na coluna. Os membros do grupo possuem credor (ex: MONTREAL), mas essa informacao e perdida na consolidacao.

### Solucao

Alterar a logica de merge no `useMemo` de `Clientes.tsx` para coletar os credores de todos os membros do grupo. Se todos compartilham o mesmo credor, exibir esse credor. Se houver credores distintos, exibir todos separados por virgula.

### Alteracao tecnica

**Arquivo:** `src/pages/Clientes.tsx` (apenas o bloco do `useMemo`, linhas ~122-152)

Adicionar coleta de credores no loop de membros:

```typescript
const allCredores: string[] = [];

for (const memberCpf of info.cpfs) {
  if (map[memberCpf]) {
    // ... (logica existente de contratos, valor, estagios)
    const memberCredor = map[memberCpf].credor;
    if (memberCredor && !allCredores.includes(memberCredor)) {
      allCredores.push(memberCredor);
    }
  }
}

result.push({
  // ... demais campos
  credor: allCredores.length > 0 ? allCredores.join(', ') : null,
  // ...
});
```

Nenhuma outra alteracao necessaria. A coluna "Credor" ja renderiza `row.credor || '-'`, entao basta preencher corretamente o valor.

