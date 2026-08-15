# IAGO entendendo imagens do cliente

Hoje, quando o cliente manda uma imagem, o IAGO recebe apenas "[Imagem]" e não responde (a conversa é escalada). A ideia é fazer com a imagem o mesmo que já é feito com áudio: a IA "olha" a imagem, gera uma descrição interna e responde a partir dela.

## Como vai funcionar

1. Cliente envia uma imagem (foto, print, documento fotografado) numa caixa em que o IAGO atende.
2. O sistema envia a imagem para a IA, que devolve uma leitura curta do que aparece nela (texto visível, valores, tipo de documento). Essa leitura é de uso interno — não aparece no Inbox.
3. O IAGO responde usando essa leitura + a legenda que o cliente escreveu (se houver) + o histórico da conversa.
4. Casos especiais:
   - **Comprovante de pagamento** (Pix, boleto pago, transferência): o IAGO agradece, diz que vai validar com a equipe, aplica a etiqueta "Aguardando Humano" e dispara o aviso aos contatos de emergência — nunca confirma pagamento sozinho.
   - **Documento pessoal / print de dívida / cobrança de outro credor**: responde com base no que leu e segue a negociação.
   - **Imagem sem relação (foto pessoal, meme, bom dia, figurinha)**: responde curto e educado e retoma o assunto da negociação.
   - **Imagem ilegível ou que a IA não consegue ler**: não inventa nada — aplica "Aguardando Humano" (mesma regra do áudio que falha).
5. Regras já existentes continuam valendo: plantão por caixa, etiqueta do atendente, opt-out, silêncio após resposta humana, nunca se identificar como IA.

## Detalhes técnicos

- Nova edge function `meta-descrever-imagem`: recebe `mensagem_id`, baixa a imagem do bucket privado `inbox-media` por URL assinada, envia como `image_url` para um modelo de visão do Lovable AI (`google/gemini-3.6-flash`) e devolve a descrição + uma classificação (`comprovante` | `documento` | `divida` | `irrelevante` | `ilegivel`). Limite de tamanho (~5 MB) e 1 tentativa de retry; nada é persistido em coluna nova de exibição.
- `meta-whatsapp-webhook`: espelhar o bloco de transcrição de áudio para `tipo === 'imagem'` (e `sticker`), somente em caixas com IAGO. O texto para a IA passa a ser `legenda + [descrição da imagem]`. Falha de leitura → `etiquetarAguardandoHumano`, sem chamar o IAGO.
- `iago-atendimento`: aceitar campo opcional `imagem_contexto` (descrição + classificação); ajustar o regex de `semConteudoUtil` para não bloquear quando houver descrição; adicionar ao prompt as regras de comprovante (escalar + avisar), documento e imagem irrelevante.
- Escalonamento de comprovante reaproveita o caminho atual: `aguardando_humano=true`, etiqueta "Aguardando Humano" e `notificar-admin`.
- Custo: a leitura de imagem só roda em mensagens recebidas em caixas com IAGO ativo, uma chamada por imagem, sem cron novo nem polling.
