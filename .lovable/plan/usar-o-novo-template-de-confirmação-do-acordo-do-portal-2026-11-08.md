# Usar o novo template de confirmação do acordo do portal

## O que muda para você
Quando o novo template `confirmacao_formalizacao_acordo` for aprovado pela Meta, o cliente que fechar acordo pelo portal passa a receber:

"Olá, {nome}! Confirmamos a formalização do seu acordo com {credor} em seu CPF {CPF}! Condição registrada: {condição}. Caso precise de suporte ou da segunda via do seu boleto/PIX, estamos à disposição por este canal ou em nosso portal de negociação."

- Troca automática: enquanto o novo não estiver aprovado em nenhuma instância saudável, o sistema continua usando o template antigo (`confirmacao_acordo_portal`). Nenhum cliente fica sem confirmação.
- Continua começando pelo NOVO MUNDO 3144, com as mesmas regras de hoje: até 4 tentativas em outras instâncias saudáveis, número exclusivo da Odres Cred para acordos Odres, etiqueta do Rodrigo nos acordos à vista e aviso ao admin se nada for entregue.
- O novo template só é usado nas instâncias onde ele já foi aprovado; nas outras, a tentativa usa o antigo.

## Como as variáveis serão preenchidas
- {{1}} Nome: primeiro nome do cliente (como hoje).
- {{2}} Credor: "a Novo Mundo", "a UME" ou "a Odres Cred" (o texto fica "com a Novo Mundo").
- {{3}} CPF: CPF completo formatado (000.000.000-00), conforme você definiu.
- {{4}} Condição: "1 parcela no valor de R$ 2.414,00, com vencimento em 07/11/2026" ou "6 parcelas mensais de R$ 157,06, com primeiro vencimento em 07/11/2026".

## Detalhes técnicos
- `_shared/portal-confirmacao-cliente.ts`: buscar candidatas com os dois nomes de template aprovados, preferindo o novo na mesma instância; montar `vars` conforme o template escolhido; o webhook de reenvio reconhece os dois nomes.
- `portal-efetivar-acordo`: passar o CPF para `enviarConfirmacaoPortal`.
- Teste em `portal-confirmacao-rules.test.ts`: preferência do novo template, volta ao antigo quando não aprovado, e texto da condição para 1x e parcelado.
- Sem nova rotina automática ou consulta periódica: custo inalterado.
