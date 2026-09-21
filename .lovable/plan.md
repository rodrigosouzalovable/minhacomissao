# Corrigir falso bloqueio `ACCOUNT_VIOLATION:SPAM`

## Diagnóstico confirmado

A instância **SOUZA 62 8275-5862** está registrada como `CONNECTED`, qualidade `GREEN`, sem banimento, sem quarentena, sem retirada manual e com envio `AVAILABLE` no número, WABA e Business. Mesmo assim, permanece fora do pool com o motivo `ACCOUNT_VIOLATION:SPAM`.

O motivo fica preso porque um alerta `ACCOUNT_VIOLATION` recebido pelo webhook retira preventivamente todos os números da mesma BM, enquanto a verificação periódica de saúde possui uma exceção que impede limpar automaticamente qualquer motivo contendo `ACCOUNT_VIOLATION`, mesmo quando a própria Meta volta a confirmar que tudo está disponível.

## O que será corrigido

1. **Revalidar violações antes de mantê-las**
   - Manter a pausa imediata quando chegar um alerta real `ACCOUNT_VIOLATION`.
   - Na verificação seguinte, liberar individualmente somente o número que estiver `CONNECTED`, `GREEN`, sem banimento, sem quarentena e com `can_send_message=AVAILABLE` no número, WABA e Business.
   - Se a Meta ainda indicar `BLOCKED`, `LIMITED` ou `RESTRICTED`, a instância continuará fora do pool.

2. **Remover a trava permanente incorreta**
   - Permitir que a rotina de saúde limpe `ACCOUNT_VIOLATION:SPAM` quando todas as confirmações atuais da Meta estiverem saudáveis.
   - Preservar `pool_fora_manual`: números retirados manualmente não voltarão sozinhos.
   - Não afrouxar os bloqueios por qualidade baixa, recuperação, quarentena, banimento, pagamento ou restrição comercial.

3. **Corrigir o estado atual**
   - Revalidar a SOUZA 62 8275-5862 depois da publicação e devolvê-la ao pool se a Meta continuar confirmando o estado saudável.
   - Aplicar a mesma reconciliação às demais instâncias que tenham esse motivo antigo, mas apenas uma a uma e conforme a saúde real de cada número.

4. **Validar**
   - Confirmar que a instância aparece ativa no pool e que o aviso falso desapareceu.
   - Confirmar que uma instância realmente limitada pela Meta continua bloqueada.

## Detalhes técnicos

- Ajustar `check-meta-instance-health` para reconciliar também motivos `ACCOUNT_VIOLATION`, usando os dados atuais de `health_status` já consultados; não será criado novo cron nem nova chamada recorrente.
- Manter o webhook como proteção imediata, mas tornar a restrição reversível pela confirmação posterior da Meta.
- Publicar a função alterada e executar uma revalidação direcionada da instância.
