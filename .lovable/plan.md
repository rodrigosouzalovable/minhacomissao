# Corrigir envio para nossos números UAZAPI na aba Envio Meta

## O que está acontecendo (confirmado nos dados)

Na campanha de hoje (CSIM 46, 1021 destinatários), cada um dos 45 números nossos da UAZAPI presentes na planilha recebeu **exatamente 1 mensagem**, mesmo estando repetido 3 ou 4 vezes na planilha. Consultei a fila da campanha: os 1021 itens estão todos com telefone único — as repetições dos nossos números foram removidas antes do envio. Por isso a caixa AQUECIMENTO recebeu mensagens só entre 08:30 e 09:30 (BRT) e depois parou.

Causa confirmada no código: em `src/pages/EnvioMeta.tsx` a lista de números isentos de deduplicação é montada exigindo chave de 8 dígitos (`key.length === 8`), mas a função de normalização usada ali devolve o telefone completo com DDI (ex.: `5562982443335`, 13 dígitos). Resultado: o conjunto de isentos fica **sempre vazio**, e a deduplicação apaga todas as repetições dos nossos números — inclusive as que o diálogo de importação tinha preservado (o diálogo usa sufixo de 8 dígitos e funciona corretamente, mas o textarea é deduplicado de novo no momento do disparo).

## O que muda

- Os nossos números conectados na UAZAPI voltam a ser reconhecidos e **todas as repetições da planilha são mantidas** e enviadas, gerando a interação/aquecimento esperado.
- Qualquer outro telefone repetido continua sendo removido como hoje.
- O aviso ao iniciar o disparo passa a mostrar corretamente quantos duplicados foram removidos e quantas linhas de números UAZAPI foram preservadas.

## Detalhes técnicos

- Em `src/pages/EnvioMeta.tsx`:
  - Adicionar helper `telSuffix8(t)` (últimos 8 dígitos) e montar `isentosDedup` com esses sufixos, sem o filtro `key.length === 8` que hoje zera o conjunto.
  - Em `parseRecipients` e `dedupRecipientsRaw`, manter a chave de dedup atual (telefone normalizado com DDI) para o `seen`, mas consultar a isenção por sufixo de 8 dígitos — alinhando com o padrão de comparação de telefone do projeto e com o `MapearColunasImportDialog`.
  - Manter a passagem do conjunto para o diálogo de importação (já usa sufixo de 8).
- Sem mudança de banco, sem novo cron/polling e sem alteração no worker de envio (a fila e a função `envio-meta-massa-iniciar` não deduplicam; recebem a lista já pronta do front).

## Verificação após o ajuste

Reimportar a mesma planilha e conferir, antes de disparar, que o total de destinatários volta a incluir as repetições dos 45 números UAZAPI (aviso "N linha(s) de números UAZAPI mantidas") e que a fila da campanha passa a ter mais de um item por número nosso.
