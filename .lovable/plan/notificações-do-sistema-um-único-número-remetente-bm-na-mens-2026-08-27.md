# Notificações do sistema: um único número remetente + BM na mensagem

## O que está acontecendo hoje (verificado)

- Os avisos do sistema (ex.: "Bloqueio da Meta liberado") são enviados em **round-robin**: a cada aviso o sistema pula para a próxima instância conectada. Nos últimos 4 dias **mais de 25 instâncias diferentes** já enviaram avisos para o seu número — é exatamente o comportamento que você quer eliminar.
- A mensagem de liberação mostra hoje apenas `Número: SOUZA 62 8269-3446`, sem a Business Manager.
- O vínculo da BM existe no cadastro da instância Meta (campo de BM e/ou `business_id`), mas hoje só 26 das 109 instâncias têm a BM preenchida diretamente — para as demais o sistema tentará descobrir pelo `business_id` e, se não achar, mostra "BM não vinculada".

## O que vai mudar

### 1. Um único número remetente das notificações (com troca automática)

- Passa a existir um **remetente fixo** das notificações, guardado na configuração de notificações.
- Todo aviso sai sempre por esse número, desde que ele esteja conectado.
- Se ele estiver desconectado, com token inválido, banido ou falhar no envio, o sistema **elege automaticamente outro número apto**, grava como novo remetente fixo e passa a usar sempre ele — sem voltar a alternar entre vários.
- O fallback pela API Oficial da Meta continua existindo, só como último recurso quando nenhum número UAZAPI entrega.
- Vale para todos os avisos que hoje usam esse mesmo canal (saúde de instância, bloqueio/liberação da Meta, resumos diários, alertas de ponto, etc.).

### 2. BM vinculada abaixo do nome da instância

Todas as notificações que citam uma instância Meta passam a mostrar a BM logo abaixo do número:

```text
✅ Bloqueio da Meta liberado

Número: SOUZA 62 8269-3446
BM: NOVO MUNDO BM 02

A Meta voltou a responder normalmente (CONNECTED, sem restrição).
O número voltou para o pool de envios.
```

Quando não houver BM vinculada, aparece `BM: não vinculada`, para você saber que falta o cadastro.

## Detalhes técnicos

- Migração: adicionar `instancia_notificacao_id` (uuid, nullable) em `admin_notificacoes_config`, referenciando `user_whatsapp_instances`.
- `supabase/functions/_shared/notificar-admin.ts`:
  - substituir o cursor round-robin (`ultima_instancia_id` + índice rotativo) por: usar `instancia_notificacao_id` se estiver na lista de conectadas; senão eleger a primeira conectada (ordem estável) e persistir em `instancia_notificacao_id`.
  - em falha de entrega/instância morta, tentar as demais conectadas e, ao ter sucesso, gravar a nova escolhida como remetente fixo.
- `supabase/functions/_shared/rotulo-instancia.ts`: nova função auxiliar `linhaBmInstancia(supabase, inst)` que resolve o nome da BM por `meta_bm_id` e, como fallback, por `business_id` em `meta_business_managers`, devolvendo a linha `BM: <nome>` ou `BM: não vinculada`.
- Aplicar a linha de BM nas mensagens de: `check-meta-instance-health` (bloqueio liberado, restrição/pausa), `_shared/meta-conta-bloqueada.ts` (#131031 e #131042) e `_shared/meta-numero-inacessivel.ts`.
- Nenhuma mudança de custo: sem novos crons, polling ou queries em loop; a resolução da BM é uma consulta pontual por aviso.
