# Integração 3C Plus → Relatórios (ligações, tentativas, CPC e CPC-A)

Sim, dá para fazer. Li a documentação (API Discador da 3C+) e ela entrega exatamente o que falta hoje na aba Relatórios: as ligações.

## O que a API da 3C entrega

- `GET /api/v1/calls` — lista **ligação por ligação**, com `number`, `call_date_rfc3339` (com fuso -03:00), `campaign`, `agent`, `status_id` / `readable_status_text`, `qualification` / `qualification_id`, `speaking_with_agent_time`, `is_conversion`, `mode` (dialer/manual/receptivo). Aceita `start_date`, `end_date`, `campaign_ids`, `page`, `per_page`. É a fonte principal.
- `GET /api/v1/campaigns/:id/statistics?interval=60` — totais **já agrupados por hora** (total, atendidas, não atendidas, falhas, abandonadas). Bom para conferência.
- `GET /api/v1/qualification_lists/:id/qualifications` — lista as qualificações cadastradas (nome, id, cor). Serve para você marcar quais são CPC e quais são CPC-A.
- Autenticação simples: `api_token` (token de gestor) na query string.

## Como cada número do relatório será calculado

| Coluna | Origem |
|---|---|
| TENTATIVAS | total de ligações discadas na faixa da hora + acionamentos WhatsApp Meta (já automático) |
| ALÔ | ligações atendidas (`status_id` de atendida / `speaking_with_agent_time` > 0) |
| CPC | ligação com qualificação marcada como CPC **ou** cliente que respondeu no Inbox Meta (regra atual) — contando cada telefone uma vez por dia |
| CPC-A | telefone CPC que teve acordo lançado no mesmo dia, ou qualificação marcada como "acordo/fechou" |
| WHATSAPP | mantém a regra atual (envios Meta) |

Contagem sempre por **sufixo de 8 dígitos** do telefone, o padrão do projeto — assim uma mesma pessoa contatada por ligação e por WhatsApp não é contada duas vezes como CPC.

## Tela: mapeamento de qualificações

Nova aba/painel "Integração 3C Plus" dentro de Relatórios (visível só para admin):

1. Campo para colar o token de gestor (salvo como segredo, nunca no código) e botão **Testar conexão** (mostra empresa e campanhas encontradas).
2. Seleção das campanhas que entram no relatório.
3. Lista de todas as qualificações da 3C com três chaves por linha: `Ignorar` / `CPC` / `CPC-A`. Isso evita adivinhar nomes e permite ajustar quando o time criar qualificação nova.
4. Botão **Sincronizar agora** (recalcula a hora corrente) e selo com a hora da última sincronização.

## Automação

- Nova função `relatorio-3c-sync`, agendada de hora em hora (08h–19h BRT), paginando `/calls` do dia e gravando por faixa de hora em `relatorio_acionamentos` nas colunas automáticas.
- A função existente `relatorio-acionamentos-sync` passa a somar as ligações às tentativas e ao CPC/CPC-A, mantendo a regra de que **qualquer valor editado manualmente por admin nunca é sobrescrito**.
- O resumo de WhatsApp às 19h30 ganha as linhas de ligações (tentativas, alô, CPC, CPC-A por ligação).

## Detalhes técnicos

- Tabelas novas: `tresc_config` (token ref, base_url, campanhas selecionadas), `tresc_qualificacoes` (id, nome, classificação CPC/CPC-A/ignorar), `tresc_ligacoes` (cache diário: id da ligação, telefone_sufixo, data/hora BRT, status, qualificação, agente, campanha) com índice em `(data, hora)` e `(telefone_sufixo, data)`. Todas com GRANT + RLS (leitura autenticada, escrita apenas admin e service role).
- Colunas automáticas adicionais em `relatorio_acionamentos`: `ligacoes_auto`, `alo_auto` e `alo_manual`, seguindo o padrão `*_auto`/`*_manual` já existente.
- A base da API precisa ser configurável (`base_url`), porque a 3C mudou de domínio em 03/2025; o padrão vem do domínio do seu painel e o botão "Testar conexão" valida antes de salvar.
- Paginação com `simple_paginate=true` e `per_page` alto; a função só relê o dia corrente, com upsert idempotente pelo `id` da ligação.
- Segredo necessário: `TRESC_API_TOKEN` (token de gestor da 3C, gerado no painel deles). Vou pedir pelo formulário seguro depois da sua aprovação.

## Alerta de custo (Lovable Cloud)

Novo cron de 12 execuções/dia mais uma tabela de cache de ligações. Impacto estimado baixo: cada execução é uma sequência curta de chamadas paginadas e um upsert em lote; sem polling novo no cliente e reaproveitando o Realtime já existente da tela. O cache de ligações terá limpeza automática mantendo 90 dias.

## Etapa seguinte, se você quiser

Detalhamento por operador (ranking de ligações, alô, CPC e CPC-A por agente) usando `/agents/statistics/by_agent` — fica para depois que os números da hora estiverem batendo com o painel da 3C.
