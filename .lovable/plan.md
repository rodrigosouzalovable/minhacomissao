# Injeção automática e gradual de templates em números novos

Sim, é plausível e é o caminho certo — desde que seja lento, seletivo e com freio automático. Submeter 30 templates de uma vez num número recém-criado é justamente o padrão que a Meta pune. A proposta abaixo copia só o que já foi **aprovado** em outros números, em doses pequenas, e para sozinha ao primeiro sinal de problema.

## Como vai funcionar

1. Ao conectar um número novo (API Oficial), o card ganha a opção **"Copiar templates aprovados automaticamente"**. Só o administrador pode marcar/desmarcar; parceiros não veem nem alteram.
2. O sistema monta uma fila para esse número com os modelos que **já estão aprovados em pelo menos um outro número seu**, na ordem dos mais aprovados/mais usados primeiro (os que a Meta claramente aceita).
3. A fila é enviada em doses:
   - Dia 1: 3 modelos. Dia 2: 5. Dia 3: 8. Depois: 10 por dia.
   - Um modelo por vez, com intervalo aleatório de 15 a 25 minutos.
   - Somente entre 09h e 18h (BRT) e nunca no domingo.
4. Freios automáticos:
   - 2 reprovações seguidas → a fila desse número pausa e você é avisado.
   - Erro de limite/bloqueio da Meta → pausa de 24h nesse número.
   - Nada é reenviado se o modelo já existir no número (evita duplicidade e erro).
5. O status de cada modelo (aprovado/reprovado e motivo) continua sendo lido pela verificação de status já existente, então a fila só avança com informação real da Meta.

## Avisos no seu WhatsApp (só 62991672674)

- **Início**: "Comecei a copiar N templates aprovados para o número X (BM ...)."
- **Reprovação**: número, nome do modelo e motivo devolvido pela Meta, para você corrigir manualmente.
- **Pausa automática**: motivo (2 reprovações seguidas ou limite da Meta).
- **Conclusão**: quantos aprovados, quantos reprovados, quantos ficaram pendentes.

Também vou remover o 62994300880 de todos os avisos do sistema (saúde de instâncias, reaquecimento, guardião de engajamento e relatórios), deixando apenas o 62991672674.

## Aviso de custo (Lovable Cloud)

Impacto baixo: **não** vou criar cron novo, nem Realtime, nem polling no navegador. A fila avança dentro de um agendamento que já roda de 10 em 10 minutos, com uma consulta leve por execução e índice na fila. Se preferir um agendamento próprio (mais previsível, custo um pouco maior), me diga.

## Detalhes técnicos

- Nova tabela `meta_templates_onboarding_fila`: `instancia_id`, `mestre_id`, `status` (PENDENTE/ENVIADO/APPROVED/REJECTED/ERRO/PULADO), `tentativas`, `motivo`, `agendado_para`, timestamps; índice em (`status`, `agendado_para`). GRANTs para `authenticated`/`service_role`, RLS: leitura para admin, escrita só `service_role`.
- Nova tabela `meta_templates_onboarding_config` (linha única): `ativo`, `qtd_dia_1..dia_3`, `qtd_dia_padrao`, `intervalo_min_seg`/`intervalo_max_seg`, `hora_inicio`, `hora_fim`, `max_rejeicoes_seguidas`.
- Nova coluna em `meta_whatsapp_instances`: `templates_auto_copiar boolean default false` + `templates_auto_status`/`templates_auto_pausado_ate`. RLS existente já impede parceiro de alterar instância alheia; a marcação será restrita a admin via política/checagem.
- Nova Edge Function `meta-templates-onboarding-tick`: seleciona 1 item elegível (respeitando janela, domingo, dose diária, pausa), reaproveita a lógica de submissão de `meta-criar-template-lote`, grava resultado e dispara avisos via `_shared/notificar-admin.ts`.
- Enfileiramento: ao marcar a opção no card, uma função `meta-templates-onboarding-enfileirar` monta a fila a partir de `meta_templates_instancia` com `status='APPROVED'` agrupado por `mestre_id`.
- `meta-verificar-status-templates` passa a atualizar também a fila (aprovado/reprovado + motivo) e a fechar o processo quando não sobrar pendência.
- Destinos de aviso: remover `5562994300880` de `check-meta-instance-health`, `meta-engajamento-guardiao`, `meta-recuperacao-relatorio` (2 pontos) e usar apenas `5562991672674`.
- Front-end: selo e progresso ("templates: 7/22") no card da aba API Oficial Meta, com o motivo da pausa quando houver.
