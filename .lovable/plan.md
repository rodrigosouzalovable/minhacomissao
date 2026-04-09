

## Conversa Natural e Fluida entre Instâncias

### Problema Atual
O fluxo é unidirecional por ciclo: A envia uma mensagem do pool de diálogos, B responde UMA vez via IA, e a conversa morre. No próximo ciclo (15 min depois), outro par é escolhido. Resultado: conversas robóticas de 1 mensagem cada.

### Solução: Conversa em Cadeia (Ping-Pong Contínuo)

Quando o `whatsapp-ia-responder` envia uma resposta de B para A, ele automaticamente dispara uma nova chamada para que A responda de volta a B (com delay humanizado). Isso cria uma cadeia:

```text
A envia msg inicial (do pool de diálogos)
  └─ B responde via IA (delay 15-60s)
      └─ A responde via IA (delay 20-90s)  ← NOVO
          └─ B responde via IA (delay 15-60s)  ← NOVO
              └─ ... até atingir 10-15 trocas
                  └─ Quem atingir o limite encerra naturalmente
```

### Mudanças

**1. whatsapp-ia-responder/index.ts — Cadeia de respostas**
- Aumentar `max_trocas` de `5-7` para `10-15` (linha 312: `10 + Math.floor(Math.random() * 6)`)
- Após enviar a resposta, o responder busca os dados da instância que RECEBEU a mensagem e dispara uma nova chamada fire-and-forget para que ela responda de volta (invertendo origem/destino)
- Delay humanizado variável: 20-120s entre respostas, com variação para parecer natural
- Passar `server_url` e `instance_token` da instância que vai responder na próxima rodada
- Aumentar histórico de contexto de 6 para 10 mensagens para a IA manter coerência

**2. whatsapp-ia-responder/index.ts — Prompt mais conversacional**
- Melhorar o system prompt para instruir a IA a fazer perguntas, mudar de assunto, reagir com curiosidade
- Variar o tamanho das respostas (às vezes 1 palavra "kkk", às vezes 2 frases)
- Adicionar instrução para ocasionalmente enviar mensagens curtas tipo "e aí?", "conta mais", "sério?"

**3. whatsapp-ia-responder/index.ts — Encerramento natural**
- Nas últimas 2-3 trocas antes do limite, instruir a IA a ir "finalizando" naturalmente (ex: "bom, vou nessa")
- Não encerrar abruptamente com frase fixa — deixar a IA gerar o encerramento baseado no contexto

**4. Áudio (fase futura)**
- Áudio entre instâncias requer gravação/síntese de voz (TTS), que não está implementado no UAZAPI nem no sistema atual
- Por enquanto, as conversas serão 100% texto, que já é o formato mais comum no WhatsApp
- Podemos adicionar áudio depois com um serviço de TTS se necessário

### Fluxo Técnico Detalhado

```text
whatsapp-aquecimento (cron 15min)
  │ Envia msg do pool: A → B
  │ Chama whatsapp-ia-responder (B responde a A)
  │
  └─ whatsapp-ia-responder:
      1. Delay 15-60s
      2. Gera resposta via Gemini Flash Lite
      3. Envia resposta B → A via UAZAPI
      4. Salva no histórico
      5. SE total_trocas < max_trocas:
         └─ Busca dados da instância A no banco
         └─ Delay 20-120s (fire-and-forget)
         └─ Chama whatsapp-ia-responder novamente
            (agora A responde a B)
            └─ Repete do passo 1 (agora invertido)
      6. SE total_trocas >= max_trocas - 2:
         └─ Prompt com instrução de encerramento gradual
      7. SE total_trocas >= max_trocas:
         └─ Finaliza conversa
```

### Arquivos Afetados
- `supabase/functions/whatsapp-ia-responder/index.ts` — toda a lógica de cadeia, prompt melhorado, max_trocas 10-15

### Resultado Esperado
Cada conversa terá entre 10 e 15 trocas totais (cada lado manda 5-8 mensagens), com delays variáveis de 15s a 2min entre cada mensagem, durando entre 5 e 20 minutos no total. As conversas serão naturais, com mudanças de assunto, perguntas, reações curtas e encerramentos orgânicos.

