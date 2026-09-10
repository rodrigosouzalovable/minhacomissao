# Exibir qualidade da instância ao lado da BM

## O que será feito
Na aba **Templates Meta → Status de Aprovação**, dentro do bloco **"Ver detalhes por instância"** de cada template mestre, adicionar um badge com a qualidade atual (GREEN/YELLOW/RED/SEM LEITURA) ao lado do nome da BM, para cada linha de instância.

## Onde
- `src/pages/MetaTemplates.tsx`, no `details` que lista `filhas` (linha ~1235).

## Como
- Reutilizar a função existente `qualidadeDa(inst)` e o mapa `QUALIDADE_CORES`.
- Inserir um `<Badge>` com a qualidade logo após o trecho que renderiza "BM: {bm.nome}".
- Se a instância não tiver qualidade (`saude_quality` nulo), exibir "SEM LEITURA".

## Resultado esperado
Cada linha passará a mostrar algo como:
```text
SOUZA 62 8269-3413  BM: Facebook Edna  GREEN
```
com a cor correspondente (verde/âmbar/vermelho/cinza).
