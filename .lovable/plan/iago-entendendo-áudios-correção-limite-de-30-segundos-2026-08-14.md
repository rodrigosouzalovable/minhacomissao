# IAGO entendendo áudios: correção + limite de 30 segundos

## O que foi verificado agora

- As duas mensagens de áudio do seu teste (21:32 e 21:33 de hoje) estão salvas com mídia baixada, mas com `transcricao` e `transcricao_status` **vazios** — ou seja, a transcrição foi iniciada e não concluiu.
- A função de transcrição realmente foi acionada nos dois horários (há registro de inicialização), porém **não gravou resultado nem erro**: ela morreu no meio do caminho, sem deixar rastro. Hoje ela não registra nada antes da chamada de IA, então não há como saber se falhou o download da mídia, o envio para a IA ou o tempo de execução.
- Como a transcrição não voltou, o webhook marcou a conversa como "áudio sem transcrição" e **bloqueou o IAGO de responder** — foi por isso que ele ficou calado após o áudio.
- Confirmado também: o limite atual é por tamanho de arquivo (~1,5 MB, equivalente a uns 3 minutos), como você lembrou.

## O que será feito

### 1. Diagnóstico permanente (para nunca mais ficar sem rastro)
- Registrar cada etapa da transcrição (download da mídia, tamanho/formato, chamada da IA, resposta, tempo gasto).
- Sempre gravar um status na mensagem (`ok`, `erro`, `muito_longo`), mesmo em falha inesperada, para o Inbox e o IAGO saberem o que aconteceu.

### 2. Tornar a transcrição confiável
- Usar um modelo de IA atual e mais robusto para áudio de WhatsApp (formato OGG/Opus), com uma tentativa de repetição automática em caso de falha temporária ou limite de requisições.
- Aumentar a tolerância de tempo da chamada e garantir que a função conclua a gravação da transcrição antes de encerrar.

### 3. Novo limite: 30 segundos
- Passar o limite de ~3 minutos para **30 segundos**.
- O limite será aplicado por duração informada pelo WhatsApp quando disponível e, na falta dela, por tamanho estimado equivalente a 30s de áudio de voz.
- Áudio acima de 30s: **não é transcrito**, o IAGO **não responde** e a conversa é escalada para atendimento humano — recebe a etiqueta "Aguardando Humano" e o aviso ao admin, igual ao fluxo atual de mídia que a IA não entende.

### 4. Fluxo do IAGO com áudio
- Áudio de até 30s: transcrição entra no histórico como se o cliente tivesse digitado, e o IAGO responde normalmente (continuando a negociação no ponto em que estava).
- Áudio longo, sem fala audível ou com falha definitiva de transcrição: IAGO fica em silêncio e chama atendente, sem mandar mensagem genérica ao cliente.

## Detalhes técnicos

- `supabase/functions/meta-transcrever-audio/index.ts`: logs por etapa; troca do modelo de transcrição por um de geração atual; retry único com backoff; novo teto de bytes correspondente a 30s; novo status `muito_longo` retornado com código próprio; gravação de status garantida em todos os caminhos.
- `supabase/functions/meta-whatsapp-webhook/index.ts`: passar a duração do áudio (`m.audio.duration`, quando presente no payload) para a função de transcrição; distinguir "áudio longo" de "falha de transcrição" nos logs; manter o bloqueio do IAGO e a escalada humana nos dois casos.
- Nenhuma alteração de schema é necessária (`transcricao` / `transcricao_status` já existem).
