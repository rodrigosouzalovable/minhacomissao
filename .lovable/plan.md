# Bloquear campanha para números sem qualidade GREEN confirmada

## O que encontrei agora no banco (verificado)

1. O número do print (`SOUZA 62 8269-8799`) hoje já está gravado como **RED** (leitura de 02/09 12:18), mas o painel mostrava "QUALIDADE UNKNOWN" porque a tela exibe `UNKNOWN` sempre que o campo está vazio/desatualizado — não existe distinção entre "Meta disse UNKNOWN", "ainda não lemos" e "a leitura falhou".
2. A chave global **"Liberar YELLOW/RED" está LIGADA** (`liberar_qualidade_global = true`). Com ela ligada, a campanha ignora RED, quarentena e pausa por qualidade — é por isso que o sistema liberou o disparo desse número.
3. Das instâncias ativas: 22 GREEN, 4 RED, 7 UNKNOWN e **78 com qualidade nula porque a leitura na Meta falhou** com `Invalid OAuth access token` (token expirado/errado). Hoje qualidade nula/UNKNOWN entra na campanha com peso 60, ou seja, número sem qualidade conhecida dispara normalmente.

## O que vou fazer

1. **Campanha só com GREEN.** A chave "Liberar YELLOW/RED" passa a valer **apenas para aquecimento/recuperação**. Campanha e disparo em massa nunca mais aceitam YELLOW, RED, UNKNOWN, qualidade nula ou leitura falhada, mesmo com a chave ligada.
2. **Qualidade tem que ser fresca.** Se a última leitura da Meta for anterior a 6 horas ou tiver falhado, o número é descartado da campanha com motivo claro ("qualidade não confirmada — leitura falhou/desatualizada"), em vez de ser tratado como neutro.
3. **Leitura de qualidade mais confiável.** Além de consultar o número, a checagem passa a ler a lista `phone_numbers` da WABA (que é a mesma fonte do portfólio da Meta) e usa o pior valor entre as duas leituras. Assim "Baixa" no portfólio aparece como RED no sistema.
4. **Sinalização na tela.** No Pool Meta e na lista de instâncias, em vez de "QUALIDADE UNKNOWN" genérico: `GREEN`/`YELLOW`/`RED`, `SEM LEITURA` (token inválido — com o erro no tooltip) e `DESATUALIZADA`. Instâncias com token inválido ganham aviso destacado, já que 78 estão nessa situação e precisam de token novo.
5. **Correção de dados imediata:** rodar a checagem de saúde para atualizar todos e deixar registrado quem está sem token válido.
6. Aquecimento e recuperação seguem funcionando com YELLOW/RED exatamente como hoje.

## Detalhes técnicos

- `pick-meta-instance`: novo parâmetro `contexto: 'campanha' | 'aquecimento'`. `liberar_qualidade_global` e `qualidade_liberada_manual` deixam de afetar o gate de qualidade quando `contexto = 'campanha'`; `pesoQualidade` retorna 0 para `UNKNOWN`/vazio em campanha; novo descarte por `saude_checked_at` mais velho que 6h ou `saude_raw.phone.error` presente.
- `envio-meta-massa-iniciar`: filtro de qualidade deixa de considerar `liberacaoGlobal`; passa a exigir `saude_quality = 'GREEN'` + leitura recente, mantendo os motivos por instância no `CampanhaInstanciasPanel`.
- `envio-meta-massa-tick` / `envio-meta-massa-burst` / `send-whatsapp-meta` / `process-campanha-meta-diaria`: passam `contexto: 'campanha'`; aquecimento/recuperação passam `contexto: 'aquecimento'`.
- `check-meta-instance-health`: leitura adicional `GET /{waba_id}/phone_numbers?fields=id,quality_rating,display_phone_number`, consolidação pelo pior valor, e novas colunas `qualidade_leitura_ok boolean` + `qualidade_leitura_erro text` (migração).
- `PoolMetaPanel.tsx` e listagem de instâncias em `EnvioMeta.tsx`: badges novas por estado de leitura.
- Sem novos crons, polling ou consultas em loop — a checagem de saúde existente é reaproveitada. Sem impacto de custo.
