# Corrigir o credor nas mensagens automáticas

## O que aconteceu
- O cliente Weder (CPF 040.322.661-90) tem um acordo ativo com a **Novo Mundo**.
- A mensagem de hoje (16h19, lembrete de boleto da campanha urgente) foi com "UME". Essa campanha foi montada a partir da planilha que a UME enviou, e o credor foi pego da planilha em vez do acordo cadastrado no sistema.
- A rotina automática diária (aviso da véspera, às 09h30) já usa o credor do acordo, então não tem esse erro. Não houve envio dela ainda.

## O que vou fazer
1. **Levantar quem recebeu errado:** comparar os 165 contatos da campanha de hoje com o credor do acordo ativo de cada CPF e listar os casos que não batem.
2. **Proteção nas campanhas com CPF:** antes de cada envio que tenha CPF, o sistema vai procurar o acordo ativo do cliente e usar o credor desse acordo na mensagem (variável do credor e escolha do template no modo com vários credores). Se o acordo for de outro credor, vale o acordo. Sem acordo ativo, continua como está hoje.
3. **Mensagem de correção (opcional, só se você aprovar):** mandar aos clientes que receberam o credor errado um lembrete com o credor certo, usando o mesmo template Utility aprovado. O custo é de 1 mensagem por cliente afetado.
4. **Testes:** criar testes para garantir que acordo Novo Mundo sai como "NOVO MUNDO", UME como "UME" e Odres como "ODRES CRED", mesmo quando a planilha diz outra coisa.

## Detalhes técnicos
- Na função de envio em massa (o mesmo lugar que já resolve o template por credor), buscar `acordos.empresa` do acordo ativo pelo CPF (com e sem pontuação), mapear `ume_novo_mundo→novo_mundo/NOVO MUNDO`, `mundo_da_moda→ume/UME`, `odres_cred→odres_cred/ODRES CRED`, e sobrescrever `credor` e a variável do credor do item.
- Uma busca por lote, não por contato, sem novas rotinas agendadas e sem custo extra contínuo.
