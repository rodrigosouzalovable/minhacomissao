# Corrigir os gargalos do aquecimento Meta e ampliar a captação de leads

## Diagnóstico confirmado hoje

- A programação atual já prevê **até 450 destinatários únicos por dia para cada número intensivo**. Para os 19 números com plano hoje, o alvo somado é **3.610 mensagens**.
- Até a auditoria, saíram **134 mensagens**: 117 para números UAZAPI e 17 para leads do Google Maps.
- Houve **808 falhas**: 798 com “Message undeliverable (#131026)” nos destinos UAZAPI e 10 por conta Meta bloqueada (`#131031`). O baixo volume não está sendo causado pelo alvo de 450, mas por destinos indisponíveis e falta de leads prontos.
- A base tem 581 empresas confirmadas com WhatsApp, porém apenas **20 estão disponíveis agora** por causa do uso recente; outras **65 aguardam verificação**.
- A reposição automática está limitada a uma busca de até 60 empresas por dia. O uso do Google está em **134 de 4.800 consultas mensais**, portanto há margem.
- O orçamento Meta de hoje está em R$ 32,36 de R$ 120; o teto não foi o motivo da parada.

## Alterações

1. **Manter a meta segura atual**
   - Preservar o máximo de 450 destinatários únicos/dia por número intensivo e o teto de 60% do tier.
   - Manter horário 08h–19h BRT, bloqueio aos domingos, somente templates UTILITY, orçamento Meta de R$ 120/dia e bloqueios reais da Meta.

2. **Parar a repetição de destinos UAZAPI inválidos**
   - Ao receber `#131026`, retirar aquele destino UAZAPI das próximas rodadas do dia, em vez de testá-lo novamente por vários números.
   - Montar a lista UAZAPI somente com números ativos, completos e sem falha recente de entrega.
   - Se o conjunto saudável acabar, continuar com leads confirmados do Google Maps, sem desperdiçar centenas de tentativas.
   - `#131031`, pagamento, banimento e demais bloqueios reais continuam pausando somente o número Meta afetado.

3. **Aumentar o estoque de leads sem aumentar a meta de mensagens**
   - Elevar a reserva desejada de 80 para **600 contatos com WhatsApp disponíveis**.
   - Usar o processo já executado a cada 10 minutos, sem criar novo agendamento.
   - Quando o estoque estiver abaixo da reserva, buscar progressivamente em vários nichos e cidades bem avaliados, deduplicando por `place_id` e telefone.
   - Limitar todo o abastecimento automático a **60 requisições Places por dia**, com trava persistida para impedir execuções simultâneas e excesso de custo.
   - Cada lote captado será verificado imediatamente no WhatsApp; também serão processados os 65 telefones atualmente pendentes.
   - Corrigir o retorno final da verificação, que hoje referencia uma instância inexistente após concluir os lotes.

4. **Distribuir o volume conforme o estoque real**
   - Recalcular cada lote usando o que falta para a meta diária, as rodadas restantes e a quantidade real de destinos saudáveis.
   - Evitar que uma sequência de falhas consuma a rodada inteira; cada número segue tentando apenas candidatos válidos até seu lote ou o limite global da execução.
   - Manter os intervalos aleatórios já existentes: 2–6 segundos dentro do lote e 1–3 minutos entre rodadas intensivas.

5. **Deixar o relatório transparente**
   - Mostrar separadamente: alvo do dia, enviados totais, enviados para leads, enviados para UAZAPI, falhas e quanto falta.
   - Informar números ativos/intensivos, estoque disponível, pendentes de verificação e principais bloqueios.
   - Assim, “17 mensagens” não será confundido com o total: aquele bloco representa somente os contatos do Google Maps.

## Custo e limites aprovados

- **Mensagens Meta:** permanece o teto atual de **R$ 120/dia**; não será aumentado.
- **Google Maps:** máximo de **60 requisições/dia**, cerca de **US$ 1,92/dia** ou **US$ 57,60 em 30 dias** no pior caso, antes da franquia gratuita do Google.
- O bloqueio mensal atual de 4.800 consultas permanece.
- Nenhum novo agendamento, polling ou canal em tempo real será criado.

## Validação

- Testar uma rodada com destinos inválidos e confirmar que cada `#131026` é descartado pelo restante do dia.
- Confirmar que o abastecimento para no limite diário, não duplica empresas e verifica os números captados.
- Conferir que as mensagens avançam entre as BMs elegíveis sem ultrapassar 450 por número, qualidade/tier, orçamento ou horário.
- Validar o relatório com os totais separados por origem e os motivos reais das interrupções.
