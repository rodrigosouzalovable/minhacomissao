

# Filtrar Dropdown de Credor por Permissoes do Usuario

## Objetivo
Quando um usuario tem credores especificos configurados nas suas permissoes (tabela `user_permissions`), o dropdown de "Credor" na tela de Clientes deve mostrar apenas os credores permitidos. Usuarios sem restricao (campo `credores` nulo) continuam vendo todos.

## Mudancas

### Arquivo: `src/pages/Clientes.tsx`

1. Importar o hook `useUserPermissions` no topo do arquivo
2. Chamar `const { credores: credoresPermitidos } = useUserPermissions()` dentro do componente
3. No `useEffect` que monta a lista de credores (e tambem no estado inicial), filtrar pela lista de credores permitidos quando ela nao for nula:
   - Se `credoresPermitidos` for `null` ou vazio, manter o comportamento atual (mostrar todos)
   - Se `credoresPermitidos` tiver valores, filtrar `credores` para incluir apenas os que estao na lista de permissoes
4. Quando o usuario tem apenas 1 credor permitido, pre-selecionar automaticamente esse credor no filtro

### Logica de filtragem

```
// Apos montar a lista merged de credores:
if (credoresPermitidos && credoresPermitidos.length > 0) {
  const filtered = merged.filter(c => credoresPermitidos.includes(c));
  setCredores(filtered);
} else {
  setCredores(merged);
}
```

### Efeito adicional
Adicionar `credoresPermitidos` como dependencia do `useEffect` que carrega os credores, para que a filtragem seja aplicada quando as permissoes carregarem.

## Resultado
Os usuarios `cobranca2@montrealindustria.com.br` e `manoelito@montrealindustria.com.br`, ao terem `["MONTREAL"]` configurado nas suas permissoes, verao apenas "MONTREAL" no dropdown de Credor.
