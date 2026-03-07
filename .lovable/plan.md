

# Remover limite de iterações do agente

O erro "Agente atingiu limite de iterações" acontece porque o agente tem um cap fixo (30 iterações). Você quer remover isso para treinar a IA sem interrupções.

## Mudança

### `server.js`

Remover o limite fixo de iterações. Em vez de `MAX_ITERATIONS = 30`, usar apenas o timeout de 5 minutos como proteção. O loop `for` vira um `while(true)` controlado pelo timeout e pelo flag de abort.

- Linha 779: remover `MAX_ITERATIONS`
- Linha 824: trocar `for (let i = 0; i < MAX_ITERATIONS; i++)` por `for (let i = 0; ; i++)` (loop infinito controlado pelo timeout que já existe na linha 830-847)
- Linha 849: remover `/${MAX_ITERATIONS}` da mensagem de status
- Linhas 1024-1032: remover o bloco "Max iterations reached" — agora o loop só termina por: `done`, `error`, `abort`, `timeout`, ou `confiança baixa`

O timeout de 5 minutos (linha 830-847) continua como proteção contra loops infinitos.

