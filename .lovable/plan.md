# Última sincronização dos Templates HSM e execução aos sábados

## Situação confirmada

- O agendamento automático está ativo para **06h BRT**, mas atualmente roda somente de **segunda a sexta** (`0 9 * * 1-5`).
- A última execução registrada começou em **11/09/2026 às 17:18 BRT**, processou **62 instâncias** e sincronizou **1.066 templates**.
- Essa execução terminou **com falha parcial**: uma instância não pôde ser consultada por falta de permissão na Meta. As outras foram processadas.
- O botão **Sincronizar todos os templates** atualiza os templates manualmente, mas hoje não exibe a data, a hora nem o resultado da última execução.

## Alterações

1. **Mostrar a última sincronização ao lado do botão**
   - Exibir data e hora no formato brasileiro e no horário de Brasília.
   - Mostrar o resultado: concluída, concluída com ressalvas, em andamento ou falhou.
   - Informar também quantas instâncias e templates foram processados na última rotina completa.
   - Atualizar essa informação imediatamente após uma sincronização manual, sem exigir recarregar a página.

2. **Sincronizar de segunda a sábado às 06h**
   - Alterar o agendamento existente de segunda–sexta para **segunda–sábado às 06h BRT**.
   - Não criar um segundo agendamento; será alterada a rotina atual para evitar duplicidade.

3. **Registrar corretamente a sincronização manual**
   - Fazer o botão global usar a mesma rotina controlada do agendamento, em vez de executar cada instância separadamente no navegador.
   - Assim, a data, o resultado, a quantidade processada e as falhas parciais ficam registrados da mesma forma nos modos manual e automático.
   - Uma instância com erro não interromperá as demais.

4. **Validar após a alteração**
   - Confirmar no banco que o agendamento ficou ativo para segunda a sábado às 06h BRT.
   - Executar uma sincronização controlada e conferir se o horário e o resultado aparecem corretamente ao lado do botão.

## Aviso de custo da Lovable Cloud

Esta mudança acrescenta **uma sincronização completa por semana**, aos sábados, consultando atualmente cerca de 62 instâncias Meta. O impacto esperado é **baixo a moderado**, equivalente a aproximadamente 62 consultas iniciais adicionais por semana, com páginas extras somente para contas com muitos templates. Não haverá novo polling, novo cron paralelo ou consultas contínuas na tela.

## Detalhes técnicos

- Atualizar o cron de `0 9 * * 1-5` para `0 9 * * 1-6`.
- Reutilizar `meta-templates-sync-diario` com execução forçada e autenticação administrativa para o botão manual.
- Expor à tela somente o resumo seguro de `meta_templates_sync_state`, mantendo detalhes sensíveis de falhas protegidos.
- Ajustar `ConfigurarMeta.tsx` para mostrar o horário em `America/Sao_Paulo` e recarregar o resumo após a execução manual.
