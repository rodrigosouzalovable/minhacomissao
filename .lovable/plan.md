# Liberar o aquecimento das BMs DICEPAY e GREENAUTO

## Diagnóstico confirmado

- As duas BMs estão ativas e seus **10 números** estão marcados para aquecimento, com credenciais da Meta disponíveis e sem quarentena ou recuperação ativa.
- O aquecimento aceita hoje qualidade **GREEN, UNKNOWN ou ainda sem leitura**. Portanto, “nome em análise” e qualidade desconhecida não são o bloqueio.
- Todos os números estão com o estado **“aguardando templates”**, e a regra atual exige estado “ativo”; por isso nenhum deles recebeu trilha hoje e não houve envio de aquecimento.
- **DICEPAY:** os 6 números já possuem ao menos um template UTILITY aprovado e liberado para leads do Google Maps.
- **GREENAUTO:** 3 dos 4 números já possuem template elegível; 1 número ainda tem os templates para leads pendentes de aprovação.
- Há apenas **41 leads disponíveis agora** e 81 aguardando verificação. O abastecimento automático já está configurado com o limite ampliado de até 150 requisições diárias.
- O orçamento do aquecimento está em **R$ 120/dia**; hoje foram usados R$ 37,60.

## Correção

1. Separar o bloqueio de campanhas do bloqueio de aquecimento:
   - “Aguardando templates” continuará impedindo campanhas comuns.
   - Para aquecimento, o número poderá entrar assim que tiver pelo menos um template UTILITY aprovado e marcado para leads.
   - Nome em análise e qualidade UNKNOWN/sem leitura serão aceitos, como solicitado.

2. Manter todas as proteções reais:
   - Continuar bloqueando YELLOW, RED, quarentena, recuperação ativa, pagamento pendente, conta bloqueada, token inválido e demais recusas reais da Meta.
   - Se a Meta recusar um número, pausar somente esse número; os demais números da BM continuam.

3. Corrigir o planejamento diário:
   - Não deixar o plano já criado por outras BMs impedir a entrada de DICEPAY e GREENAUTO no mesmo dia.
   - Criar trilha imediatamente para cada número elegível, sem esperar o planejamento da manhã seguinte.
   - Manter o alvo intensivo existente de até 450 destinatários únicos por número/dia, limitado a 60% do tier e ao orçamento global.

4. Tratar templates por número:
   - Liberar imediatamente os 9 números que já têm template elegível.
   - O quarto número da GREENAUTO entra automaticamente assim que seu template ficar APPROVED, sem intervenção manual.
   - Validar o template diretamente na Meta antes do primeiro envio para não confiar apenas no estado local.

5. Garantir destinos suficientes:
   - Acionar o abastecimento/verificação já existente quando o estoque estiver baixo.
   - Preservar deduplicação, carência de 15 dias, blacklist, supressões, nichos bloqueados e o teto atual de consultas do Google Maps.

6. Melhorar o relatório administrativo:
   - Exibir por BM e número o motivo exato quando não houver envio: sem template aprovado, sem lead disponível, orçamento, bloqueio Meta ou fora da janela.
   - Diferenciar claramente “nome/qualidade em análise — permitido” de bloqueio real.

## Validação

- Confirmar trilhas ativas hoje para os 6 números da DICEPAY e os 3 números elegíveis da GREENAUTO.
- Executar uma rodada controlada e conferir envios aceitos para leads do Google Maps por ambas as BMs.
- Confirmar que o número da GREENAUTO sem template aprovado permanece aguardando, entrando automaticamente após aprovação.
- Conferir que campanhas comuns continuam bloqueadas enquanto o estado geral estiver “aguardando templates”.
- Validar logs, relatório diário e ausência de erros na aplicação.

## Alerta de custo alto — Lovable Cloud e Meta

Esta mudança não cria novo agendamento, polling ou canal em tempo real, mas fará até **9 números adicionais** começarem a consumir mensagens Meta e consultas já programadas. O gasto continuará limitado ao teto global atual de **R$ 120/dia**, e o Google Maps continuará limitado a **150 requisições/dia** e **4.800/mês por conta antes da troca automática**. Aprovar este plano confirma a liberação desse consumo dentro dos limites existentes.
