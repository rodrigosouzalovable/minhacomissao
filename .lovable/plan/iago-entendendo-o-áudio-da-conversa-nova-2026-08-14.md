# IAGO entendendo o áudio da conversa nova

## O que aconteceu no seu teste

O áudio que você mandou às 20:15 (número 62 99430-0880, instância Novo Mundo 3144) chegou e foi salvo na caixa Padrão, mas ficou **sem transcrição**: o registro está com transcrição vazia e sem nenhum status de erro. O log do webhook mostra apenas:

`[MetaWebhook] falha na transcrição do áudio Edge Function returned a non-2xx status code`

Ou seja: o sistema tentou transcrever, a função de transcrição respondeu erro, e **o motivo real foi perdido** — o webhook só registra a mensagem genérica, sem o corpo da resposta. Como não conseguimos entender o áudio, o IAGO seguiu a regra atual (não responder o que não entende) e apenas marcou a conversa para humano, por isso ele "não fez nada".

Um áudio anterior do mesmo dia foi transcrito com sucesso, então o motor de transcrição funciona; o que falta é enxergar e tratar essa falha específica. A causa exata ainda não está confirmada — confirmá-la é o primeiro passo do plano.

## O que será feito

1. **Enxergar o erro de verdade**
   - O webhook passa a registrar status HTTP + corpo da resposta da transcrição (hoje isso é engolido).
   - A função de transcrição passa a registrar o motivo em todos os caminhos de saída e a gravar sempre um status na mensagem (hoje alguns caminhos saem sem gravar nada, foi o que aconteceu no seu teste).

2. **Tornar a transcrição confiável no fluxo automático**
   - Chamada da transcrição pelo webhook feita de forma direta e autenticada como serviço, sem depender das regras de acesso do usuário.
   - Nova tentativa automática (2 tentativas com pequeno intervalo) em falhas temporárias.
   - Áudios muito curtos ou com fala fraca: segunda tentativa com instrução mais tolerante antes de desistir.

3. **IAGO responde depois da transcrição**
   - Com a transcrição pronta, o texto entra no IAGO como se o cliente tivesse digitado (comportamento que já existe) — incluindo respostas curtas como "à vista"/"parcelado" enviadas por áudio.
   - Se depois de todas as tentativas o áudio realmente não for compreendido, mantém-se a regra atual: IAGO não responde, conversa marcada como "Aguardando Humano".

4. **Reprocessar o áudio do teste**
   - Rodar a transcrição do áudio da Fernanda para validar a correção com o caso real e confirmar que o IAGO responde.

## Detalhes técnicos

- `supabase/functions/meta-whatsapp-webhook/index.ts`: substituir `functions.invoke` da transcrição por `fetch` com service role, logar `status` + corpo; manter `audioSemTranscricao` como gatilho da etiqueta de humano.
- `supabase/functions/meta-transcrever-audio/index.ts`: usar client admin para ler a mensagem quando a chamada vier com service role; `marcarStatus` em todos os retornos de erro (403/404/422/502); segunda passada no gateway com prompt tolerante quando o retorno for `SEM_FALA`; manter limite de 30s.
- Sem novos crons, sem polling novo, sem tabela nova — custo praticamente inalterado (só uma chamada extra de IA nos áudios que falharem na primeira tentativa).
