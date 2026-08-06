# Previsão de término da campanha

Mostrar, dentro do diálogo da campanha, quanto tempo falta e a que hora os envios devem terminar, com base nas configurações de tempo escolhidas na abertura da campanha.

## O que aparece na tela

Um bloco novo logo abaixo da barra de progresso:

```text
Restam 690 envios • Ritmo médio: ~1 msg / 62s
Tempo estimado: ~11h 55min
Previsão de término: hoje 01:33 (07/08)
```

Regras de exibição:
- Só aparece enquanto a campanha está rodando ou pausada e ainda tem pendentes.
- Se estiver pausada: mostra "Pausada — previsão retomada ao continuar" com o tempo estimado ainda calculado.
- Se concluída/cancelada: mostra a duração real (início → conclusão) em vez de previsão.
- Rótulo "estimativa aproximada" para deixar claro que varia com falhas, rate limit da Meta e instâncias bloqueadas.

## Como a estimativa é calculada

- Modo serial (anti-ban): delay médio = (min_seg + max_seg) / 2 por mensagem. Restantes × delay médio.
- Modo rajada: taxa = msgs_por_segundo × número de instâncias ativas do job; tempo = restantes / taxa.
- Quando já existem envios feitos, usa também o ritmo real observado (tempo desde o início ÷ processados) e exibe a estimativa pelo ritmo real, que é mais fiel que o teórico. Sem histórico suficiente, usa o teórico.
- Desconta instâncias já ignoradas automaticamente (`instancias_bloqueadas_run`) do total de instâncias ativas.
- Hora prevista = agora + tempo estimado, formatada em pt-BR, com indicação do dia quando cair no dia seguinte.

## Detalhes técnicos

- `src/contexts/EnvioMetaSendingContext.tsx`: incluir `min_seg`, `max_seg`, `modo_rajada`, `msgs_por_segundo` no tipo `CampanhaJob` e no mapeamento `toCampanhaJob` (a query já usa `select("*")`, sem mudança de banco).
- `src/components/meta/CampanhaDetalheDialog.tsx`: novo cálculo memoizado de ETA + bloco de UI usando tokens semânticos existentes (texto muted, ícone de relógio), reaproveitando o polling atual — sem nova query, sem novo intervalo, sem custo extra de backend.
- Nenhuma alteração em edge functions, cron ou banco de dados.
