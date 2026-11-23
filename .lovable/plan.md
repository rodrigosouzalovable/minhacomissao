# Ocultar "mínimo R$ 100" do portal de negociação

O sistema continua aplicando a parcela mínima de R$ 100 (a lista de parcelas só mostra opções válidas), mas o cliente deixa de ver esse valor escrito.

## O que muda na tela do cliente
- Cartão "Parcelado": "Até 18x · mínimo R$ 100" vira apenas "Até 18x".
- Campo de parcelas (portal antigo de consulta): "Número de parcelas (mínimo R$ 100 por parcela)" vira "Número de parcelas".
- Aviso de erro "todas as parcelas a partir de R$ 100" vira "Escolha uma quantidade de parcelas válida".
- Perguntas frequentes do portal: remover "de no mínimo R$ 100" das respostas sobre condições.

## O que fica igual
- Regra interna de R$ 100 por parcela e cálculo das opções.
- Entrada opcional (Novo Mundo): o texto "mínimo R$ 100" da entrada também será retirado, mantendo a validação com mensagem neutra ("valor de entrada inválido").

## Arquivos
- src/components/portal/PortalWalletSection.tsx
- src/components/portal/PublicPortalHome.tsx
- src/pages/ConsultaResultado.tsx
