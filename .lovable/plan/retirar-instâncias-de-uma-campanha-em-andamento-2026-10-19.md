# Retirar instâncias de uma campanha em andamento

## 1. Agora: retirar a Novo Mundo 3144 da campanha atual
- Na campanha em execução "acesse_o_portal_de_negociacao" (iniciada em 18/10, 48 instâncias), incluir a Novo Mundo 3144 na lista de instâncias ignoradas desta campanha.
- Os envios continuam com as outras 36 ativas. Os 181 envios já feitos por ela continuam no histórico.
- A instância não é desconectada nem retirada de outras campanhas ou do Inbox.

## 2. Botão "Retirar da campanha"
No quadro "Instâncias do disparo", em cada número da lista "Ativas (enviando)":
- Botão "Retirar" visível na linha (funciona no celular, onde não existe botão direito).
- No computador, clicar com o botão direito na linha abre um menu com a opção "Retirar da campanha".
- Antes de retirar, aparece uma confirmação com o nome do número.
- Depois de retirado, o número passa para "Ignoradas" com o motivo "retirada manual" e pode voltar com o botão "Voltar" já existente.
- Só aparece para administradores ou para quem iniciou a campanha, e só enquanto a campanha estiver rodando ou pausada.
- Se o número estiver "Enviando agora", a mensagem em andamento termina; os próximos envios já saem pelas outras.
- Não é possível retirar a última instância ativa (a campanha ficaria sem número); nesse caso o aviso sugere pausar.

## Detalhes técnicos
- Nova ação `retirar_instancia_run` na função de controle do envio Meta, ao lado de `desbloquear_instancia_run`: valida dono/admin e status do job, adiciona o id em `instancias_bloqueadas_run` com motivo "retirada manual" de forma atômica (sem sobrescrever outros bloqueios) e recusa se não sobrar instância ativa.
- `instancias_status` passa a devolver o motivo "retirada manual" como reativável.
- Contexto `EnvioMetaSendingContext`: `retirarInstanciaJob(jobId, instanciaId)`.
- `CampanhaInstanciasPanel.tsx`: botão "Retirar" + `ContextMenu` (shadcn) + `AlertDialog` de confirmação; recarrega a lista após sucesso. Sem polling novo.
- Item 1 executado com a mesma ação após o deploy (ou atualização direta do job em execução).
