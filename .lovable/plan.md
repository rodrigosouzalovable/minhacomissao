# Corrigir a atualização do resultado das campanhas

## O que será feito

1. **Identificar a falha real antes de mudar o tempo de espera.** Reproduzir o clique em “Atualizar” na campanha CNAO 4 e registrar o código e a mensagem técnica da solicitação, sem mostrar dados sensíveis. O aviso “Não foi possível calcular agora” é genérico: hoje a tela oculta erros que não são do tipo esperado. Portanto, a captura enviada não comprova, por si só, que houve timeout.
2. **Corrigir a causa encontrada.** Se for demora, otimizar a apuração no banco e só então ajustar o limite de tempo necessário; se for permissão, consulta ou outra falha, corrigir essa causa. Manter a contagem de pessoas distintas, a janela de 72 horas após cada envio e os acordos em até 15 dias, sem arredondar respostas incorretamente nem iniciar envios.
3. **Tornar a atualização confiável na tela.** Manter “Calculando…” enquanto a solicitação estiver em andamento, impedir cliques duplicados, preservar os últimos números válidos se houver falha e exibir um aviso claro que permita diferenciar demora de erro de cálculo. Após sucesso, atualizar números e horário da apuração.
4. **Conferir o resultado.** Testar o clique na CNAO 4 e em uma campanha encerrada, comparando enviados, respostas, pessoas distintas e percentual; verificar também falha simulada e apresentação em tela pequena.

## Situação confirmada

A CNAO 4 está em andamento: o contador atual no banco registra 712 enviados, mas a última apuração salva considerou 312 envios, 121 respostas, 77 pessoas e 24,68%, às 11h56 BRT. A tela chama diretamente a apuração ao clicar e troca erros não reconhecidos pelo aviso genérico da imagem. A função atual cruza destinatários com mensagens e acordos; há índices parciais para essas buscas, mas ainda não há evidência de que o erro específico tenha sido causado por tempo excedido.

## Detalhes técnicos e custo

Investigar a resposta da RPC `envio_meta_job_resultado_calcular` para o job `12825b2f-bf44-48ef-b00a-927068b41c08`. Usar o código SQL/PostgREST e, se for lentidão, plano de execução e índices compatíveis com o filtro por sufixo de telefone e intervalo temporal. Evitar aumentar o timeout global ou refazer apurações automaticamente. Preservar autorização e isolamento existentes.

**Alerta de custo Lovable Cloud:** a apuração é feita apenas sob clique e no relatório diário existente. Uma otimização pontual de índice pode ocupar armazenamento e ter custo de escrita baixo; não haverá novo agendamento, polling ou consultas repetidas. A aprovação deste plano autoriza apenas essa mudança pontual, se o diagnóstico a exigir.
