# Controle geral da exigência de ponto

## O que será feito

- Desativar imediatamente a exigência de bater ponto em **18/09/2026 (BRT)**.
- Adicionar no topo de **Controle de Ponto** um botão administrativo para ativar ou desativar a exigência geral.
- Quando desativada, funcionários acessam o sistema normalmente e não recebem bloqueio nem lembretes de ponto.
- As permissões individuais e os registros já feitos permanecem intactos; ao reativar, voltam a valer normalmente.

## Segurança e comportamento

- Somente administradores poderão alterar o controle geral.
- O estado será salvo no banco e compartilhado entre todos os acessos.
- Alertas automáticos de ponto também respeitarão o controle geral.
- Nenhuma rotina nova, consulta repetitiva ou custo recorrente será criado.

## Detalhes técnicos

- Guardar a configuração global em `system_settings` e expor leitura autenticada e alteração administrativa protegida.
- Aplicar o estado no bloqueio global, card, lembrete flutuante, monitor de atividade e alertas diários.
- Exibir estado e ação clara na tela administrativa, com atualização imediata após a troca.
