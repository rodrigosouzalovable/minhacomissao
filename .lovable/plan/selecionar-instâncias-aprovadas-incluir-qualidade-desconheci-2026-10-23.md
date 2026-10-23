# Selecionar instâncias aprovadas: incluir qualidade desconhecida

## O que muda
Na aba Envio Meta, o botão **Selecionar instâncias aprovadas** passa a marcar, além das GREEN, as instâncias com qualidade **desconhecida (UNKNOWN)** ou sem qualidade lida, desde que tenham o template escolhido aprovado. Com o template "Acesse o portal de negociação", a contagem deve subir de 45 para cerca de 61.

## Continua de fora
- YELLOW e RED.
- Números internacionais, banidos, desconectados ou com bloqueio real da Meta.
- Instâncias sem o template aprovado.

## Detalhes técnicos
- `approvedGreenSelectionIds` em `src/lib/metaNationalInstances.ts`: aceitar `GREEN`, `UNKNOWN` e vazio/nulo.
- Atualizar `tests/metaApprovedGreenSelection.test.ts`: UNKNOWN e vazio entram; YELLOW/RED continuam excluídos.
- Ajustar o texto de ajuda do botão, se mencionar "somente GREEN".
- Atualizar o plano/memória que diz "só GREEN" para esta seleção.
- Só muda a tela, sem alteração no banco e sem custo extra.
