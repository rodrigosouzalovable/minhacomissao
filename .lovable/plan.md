

## Preencher valores padrão + Arrumar AUTO START

### O que são as fases
O aquecimento funciona em 4 fases progressivas — números novos começam enviando poucas mensagens por dia e vão aumentando gradualmente para parecerem naturais ao WhatsApp. Cada fase dura alguns dias antes de avançar.

### Alterações em `src/components/aquecimento/AquecimentoConfigTab.tsx`

**1. Valores padrão pré-preenchidos** — usar `placeholder` + fallback nos campos vazios:

| Config | Fase 1 | Fase 2 | Fase 3 | Fase 4 | Aquecido |
|--------|--------|--------|--------|--------|----------|
| Limite msgs/dia | 5 | 10 | 20 | 30 | 50 |
| Dias na fase | 7 | 7 | 7 | 7 | — |

| Config | Valor padrão |
|--------|-------------|
| Horário | 08:00 – 18:00, America/Sao_Paulo |
| Dias ativos | Seg-Sáb (1-6) |
| Delay | min 30s, max 180s |

Adicionar descrições mais claras em cada Card explicando o propósito para iniciantes.

**2. AUTO START — campos dedicados em vez de JSON**

Adicionar `auto_start` à lista de `knownKeys` e renderizar com:
- Input de hora: "Horário de início automático"
- Switch: "Iniciar novas instâncias automaticamente"
- Descrição: "Se ativado, o sistema inicia o aquecimento de novas instâncias automaticamente no horário definido."

**3. Botão "Salvar Tudo"** no final da página para salvar todas as configs de uma vez.

