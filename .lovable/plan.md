

## Ranking do Mes na pagina Meus Acordos

### O que sera feito

Adicionar um botao "Ranking" ao lado do badge "Acordos Hoje" na pagina Meus Acordos. Ao clicar, ele expande/colapsa um painel mostrando o ranking de todos os funcionarios do mes atual, com medalhas para os 3 primeiros, percentual da equipe e valor total recebido -- identico ao visual da imagem de referencia.

### Como funciona

1. **Nova funcao SQL (SECURITY DEFINER)**: Criar uma funcao `ranking_mensal` que retorna o ranking de todos os funcionarios (nome, total recebido no mes) sem depender de RLS, permitindo que qualquer funcionario veja os dados da equipe inteira.

2. **Componente RankingMensal**: Novo componente em `src/components/RankingMensal.tsx` que:
   - Chama a funcao `ranking_mensal` via `supabase.rpc()`
   - Calcula o percentual da equipe para cada funcionario
   - Exibe medalhas (ouro, prata, bronze) para os 3 primeiros
   - Lista os demais com numero de posicao
   - Mostra nome, percentual e valor em verde

3. **Integracao na pagina Acordos**: Adicionar ao lado do badge "Acordos Hoje":
   - Um botao "Ranking" com icone de trofeu
   - Ao clicar, expande/colapsa o componente de ranking usando Collapsible
   - O painel aparece abaixo da barra de titulo, antes dos filtros

### Detalhes tecnicos

**Migracao SQL:**
```sql
CREATE OR REPLACE FUNCTION ranking_mensal(p_mes_ano TEXT DEFAULT NULL)
RETURNS TABLE(user_id UUID, nome TEXT, total_recebido NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_mes_ano TEXT;
BEGIN
  v_mes_ano := COALESCE(p_mes_ano, to_char(NOW(), 'YYYY-MM'));
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
  GROUP BY p.id, p.nome
  ORDER BY total_recebido DESC;
END;
$$;
```

**Novo arquivo:** `src/components/RankingMensal.tsx`
- Query com react-query chamando `supabase.rpc('ranking_mensal')`
- Layout identico a imagem: card com titulo "Ranking do Mes", icone trofeu, lista com medalhas, scroll vertical

**Alteracao:** `src/pages/Acordos.tsx`
- Importar RankingMensal e Collapsible
- Adicionar estado `rankingAberto`
- Botao com icone Trophy ao lado do badge "Acordos Hoje"
- Collapsible com o componente RankingMensal abaixo do titulo
