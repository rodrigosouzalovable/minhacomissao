# Relatório matinal e metas de aquecimento por tier

## Objetivo
Enviar todas as manhãs ao WhatsApp do administrador um resumo do plano de aquecimento do dia e ajustar o volume conforme o limite real de cada número.

## O que foi confirmado
- O planejamento diário já roda às **07:00 BRT**.
- Atualmente, todos os números abaixo de 10 mil entram no mesmo modo intensivo, limitado a 60% do tier. Por isso, um número de tier 250 pode receber meta de **150 mensagens/dia**, acima do fluxo solicitado.
- Hoje existem números selecionados sem plano por falta de template UTILITY aprovado para leads; qualidade `UNKNOWN` ou nome em análise, isoladamente, não impedem o aquecimento.
- Não existe hoje um relatório matinal consolidado com a quantidade programada por número.

## Alterações

### 1. Metas por faixa de tier
- **Tier 250:** programar **25 mensagens por número/dia**, dentro da faixa solicitada de 20–30.
- **Tier 2.000 até abaixo de 10.000:** manter fluxo intensivo de até **450 mensagens por número/dia**.
- **Tier 10.000 ou superior:** manter a regra adaptativa atual, respeitando histórico, qualidade, limite do número e orçamento.
- Usar o tier mais recente conhecido e corrigir trilhas criadas com tier antigo quando o planejamento do dia rodar novamente.
- Aplicar a mesma regra tanto no planejamento das 07h quanto na criação automática de uma trilha durante o dia, evitando metas diferentes para o mesmo tier.

### 2. Relatório matinal no WhatsApp
Após o planejamento das 07h, enviar uma única mensagem consolidada contendo:
- data e total programado para o dia;
- BM, nome/número remetente, tier atual e meta diária de cada número;
- divisão prevista entre leads Google Maps e destinos UAZAPI;
- números selecionados que não entrarão no dia e o motivo exato, como falta de template, pausa da Meta, quarentena, recuperação ou qualidade YELLOW/RED;
- orçamento diário disponível e aviso de que a quantidade é uma meta programada, podendo ser menor se faltar lead elegível ou surgir bloqueio real da Meta.

O relatório será enviado somente ao WhatsApp administrativo já usado pelos avisos do aquecimento, com proteção contra mensagem duplicada no mesmo dia.

### 3. Segurança e continuidade
- Continuar permitindo `GREEN`, `UNKNOWN` e nome em análise.
- Manter bloqueados YELLOW/RED, conta bloqueada, pendência de pagamento, token inválido, quarentena, recuperação e demais bloqueios reais.
- Não liberar número sem template UTILITY aprovado e marcado para leads.
- Manter o teto atual de **R$ 120/dia** e a captação do Google Maps em até **150 requisições/dia**.
- Não alterar campanhas comuns nem o sistema de recuperação.

### 4. Validação
- Reprocessar o planejamento do dia para atualizar as trilhas existentes com a nova faixa.
- Confirmar que números de tier 250 recebem meta 25 e números de tier 2.000 recebem meta até 450.
- Confirmar que o relatório lista cada BM/número uma vez, soma corretamente o total e explica todos os selecionados sem plano.
- Testar a proteção contra duplicidade e o envio ao WhatsApp administrativo.

## Impacto de custo
**Alerta de custo:** haverá uma mensagem adicional de WhatsApp por dia. O relatório reutilizará o planejamento das 07h, sem novo cron, polling ou consulta contínua; portanto, o impacto no Lovable Cloud será mínimo e controlado.
