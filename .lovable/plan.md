## O que será feito

Alterar o campo **Observações (opcional)** para **Número que falou com o cliente (obrigatório)** nas telas de lançamento/edição de acordo:

- `src/pages/NovoAcordo.tsx`
- `src/pages/NovoAcordoAdmin.tsx`
- `src/pages/EditarAcordo.tsx` (mantém consistência ao editar)

Mudanças em cada arquivo:

1. **Label**: trocar "Observações (opcional)" por "Número que falou com o cliente *".
2. **Placeholder**: "Ex: (62) 99999-9999 ou ramal 1234".
3. **Validação Zod** `observacoes`:
   - Aceitar letras e números (qualquer texto não vazio após `trim`).
   - `min(3)` e `max(50)`.
   - Tornar obrigatório (remover `.optional()`).
4. **Submit**: bloquear envio quando vazio (a validação do zod já cuida; só remover o `|| undefined`/`|| null` que permitia gravar vazio).
5. O valor continua salvo na coluna `observacoes` da tabela `acordos` (sem migração).

## Fora de escopo

- Não criar coluna nova no banco.
- Não mexer em filtros, listas ou exibição do card em "Meus Acordos".
- Não alterar máscara de telefone (campo livre conforme pedido: número e letra).
