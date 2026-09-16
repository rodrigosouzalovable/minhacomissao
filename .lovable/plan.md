# Proteção de templates para contas Meta tier 250

## Objetivo

Evitar novas perdas de contas tier 250 por excesso de templates, sem alterar o comportamento atual das contas tier 2 mil ou de outros tiers.

## Situação confirmada

- A cópia automática atualmente pode processar todos os templates marcados no mesmo dia porque o limite diário global está desativado.
- O sistema já impede o envio final de templates que não sejam `UTILITY`, mas alguns caminhos manuais ainda conseguem colocá-los na fila antes do cancelamento posterior.
- O envio manual em lote chama diretamente a criação de templates e hoje pode contornar a fila gradual.
- O tier efetivo está disponível por BM/instância, porém ainda não participa da limitação de criação de templates.

## Alterações

1. **Regra fixa para tier 250**
   - Identificar o tier efetivo no servidor, usando o tier manual quando definido e o tier sincronizado da Meta nos demais casos.
   - Para cada número pertencente a uma conta tier 250, permitir no máximo **2 novas submissões de template por dia no horário de Brasília**.
   - Contabilizar a tentativa quando ela for reservada para envio, evitando que falhas ou chamadas simultâneas liberem submissões extras no mesmo dia.
   - Aplicar somente templates de **UTILIDADE (`UTILITY`)**, não reclassificados como marketing.

2. **Aplicar a proteção em todos os caminhos**
   - Cópia automática ao cadastrar ou editar uma instância.
   - Auditoria diária que completa templates faltantes.
   - Injeção de um template solicitada durante uma campanha.
   - “Aplicar template em várias instâncias”, piloto, replicação e reenvio manual.
   - Para tier 250, o que ultrapassar a cota será mantido na fila para o próximo dia permitido, em vez de ser enviado imediatamente ou perdido.

3. **Controle atômico e auditável**
   - Criar um registro diário por número para reservar cada uma das duas vagas antes da chamada à Meta.
   - Usar uma operação atômica no banco para impedir que duas execuções simultâneas ultrapassem o teto.
   - Manter a deduplicação existente por número + template e registrar origem, data BRT e resultado da tentativa.
   - Preservar janela de 07h–20h, bloqueio aos domingos, pausas por rejeição/limite e avisos já existentes.

4. **Tier 2 mil e demais tiers sem mudança**
   - Não aplicar o novo teto de 2 templates às contas tier 2 mil.
   - Manter nelas o ritmo, a fila e as validações atuais, inclusive a política atual de templates de utilidade.
   - Não criar novo agendamento nem aumentar a frequência das rotinas existentes.

5. **Retorno claro na tela**
   - Ao selecionar uma conta tier 250, informar que ela aceita somente utilidade e até 2 templates por número/dia.
   - Em ações manuais, separar o resultado entre enviados agora, já existentes e agendados para os próximos dias.
   - Ajustar a previsão de conclusão para considerar o teto diário das contas tier 250.

6. **Validação**
   - Testar uma tier 250 com mais de dois templates selecionados e confirmar apenas duas reservas no mesmo dia BRT.
   - Testar chamadas simultâneas e confirmar que não passam de duas por número.
   - Testar template não-UTILITY em fluxo automático e manual, com bloqueio antes de chegar à Meta.
   - Testar tier 2 mil e confirmar que seu comportamento permanece igual ao atual.
   - Confirmar que itens excedentes retomam no próximo dia permitido e que domingo continua bloqueado.

## Detalhes técnicos

- Centralizar a resolução do tier efetivo e a validação de categoria em helpers compartilhados pelas funções de fila, processamento e criação em lote.
- Adicionar tabela leve de reservas diárias, com acesso restrito ao serviço, índice/único por número, dia BRT e vaga, RLS e permissões explícitas.
- Adicionar função transacional de reserva que bloqueie por número/dia, conte no máximo duas vagas para tier 250 e seja idempotente por número + template.
- Encaminhar submissões manuais de tier 250 para `meta_templates_onboarding_fila`; chamadas do processador só chegam à Meta após obter uma vaga diária.
- Remover qualquer confiança em sinalizadores de “chamada interna” enviados pelo navegador; a autorização será validada no servidor.

## Impacto de custo

Sem novo cron, polling ou frequência adicional. O registro diário acrescenta somente pequenas gravações e consultas indexadas por submissão de template, com impacto esperado mínimo na Lovable Cloud.
