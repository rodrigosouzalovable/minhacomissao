

# Disparo automatico com intervalo randomizado

## Resumo
Adicionar um campo de configuracao de intervalo (minimo e maximo em segundos) e um botao "Iniciar" que dispara mensagens automaticamente para todos os clientes pendentes, com tempo aleatorio entre cada envio.

## Alteracoes em `src/pages/Acionamento.tsx`

### 1. Novos estados
- `autoMinSec: number` (default 10) - tempo minimo em segundos
- `autoMaxSec: number` (default 30) - tempo maximo em segundos
- `autoSending: boolean` - se o disparo automatico esta ativo
- `autoSendingRef: React.MutableRefObject<boolean>` - ref para controlar o loop async (permite parar)

### 2. UI - Campo de configuracao
Acima da tabela de clientes (dentro do card, entre os botoes de aba e a tabela), renderizar uma linha com:
- Label "Envio automático:"
- Input number para "De" (segundos minimos)
- Label "a"
- Input number para "Até" (segundos maximos)
- Label "segundos"
- Botao "Iniciar" (verde) / "Parar" (vermelho) que alterna conforme `autoSending`

```text
Envio automático: [10] a [30] segundos  [▶ Iniciar]
```

### 3. Logica de disparo automatico
- Funcao `handleAutoSend`:
  - Marca `autoSending = true`
  - Itera sobre os clientes pendentes em ordem
  - Para cada cliente:
    - Verifica se `autoSendingRef.current` ainda e true (se nao, para)
    - Chama `handleSend(originalIndex)`
    - Aguarda um tempo aleatorio entre `autoMinSec` e `autoMaxSec` segundos (usando `Math.random() * (max - min) + min`)
    - O tempo nunca e igual ao anterior (garante variacao)
  - Ao terminar ou parar, marca `autoSending = false`

- Funcao `handleStopAutoSend`:
  - Marca `autoSendingRef.current = false`
  - O loop async detecta e para

### 4. Validacoes
- Min deve ser >= 1 segundo
- Max deve ser > Min
- Deve haver pelo menos 1 mensagem salva
- Deve haver clientes pendentes

### 5. Detalhes tecnicos
- Usar `useRef` para o flag de parada (evita closure stale)
- O delay entre envios usa `new Promise(resolve => setTimeout(resolve, ms))`
- Gerar tempo aleatorio: `Math.floor(Math.random() * (max - min + 1)) + min` em segundos, converter para ms
- Para garantir que o tempo nunca repita consecutivamente, manter uma variavel local `lastDelay` e re-sortear se igual
- O botao "Iniciar" fica desabilitado se nao ha mensagens salvas ou nao ha pendentes
- Durante o envio automatico, desabilitar os botoes individuais de WhatsApp e o checkbox manual

