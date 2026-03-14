

# Usar templates configurados nas mensagens de lembrete

## Problema
O `gerarMensagem` no `PaymentReminders.tsx` usa mensagens hardcoded. O usuário quer que as mensagens sigam os templates configurados em "Mensagens de Lembrete" (`lembrete_mensagens_templates`).

## Solução

### `src/components/PaymentReminders.tsx`

1. **Carregar templates do banco** ao abrir o dialog: buscar `lembrete_mensagens_templates` do usuário logado, filtrar por `ativo = true`, agrupar por `tipo_lembrete`.

2. **Mapear tipo do lembrete para tipo_lembrete do template**:
   - `tipo === 'vencido'` → calcular dias de atraso → `vencido_d{N}` (ex: `vencido_d1`, `vencido_d10`). Se não encontrar template exato para o dia, usar o template genérico de vencido mais próximo ou fallback.
   - `tipo === 'hoje'` → `dia_vencimento`
   - `tipo === 'tres_dias'` → `3_dias`

3. **Substituir variáveis** no template usando a mesma lógica do Edge Function:
   - `{nome_cliente}` → nome completo em Title Case
   - `{primeiro_nome}` → primeiro nome em Title Case
   - `{nome_operador}` → primeiro nome do perfil do usuário logado
   - `{valor}` → valor formatado em BRL
   - `{data_vencimento}` → data formatada pt-BR
   - `{dias_atraso}` → dias de atraso calculados

4. **Buscar nome do operador** do perfil do usuário (já disponível ou buscar via `profiles`).

5. **Fallback**: se não houver template configurado para aquele tipo, usar as mensagens hardcoded atuais como fallback.

6. **Seleção aleatória**: quando houver múltiplos templates para o mesmo `tipo_lembrete`, escolher um aleatoriamente (mesma lógica do Edge Function).

### Arquivos editados
- `src/components/PaymentReminders.tsx`

