# IAGO: número errado — agradecer e encerrar

Quando o cliente responde dizendo que não é a pessoa procurada ("eu não sou o Roger", "número errado", "não conheço"), o IAGO hoje segue o roteiro e pede o CPF citando a Novo Mundo. Isso vai mudar.

## Novo comportamento

- O IAGO reconhece a negação de identidade (não sou / não é meu nome / número errado / não conheço essa pessoa / pessoa errada, com ou sem acento).
- Responde uma única mensagem curta e educada, agradecendo e encerrando. Exemplo: "Entendi, obrigado pela atenção e desculpe o incômodo. Tenha um bom dia!"
- Nessa resposta: nada de CPF, nada de citar o credor/Novo Mundo, nada de valores ou proposta.
- Depois disso a conversa fica encerrada para o IAGO: sem follow-up e sem novas respostas automáticas, mesmo que chegue outra mensagem nesse número.
- A conversa recebe a etiqueta "Aguardando Humano" para você poder revisar e, se quiser, corrigir o telefone no cadastro. Sem aviso no WhatsApp (não é uma negociação).
- Se o cliente depois disser que na verdade é ele mesmo, o atendimento não é retomado automaticamente — o atendente humano assume.

## Detalhes técnicos

- `supabase/functions/_shared/iago.ts`: nova função `ehNumeroErrado(texto)` com regex tolerante a acentos, cobrindo "nao sou o/a X", "nao e meu nome", "numero errado", "nao conheco", "pessoa errada", "engano".
- `supabase/functions/iago-atendimento/index.ts`: checagem logo após o opt-out (antes de resolver CPF/proposta). Ao detectar: envia uma mensagem de encerramento (texto curto e educado, sem IA e sem menção ao credor), grava `etapa='numero_errado'`, `aguardando_humano=true`, `followup_em=null`, `followup_feito=true` em `iago_conversa_estado`, aplica a etiqueta "Aguardando Humano" e retorna.
- A guarda de silêncio já existente para `aguardando_humano` impede novas respostas automáticas nessa conversa.
- Reforço no prompt (`gerarResposta`): se o cliente negar a identidade, responder apenas agradecendo e encerrar, sem pedir CPF nem citar o credor.
- Sem migração de banco, sem cron novo e sem custo adicional (a checagem é local, antes de qualquer chamada de IA — na prática economiza chamadas).
