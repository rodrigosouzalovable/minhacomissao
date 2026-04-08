

## Correção do Comparativo Mensal - Dados Globais da Equipe

### Diagnóstico

Confirmei no banco de dados os valores reais:

| Métrica | Mês Atual (até dia 8) | Mês Anterior (até dia 8) |
|---|---|---|
| Acordos Criados | **88** | 91 |
| Valor Acordos | **R$ 56.406,64** | R$ 86.464,73 |
| Pagamentos Recebidos | **56** | 95 |
| Valor Recebido | **R$ 14.057,65** | R$ 23.522,34 |

O dashboard está mostrando apenas os dados do seu usuário (42 pagamentos / R$ 9.415,59) porque, mesmo sendo admin, as queries do Supabase passam por RLS e algo está impedindo a visão global. A solução é criar uma função no banco que busca os totais diretamente, sem restrição de RLS.

### Plano

1. **Criar função no banco** (`comparativo_mensal_global`) com `SECURITY DEFINER` que recebe as datas de início/fim dos dois períodos e retorna os 8 valores agregados (acordos e pagamentos de ambos os meses). Só pode ser chamada por admins.

2. **Alterar `Dashboard.tsx`**: quando o usuário for admin, chamar `supabase.rpc('comparativo_mensal_global', {...})` em vez das 4 queries individuais que passam por RLS. Isso garante que os totais reflitam toda a equipe.

3. **Manter comportamento para não-admins**: funcionários comuns continuam vendo apenas seus próprios dados normalmente.

### Detalhes técnicos

**Migração SQL:**
```sql
CREATE OR REPLACE FUNCTION public.comparativo_mensal_global(
  p_inicio_atual timestamptz,
  p_fim_atual timestamptz,
  p_inicio_anterior timestamptz,
  p_fim_anterior timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN jsonb_build_object(
    'acordos_atual_qtd', (SELECT count(*) FROM acordos WHERE criado_em >= p_inicio_atual AND criado_em <= p_fim_atual),
    'acordos_atual_valor', (SELECT coalesce(sum(valor_total),0) FROM acordos WHERE criado_em >= p_inicio_atual AND criado_em <= p_fim_atual),
    'acordos_anterior_qtd', (SELECT count(*) FROM acordos WHERE criado_em >= p_inicio_anterior AND criado_em <= p_fim_anterior),
    'acordos_anterior_valor', (SELECT coalesce(sum(valor_total),0) FROM acordos WHERE criado_em >= p_inicio_anterior AND criado_em <= p_fim_anterior),
    'pgtos_atual_qtd', (SELECT count(*) FROM pagamentos WHERE status='pago' AND data_paga >= p_inicio_atual::date AND data_paga <= p_fim_atual::date),
    'pgtos_atual_valor', (SELECT coalesce(sum(valor_parcela),0) FROM pagamentos WHERE status='pago' AND data_paga >= p_inicio_atual::date AND data_paga <= p_fim_atual::date),
    'pgtos_anterior_qtd', (SELECT count(*) FROM pagamentos WHERE status='pago' AND data_paga >= p_inicio_anterior::date AND data_paga <= p_fim_anterior::date),
    'pgtos_anterior_valor', (SELECT coalesce(sum(valor_parcela),0) FROM pagamentos WHERE status='pago' AND data_paga >= p_inicio_anterior::date AND data_paga <= p_fim_anterior::date)
  );
END;
$$;
```

**Dashboard.tsx:** Substituir as 4 queries do comparativo por uma única chamada RPC quando `isAdmin`, mantendo as queries atuais como fallback para não-admins.

### Arquivos alterados
- **Migração SQL** (nova função `comparativo_mensal_global`)
- **`src/pages/Dashboard.tsx`** (usar RPC para dados globais)

