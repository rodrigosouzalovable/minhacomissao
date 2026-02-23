
# Persistir lista de clientes e status de envio entre navegacoes

## Problema atual
Ao sair da pagina de Acionamento e voltar, a lista de clientes desaparece e o status de envio (quem ja foi acionado) se perde. Os dados so existem em memoria (estado React).

## Solucao

### Alteracoes em `src/pages/Acionamento.tsx`

1. **Persistir a planilha ativa**: Ao carregar a pagina, verificar no `localStorage` qual e o `activeHistoricoId` salvo (nova chave `acionamento_ativo`) e automaticamente carregar os clientes daquela planilha do historico.

2. **Persistir o status de envio**: Salvar o `sendStatus` no `localStorage` (nova chave `acionamento_send_status`) associado ao ID da planilha ativa. Sempre que o status de um cliente mudar (sucesso/erro), atualizar o localStorage. Ao recarregar a planilha do historico, restaurar os status salvos.

3. **Lista so desaparece ao excluir**: Remover qualquer logica que limpe a lista de clientes ao navegar. A lista so sera limpa quando o usuario excluir a planilha no historico de importacoes.

### Detalhes tecnicos

- Nova constante `ACTIVE_KEY = 'acionamento_ativo'` e `SEND_STATUS_KEY = 'acionamento_send_status'`
- No `useEffect` inicial: alem de carregar historico e mensagem, carregar o `activeHistoricoId` do localStorage, buscar a planilha correspondente no historico e setar os clientes e o sendStatus
- No `handleSend`: apos atualizar o `sendStatus` no estado, tambem salvar no localStorage com a chave composta pelo ID da planilha
- No `handleFileUpload` e `handleLoadHistorico`: salvar o `activeHistoricoId` no localStorage e limpar/carregar o sendStatus correspondente
- No `handleDeleteHistorico`: limpar o `activeHistoricoId` e `sendStatus` do localStorage quando a planilha ativa for excluida
