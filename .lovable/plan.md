

## Melhorias para Aquecimento Mais Natural

### Diagnóstico atual
O sistema já é bom na qualidade das mensagens (gírias, temas variados, mídia). Mas tem padrões detectáveis: conversas longas demais, delays fixos, horários previsíveis, e falta de indicador "digitando".

### Melhorias propostas (sem aumento de custo)

#### 1. Conversas mais curtas e realistas
- Reduzir `max_trocas` de 12-18 para **4-8** (aleatório)
- Resultado: ~60% menos chamadas ao IA responder por conversa
- Pessoa real troca 3-6 mensagens numa conversa casual rápida

#### 2. Delays humanizados entre respostas
- Atual: sempre 30-60s (fixo e previsível)
- Novo: distribuição variada:
  - 30% chance: resposta rápida (5-15s) — "tava com o celular na mão"
  - 40% chance: normal (30-90s) — leu e respondeu
  - 20% chance: demorou (2-5 min) — estava ocupado
  - 10% chance: bem demorado (5-10 min) — foi fazer outra coisa
- Torna o padrão impossível de prever

#### 3. Indicador "digitando..." antes de enviar
- Chamar endpoint UAZAPI de "composing/typing" antes de cada mensagem
- Duração proporcional ao tamanho da mensagem (1-4s)
- Faz a conversa parecer 100% humana no lado do WhatsApp

#### 4. Variação diária (dias mais/menos ativos)
- Em vez de sempre 1 conversa/dia, sortear:
  - 20% chance: 0 conversas (dia "ocupado", não mexe no celular)
  - 60% chance: 1 conversa (normal)
  - 20% chance: 2 conversas (dia tranquilo)
- Média se mantém ~1/dia mas com variação natural

#### 5. "Amigos frequentes" — pares com afinidade
- Manter registro do `ultimo_parceiro_id` e dar 30% de preferência para repetir o mesmo parceiro
- Pessoas reais conversam mais com os mesmos contatos
- Outros 70% continuam aleatórios para variedade

### Impacto no consumo Lovable Cloud
- **Conversas mais curtas**: reduz ~50% das chamadas ao IA responder (de ~15 trocas para ~6)
- **Dias sem conversa (20%)**: reduz mais ~20% no total
- **Typing indicator**: 1 fetch extra por mensagem (leve, sem custo de Edge Function)
- **Resultado líquido: ECONOMIA de ~40-50%** comparado ao sistema atual

### Alterações

#### 1. `supabase/functions/whatsapp-ia-responder/index.ts`
- `max_trocas`: `12 + random(7)` → `4 + random(5)` (4-8 trocas)
- `randomDelay`: distribuição variada em vez de 30-60s fixo
- Adicionar `enviarTypingIndicator()` antes de cada `enviarMensagemUAZAPI`

#### 2. `supabase/functions/whatsapp-aquecimento/index.ts`
- Sortear quantidade diária (0, 1 ou 2 conversas) em vez de sempre 1
- Dar 30% preferência ao `ultimo_parceiro_id` na seleção de pares
- Manter lógica de skip aleatório e max 3 pares/ciclo

### Arquivos
1. **`supabase/functions/whatsapp-ia-responder/index.ts`** — trocas mais curtas, delays humanizados, typing indicator
2. **`supabase/functions/whatsapp-aquecimento/index.ts`** — variação diária, pares com afinidade

