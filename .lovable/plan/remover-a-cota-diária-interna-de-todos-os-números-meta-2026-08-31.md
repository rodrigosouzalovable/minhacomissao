# Remover a cota diária interna de todos os números Meta

## O que está travando hoje (verificado)

- A campanha "Aquecer numero" está em `Aguardando cota` porque o número **AMARAL 62 8273-8416** está com teto interno **20/dia** e já enviou **21** — sendo que a cota real da Meta dele é **2.000/dia**.
- Motivo: esse número está **YELLOW**, e o modo "sem teto" hoje só vale para números **GREEN**. Os números RED estão todos com teto interno de 20/dia.
- Também existe teto por hora (`cota_max_hora`, hoje 720) e o job de freio de qualidade, que a cada 30 min regrava tetos reduzidos por engajamento.

## O que vou fazer

1. **Sem teto para todos, independente da qualidade** — o modo "sem teto" deixa de olhar GREEN/YELLOW/RED. Todo número liberado no pool envia até a cota real da Meta dele (tier), sem teto interno e sem teto por hora.
2. **Freio de qualidade deixa de cortar volume** — o job continua calculando e exibindo as métricas (respostas, não lidas) para o painel, mas não baixa mais o teto de nenhum número.
3. **Único limite restante**: a cota da própria Meta por número (e os bloqueios reais da Meta — banimento, pendência de pagamento, template reprovado), além da janela 08h–19h BRT e do bloqueio de domingo, que continuam.
4. **Destravar agora** — subir o teto do dia de todos os números para a cota real da Meta e retomar a campanha "Aquecer numero" (46 pendentes) imediatamente.
5. **Painel** — no Pool Meta, deixar claro que o modo sem teto está valendo para todas as qualidades, e no detalhe da campanha ajustar o texto de "aguardando cota".

## Detalhes técnicos

- `pick-meta-instance`: `semTeto = cfg.sem_teto_global === true` (remover a condição `qualidadeUp === 'GREEN'`); nesse modo, não avaliar `meta_instance_freio_diario.teto_efetivo` nem `cota_max_hora`, apenas `tier_diario`.
- `meta-qualidade-freio`: com `sem_teto_global` ligado, gravar `teto_efetivo = tier_diario` para qualquer qualidade (hoje só preserva GREEN), mantendo `enviados`, `resposta_pct`, `nao_lidas_pct` e o motivo apenas informativo.
- `envio-meta-massa-control` (`liberar_teto_hoje`): liberar até a cota real da Meta para qualquer qualidade quando o modo estiver ligado.
- Ação de dados: `UPDATE meta_instance_freio_diario` do dia com `teto_efetivo = tier_diario` da instância e `liberado_manual = true`; job da campanha com `status_motivo = null` e `proximo_em = now()`, seguido do disparo do tick.
- `PoolMetaPanel.tsx` e `CampanhaDetalheDialog.tsx`: textos refletindo o novo comportamento.

## Aviso de risco e custo

⚠️ Sem teto interno, números YELLOW/RED passam a disparar em volume alto — isso tende a **piorar a qualidade** e pode levar a restrição/banimento pela Meta. O custo maior é o das mensagens na Meta, não o do Lovable Cloud. As travas de bloqueio real da Meta continuam ativas.
