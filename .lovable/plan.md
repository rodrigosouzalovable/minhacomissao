# Mostrar o tempo configurado no bloco de previsão da campanha

## A previsão está correta

Conferi a campanha CSIM 39 (915 contatos, delay 10–15s, modo serial) com os dados reais de envio:

- Intervalo real entre envios: mediana **14,9s**, média **15,8s**, mínimo 11,4s, máximo 30,9s.
- A tela mostra "Ritmo: ~1 msg / 15s" e "Tempo estimado: ~3h40" para 860 restantes — isso bate com o ritmo real (860 × ~15,4s ≈ 3h40).

Ou seja: a previsão exibida está coerente. Ela usa o ritmo real observado (tempo decorrido ÷ processados), não a média teórica, por isso é fiel. A pequena diferença acima de 15s vem do tempo de resposta da Meta em cada envio somado ao delay sorteado.

## O que muda na tela

No mesmo bloco de previsão, acrescentar uma linha com o tempo configurado na abertura da campanha:

```text
Restam 860 envios • Ritmo: ~1 msg / 15s
Delay configurado: 10–15s (aleatório por envio) • Teórico: ~1 msg / 12,5s
Tempo estimado: ~3h 40min • Previsão de término: hoje 12:32
Estimativa aproximada: varia com falhas, rate limit da Meta e instâncias bloqueadas.
```

Regras:
- Modo serial: mostra "Delay configurado: {min}–{max}s (aleatório por envio)" e o ritmo teórico correspondente.
- Modo rajada: mostra "Rajada: {msgs_por_segundo} msg/s × {n} instâncias".
- Em campanha concluída/cancelada, além da duração total, mostra também o delay que estava configurado.

## Detalhes técnicos

- `src/components/meta/CampanhaDetalheDialog.tsx`: no cálculo `eta` (linhas 145-194) já existem `min_seg`, `max_seg`, `modo_rajada`, `msgs_por_segundo` e `segPorMsgTeorico`; expor esses valores no objeto retornado e renderizar a nova linha no bloco de UI (linhas 392-418) com tokens semânticos existentes.
- Sem alteração de banco, edge function, cron ou nova query — nenhum custo adicional.
