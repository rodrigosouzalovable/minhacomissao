## O que significa a mensagem atual

O código `(#2200) Callback verification failed ... curl_errno = 28 ... Operation timed out after 6000 milliseconds` é o retorno cru da Meta quando ela tenta reinscrever o webhook da instância e **não consegue chamar a URL do nosso servidor dentro de 6 segundos** (timeout de rede entre Meta ↔ Lovable Cloud naquele momento).

Na prática:
- Não é banimento, não é bloqueio de conta, não é erro de token.
- É uma falha temporária de rede na hora em que o `meta-webhook-health` (que roda periodicamente) tentou re-registrar o callback.
- Nas próximas execuções (o job roda de tempos em tempos) ele tenta de novo. Se a Meta conseguir responder dentro do prazo, a instância volta ao normal sozinha.
- Só vira problema real se **continuar falhando por várias horas seguidas na mesma instância** — aí mensagens recebidas podem não chegar no Inbox.

## O que vou mudar

Reescrever a mensagem enviada ao admin em `supabase/functions/meta-webhook-health/index.ts` (bloco que hoje monta `Saúde Webhook Meta — ${nome}` + erro cru) para:

1. **Traduzir os três casos** (`erro`, `perda_suspeita`, `reinscrito`) em português claro, sem jargão.
2. **Detectar especificamente o timeout `(#2200)` / `curl_errno = 28`** e explicá-lo como falha temporária de rede da Meta.
3. **Dizer o que fazer** em cada caso.
4. Manter o código técnico só em uma linha final `Detalhe técnico: ...` (curto) para quando eu precisar debugar, sem poluir o texto principal.

### Novo formato da mensagem (exemplo do caso do print)

```
⚠️ Saúde do Webhook — MEMU 52

A Meta demorou demais para responder ao nosso servidor
na hora de reconectar o recebimento de mensagens desta
instância (timeout de 6s).

Isso costuma ser uma instabilidade momentânea entre a
Meta e o nosso servidor. O sistema tentará novamente
automaticamente na próxima verificação.

O que fazer:
• Nenhuma ação imediata é necessária.
• Se você receber 3+ avisos seguidos da MESMA instância
  em menos de 1 hora, abra Configurar Meta → Diagnóstico
  daquela instância e clique em "Reinscrever webhook".
• Só se preocupe se pararem de chegar mensagens de
  clientes no Inbox por mais de 30 minutos.

Detalhe técnico: (#2200) callback verification timeout 6000ms
```

Para os outros casos manterei o mesmo padrão amigável:

- **`erro` genérico (não timeout):** "Não foi possível reconectar o webhook desta instância. Motivo: <resumo>. Abra Configurar Meta → Diagnóstico e clique em Reinscrever webhook."
- **`perda_suspeita`:** "A Meta registrou X conversas iniciadas hoje, mas o Inbox só recebeu Y. Podem ter faltado Z mensagens. Verifique se todas as instâncias estão com o webhook verde em Configurar Meta."
- **`reinscrito`:** "O webhook desta instância caiu e foi religado automaticamente. Nenhuma ação necessária — mensagens já estão chegando de novo."

## Escopo

- Apenas a montagem do texto da notificação em `meta-webhook-health/index.ts`.
- Não muda lógica de detecção, cadência, nem o painel de saúde no front. Nada de banco.
