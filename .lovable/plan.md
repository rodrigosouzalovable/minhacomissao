

# Streaming "Desconectado" - Problema do ngrok

## Diagnóstico

O problema **nao e no server.js**. O robô está online (a verificação de status funciona via Edge Function). O problema é que o **RoboStreamViewer** faz chamadas diretas do navegador para a URL do ngrok, e o ngrok free exibe uma página de aviso (interstitial) que bloqueia a resposta JSON.

Nos logs de rede, todas as chamadas GET `/screenshot` retornam HTML do ngrok (ERR_NGROK_6024) em vez do JSON esperado com a imagem.

## Solução

Adicionar o header `ngrok-skip-browser-warning: true` nas chamadas fetch do `RoboStreamViewer.tsx`. Esse header faz o ngrok pular a página de aviso e entregar a resposta real do servidor.

## Arquivo

| Arquivo | Mudanca |
|---|---|
| `src/components/RoboStreamViewer.tsx` | Adicionar header `ngrok-skip-browser-warning: true` no fetch de `/screenshot` |

### Detalhe tecnico
Na funcao `fetchScreenshot`, alterar o fetch para incluir:
```ts
headers: { 'ngrok-skip-browser-warning': 'true' }
```

