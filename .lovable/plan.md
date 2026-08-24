# Portal de Negociação: voltar ao logo antigo da Novo Mundo

## O que muda

Na página inicial do portal de negociação (`/consulta/novomundo`), o logo principal da Novo Mundo volta a ser a faixa horizontal antiga (`novomundo.com` branco), em vez do quadrado azul `nm.` atual. O selo do Inbox Meta Oficial e o seletor de credor do Envio Meta continuam com o quadrado `nm.`, que foi criado justamente para caber em espaços pequenos.

## Por que separar os logos

O logo quadrado `nm.` foi adotado recentemente para o selo do Inbox Meta Oficial porque a faixa horizontal "praticamente desaparece em tamanho pequeno". Por isso, em vez de substituir o arquivo global `logo-novo-mundo.png`, criaremos um asset exclusivo para o portal e apontaremos a configuração do portal para ele.

## Passos

1. **Recuperar o logo antigo** do histórico git (commit `a16e68f74`) e externalizá-lo como novo asset `logo-novo-mundo-portal.png`.
2. **Atualizar `src/lib/credorConfig.ts`**: no credor `novomundo`, usar `logo-novo-mundo-portal.png` para `principal` e `negociacao`.
3. **Ajustar `src/pages/PortalConsulta.tsx`**, se necessário: a faixa horizontal tem proporção diferente, então revisaremos as classes de altura/largura máxima nos 3 pontos onde o logo aparece (header, quem-somos, footer) para não ficar achatado ou cortado.
4. **Build/typecheck** para garantir que nada quebrou.
