# Aplicar Utility automaticamente quando o número volta para GREEN

## Resultado esperado
- Assim que uma instância própria sair de YELLOW/RED e ficar **GREEN**, o sistema coloca na fila, sozinho, todos os templates **Utility** do mesmo dono marcados como obrigatórios ("Injetar em números novos") que ainda faltam nela.
- Sem clique manual e sem esperar a conferência diária.
- Continua valendo: tier 250 = 2 templates por número/dia; tiers 1.000/2.000 = um por vez, com intervalo; janela 07h–20h BRT, sem domingo; Marketing nunca é propagado; bloqueios reais (pagamento, conta restrita, desconectado) continuam impedindo.

## Situação atual
- A conferência que preenche os faltantes só roda junto com a sincronização diária; por isso um número que vira GREEN durante o dia pode esperar até o dia seguinte.
- Ela já filtra Utility marcados como obrigatórios e já avisa "voltou ao verde".

## Mudanças
1. **Detectar a virada para GREEN** nos pontos que atualizam a qualidade (verificação de saúde e rotina de recuperação RED/YELLOW): quando a qualidade anterior era YELLOW/RED e a nova é GREEN, disparar a conferência apenas para aquela instância.
2. **Conferência por instância**: permitir que a conferência receba uma instância específica, enfileirando somente os Utility obrigatórios ausentes (sem duplicar o que já existe ou já está na fila).
3. **Rede de segurança**: a conferência diária continua reencontrando qualquer faltante se a virada não tiver sido capturada.
4. **Aviso**: manter a notificação "voltou ao verde — sincronizando templates" com a quantidade enfileirada.

## Impacto de custo
Sem nova rotina agendada, polling ou tempo real. Uma chamada extra apenas quando um número muda para GREEN; custo baixo.

## Detalhes técnicos
- Comparar `saude_quality` anterior vs. nova em `check-meta-instance-health` e `meta-recuperacao-tick`; em transição para GREEN, invocar `meta-templates-auditar-instancias` com `{ auto: true, instancia_id }` sem bloquear a resposta.
- `meta-templates-auditar-instancias`: aceitar `instancia_id` opcional para restringir o escopo; reutilizar `meta_templates_onboarding_fila`, a reserva tier 250 e `modelosParaCopiar`.
- Teste: transição RED→GREEN dispara; GREEN→GREEN e GREEN→RED não disparam.
