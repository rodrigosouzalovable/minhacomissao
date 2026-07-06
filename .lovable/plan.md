## Objetivo

Hoje o envio em massa da aba **Envio Meta** roda 100% no navegador (contexto React + `localStorage`). Se você fecha a aba, troca de navegador ou abre em outro computador, o loop morre e o progresso some. Queremos que o envio **rode no servidor** e o progresso seja **visível em tempo real em qualquer aba/navegador/dispositivo** logado na mesma conta.

## Como vai funcionar

```text
[Envio Meta UI] ──"iniciar"──▶ edge: envio-meta-massa-iniciar
                                    │
                                    ▼
                        cria envio_meta_job (status=rodando)
                        insere N envio_meta_job_item (pendente)
                                    │
                                    ▼
              cron pg_cron (a cada 20s) ──▶ edge: envio-meta-massa-tick
                                    │
                                    ▼
                    pega próximo item pendente do job ativo,
                    respeita delay/pausa/cancelar, chama send-whatsapp-meta,
                    grava resultado, atualiza contadores no job

[Qualquer aba/navegador] ──Realtime + query──▶ mostra progresso do job ativo
```

- Fecha a aba → envio continua (é o cron do banco que dispara).
- Abre em outro navegador → mesma tela, mesmo painel flutuante, mesmo progresso.
- Pausar/retomar/cancelar são apenas flags no registro do job — o tick respeita na próxima iteração.

## Escopo

### 1. Banco (migration)

- Tabela `envio_meta_job`
  - `user_id`, `status` (rodando/pausado/concluido/cancelado/erro), `template_id`, `template_nome`
  - `instancia_ids uuid[]`, `min_seg`, `max_seg`
  - `total`, `enviados`, `erros`, `atual_telefone`, `atual_instancia`, `proximo_em`
  - `template_id_by_instance jsonb`, `iniciado_em`, `atualizado_em`, `concluido_em`
- Tabela `envio_meta_job_item`
  - `job_id`, `ordem`, `telefone`, `nome`, `cpf`, `atraso`, `saldo`, `status` (pendente/enviado/erro/pulado), `instancia_id`, `erro`, `processado_em`
- RLS: só o dono vê/edita. Grants padrão. Trigger `updated_at`.
- Publicação Realtime nas duas tabelas.
- Cron `pg_cron` a cada 20s chamando a edge `envio-meta-massa-tick` (com anon key, como no memo de cron).

### 2. Edge functions

- `envio-meta-massa-iniciar` — valida payload (Zod), cria `envio_meta_job` + itens em lote, retorna `job_id`. Recusa se já houver job "rodando" do mesmo user.
- `envio-meta-massa-tick` — para cada job "rodando":
  1. Se `proximo_em > now()`, ignora (respeita o delay aleatório do último envio).
  2. Pega 1 item pendente (`FOR UPDATE SKIP LOCKED`), escolhe instância via `pick-meta-instance` (mesma lógica atual), chama `send-whatsapp-meta`, grava status no item, incrementa contadores, sorteia próximo delay entre `min_seg`/`max_seg`.
  3. Se acabaram os itens, marca `concluido`.
  4. Respeita `pausado`/`cancelado` sem consumir item.
- `envio-meta-massa-control` — muda `status` para `pausado`/`rodando`/`cancelado` (só o dono).

### 3. Frontend

- Novo hook `useEnvioMetaJob()` — busca job "ativo" do usuário e assina Realtime das duas tabelas.
- Refatorar `EnvioMetaSendingContext` para virar um wrapper fino sobre o hook: `iniciar()` chama a edge, `togglePausa()`/`cancelar()` chamam control, o estado (progresso, detalhes, resultado) vem 100% do banco. `localStorage` é removido.
- O painel flutuante existente (usado em `EnvioMeta.tsx`) segue igual visualmente; só passa a refletir o job do servidor. Se o usuário abre outro navegador, o mesmo painel aparece automaticamente.
- Aviso `beforeunload` deixa de ser necessário — pode remover.

## Detalhes técnicos

- Cron a cada 20s + delay aleatório mínimo de 1s (memo `technical/whatsapp/padronizacao-delays`): o `proximo_em` no job garante que 2 ticks seguidos não disparem em rajada; o intervalo real entre envios continua sendo o randômico `min_seg..max_seg` configurado.
- Domingo/horário/tier cheio: o tick usa as mesmas checagens do fluxo atual via `pick-meta-instance` e o retorno de `send-whatsapp-meta` (`pool_paused`, `tier_full`, `blocked`). Em bloqueio global, pausa o job automaticamente e registra o motivo em `envio_meta_job.status_motivo`.
- `pg_cron` + `pg_net` — habilitar via `supabase.insert` (SQL com anon key + URL), não migration, conforme o guia de jobs agendados.
- Custo Lovable Cloud: adiciona 1 execução de edge a cada 20s (~4.3k/dia). Baratíssimo comparado ao custo de mensagens Meta, e economiza chamadas quando não há job ativo (early return no início do tick). Vou avisar isso no toast do primeiro deploy.
- Sem mudança nas regras de negócio de envio (round-robin, seleção por saúde, ramp-up) — reaproveita `pick-meta-instance` e `send-whatsapp-meta`.

## Arquivos afetados

- **Migration nova**: cria `envio_meta_job`, `envio_meta_job_item`, grants, RLS, publicação Realtime, trigger updated_at.
- **SQL via supabase.insert**: agenda o cron `envio-meta-massa-tick` (contém URL/anon key, não pode ir em migration).
- **Edge functions novas**: `envio-meta-massa-iniciar/index.ts`, `envio-meta-massa-tick/index.ts`, `envio-meta-massa-control/index.ts`.
- **Frontend**:
  - `src/hooks/useEnvioMetaJob.ts` (novo)
  - `src/contexts/EnvioMetaSendingContext.tsx` (refatorado — vira ponte pro job do servidor)
  - Ponto de uso na página `src/pages/EnvioMeta.tsx` e no painel flutuante: apenas ajustes se o contrato do context mudar de nome de campo.

## Fora de escopo (a menos que você peça)

- Rodar em paralelo mais de um job por usuário.
- Fila global entre múltiplos usuários (cada usuário roda o seu próprio job).
- Reaproveitar essa infraestrutura para outros envios (Inbox Meta, WhatsApp UAZAPI) — dá pra fazer depois se você quiser.
