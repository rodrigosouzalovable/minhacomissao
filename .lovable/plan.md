# Envio Meta — Variação de templates (múltipla seleção)

## Objetivo
Na aba "Envio Meta", permitir selecionar **vários templates** e alternar entre eles a cada disparo (round-robin), desde que todos tenham a **mesma quantidade de variáveis**.

## Como vai funcionar na tela

1. O seletor de template passa a aceitar múltipla seleção (lista com caixas de marcação, mantendo o dropdown atual).
2. O **primeiro** template marcado define a "assinatura": quantidade de variáveis numéricas ({{1}}, {{2}}…) do cabeçalho + corpo.
   - Templates com quantidade diferente ficam desabilitados na lista, com aviso "variáveis incompatíveis (2 vs 1)".
3. Aparece um resumo: "3 templates selecionados · 1 variável · alternando a cada envio".
4. Regras já existentes continuam valendo por template selecionado:
   - MARKETING bloqueado;
   - aviso e bloqueio quando algum template não está aprovado em alguma instância marcada (a validação passa a considerar a interseção de todos os selecionados);
   - pré-visualização mostra o template em foco (abas/tabs com os selecionados).
5. O mapeamento de colunas da planilha e a edição de variáveis usam o primeiro template (a estrutura de variáveis é idêntica entre eles, por definição da regra).
6. Confirmação de custo e mensagem de confirmação listam os templates que serão alternados.

## Como a variação acontece no disparo

- Cada destinatário recebe uma "variante" atribuída na criação da campanha, em round-robin pela ordem da lista (contato 1 → template A, contato 2 → template B, contato 3 → template A…).
- A instância continua sendo escolhida pelo round-robin atual; o template usado é o registro daquela variante **aprovado naquela instância**. Se a variante não existir aprovada na instância escolhida, o sistema cai para a próxima variante disponível (sem falhar o envio).
- Vale para envio normal, modo rajada e turbo.
- Campanhas agendadas: mesma lógica, gravando as variantes no agendamento.

## Detalhes técnicos

Banco:
- `envio_meta_job`: nova coluna `template_variantes jsonb default '[]'` — array `[{ template_id, nome_template, template_id_by_instance }]`. `template_id`/`template_nome`/`template_id_by_instance` continuam preenchidos com a 1ª variante (compatibilidade e relatórios).
- `envio_meta_job_item`: nova coluna `variante_idx int default 0`.
- `meta_campanha_agendada`: nova coluna `template_variantes jsonb default '[]'`.
- Migração inclui apenas `ALTER TABLE` (sem novas tabelas, sem mudança de RLS/grants).

Frontend (`src/pages/EnvioMeta.tsx`):
- `templateId: string` → `templateIds: string[]`; helper `contarVariaveis(template)` extraindo `{{n}}` de header TEXT + `body_text` (mesma lógica já usada em `MetaNovaConversaDialog`).
- `templateGroups` ganha `varsCount`; itens incompatíveis com a assinatura ativa ficam desabilitados.
- `instanciasIncompatíveis` = instâncias marcadas que não têm **todos** os templates selecionados aprovados.
- `enviar()` monta `templateVariantes` e envia junto de `template` (1ª variante) para `iniciar()`.

Motor:
- `src/contexts/EnvioMetaSendingContext.tsx`: novo parâmetro opcional `templateVariantes`, repassado ao invoke.
- `envio-meta-massa-iniciar`: grava `template_variantes` no job, `variante_idx = ordem % variantes.length` em cada item, e roda a checagem anti-MARKETING em todos os ids das variantes.
- `envio-meta-massa-tick` e `envio-meta-massa-burst`: resolver o `tplId` via `job.template_variantes[item.variante_idx]` (com fallback para o comportamento atual quando o array está vazio), incluindo o fallback para a próxima variante aprovada na instância.
- `meta-campanha-tick` (agendadas): mesma resolução de variante.

Nada de novo cron, polling ou realtime — sem impacto de custo no Cloud.
