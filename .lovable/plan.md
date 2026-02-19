

## Vincular Funcionarios a Credores e Controlar Visibilidade no Ranking

### O que sera feito

Duas novas funcionalidades na pagina de Equipes (AdminEquipes):

1. **Vincular funcionarios a credores**: Atualmente cada funcionario so pode ter uma "empresa" vinculada. Vamos trocar a coluna `empresa` (text unico) por `credores` (array de textos) na tabela `user_permissions`, permitindo vincular um funcionario a multiplos credores (ex: "UME / NOVO MUNDO", "MUNDO DA MODA", "MONTREAL").

2. **Controlar visibilidade no ranking**: Adicionar uma coluna booleana `visivel_ranking` na tabela `user_permissions` (padrao `true`). Na pagina de Equipes, cada funcionario tera um checkbox/switch para marcar se aparece no ranking. O componente `RankingMensal` filtrara apenas os usuarios com essa flag ativa.

### Alteracoes no banco de dados

**Migracao SQL:**
- Adicionar coluna `credores` (text array, default `ARRAY['ume_novo_mundo']`) na tabela `user_permissions`
- Migrar dados existentes da coluna `empresa` para `credores` (convertendo o valor unico em array)
- Remover a coluna `empresa`
- Adicionar coluna `visivel_ranking` (boolean, default `true`) na tabela `user_permissions`
- Atualizar a funcao `ranking_mensal` para filtrar apenas usuarios com `visivel_ranking = true`

### Alteracoes nos arquivos

**1. `src/components/EditPermissionsDialog.tsx`**
- Trocar o Select unico de "Empresa vinculada" por uma lista de checkboxes para selecionar multiplos credores
- Adicionar um Switch/Checkbox para "Visivel no Ranking"
- Atualizar a mutacao para salvar `credores` (array) e `visivel_ranking` (boolean) em vez de `empresa` (text)

**2. `src/pages/AdminEquipes.tsx`**
- Na tabela de equipes, adicionar colunas "Credores" e "Ranking" para visualizacao rapida
- A coluna "Ranking" mostra um icone/badge indicando se o funcionario aparece no ranking
- A coluna "Credores" mostra badges com os credores vinculados

**3. `src/components/RankingMensal.tsx`**
- Atualizar a funcao `ranking_mensal` (SQL) para excluir usuarios com `visivel_ranking = false`

**4. `src/hooks/useUserPermissions.tsx`**
- Atualizar para retornar `credores` (array) em vez de `empresa` (text)

### Detalhes tecnicos

**Migracao SQL:**
```sql
-- Adicionar novas colunas
ALTER TABLE user_permissions 
  ADD COLUMN credores TEXT[] NOT NULL DEFAULT ARRAY['ume_novo_mundo'],
  ADD COLUMN visivel_ranking BOOLEAN NOT NULL DEFAULT true;

-- Migrar dados existentes
UPDATE user_permissions SET credores = ARRAY[empresa];

-- Remover coluna antiga
ALTER TABLE user_permissions DROP COLUMN empresa;

-- Atualizar funcao de ranking para respeitar flag
CREATE OR REPLACE FUNCTION ranking_mensal(p_mes_ano TEXT DEFAULT NULL)
RETURNS TABLE(user_id UUID, nome TEXT, total_recebido NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_mes_ano TEXT;
BEGIN
  v_mes_ano := COALESCE(p_mes_ano, to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM'));
  RETURN QUERY
  SELECT 
    p.id AS user_id,
    p.nome,
    COALESCE(SUM(pg.valor_parcela), 0) AS total_recebido
  FROM profiles p
  LEFT JOIN acordos a ON a.user_id = p.id
  LEFT JOIN pagamentos pg ON pg.acordo_id = a.id 
    AND pg.status = 'pago'
    AND pg.data_paga >= (v_mes_ano || '-01')::DATE
    AND pg.data_paga < ((v_mes_ano || '-01')::DATE + INTERVAL '1 month')
  WHERE NOT EXISTS (
    SELECT 1 FROM user_permissions up 
    WHERE up.user_id = p.id AND up.visivel_ranking = false
  )
  GROUP BY p.id, p.nome
  ORDER BY total_recebido DESC;
END;
$$;
```

**EditPermissionsDialog** - Credores como checkboxes multiplos:
```typescript
const CREDORES = [
  { value: 'ume_novo_mundo', label: 'UME / NOVO MUNDO' },
  { value: 'mundo_da_moda', label: 'MUNDO DA MODA' },
  { value: 'montreal', label: 'MONTREAL' },
];
// Estado: credores: string[], visivelRanking: boolean
```

**useUserPermissions** - Retorno atualizado:
```typescript
return {
  abasPermitidas: permissions?.abas_permitidas ?? null,
  credores: permissions?.credores ?? null,
  visivelRanking: permissions?.visivel_ranking ?? true,
  isLoading,
};
```

