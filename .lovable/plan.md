

# Transferir clientes automaticamente para "ENVIADOS" durante envio automático

## Análise

Revisando o código atual, a lógica de transferência **já existe**: quando `handleSend` marca `sendStatus[index] = 'success'`, o `useMemo` recalcula `pendentes` e `enviados` automaticamente, movendo o cliente entre as listas.

Porém, durante o envio automático o usuário permanece na aba "A ENVIAR" e não vê os clientes aparecendo na aba "ENVIADOS" em tempo real. Para melhorar a experiência:

## Alterações em `src/pages/Acionamento.tsx`

### 1. Mudar automaticamente para a aba "ENVIADOS" ao finalizar o envio automático
- No final de `handleAutoSend`, após o loop, chamar `setActiveTab('enviados')` para que o usuário veja os resultados.

### 2. Mostrar progresso em tempo real durante o envio
- Enquanto `autoSending` estiver ativo, exibir um indicador na aba "A ENVIAR" mostrando o progresso (ex: "Enviando... 5/20").
- Adicionar um estado `autoProgress` com `{ current: number, total: number }` que é atualizado a cada iteração do loop.
- Exibir esse progresso ao lado do botão "Parar".

### Detalhes técnicos
- Novo estado: `autoProgress: { current: number; total: number } | null`
- No loop de `handleAutoSend`, antes de cada `handleSend`, atualizar `setAutoProgress({ current: i + 1, total: pendentesSnapshot.length })`
- Ao finalizar ou parar, limpar com `setAutoProgress(null)` e mudar para aba "ENVIADOS"
- Na UI, quando `autoProgress` não for null, mostrar texto "Enviando {current}/{total}..." ao lado do botão Parar

