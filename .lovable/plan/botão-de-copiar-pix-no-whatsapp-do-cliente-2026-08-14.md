# Botão de copiar Pix no WhatsApp do cliente

## O que está acontecendo hoje

O botão que apareceu na sua conversa não é o botão nativo do WhatsApp: é um botão de link (com o ícone de seta ↗) que o sistema envia junto com o código. Ao clicar, ele abre a página `/pix/...` do sistema, que é exatamente o comportamento que você viu.

Verificado agora no banco: o código enviado às 18:27 (SP) foi mandado sozinho, sem o prefixo do atendente, e o código é válido (o dígito verificador `764B` confere). Ou seja, o problema não é o código nem o texto — é o botão de link que estamos anexando.

## O ponto importante sobre o botão original

O botão verde "Copiar código Pix" da sua imagem é gerado pelo **próprio aplicativo WhatsApp** quando ele reconhece um código Pix na mensagem. A API Oficial da Meta não tem nenhum recurso para pedir esse botão: os únicos botões que a API permite em mensagem de texto livre são botão de link (o atual) e botões de resposta rápida — nenhum deles copia texto. O botão de "copiar código" da Meta existe só em templates de autenticação (senha de uso único, máximo 15 caracteres), o que não serve para o Pix.

Então o caminho é entregar a mensagem no formato ideal para o WhatsApp reconhecer o Pix sozinho e mostrar o botão dele — e parar de anexar o botão de link que atrapalha.

## O que será feito

1. Remover o botão de link "Copiar código Pix" das mensagens enviadas ao cliente (Inbox e demais envios de texto).
2. Manter/garantir o formato que favorece o reconhecimento automático do WhatsApp:
   - o código Pix sempre em uma mensagem separada;
   - nada além do código nessa mensagem (sem prefixo do atendente, sem "segue o Pix", sem emoji, sem espaços ou quebras extras);
   - o texto explicativo do atendente vai na mensagem anterior;
   - prévia de link desativada nessa mensagem, para o WhatsApp tratar o conteúdo como código e não como URL.
3. Manter o botão "Copiar código Pix" que já existe **dentro do Inbox** (uso interno do atendente) — ele continua útil e não afeta o cliente.
4. A página `/pix/...` e o registro de links deixam de ser usados no envio; fica sem uso, sem quebrar nada que já foi enviado.

Depois da alteração, se em algum aparelho o WhatsApp ainda não exibir o botão verde (depende da versão do app do cliente e do reconhecimento dele), o cliente segue conseguindo copiar tocando e segurando a mensagem > Copiar — sem cair em nenhum link do sistema.

## Detalhes técnicos

- `src/pages/InboxMeta.tsx`: remover a criação do registro em `pix_links` e o envio dos campos `botao_url` / `botao_texto`; manter `separarPix` para isolar o código em mensagem própria.
- `supabase/functions/send-whatsapp-meta-text/index.ts`: parar de montar o payload `interactive/cta_url`; enviar `type: text` com `preview_url: false` quando o conteúdo for um código Pix (`extrairPix`).
- `src/lib/pixCode.ts` e `src/components/inbox/ChatMessage.tsx`: sem mudança de comportamento — botão de cópia continua só na interface do Inbox.
- `src/pages/PixPublico.tsx` e a rota `/pix/:id` permanecem no código para links antigos, sem novos usos.
