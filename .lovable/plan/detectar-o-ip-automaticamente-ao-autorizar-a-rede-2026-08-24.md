# Detectar o IP automaticamente ao autorizar a rede

Sim, é possível. Hoje o painel já pede o IP ao servidor, mas no seu print o campo "Seu IP atual" aparece como `...` — ou seja, o valor não chegou (a consulta ainda estava carregando ou voltou vazia), e nesse caso o botão autoriza um IP em branco e falha. A ideia é tornar a detecção confiável e automática.

## O que muda

- Ao abrir a aba **Redes autorizadas**, o sistema detecta o IP público em duas frentes:
  1. o IP visto pelo servidor na sua requisição (como já faz hoje);
  2. se o servidor não conseguir determinar, o navegador consulta um serviço público de IP como reserva.
- O campo "Seu IP atual" passa a mostrar estado real: "Detectando...", o IP encontrado, ou uma mensagem clara caso não seja possível detectar (com botão "Tentar de novo").
- O botão **Autorizar o IP atual** usa o IP já detectado e exibido, então o que é gravado é exatamente o que você vê na tela. Fica desabilitado enquanto não houver IP detectado, evitando o erro de gravar vazio.
- Depois de autorizar, a lista de redes e o status ("Esta rede já está autorizada") atualizam na hora.

## Detalhes técnicos

- `supabase/functions/ponto-ip-autorizar/index.ts`:
  - na ação `consultar`, retornar também `origem` ("servidor" ou vazio) para o front saber se precisa do fallback;
  - na ação `autorizar_atual`, aceitar um campo opcional `ip` enviado pelo cliente, validado como IPv4/IPv6 ou CIDR, e usá-lo somente quando o IP do request vier vazio. Continua restrito a admin.
- `src/pages/PontoAdmin.tsx`:
  - hook de detecção que chama a função e, se `ip` vier vazio, faz fetch em `https://api.ipify.org?format=json` como reserva;
  - estados de carregando/erro no bloco "Seu IP atual" com botão de nova tentativa;
  - `autorizarAtual` envia o IP detectado no corpo da chamada.

Nenhuma mudança de banco de dados e nenhum custo adicional de backend (uma consulta por abertura da aba).
