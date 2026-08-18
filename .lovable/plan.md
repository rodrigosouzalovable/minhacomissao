# Corrigir o envio de áudio no Inbox Meta Oficial

## Diagnóstico confirmado

- O envio de texto e arquivos comuns aceita o destinatário por **telefone ou BSUID**.
- O gravador de áudio envia somente `telefone`. Quando a conversa Meta está identificada por BSUID e não expõe telefone, a função recebe o destinatário vazio e rejeita a solicitação antes de tentar enviar o áudio.
- A conversão WebM → MP3 já existe e a biblioteca necessária está instalada. A função de envio também já aceita MP3, faz upload do binário na Meta e usa o ID retornado.
- Os registros mais recentes mostram a função inicializando, mas sem chegar ao log de upload do áudio, coerente com a rejeição antecipada dos dados da chamada.

## Alterações

1. **Enviar para o destinatário correto**
   - Passar o `bsuid` da conversa para o gravador, além do telefone.
   - Montar a chamada com telefone quando disponível e BSUID como alternativa, igual ao fluxo de texto e anexos.
   - Impedir o início da gravação apenas se ambos estiverem ausentes.

2. **Exibir o erro real**
   - Ler o corpo de erro devolvido pela função, inclusive quando a chamada responde 400/500, para não mostrar apenas uma mensagem genérica.
   - Separar claramente falha de conversão, armazenamento, upload na Meta, janela de 24 horas e destinatário inválido.
   - Acrescentar logs por etapa sem registrar áudio, token ou dados sensíveis.

3. **Fortalecer o processamento do áudio**
   - Validar que o MP3 convertido não está vazio e possui tamanho plausível antes do upload.
   - Manter MP3 como caminho principal e OGG/Opus via conversor atual somente como fallback.
   - Garantir limpeza do estado do gravador em sucesso e falha, permitindo tentar novamente sem recarregar a página.

4. **Validar ponta a ponta**
   - Testar uma conversa identificada por telefone e outra identificada por BSUID, ambas dentro da janela de 24 horas.
   - Confirmar nos registros: download da URL assinada, upload de mídia aceito pela Meta, envio da mensagem e gravação no histórico do Inbox.
   - Verificar que o áudio aparece no histórico e pode ser reproduzido após o envio.

## Detalhes técnicos

- `src/hooks/useMetaAudioRecorder.tsx`: aceitar `bsuid`, validar destinatário, enviá-lo à função e preservar a mensagem detalhada da resposta.
- `src/pages/InboxMeta.tsx`: fornecer `contatoAtivo.bsuid` ao hook.
- `supabase/functions/send-whatsapp-meta-media/index.ts`: registrar etapas e devolver erros estruturados e específicos; manter o upload multipart para a API oficial.
- Sem cron, polling, tabela ou chamadas recorrentes novas; não há aumento relevante de custo de Cloud.