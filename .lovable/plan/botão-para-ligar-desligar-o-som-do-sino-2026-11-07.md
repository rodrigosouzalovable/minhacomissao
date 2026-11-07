# Botão para ligar/desligar o som do sino

## O que muda
- No topo da tela, ao lado do sino, aparece um botão de alto-falante:
  - Alto-falante normal = som ligado.
  - Alto-falante riscado = som desligado.
- Clicar alterna entre ligado e desligado e mostra um aviso rápido ("Som das conversas ativado/desativado").
- Com o som desligado, o sino continua mostrando o contador e as conversas normalmente, só deixa de tocar.
- A escolha fica guardada por usuário neste navegador; continua valendo ao recarregar a página.
- Padrão: ligado (como hoje).

Nada muda em etiquetas, distribuição ou contagem de não lidas.

## Detalhes técnicos
- Preferência em localStorage `meta-atendente-som-ativo:<userId>`, com evento para sincronizar entre componentes/abas.
- `MetaAtendenteNotifier.tsx`: checar a preferência antes de `audio.play()` (incluindo o som de teste).
- `AppLayout.tsx`: botão `Volume2`/`VolumeX` junto ao sino do cabeçalho (desktop e mobile).
- Sem custo extra: nenhuma consulta ou canal novo.
