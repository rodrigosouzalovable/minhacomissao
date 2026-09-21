# Piloto de escala da BM Greensoul

## Objetivo
Aplicar somente à BM Greensoul uma rampa controlada para buscar a evolução do tier 2.000 para 10.000, usando o processamento atual e sem reativar os seis números retirados manualmente do pool.

## Implementação
- Criar uma configuração auditável do piloto vinculada à BM Greensoul, iniciando com metas diárias de 450, 550 e 650 destinatários únicos.
- Planejar e limitar os envios pelo total agregado da BM, compartilhado entre seus números, contando cada telefone apenas uma vez na janela de sete dias.
- Manter o mix do piloto em 85–90% Google Maps e 10–15% UAZAPI, priorizando contatos ainda não usados pela BM.
- Avançar a rampa somente quando o dia anterior tiver qualidade GREEN, entrega mínima de 95%, falhas abaixo de 3% e nenhuma restrição real.
- Se as falhas ficarem entre 3% e 5%, reduzir a próxima meta em 30%; acima de 5%, pausar. YELLOW, RED, bloqueio, banimento, quarentena ou restrição comercial pausam imediatamente o piloto.
- Encerrar automaticamente o piloto quando a Meta informar tier 10.000 ou superior, sem continuar acelerando.
- Exibir no acompanhamento da BM Greensoul: situação do piloto, etapa/meta do dia, únicos enviados e entregues, respostas, falhas, qualidade, progresso em sete dias e distância operacional até 10K.

## Proteções preservadas
- Nenhum número marcado como fora do pool manualmente será reativado.
- As regras das demais BMs permanecerão inalteradas.
- Recusas e limites reais da Meta continuarão bloqueando o envio.
- Domingos e a janela de horário atual continuarão respeitados.
- Não haverá novo agendamento, consulta recorrente ou canal em tempo real; o piloto reutilizará as rotinas existentes.

## Validação
- Confirmar que somente o número ativo da Greensoul recebe a meta agregada.
- Confirmar que contatos repetidos na BM não consomem novamente a meta de únicos.
- Simular os limites de entrega, falhas e qualidade para validar avanço, redução, pausa e encerramento em 10K.
- Publicar as rotinas alteradas e verificar o estado final da aplicação.
