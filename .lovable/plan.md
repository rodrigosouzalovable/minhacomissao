# Diagnóstico

**O sistema NÃO está travado por causa do crédito de IA zerado.** A IA zerada só desliga respostas automáticas — não afeta login nem carregamento de dados.

A causa real é uma **sobrecarga de webhooks no `whatsapp-chatbot`**, que está saturando os workers da Lovable Cloud e empurrando todas as outras requisições (login, queries do app) para a fila de espera. Por isso aparece "Carregando…" e "O servidor demorou para responder".

### Evidências

- **30+ webhooks de grupos/broadcasts em 5 segundos** chegando no `whatsapp-chatbot` (cada um inicia um worker novo, mesmo sendo descartado depois).
- Múltiplas execuções **estourando 150 segundos** (timeout 504), travando workers inteiros por 2,5 minutos cada.
- A base tem **716.859 devedores** — qualquer query mal otimizada pesa.
- Logs do Postgres e Auth limpos: o problema é runtime de Edge Functions.

# Plano de correção (3 camadas)

## Camada 1: Rejeitar grupos/broadcasts ANTES do worker iniciar

Hoje o `whatsapp-chatbot` boota o worker, conecta ao Supabase, e SÓ DEPOIS descarta a mensagem de grupo. Vamos fazer o descarte ser a primeiríssima coisa, sem nenhum import pesado, retornando 200 imediatamente. Isso reduz drasticamente o tempo gasto por webhook descartado.

## Camada 2: Eliminar travas de 150s no chatbot

Adicionar um timeout interno de 20 segundos em qualquer chamada externa (UAZAPI, IA, fetch). Se estourar, retorna 200 e loga o erro — nunca mais um worker preso por 2,5 min.

## Camada 3: Garantir que send-whatsapp não trave

A função `send-whatsapp` também apareceu com 504 (150s). Aplicar mesma estratégia: timeout interno em chamadas UAZAPI (15s) e fallback de erro rápido.

## Camada 4 (opcional, recomendado): Aumentar instância da Cloud

Com 716 mil devedores e webhooks intensos, a instância padrão está no limite. Mesmo com as correções acima, recomendo subir o tamanho da instância em **Cloud → Backend → Advanced settings → Upgrade instance**. Isso melhora simultaneidade de Edge Functions e throughput de queries. Faço isso só se você autorizar (custo Cloud sobe um pouco).

# Arquivos afetados

- `supabase/functions/whatsapp-chatbot/index.ts` — early-return para grupos/broadcasts, timeout em chamadas externas
- `supabase/functions/send-whatsapp/index.ts` — timeout em chamadas UAZAPI

# Sobre os créditos de IA

Os $20 zeraram nos últimos dias por causa do consumo descontrolado já corrigido na rodada anterior (kill switch + budget guard + alertas WhatsApp já estão ativos). A barreira já existe — se acontecer de novo, você é avisado no 62991672674 e o sistema bloqueia sozinho.

# Próximo passo

Aprove o plano para eu aplicar as correções nos 2 edge functions. Em ~2 minutos depois do deploy, o login e o carregamento de dados devem voltar ao normal. Se ainda assim ficar lento, partimos para o upgrade de instância.
