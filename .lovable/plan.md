# Falhas "Something went wrong (#131000)" na campanha CSIM 44

## Causa confirmada (consulta ao banco)

Nas últimas 6 horas, **todas as 419 falhas** com "Something went wrong (#131000)" saíram de **uma única instância: 62 8267-7298**. Nenhuma outra instância gerou esse erro no período.

Essa instância está com:
- `meta_name_status = PENDING_REVIEW` (nome de exibição em análise pela Meta)
- `saude_quality = UNKNOWN`
- 419 falhas x 14 enviadas — praticamente 100% de falha

As outras instâncias no mesmo período entregaram normalmente (7580, 7609, 4838, AMARAL, Novo Mundo). Ou seja: **o problema não é o template nem a planilha — é esse número específico, que a Meta está rejeitando na entrega.**

Dois pontos agravantes encontrados:

1. **A Meta aceita a mensagem e só depois falha.** A API responde "aceito" (por isso o painel mostra 37 enviadas) e a falha chega minutos depois pelo webhook de status. Como a nossa exclusão automática de instância só reage a erro na hora do envio, o número ruim continuou no round-robin durante toda a campanha.
2. **Reenvio no mesmo número ruim.** O retry automático só tira a instância da rodada quando o código é classificado como "restrição" (#131000 não é). Resultado: o mesmo contato recebeu até 4 disparos do mesmo template, às vezes 2 falhas + 1 entrega — exatamente o que aparece na conversa do Heliton (12:57, 13:02, 13:08).

Também apareceram, em menor volume: 28 "Message undeliverable" (número sem WhatsApp — normal) e 7 "Business eligibility payment issue" em outras 3 instâncias, que indica pendência de pagamento/faturamento no Business Manager.

## O que será feito

1. **Explicar o erro em português claro.** #131000 passa a exibir: "A Meta rejeitou a entrega nesse número. Quase sempre é problema da própria instância (nome em análise, qualidade rebaixada ou pendência no Business Manager) — não do contato. Use outra instância."
   Mesmo tratamento para "Message undeliverable" (número sem WhatsApp) e "Business eligibility payment issue" (pendência de pagamento na conta Meta).
2. **Corte automático da instância problemática durante a campanha.** Contar falhas de entrega por instância dentro do job: ao passar de um limite (ex.: 5 falhas seguidas ou 40% de falha com no mínimo 10 envios), a instância é retirada do round-robin daquele job, com aviso no WhatsApp informando qual número foi cortado e o motivo.
3. **Nunca repetir o mesmo contato na mesma instância ruim.** O retry passa a excluir explicitamente a instância que falhou para aquele item — acaba a duplicação de template para o mesmo cliente.
4. **Bloqueio preventivo antes de começar.** Instâncias com nome em `PENDING_REVIEW`/`REJECTED` ou qualidade `UNKNOWN`/`RED` ficam marcadas como "não recomendada" na tela de Envio Meta, com aviso antes de iniciar o disparo (hoje só bloqueamos RED/YELLOW já conhecidos).
5. **Resumo de falhas por instância no painel da campanha.** Novo bloco no diálogo de detalhe: falhas agrupadas por instância e por motivo, para identificar em segundos qual número está queimando envios.

## Detalhes técnicos

- `src/lib/humanizarErroEnvio.ts`: novas regras para `#131000`, `Message undeliverable`, `Business eligibility payment issue`.
- `supabase/functions/meta-whatsapp-webhook/index.ts` (bloco `status === 'failed'`, linhas ~1283-1380): incrementar contador em `envio_meta_job.falhas_por_instancia_run`, aplicar corte por limiar adicionando o id em `instancias_bloqueadas_run`, e sempre excluir a instância que falhou na reatribuição do item.
- `supabase/functions/envio-meta-massa-tick` e `pick-meta-instance`: respeitar `instancias_bloqueadas_run` e as novas condições de `meta_name_status`.
- `src/pages/EnvioMeta.tsx`: selo/aviso de instância não recomendada.
- `src/components/meta/CampanhaDetalheDialog.tsx`: agrupamento de falhas por instância e motivo.
- Sem mudanças de banco (colunas já existem) e sem novo cron — nenhum impacto de custo.

## Ação fora do sistema (recomendada)

Enquanto a Meta não aprovar o nome de exibição da 62 8267-7298, esse número não deve ser usado em campanha. Vale também conferir a pendência de pagamento sinalizada pela Meta nas instâncias que retornaram "Business eligibility payment issue".
