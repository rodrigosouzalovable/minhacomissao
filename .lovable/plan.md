# Plano: abrir a conversa correta pelo aviso de chamada autorizada

## Objetivo
Fazer com que o botão **Abrir conversa** do aviso “Cliente autorizou a chamada” abra a conversa real da cliente no Inbox Meta Oficial, mesmo quando o usuário estiver em outra aba do sistema ou já estiver dentro do próprio Inbox.

## Diagnóstico confirmado
- O aviso é gerado no contexto global de chamadas (`MetaCallContext`) quando a permissão da cliente muda para aceita.
- O botão hoje navega para `/admin/inbox-meta?contato=...&telefone=...&instancia=...`.
- O Inbox Meta tem uma lógica de link direto que lê esses parâmetros e seleciona a conversa, mas ela roda apenas uma vez por montagem da tela.
- Se o usuário já está no Inbox, a mudança de URL pode não reexecutar essa lógica; por isso a página pode mudar/ficar no Inbox sem realmente abrir a conversa.

## Correção proposta
1. Ajustar o Inbox Meta para reagir sempre que os parâmetros da URL mudarem, usando o estado de navegação atual em vez de depender de uma execução única.
2. Remover/ajustar a trava que impede múltiplas aberturas por link direto na mesma sessão da tela.
3. Garantir que, ao abrir por link direto, o Inbox:
   - localize o contato por `contato_id` ou pelo sufixo do telefone;
   - troque para a caixa/pasta correta da conversa;
   - selecione a aba correta (`Conversas` ou `Arquivados`);
   - marque a conversa como ativa na tela.
4. Centralizar a montagem do link do botão **Abrir conversa** para enviar os parâmetros necessários com segurança.
5. Manter o comportamento atual do botão de ligação: depois que a conversa abrir, o atendente poderá clicar no telefone dentro do cabeçalho da conversa para ligar.

## Validação
- Simular o clique no botão **Abrir conversa** do aviso estando fora do Inbox.
- Simular o clique estando já dentro do Inbox, inclusive com outra conversa aberta.
- Confirmar que a conversa selecionada corresponde ao telefone/contato da autorização e que o botão de ligar fica disponível no cabeçalho quando a permissão está aceita.

## Arquivos previstos
- `src/pages/InboxMeta.tsx`
- `src/contexts/MetaCallContext.tsx` se for necessário ajustar a URL/estado enviado pelo aviso
