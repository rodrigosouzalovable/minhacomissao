

## Reduzir delays do "Aplicar perfil em todas as instâncias"

### Alterações em `src/pages/Acionamento.tsx`

1. **Linha 1209** — Delay entre nome e foto da mesma instância:
   - De: `randomDelay(30000, 90000)` (30-90s)
   - Para: `randomDelay(10000, 20000)` (10-20s)

2. **Linha 1263** — Delay entre instâncias:
   - De: `randomDelay(60000, 180000)` (60-180s)
   - Para: `randomDelay(20000, 40000)` (20-40s)

3. **Linha 2535** — Atualizar texto descritivo:
   - De: "1-3 min entre cada"
   - Para: "20-40s entre cada"

### Risco de banimento
Nenhum. Alterações de perfil são operações administrativas leves, não sujeitas às mesmas restrições que disparos de mensagens em massa.

