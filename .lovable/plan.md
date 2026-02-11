

## Plano: Contador de Acordos Lançados no Dia

### Objetivo
Adicionar um contador visível na página "Meus Acordos" mostrando quantos acordos foram lançados **no dia por todos os funcionários** do sistema.

### Implementação

**Arquivo:** `src/pages/Acordos.tsx`

### Mudanças

1. **Nova query ao banco** - Buscar a contagem de acordos criados hoje por todos os usuários:
   - Consulta na tabela `acordos` filtrando por `criado_em >= hoje 00:00:00`
   - Essa query usa as políticas de acesso existentes. Como funcionários só veem seus próprios acordos, será necessário criar uma **função de banco (RPC)** para retornar a contagem global.

2. **Nova função SQL (RPC)** - `contar_acordos_hoje`:
   - Função `SECURITY DEFINER` que conta todos os acordos criados hoje
   - Acessível por qualquer usuário autenticado
   - Retorna apenas o número (sem expor dados sensíveis)

3. **Componente visual** - Card/Badge no topo da página:
   - Exibido entre o título "Meus Acordos" e os filtros
   - Mostra o número de acordos lançados hoje com um ícone
   - Estilo visual destacado (badge ou mini-card com cor)

### Detalhes Técnicos

**Migration SQL:**
```sql
CREATE OR REPLACE FUNCTION contar_acordos_hoje()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::integer
  FROM acordos
  WHERE criado_em >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date::timestamp AT TIME ZONE 'America/Sao_Paulo';
$$;
```

**Frontend - Nova query:**
```typescript
const { data: acordosHoje } = useQuery({
  queryKey: ['acordos-hoje-count'],
  queryFn: async () => {
    const { data, error } = await supabase.rpc('contar_acordos_hoje');
    if (error) throw error;
    return data as number;
  },
});
```

**Visual - Badge no header:**
```tsx
<Badge variant="outline" className="text-sm py-1 px-3">
  <TrendingUp className="h-4 w-4 mr-1" />
  {acordosHoje ?? 0} acordo(s) lançado(s) hoje
</Badge>
```

### Resultado
- Todo funcionário verá no topo da página quantos acordos foram lançados no dia pela equipe inteira
- Atualiza automaticamente ao recarregar a página
- Seguro: expõe apenas a contagem, sem dados de outros usuários
