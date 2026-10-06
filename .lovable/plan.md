# Link do botão sempre atualizado

## Resultado esperado
- O destino do botão será exatamente o endereço informado no campo **Link do botão (URL dinâmica)**, inclusive caminho, parâmetros e fragmento.
- Ao salvar uma alteração, o novo endereço valerá para testes, novas campanhas e mensagens ainda não enviadas das campanhas em andamento que usam esse modelo e pertencem ao usuário autorizado.
- Mensagens já enviadas não podem ter seus botões alterados. Uma mensagem cuja solicitação já saiu para a Meta também pode manter o endereço anterior.

## O que foi confirmado
- O campo salva o endereço nos registros do modelo, mas cada destinatário da campanha também guarda uma cópia do link original.
- Os processos de envio utilizam essa cópia antes do endereço salvo no modelo. Portanto, apenas salvar o modelo não atualiza o link de campanhas iniciadas.
- Já existem redirecionamento para links antigos e testes para o endereço `https://w.app/czafpg`.

## Alterações
1. **Salvar e aplicar a alteração:** tornar o salvamento consistente, respeitando a propriedade dos modelos e das campanhas; confirmar sucesso somente quando o novo link estiver disponível para os próximos envios, sem atualizações parciais silenciosas.
2. **Atualizar campanhas em andamento:** aplicar o novo destino às mensagens ainda não enviadas do modelo correspondente, incluindo envio sequencial e paralelo, sem modificar destinatários, ordem, contadores ou mensagens concluídas. Evitar que lotes já carregados reutilizem uma cópia antiga depois da confirmação do salvamento.
3. **Garantir o destino correto:** validar o endereço completo e a combinação com a URL registrada na Meta. Quando houver passagem por `meusacordos.com.br`, redirecionar ao destino informado sem perder parâmetros. Se a base de um modelo impedir esse resultado, bloquear o envio com explicação clara em vez de enviar um link incorreto.
4. **Mesma regra nos testes e na prévia:** usar o destino efetivo que será enviado, sem recorrer silenciosamente a um endereço antigo. Antes de iniciar um teste ou campanha, aplicar o endereço atual do campo.

## Validação
- Testar troca de endereço A → B → C: novos testes, novas campanhas e mensagens pendentes devem usar a última alteração salva.
- Testar campanhas sequenciais e paralelas, cópias do modelo em várias instâncias e isolamento entre usuários/modelos.
- Confirmar que mensagens enviadas permanecem intactas e que URLs com parâmetros, caracteres escapados e fragmentos são preservadas.
- Conferir o fluxo na prévia sem enviar mensagens reais a clientes.

## Detalhes técnicos
- Centralizar a resolução do destino nos helpers existentes e ajustar o salvamento em `EnvioMeta`, a persistência autorizada e os caminhos de envio necessários.
- Usar atualização transacional e leitura do destino vigente no ponto de envio, reaproveitando consultas existentes; sem novo cron, polling ou varredura recorrente.
- Adicionar testes de regras junto aos testes existentes de URL e redirecionamento.
- Disponibilizar as funções alteradas após validação. A correção de redirecionamento no domínio público dependerá da publicação da atualização do site; não publicar sem solicitação.