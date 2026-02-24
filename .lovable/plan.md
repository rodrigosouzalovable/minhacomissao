

# Correções e melhorias no envio automático

## Problemas identificados

1. **Mensagens enviando sem clicar "Iniciar"**: O usuário reporta que mensagens estão sendo enviadas mesmo com o botão "Iniciar" visível. Isso pode estar acontecendo porque ao carregar um histórico, os `sendStatus` do localStorage ainda mostram clientes como pendentes, mas a função `handleSend` pode estar sendo chamada por outro caminho. Preciso investigar se há algum `useEffect` ou trigger automático — revisando o código, não encontrei nenhum. É provável que o problema seja que o envio via WhatsApp individual (botão do ícone WhatsApp na tabela) esteja sendo confundido com envio automático. A correção principal aqui é garantir que os clientes que já tiveram `sendStatus = 'success'` persistido no localStorage apareçam corretamente na aba "ENVIADOS" ao recarregar a página.

2. **Clientes já enviados permanecem em "A ENVIAR"**: Ao recarregar a página ou trocar de histórico, os sendStatus são restaurados do localStorage, e os `useMemo` já filtram corretamente. No entanto, pode haver inconsistência entre dados persistidos. Preciso garantir que a restauração está completa.

3. **Envio automático deve persistir ao sair da página**: Atualmente, ao navegar para outra página, o componente desmonta e o loop async é cancelado. Para manter o envio ativo ao sair e voltar, preciso usar um mecanismo fora do ciclo de vida do componente — persistir o estado de "autoSending" no localStorage e retomar ao voltar.

## Alterações em `src/pages/Acionamento.tsx`

### 1. Persistência do envio automático entre navegações
- Salvar no localStorage quando o envio automático está ativo: flag `acionamento_auto_sending`, junto com `autoMinSec`, `autoMaxSec`, e o índice atual do loop
- Ao montar o componente, verificar se havia um envio em andamento e retomá-lo automaticamente
- Novo estado `autoResuming` para indicar que está retomando um envio anterior
- Guardar o `activeHistoricoId` junto para saber qual planilha estava sendo processada

### 2. Garantir que clientes enviados apareçam em "ENVIADOS"
- Ao carregar um histórico (`handleLoadHistorico`), restaurar sendStatus, manualChecked e sendTimestamps do localStorage — isso já acontece, mas vou verificar se a restauração está correta
- Ao montar, se houver um `activeHistoricoId` salvo, restaurar automaticamente os dados

### 3. Lógica de retomada do envio automático
- Ao montar, se `localStorage` tiver `acionamento_auto_sending = true`:
  - Restaurar os dados do histórico ativo
  - Chamar `handleAutoSend()` automaticamente para retomar o envio
  - O `handleAutoSend` já calcula o snapshot de pendentes, então retomará de onde parou (clientes já marcados como `success` serão filtrados)

### 4. Detalhes técnicos
- Novas constantes: `AUTO_SENDING_KEY = 'acionamento_auto_sending_state'`
- Formato salvo: `{ active: boolean, historicoId: string, minSec: number, maxSec: number }`
- No `handleAutoSend`: salvar estado no localStorage ao iniciar
- No `handleStopAutoSend` e ao finalizar: limpar estado do localStorage
- `useEffect` no mount: verificar se há envio pendente e retomar
- Não mudar para aba "enviados" automaticamente ao parar — só mudar quando o usuário clicar em "Parar" explicitamente ou quando terminar todos

