

# Atualizar o código exibido no "Código do Robô"

## Problema

O componente `RoboCodeViewer.tsx` contém uma string hardcoded `SERVER_JS_CODE` que mostra apenas o código antigo (716 linhas), sem o endpoint `/automacao/agent` (linhas 762-1034 do `server.js` real). Por isso, quando você copia o código da aba "Código do Robô", ele vem incompleto.

## Solução

Atualizar a string `SERVER_JS_CODE` dentro de `src/components/RoboCodeViewer.tsx` para incluir todo o conteúdo do `server.js` atual (1034 linhas), incluindo:
- O endpoint `/automacao/agent` com o loop autônomo
- A função `executeAgentAction` 
- O listener de `app.listen` e `SIGINT` reposicionados após o novo endpoint

## Arquivo a modificar

| Arquivo | Ação |
|---------|------|
| `src/components/RoboCodeViewer.tsx` | Substituir o conteúdo da string `SERVER_JS_CODE` pelo código completo do `server.js` (linhas 762-1034 adicionadas antes do `app.listen`) |

