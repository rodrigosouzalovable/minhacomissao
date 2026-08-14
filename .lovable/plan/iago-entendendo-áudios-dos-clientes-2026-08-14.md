# IAGO entendendo áudios dos clientes

Hoje, quando o cliente manda áudio no Inbox Meta Oficial, o sistema baixa o arquivo e grava o texto da mensagem apenas como `[Áudio]`. O IAGO recebe esse `[Áudio]` e não tem ideia do que foi dito — por isso ele responde fora de contexto ou pede dados que o cliente já falou.

A solução é transcrever o áudio em texto no momento em que ele chega e entregar esse texto ao IAGO como se o cliente tivesse digitado.

## Alerta de custo (Lovable Cloud / IA)

Cada áudio transcrito é uma chamada de IA. Para conter custo:
- Transcrição automática **só nas conversas de pastas onde o IAGO atende** (pasta com credor/janela do IAGO configurada). Áudios de outras caixas ficam sem transcrição automática.
- Limite de duração: áudios acima de ~3 minutos são transcritos apenas nos primeiros ~3 min (o resto é indicado como "áudio longo, trecho inicial").
- Uma transcrição por áudio: o resultado é gravado no banco e nunca reprocessado.
- Estimativa: com modelo Gemini Flash Lite, cerca de US$ 0,0003–0,001 por áudio de 30s. 300 áudios/dia ≈ US$ 0,10–0,30/dia.

## Como vai funcionar

1. Cliente manda áudio → webhook baixa o arquivo (já acontece hoje).
2. Se a conversa pertence a uma caixa com IAGO ativo, o sistema transcreve o áudio.
3. A mensagem passa a ser gravada com o texto: `🎤 <transcrição>` e o áudio continua tocável no Inbox.
4. O IAGO é acionado com a transcrição no lugar de `[Áudio]` — ele identifica CPF, proposta aceita, número errado, tudo normalmente.
5. Se a transcrição falhar (áudio corrompido, sem fala), a mensagem fica como `[Áudio]` e o IAGO **não** responde nada nessa mensagem — a conversa recebe a etiqueta "Aguardando Humano" para o atendente ouvir.
6. No Inbox, a transcrição aparece em texto pequeno abaixo do player de áudio, com rótulo "transcrição automática".
7. Botão **"Transcrever"** em cada mensagem de áudio (para áudios antigos ou que falharam): o atendente clica, o sistema transcreve e salva. Assim o texto passa a valer para todos que abrirem a conversa.

## Detalhes técnicos

- **Nova função** `meta-transcrever-audio`: recebe `mensagem_id`, baixa o arquivo do bucket de mídia do Inbox, converte para base64 e chama o Lovable AI Gateway (`/v1/chat/completions`, `google/gemini-2.5-flash-lite`) com bloco `input_audio` e `format: "ogg"` (formato que a Meta entrega). Grava o resultado em `meta_whatsapp_mensagens.transcricao` e reescreve `conteudo` para `🎤 <texto>`. Idempotente: se `transcricao` já existe, retorna o valor salvo.
- **Migração**: adicionar colunas `transcricao text` e `transcricao_status text` (`pendente|ok|erro`) em `meta_whatsapp_mensagens`. Sem novas policies — a tabela já tem RLS por instância/pasta.
- **`meta-whatsapp-webhook`**: após inserir a mensagem, quando `tipo_conteudo = 'audio'` e a pasta do contato tem IAGO configurado (`meta_inbox_folder_credores` / `meta_inbox_folder_iago_janela`), chama a transcrição **antes** de invocar `iago-atendimento`, e passa o texto transcrito no campo `texto`. Se falhar, pula a chamada do IAGO e aplica a etiqueta "Aguardando Humano".
- **`iago-atendimento`**: ao ler a última entrada do histórico, usar `transcricao` quando existir; ignorar mensagens cujo conteúdo seja apenas `[Áudio]` sem transcrição (não gerar resposta em cima delas).
- **`src/pages/InboxMeta.tsx`**: exibir `transcricao` abaixo do player de áudio; botão "Transcrever" (ícone de texto) nas mensagens de áudio sem transcrição, chamando a nova função e atualizando a lista.
- Nenhum arquivo de áudio novo é armazenado — usa a mídia já baixada, respeitando a retenção de 3 dias existente. Áudios já expirados do bucket não podem ser transcritos (o botão informa isso).
