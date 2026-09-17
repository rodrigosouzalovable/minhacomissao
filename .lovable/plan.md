# Controle manual e permanente do pool no Envio Meta

## Objetivo

Impedir que uma instância retirada manualmente no **Envio Meta → Instâncias** volte sozinha ao pool. Somente o administrador poderá devolvê-la, e o retorno dependerá de uma verificação saudável na Meta.

## Comportamento da tela

- Ao o administrador desmarcar uma instância que estava selecionada, pedir confirmação e registrar a retirada permanente do pool.
- A instância retirada continuará visível, identificada como **Fora do pool manualmente**, mas não poderá ser selecionada para campanhas nem entrar no “Selecionar todas”.
- Exibir nela o botão **Voltar para o pool**, somente para administradores.
- Ao clicar, verificar a saúde atual na Meta antes de liberar.
- Se estiver conectada, sem bloqueio/limitação, com nome aprovado e qualidade permitida, recolocar no pool e informar sucesso.
- Se houver bloqueio, limitação, nome pendente/reprovado, pausa ativa, quarentena ou qualidade não permitida, manter fora e mostrar o motivo.
- Atendentes e parceiros Meta apenas visualizam o estado; não podem retirar nem devolver instâncias.

## Regra permanente

- Registrar separadamente que a retirada foi manual, com data e administrador responsável.
- Todas as rotinas automáticas de saúde, recuperação, aquecimento e retomada de campanha deverão respeitar essa marcação.
- Uma recuperação para GREEN ou o fim de uma pausa não poderá apagar a retirada manual.
- Bloqueios reais da Meta continuam prevalecendo e nunca serão ignorados pelo botão.
- O retorno manual limpa apenas a retirada administrativa; não remove proteções legítimas da Meta.

## Implementação técnica

- Adicionar campos de auditoria em `meta_whatsapp_instances` para retirada manual do pool, data e responsável.
- Criar uma operação protegida no backend para retirar/devolver a instância, validando a função de administrador no servidor.
- Ajustar `check-meta-instance-health`, recuperação automática e seletores de instâncias para nunca reativarem uma instância marcada como retirada manualmente.
- Ajustar `src/pages/EnvioMeta.tsx` para tratar a desmarcação deliberada, mostrar o novo estado e oferecer **Voltar para o pool**.
- Antes do retorno, consultar a saúde da instância sob demanda; não será criado novo cron, polling ou custo recorrente.
- Manter round-robin, cotas por BM, ramp-up e regras de campanha existentes.

## Validação

- Confirmar que desmarcar retira a instância e persiste após atualizar a página.
- Executar uma verificação de saúde e confirmar que a instância não volta automaticamente.
- Confirmar que atendentes e parceiros não conseguem executar as operações, inclusive por chamada direta.
- Testar retorno saudável e retorno bloqueado com mensagem clara.
- Confirmar que “Selecionar todas” ignora instâncias retiradas manualmente.
- Validar compilação e o fluxo visual no Envio Meta em desktop e celular.
