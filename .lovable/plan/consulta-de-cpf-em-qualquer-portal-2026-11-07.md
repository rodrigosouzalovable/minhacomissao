# Consulta de CPF em qualquer portal

## O que muda
- A busca de CPF em **meusacordos.com.br** e em **meusacordos.com.br/odrescred** passa a consultar as três carteiras: Novo Mundo, UME e Odres Cred.
- Se o CPF for da Odres Cred e o cliente pesquisar no portal principal, a negociação da Odres aparece normalmente (e vice-versa para Novo Mundo/UME no portal da Odres).
- Cada carteira continua aparecendo em um bloco separado, com negociação independente — nada é misturado entre credores.

## O que continua igual
- Visual de cada portal: o principal segue com as marcas Novo Mundo e UME; o /odrescred segue só com a marca Odres Cred, textos e rodapé próprios.
- Regras de negociação, valores, parcelas (incluindo o aviso de parcelas mensais da Odres), descontos e envio para o WhatsApp.

## Detalhes técnicos
- `src/lib/portalEscopo.ts`: adicionar lista `credoresConsulta` (sempre `['novo_mundo','ume','odres_cred']`), mantendo `credores` apenas para marcas/visual.
- `src/components/portal/PublicPortalResults.tsx`: usar `credoresConsulta` para carregar e exibir as carteiras.
- Atualizar `src/lib/portalEscopo.test.ts`: ambos os escopos consultam as três carteiras; marcas continuam separadas.
- Sem mudanças no banco nem custo adicional relevante (apenas uma consulta a mais por busca).
