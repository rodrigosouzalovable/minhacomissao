

## Resposta sobre TAG "Pendente"

**"Pendente"** significa que a mensagem foi agendada na fila (`whatsapp_fila`) com status `pendente` — ou seja, já foi programada para envio mas ainda não foi processada/enviada. É diferente de "Não enviado" (que nem entrou na fila ainda) e "Enviando" (que está sendo processado naquele momento).

## Plano: Ordenar itens por status do WhatsApp

Dentro de cada seção (Vencidas, Hoje, 3 dias), ordenar os itens por prioridade de status:
1. **Enviado** (verde) — primeiro
2. **Pendente** (amarelo) — segundo  
3. **Não enviado** (cinza) — terceiro
4. **Erro** (vermelho) — por último

### Mudança

**`src/components/LembretesSection.tsx`**
- Após criar `vencidos`, `hoje`, `tresDias`, aplicar `.sort()` com uma função que mapeia `whatsapp_status` para prioridade numérica:
  - `enviado` → 0, `enviando` → 1, `pendente` → 2, `nao_enviado` → 3, `erro` → 4
- Isso ordena cada seção independentemente, mantendo a estrutura visual atual

