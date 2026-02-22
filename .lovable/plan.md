

# Sincronizar Portal Publico com Acordos Internos

## Problema

Quando um acordo e lancado no sistema interno, o portal publico continua exibindo os debitos originais (ex: 10x R$ 141,00) ao inves dos valores do acordo negociado (10x R$ 133,95). Alem disso, quando uma parcela e marcada como paga internamente, o portal nao reflete essa informacao.

Caso concreto - CPF 70776699202:
- Debitos originais: 10 parcelas de R$ 141,00 (exibidos no portal)
- Acordo ativo no sistema: 10x de R$ 133,95 (parcela 1 ja paga)
- O portal deveria mostrar as parcelas do acordo com status de pagamento

## Solucao

Quando existir um acordo ativo para o CPF consultado, o portal substituira a exibicao dos debitos originais pelas parcelas do acordo, mostrando valores corretos e status de pagamento (pago/pendente).

## Mudancas

### 1. Nova funcao no banco de dados

Criar `consultar_parcelas_acordo_por_cpf(p_cpf text)` que retorna as parcelas do acordo ativo:
- Numero da parcela
- Valor
- Data prevista
- Status (pago/pendente)
- Data de pagamento (se paga)

Funcao com `SECURITY DEFINER` para acesso sem autenticacao pelo portal.

### 2. Alteracao no ConsultaResultado.tsx

Quando `acordoExistente` for detectado (status 'ativo'):
- Buscar as parcelas do acordo via nova funcao RPC
- Substituir a lista de debitos originais pela lista de parcelas do acordo
- Exibir cada parcela com:
  - Numero (ex: "Parcela 1 de 10")
  - Valor (R$ 133,95)
  - Data de vencimento
  - Badge "PAGO" (verde) ou "PENDENTE"
- Recalcular o saldo total como soma das parcelas pendentes
- Manter o banner de "negociacao em andamento" e o botao de WhatsApp
- Desabilitar o botao de negociar (ja implementado)

### 3. Visual do portal com acordo ativo

```
[Banner: Voce ja possui uma negociacao em andamento!]

Ola, SERGIO!
CPF: 707.766.992-02

Seu acordo: 10x de R$ 133,95

Parcela 1 de 10 - R$ 133,95 - 09/02/2026  [PAGO]
Parcela 2 de 10 - R$ 133,95 - 09/03/2026  [PENDENTE]
Parcela 3 de 10 - R$ 133,95 - 09/04/2026  [PENDENTE]
...

Saldo restante: R$ 1.205,55 (9 parcelas pendentes)

[Falar no WhatsApp]
```

## Detalhes Tecnicos

### Funcao SQL

```sql
CREATE OR REPLACE FUNCTION public.consultar_parcelas_acordo_por_cpf(p_cpf text)
RETURNS TABLE(
  numero_parcela integer,
  valor_parcela numeric,
  data_prevista date,
  status text,
  data_paga date,
  total_parcelas integer,
  valor_total_acordo numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_acordo_id uuid;
  v_total_parcelas integer;
  v_valor_total numeric;
BEGIN
  SELECT a.id, a.parcelas, a.valor_total
  INTO v_acordo_id, v_total_parcelas, v_valor_total
  FROM acordos a
  WHERE cpf_normalize(a.cliente_cpf) = cpf_normalize(p_cpf)
    AND a.status IN ('ativo', 'concluido')
  ORDER BY a.criado_em DESC
  LIMIT 1;

  IF v_acordo_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.numero_parcela,
    p.valor_parcela,
    p.data_prevista,
    p.status,
    p.data_paga,
    v_total_parcelas,
    v_valor_total
  FROM pagamentos p
  WHERE p.acordo_id = v_acordo_id
  ORDER BY p.numero_parcela;
END;
$$;
```

### Frontend (ConsultaResultado.tsx)

- Novo estado `parcelasAcordo` com array de parcelas do acordo
- No `useEffect`, se `acordoExistente` existir, chamar `consultar_parcelas_acordo_por_cpf`
- Renderizacao condicional: se `parcelasAcordo.length > 0`, exibir parcelas do acordo; senao, exibir debitos originais
- Cards de parcela com badge de status (verde para pago, amarelo para pendente)
- Saldo restante calculado como soma das parcelas pendentes

