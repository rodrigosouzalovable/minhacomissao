# Corrigir IAGO quando cliente envia CPF na conversa UME

## O que foi confirmado

- A conversa da Maristela está marcada no cabeçalho com credor **UME**.
- A cliente enviou o CPF `03409213155` às 08:59.
- O backend já conseguiu consultar esse CPF na calculadora UME e existe retorno válido em cache para Maristela, com dívida atualizada de R$ 1.717,00.
- O estado do IAGO nessa conversa ficou sem CPF gravado, e a mensagem "Fico no aguardo do envio do seu CPF" foi enviada depois do CPF já ter chegado.
- A causa prática é uma corrida de mensagens: o IAGO começou a responder a mensagem anterior, esperou a janela de segurança de 20s, mas não recarregou a última entrada do cliente antes de decidir a resposta. Assim, o CPF que chegou durante essa espera não entrou na consulta UME daquela execução.

## Correção proposta

1. **Recarregar a última mensagem antes de responder**
   - Depois da espera de segurança de 20s, o IAGO vai buscar novamente as mensagens recentes da conversa.
   - Se o cliente enviou algo novo nesse intervalo, o IAGO passa a usar essa mensagem mais recente como base da resposta.

2. **Capturar CPF no histórico recente, não só na mensagem do gatilho**
   - Antes de pedir CPF, o IAGO vai procurar CPF/CNPJ nas últimas mensagens de entrada do cliente.
   - Se encontrar um documento válido, grava no estado da conversa e segue para a consulta, em vez de perguntar novamente.

3. **Fluxo obrigatório para credor UME**
   - Quando o credor resolvido da conversa for UME e houver CPF, o IAGO deve consultar a calculadora UME antes de gerar qualquer resposta.
   - Se a calculadora retornar dados válidos, a resposta deve sair com a proposta UME.
   - Se não encontrar o CPF na UME, aí sim segue o fallback atual: consultar dados internos ou escalar/solicitar conferência conforme o caso.

4. **Evitar pergunta duplicada de CPF**
   - Se o histórico mostra que o cliente já enviou um CPF, o prompt do IAGO será reforçado para proibir pedir CPF novamente.
   - Caso a consulta esteja em andamento ou falhe temporariamente, a resposta não deve ser "envie seu CPF"; deve escalonar ou informar que vai conferir, conforme o erro.

## Validação

- Testar a mesma sequência do print: cliente responde "Sim" e logo depois envia CPF durante a espera do IAGO.
- Confirmar que o IAGO grava o CPF no estado da conversa.
- Confirmar que a calculadora UME é chamada e a proposta sai com os valores do CPF enviado.
- Confirmar que a mensagem "Fico no aguardo do envio do seu CPF" não é enviada quando o CPF já aparece no histórico.

## Detalhes técnicos

- Arquivo principal: `supabase/functions/iago-atendimento/index.ts`.
- Ajustar o ponto logo após a espera de 20s para recarregar histórico/última entrada antes do bloco de contexto financeiro.
- Criar/usar uma busca de documento nas entradas recentes, priorizando a mensagem mais nova do cliente.
- Manter a lógica já existente da calculadora UME (`consultarUme` + `propostaDaUme`) e apenas garantir que ela seja acionada no momento correto.
- Sem novo cron, sem polling e sem nova tabela; impacto de custo praticamente nulo.
