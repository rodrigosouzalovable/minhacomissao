# Corrigir acesso e etiquetas por caixa de mensagens (Inbox Meta)

Dois problemas confirmados na investigação, com causas diferentes.

## Problema 1 — Thiago (e Lais, Poliana, Gabriel) não vê as conversas

Os quatro estão corretamente vinculados à caixa AMARAL, mas nenhum deles tem o acesso compartilhado do Inbox ativo e nenhum é dono das instâncias. As regras de acesso do banco hoje só liberam leitura para: dono do registro, administrador ou usuário com "inbox compartilhado". As regras por caixa de mensagens existem, mas são apenas **restritivas** (limitam quem já tem acesso) — elas não concedem acesso a ninguém. Resultado: o vínculo à caixa não dá visibilidade nenhuma.

O que será feito: criar regras de acesso que **concedem** visibilidade a quem é responsável por uma caixa, limitado às conversas daquela caixa:

- Instâncias Meta: leitura para quem é responsável por qualquer caixa (necessário para o Inbox carregar).
- Contatos/conversas: leitura e atualização (marcar lida, fixar, arquivar) apenas das conversas das caixas em que o usuário é responsável.
- Mensagens: leitura das mensagens dessas conversas e inserção ao responder.
- Etiquetas e vínculos de etiqueta: leitura das etiquetas e das etiquetas das conversas dessas caixas.

As restrições atuais continuam: quem é responsável só pela AMARAL não passa a ver Padrão, BSA, FESTA PREMIUM etc.

## Problema 2 — Etiquetas de atendentes que não pertencem à caixa

A etiqueta automática está sendo aplicada por um gatilho antigo no banco (`atribuir_atendente_fila`), que roda a cada mensagem recebida e sorteia um nome de uma fila global fixa (Anna Flavia, Yasmim, Fernanda, Wallace) — ignorando completamente a caixa da conversa. É exatamente esse rodízio que apareceu nas conversas da AMARAL.

O que será feito:

1. Ajustar o gatilho para respeitar a caixa: ele só aplica a etiqueta se o atendente da fila for responsável pela caixa daquela conversa (caixa Padrão usa os responsáveis padrão). Se nenhum da fila for responsável, ele não etiqueta e deixa a lógica principal (webhook) decidir, que já filtra por caixa.
2. Limpar o histórico: remover das conversas de todas as caixas as etiquetas de atendente cujo usuário não é responsável pela caixa. Isso apaga as etiquetas indevidas de Anna Flavia, Yasmim, Fernanda e Wallace nas conversas da AMARAL.
3. Re-etiquetar as conversas da AMARAL que ficarem sem atendente, distribuindo em rodízio equilibrado somente entre os responsáveis da caixa (Lais, Poliana, Thiago Nogueira, Gabriel).

## Detalhes técnicos

- Nova função auxiliar `public.has_any_meta_folder_access(uid)` (SECURITY DEFINER, STABLE) para as políticas de `meta_whatsapp_instances` e `meta_whatsapp_etiquetas`.
- Novas políticas PERMISSIVAS usando `can_view_meta_contato_folder` / `can_access_meta_folder`:
  - `meta_whatsapp_contatos`: SELECT + UPDATE por caixa.
  - `meta_whatsapp_mensagens`: SELECT + INSERT via EXISTS no contato correspondente (`instancia_id` + `telefone`).
  - `meta_whatsapp_contato_etiquetas`: SELECT (e DELETE/INSERT para troca manual, mantendo o bloqueio de `origem = 'auto_atendente'` para não-admin).
  - `meta_whatsapp_instances` e `meta_whatsapp_etiquetas`: SELECT para responsáveis de caixa.
- `atribuir_atendente_fila()`: passa a ler `folder_id` do contato, montar o conjunto de responsáveis (`meta_inbox_folder_members` ou `meta_inbox_default_members`), mapear etiqueta → `profiles.nome` → `user_id`, e escolher na fila apenas nomes elegíveis; sem elegível, retorna sem inserir.
- Limpeza e re-etiquetação por instruções de dados (não migração de schema), com `origem = 'auto_atendente'` nas novas atribuições.
- Sem mudanças de custo: nenhum cron, polling ou Realtime novo.
