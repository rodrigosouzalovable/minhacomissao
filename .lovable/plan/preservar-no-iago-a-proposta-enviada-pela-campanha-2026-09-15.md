# Preservar no IAGO a proposta enviada pela campanha

## Objetivo
Quando a campanha já tiver informado valores à vista e parcelado, o IAGO deve continuar exatamente essa negociação. Ele não poderá recalcular, arredondar ou apresentar uma segunda proposta diferente.

## Diagnóstico confirmado
- A mensagem do exemplo ficou salva no histórico com **R$ 144,90 à vista** ou **2x de R$ 120,75**.
- Na resposta seguinte, o IAGO consultou novamente a dívida e apresentou **R$ 241,50 à vista** ou **2x de R$ 169,05**.
- O IAGO já detecta propostas anteriores, mas hoje guarda apenas o primeiro valor encontrado e só prioriza a mensagem anterior quando não consegue calcular uma proposta pelo CPF. Quando o CPF é localizado, o novo cálculo prevalece indevidamente.

## Alterações
1. **Interpretar a proposta completa da campanha**
   - Extrair da última mensagem comercial enviada: valor à vista, quantidade de parcelas, valor de cada parcela e, quando informado, total parcelado.
   - Reconhecer os formatos dos templates atuais, inclusive `R$ 144,90`, `2x de R$ 120,75` e textos com quebras de linha.

2. **Dar prioridade absoluta à oferta já apresentada**
   - Se houver proposta válida no histórico recente, tratá-la como a proposta ativa da conversa mesmo quando o CPF e os débitos forem encontrados.
   - Impedir que o cálculo padrão de descontos substitua esses valores.
   - Orientar o IAGO a responder perguntas, confirmações e escolhas usando somente a condição já enviada.

3. **Continuar o fluxo sem repetir a proposta**
   - Para respostas como “Olá”, “Ok” ou demonstração de interesse, retomar brevemente a condição existente em vez de gerar uma nova oferta completa.
   - Se o cliente escolher à vista ou parcelado, confirmar a opção com o valor original e seguir para a pergunta sobre a data do pagamento.
   - Se o texto anterior não permitir identificar os valores com segurança, não inventar nem recalcular: encaminhar para atendimento humano.

4. **Preservar histórico e regras atuais**
   - Não alterar mensagens antigas nem condições já enviadas.
   - Manter as regras de identidade, CPF, data de pagamento, opt-out, número errado, acordo existente e escalada humana.

5. **Validar antes de publicar**
   - Criar casos de teste para proposta à vista + parcelada, somente à vista, perguntas sobre parcelas e texto sem valores confiáveis.
   - Reproduzir o caso anexado e confirmar que o IAGO mantém **R$ 144,90 ou 2x de R$ 120,75**, sem voltar aos valores calculados de **R$ 241,50 ou 2x de R$ 169,05**.
   - Publicar a função do IAGO e verificar os registros de execução.

## Resultado esperado
A proposta enviada na campanha passa a ser a fonte oficial daquela negociação. O IAGO apenas explica, confirma a escolha e coleta a data, sem oferecer condições diferentes.
