# Todo atendimento na caixa Padrão

## O que aconteceu (verificado no banco)

A mensagem "Oi" do 5562994300880 chegou normalmente na instância **Novo Mundo 3144** (registrada às 22:57 e 22:58 UTC de hoje, direção entrada). Nada foi perdido.

O motivo de você não ter visto: essa conversa (contato "Fernanda") está com a caixa de mensagens **IA**, e não na caixa **Padrão**. A lista de conversas do Inbox mostra somente as conversas da caixa aberta, então a conversa ficou fora da sua visão — e o aviso no seu WhatsApp veio da IA antiga daquela caixa ("Assuma a conversa na caixa IA").

Hoje existem 261 conversas presas na caixa IA.

## O que será feito

1. **Transferir a conversa da Fernanda (5562994300880) para a caixa Padrão** — ela aparece imediatamente na sua lista.
2. **Transferir todas as 261 conversas que estão na caixa IA para a caixa Padrão**, para que nenhum atendimento fique escondido.
3. **Impedir que novas conversas caiam na caixa IA**: quando entrar mensagem de um contato marcado na caixa IA, o sistema move a conversa para a caixa Padrão antes de processar. As demais caixas (AMARAL, AVATUS, BSA, FESTA PREMIUM, AQUECIMENTO) continuam funcionando como hoje.
4. **Atendimento por IA continua**: o plantão do IAGO já está ativo na caixa Padrão (17h–08h e fins de semana 24h), então as conversas transferidas seguem sendo atendidas pela IA no horário do plantão. A IA antiga vinculada à caixa IA deixa de receber conversas.

O aviso de sistema no WhatsApp fica com o texto atual, como você pediu.

## Detalhes técnicos

- Migração de dados: `UPDATE meta_whatsapp_contatos SET folder_id = NULL WHERE folder_id = '<caixa IA>'`.
- `supabase/functions/meta-whatsapp-webhook/index.ts`: ao resolver `_folderIdContato`, se for a caixa IA, gravar `folder_id = NULL` no contato e seguir o fluxo como caixa Padrão (afeta etiquetas, plantão IAGO e roteamento de IA).
- Nenhuma mudança nas regras de acesso às caixas nem no envio de campanhas.
