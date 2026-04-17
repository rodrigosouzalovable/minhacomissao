

## Plano: Mudar Estágio para "ACORDO" ao lançar acordo MONTREAL

### Diagnóstico

Hoje, ao criar um acordo via `acordos_devedor` (fluxo da ficha do cliente), o `estagio` na tabela `devedores` permanece inalterado (ex.: "Novo", "Andamento"). O usuário quer que, **especificamente para clientes MONTREAL**, ao criar um acordo o estágio mude automaticamente para **"Acordo"** — refletindo na coluna **Estágio** da página `/clientes`.

Verifiquei que MONTREAL hoje tem 0 acordos, mas a regra precisa estar pronta para os próximos. Também notei que o cliente DANIEL PEREIRA DE ABRANTES LTDA (CNPJ 51688297000160) já tem 1 acordo ativo em `acordos_devedor` — esse será beneficiado retroativamente pela atualização.

### Mudanças

**1. Trigger no banco em `acordos_devedor`** (após INSERT)

Quando um novo registro for inserido em `acordos_devedor` com `status='ativo'`:
- Buscar todos os registros em `devedores` cujo `cpf_normalize(cpf) = cpf_normalize(NEW.devedor_cpf)` **E** `credor` corresponde a MONTREAL (filtro: `credor ILIKE '%montreal%'`).
- Atualizar `estagio = 'Acordo'` em todas as linhas correspondentes.

```sql
CREATE OR REPLACE FUNCTION public.atualizar_estagio_montreal_acordo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'ativo' THEN
    UPDATE public.devedores
    SET estagio = 'Acordo'
    WHERE public.cpf_normalize(cpf) = public.cpf_normalize(NEW.devedor_cpf)
      AND credor ILIKE '%montreal%'
      AND ativo = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_estagio_montreal_acordo
AFTER INSERT ON public.acordos_devedor
FOR EACH ROW EXECUTE FUNCTION public.atualizar_estagio_montreal_acordo();
```

**2. Trigger equivalente em `acordos`** (fluxo antigo)

Mesma lógica, em caso futuro de acordo MONTREAL ser criado pela página `/acordos/novo`:

```sql
CREATE TRIGGER trg_estagio_montreal_acordo_old
AFTER INSERT ON public.acordos
FOR EACH ROW EXECUTE FUNCTION public.atualizar_estagio_montreal_acordo_old();
```
(função análoga usando `NEW.cliente_cpf`)

**3. Backfill imediato (one-shot)**

Aplicar a regra retroativamente para o caso já existente (DANIEL PEREIRA…):

```sql
UPDATE devedores SET estagio = 'Acordo'
WHERE credor ILIKE '%montreal%' AND ativo = true
  AND cpf_normalize(cpf) IN (
    SELECT cpf_normalize(devedor_cpf) FROM acordos_devedor WHERE status='ativo'
    UNION
    SELECT cpf_normalize(cliente_cpf) FROM acordos WHERE status='ativo'
  );
```

### O que NÃO muda

- Frontend: zero alteração. A coluna **Estágio** já lê `devedores.estagio` e renderiza o badge automaticamente.
- Outros credores (Novo Mundo, etc.) **não são afetados** — regra é exclusiva MONTREAL.
- Permissões, RLS, agrupamento empresarial: intactos.
- Custo Cloud: zero adicional (triggers são gratuitos).

### Reversibilidade

Se no futuro quiser remover, basta `DROP TRIGGER` — dados antigos permanecem com estágio "Acordo" mas podem ser revertidos manualmente.

### Arquivos a tocar

- **Nova migração SQL**: 2 funções trigger + 2 triggers + 1 UPDATE de backfill.
- Sem alteração de código frontend.

### Resultado esperado

- Próximo acordo MONTREAL criado → CNPJ aparece com badge **"Acordo"** na coluna Estágio em `/clientes`.
- DANIEL PEREIRA DE ABRANTES LTDA já passa a exibir "Acordo" imediatamente após o backfill.

