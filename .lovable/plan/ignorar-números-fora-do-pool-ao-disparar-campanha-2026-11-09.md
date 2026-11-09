# Ignorar números fora do pool ao disparar campanha

## O que muda para você
Ao clicar em disparar, se algum número marcado estiver fora do pool, a campanha **não para mais**. O sistema tira esse número só desta campanha e começa com os outros. Aparece um aviso amarelo dizendo quais números ficaram de fora (ex.: "1 número fora do pool foi ignorado: SOUZA 62 8265-3263").

- Se **todos** os números marcados estiverem fora do pool, a campanha não começa e aparece um aviso explicando o motivo.
- A seleção na tela continua como está, e nenhum número é ativado no pool sem você pedir.
- Qualidade, limites, intervalos e rodízio continuam iguais.

## Detalhes técnicos
- `src/pages/EnvioMeta.tsx` (cerca da linha 1331): em vez de `return toast.error(...)`, calcular `foraDoPool`, mostrar `toast.warning` com até 5 nomes e usar `idsOk = filteredInstanciaIds.filter(id => !foraDoPool.includes(id))`. Se `idsOk` ficar vazio, mostrar erro e parar.
- Conferir se o restante da função usa `idsOk` (e não `instanciaIds`/`filteredInstanciaIds`) para montar a campanha e os limites diários; ajustar onde for preciso.
- O servidor continua conferindo os bloqueios reais.
