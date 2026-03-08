

# Reordenar seções da página AutomacaoCobMais

## Ordem atual (linhas 686-1200)
1. Configuração + Console de Comandos (grid 2 colunas)
2. Streaming do Robô
3. Código do Robô (server.js)
4. Conhecimento Aprendido
5. Conversar com a IA
6. Fila & Logs

## Nova ordem desejada
1. Configuração + Console de Comandos *(sem mudança)*
2. **Conversar com a IA** *(mover de 5º para 2º)*
3. Streaming do Robô *(sem mudança relativa)*
4. Conhecimento Aprendido *(sem mudança)*
5. Código do Robô *(mover de 3º para 5º)*
6. Fila & Logs *(sem mudança)*

## Mudança

### `src/pages/AutomacaoCobMais.tsx`

Reorganizar os blocos JSX após o grid de config+console (linha 849) na seguinte ordem:

1. Chat com IA (atualmente linhas 955-1119)
2. Streaming (linhas 851-856)
3. Conhecimento Aprendido (linhas 862-953)
4. Código do Robô (linha 859)
5. Fila & Logs (linhas 1121-1200)

É apenas uma reorganização de blocos — nenhum código novo, nenhuma lógica alterada.

