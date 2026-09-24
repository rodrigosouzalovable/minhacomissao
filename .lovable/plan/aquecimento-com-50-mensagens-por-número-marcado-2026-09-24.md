# Aquecimento com 50 mensagens por número marcado

## Resultado

Alterar o limite de **50 mensagens globais por dia** para **50 mensagens por dia para cada número apto** marcado como **“Número de nova BM — entrar no aquecimento de tier”**.

Neste momento existem **7 números marcados**, mas somente **2 estão conectados, GREEN, ativos no pool e com o template `cnpj_atualizado_2` aprovado**. Portanto, a ativação inicial será de **100 mensagens hoje**, 50 por cada um desses dois números.

Os outros números não entrarão à força:
- 4 ainda não possuem o template aprovado;
- 1 possui o template, mas está RED e restrito.

## Alteração do controle diário

- Trocar o teto global por uma cota individual diária de 50 contatos por número.
- Reservar exatamente 50 contatos inéditos para cada número apto, sem simples divisão em rodízio.
- Recalcular automaticamente o total diário como `números aptos × 50`.
- Manter contadores independentes para impedir que um número ultrapasse sua própria cota.
- Se um número ficar desconectado, sair do pool, perder aprovação ou qualidade durante a campanha, interromper somente a cota dele; não transferir o saldo automaticamente para outro número.
- Um número que se tornar apto depois do início entra somente na próxima execução diária, evitando aumento inesperado no meio da campanha.

## Público e mensagem

- Manter a sequência por idade do CNPJ: D+5, D+10, D+15, D+20, D+25 e D+30.
- Usar primeiro contatos locais elegíveis; consultar a Casa dos Dados apenas para completar a quantidade necessária da faixa atual.
- Manter deduplicação por CNPJ e últimos 8 dígitos do telefone, blacklist, opt-out e bloqueio de contatos já utilizados.
- Usar exclusivamente o template aprovado `cnpj_atualizado_2`, em `pt_BR`.
- Preencher `{{1}}` com `falo com o(a) responsável por NOME DA EMPRESA?`.
- Manter intervalos aleatórios de 30 a 90 segundos e bloqueio aos domingos.

## Ativação imediata

- Atualizar o processamento e o painel para mostrar a cota por número e o total previsto.
- Validar novamente conexão, pool, qualidade e aprovação do template imediatamente antes da reserva.
- Ativar o piloto e iniciar hoje a campanha com os **2 números atualmente aptos**, totalizando **100 mensagens**.
- Não liberar o número RED nem números sem template aprovado.
- Registrar cada envio na caixa CERTIFICADO, com atendimento exclusivo da Clara para as respostas.
- Confirmar após a ativação o identificador da campanha, total reservado e as duas cotas de 50.

## Segurança e acompanhamento

- Preservar os controles de pausar, retomar e cancelar.
- Exibir resultados por número: reservadas, enviadas, entregues, lidas, respondidas, interessadas, recusas, opt-outs e transferências humanas.
- Manter o Google Maps pausado como fonte de novos leads.
- Reaproveitar a fila e o agendamento existentes, sem criar novo cron, polling ou canal em tempo real.

## Alerta de custo Lovable Cloud

Esta mudança aumenta o volume diário de 50 para **100 mensagens agora** e poderá crescer em mais 50 a cada novo número apto. Como hoje não há estoque local confirmado para a faixa D+10, a largada pode consumir consultas da Casa dos Dados e verificações de WhatsApp para formar os 100 contatos. As respostas também geram uso de IA pela Clara. Não haverá novo agendamento nem consulta periódica; o custo cresce somente com a quantidade efetivamente processada.
