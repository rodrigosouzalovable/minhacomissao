# Botão "Copiar código Pix" nas mensagens do Inbox

## Objetivo
Quando uma mensagem (enviada ou recebida) contiver um código Pix Copia e Cola, o balão da conversa passa a exibir um botão "Copiar código Pix" logo abaixo do texto. Ao clicar, apenas o código Pix é copiado — nunca o texto do atendente que acompanha a mensagem.

## Como vai funcionar
1. O sistema analisa o texto da mensagem e procura um payload Pix (padrão EMV: começa com `000201`, contém `br.gov.bcb.pix` e termina no campo CRC `6304XXXX`).
2. Se encontrar, abaixo do texto aparece um botão com ícone de cópia e o rótulo "Copiar código Pix", no mesmo estilo visual da foto enviada (linha separadora fina e botão centralizado dentro do balão).
3. O texto do código Pix continua visível no balão (com quebra de linha), e o restante da mensagem do atendente é preservado normalmente.
4. Clicar no botão copia somente a string do Pix e mostra a confirmação "Código Pix copiado".
5. Vale para mensagens de entrada e de saída, no Inbox Meta Oficial e no Inbox WhatsApp (ambos usam o mesmo componente de balão).

## Observação importante
Esse botão aparece no nosso painel, para o atendente. No aparelho do cliente, o botão "Copiar código Pix" é gerado pelo próprio WhatsApp quando ele reconhece o código na mensagem — como na foto enviada. Não há como forçar esse botão pelo lado da API; o que ajuda é enviar o código Pix limpo, sem caracteres extras colados nele (ideal: em linha própria).

## Detalhes técnicos
- Novo utilitário `src/lib/pixCode.ts` com `extrairPix(texto: string): string | null`, usando regex do payload EMV e validação básica de tamanho/campos.
- `src/components/inbox/ChatMessage.tsx`: no render de texto (e na legenda de mídia), se `extrairPix(msg.conteudo)` retornar código, renderizar o bloco do botão acima de `renderBotoes()`, usando tokens semânticos existentes (`border-border/40`, `hover:bg-background/60`) igual ao padrão do card de contato compartilhado.
- Cópia via `navigator.clipboard.writeText(codigoPix)` + `toast`.
- Nenhuma mudança de banco de dados, edge function ou envio.
