## Problema

Na aba **Envio Meta Massa**, o progresso do envio (cards de "Enviados / Erros / Sem WhatsApp / Próximo em X seg") vive apenas no `useState` do componente `EnvioMeta.tsx`. Quando você navega para outra página, o componente desmonta e todo o estado é perdido — só que o `for` loop continua rodando em memória (por isso os disparos seguem acontecendo no WhatsApp), mas você não vê mais nada na tela. Ao recarregar o site, até o loop morre.

## Solução

Mover toda a lógica de envio em massa para um **Provider global** (igual ao padrão já usado em `WhatsAppSendingContext` / `VoiceCampaignSendingContext`), que:

1. Vive no nível do `App.tsx`, então não desmonta ao trocar de aba.
2. Persiste o estado em `localStorage` em tempo real (a cada envio, erro, pausa, delay), então mesmo fechando o navegador e voltando, você vê o último snapshot.
3. Só limpa quando você clicar no botão **Limpar resultados** (novo).

## O que vai mudar

### Novo arquivo `src/contexts/EnvioMetaSendingContext.tsx`
- Mantém o estado global: `enviando`, `pausado`, `progresso`, `detalhes` (enviados / erros / semWhatsapp / erroValidacao), `resultado`, `instanciaIds`, `templateId`.
- Expõe: `iniciar(params)`, `togglePausa()`, `cancelar()`, `limpar()`.
- Loop `for` de envio roda dentro do provider (não no componente da página).
- A cada `setState` relevante, grava snapshot em `localStorage` na chave `envio_meta_state`.
- Ao montar (boot do app), lê do `localStorage` e restaura. Se o loop foi interrompido por fechamento do navegador, marca `enviando=false` mas mantém `detalhes` e `resultado` visíveis até o usuário clicar em **Limpar**.

### `src/App.tsx`
- Envolver a árvore com `<EnvioMetaSendingProvider>` ao lado dos providers existentes.

### `src/pages/EnvioMeta.tsx`
- Remover `useState` de `enviando`, `pausado`, `progresso`, `detalhes`, `resultado` e os `useRef` de pausa/cancel.
- Consumir tudo via `useEnvioMetaSending()`.
- Botão **Limpar resultados** adicionado ao lado de Pausar/Cancelar quando há `detalhes` ou `resultado` e não está enviando.
- Indicador "Envio em andamento em segundo plano" quando o usuário voltar à aba e ainda houver loop ativo.

## O que NÃO muda

- Edge functions (`send-whatsapp-meta`, `check-whatsapp-numbers`, etc.).
- Schema do banco.
- Layout visual dos cards de progresso e detalhes.
- Health-check de instâncias.

## Limitação honesta

Se você **fechar a aba do navegador** no meio de um envio, o `for` loop em JavaScript morre — não tem como continuar disparando sem um worker no servidor. O que esta solução garante:

- Trocar de aba dentro do site → **continua enviando e mostra progresso ao voltar**.
- Recarregar a página (F5) → loop para, mas você vê exatamente onde parou (X enviados, Y erros, lista de números) até clicar em Limpar.
- Fechar o navegador → idem ao F5.

Se quiser que o envio continue mesmo com o navegador fechado, é outro projeto: precisa mover o loop para uma edge function com fila persistida no banco. Posso planejar isso separadamente se for o caso.
