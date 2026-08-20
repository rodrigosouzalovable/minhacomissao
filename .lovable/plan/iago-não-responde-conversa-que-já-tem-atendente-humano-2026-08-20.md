# IAGO não responde conversa que já tem atendente humano

## O que foi verificado

O telefone 64 98122-3751 existe em **duas conversas** do mesmo número comercial "4 WORK B1":

- uma na caixa Padrão (número oficial Meta) com a etiqueta **Atendente: Wallace Maciel**;
- outra na caixa **AQUECIMENTO** (o mesmo número espelhado pela UAZAPI), criada às 11:51, que recebeu a etiqueta **Atendente: Iago Ribeiro de Souza**.

Como o IAGO só olha as etiquetas da conversa em que a mensagem chegou, ele não viu o Wallace e atendeu na conversa espelhada.

## O que será feito

1. **Atendente humano vinculado = IAGO calado**
   - Antes de qualquer resposta, o IAGO passa a verificar se **o mesmo telefone** (comparação pelos últimos 8 dígitos, em qualquer caixa/instância) já tem etiqueta de atendente humano.
   - Se tiver, ele não envia nada: apenas registra a mensagem, cancela follow-up e encerra. Nada de proposta, nada de pedido de CPF.
   - Só continua atendendo quando o único atendente vinculado ao número for ele mesmo.

2. **Fim da retomada após 10 minutos quando há atendente humano na etiqueta**
   - Hoje, passados 10 minutos sem resposta humana, o IAGO reassume a conversa. Isso deixa de valer quando a conversa (ou o mesmo telefone em outra caixa) está etiquetada com um atendente humano.
   - A regra dos 10 minutos continua existindo apenas para conversas que são realmente do IAGO (etiqueta dele), como proteção contra respostas duplicadas.

3. **Follow-up também respeita a regra**
   - O toque de retomada automático não é disparado para números que tenham atendente humano vinculado.

## Detalhes técnicos

- `supabase/functions/_shared/iago.ts`: nova função que, dado o `contato_id`, resolve o telefone e busca todas as etiquetas `Atendente: %` de todos os contatos com o mesmo sufixo de 8 dígitos, retornando se existe atendente diferente do IAGO.
- `supabase/functions/iago-atendimento/index.ts`: usar essa checagem logo após a validação de etiqueta (linha ~88) e condicionar o bloco de retomada de 10 minutos (linhas ~313–350) à ausência de atendente humano.
- `supabase/functions/iago-followup-tick/index.ts`: mesma checagem antes de enviar o toque.
- Sem novas tabelas, sem cron novo e sem polling — apenas uma consulta leve extra por mensagem recebida. Custo praticamente inalterado.
