---
name: IAGO entende imagens
description: IAGO lê imagens do cliente via meta-descrever-imagem (descrição interna + classificação), comprovante escala para humano, imagem ilegível não é respondida
type: feature
---

Imagens recebidas em caixas onde o IAGO atende são lidas pela IA antes do atendimento.

- Edge function `meta-descrever-imagem`: baixa a mídia, envia a imagem em base64 para `google/gemini-3.6-flash` e devolve `{ descricao, classificacao }` com classificação em `comprovante | documento | divida | irrelevante | ilegivel`. Limite ~5 MB, 1 retry em 429/5xx. A descrição é **uso interno** — não é gravada nem exibida no Inbox.
- `meta-whatsapp-webhook`: para `tipo === 'imagem'`, só chama a leitura se a caixa tiver IAGO (janela de plantão ativa ou credor configurado). Monta `textoParaIA = legenda + [imagem enviada pelo cliente — classificação: descrição]` e envia `imagem_contexto` ao `iago-atendimento`. Falha na leitura/ilegível → etiqueta "Aguardando Humano" e o IAGO não é chamado.
- `iago-atendimento`: aceita `imagem_contexto`, ignora o bloqueio de mídia sem texto quando há descrição e aplica no prompt: comprovante → agradece, nunca confirma pagamento, `escalar=true` + aviso de emergência; imagem irrelevante (foto/figurinha/bom dia) → resposta curta e retoma a negociação; documento/print de dívida → responde com o que está legível.
