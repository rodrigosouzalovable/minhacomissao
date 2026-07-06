## Causa raiz do erro

O envio falha porque **todas as 16 instâncias Meta estão com `estado_pool = 'aguardando_templates'` e `fase_rampup = 'aguardando'`** — nenhuma foi promovida a "ativa" no pool ainda. A edge function `send-whatsapp-meta` tem duas travas que bloqueiam qualquer envio nesse estado:

1. `if (inst.estado_pool !== 'ativo') → "Instância não está ativa no pool"`
2. `cota da fase 'aguardando' = 0 → "Instância ainda aguardando templates"`

Como toda instância é rejeitada, o loop do frontend remove uma a uma e no fim mostra o erro genérico "Falha ao enviar / Todas as instâncias atingiram o limite diário". Por isso o teste com o seu número (55 62 99167-2674) não passa.

Essas travas foram criadas para proteger o ramp-up (evitar banimento/gasto Meta), mas hoje elas impedem até um simples envio de teste — que é exatamente o que você precisa fazer antes de disparar em massa.

## Plano

### 1. Novo modo `envio_teste` na função `send-whatsapp-meta`
- Aceitar um parâmetro opcional `modo_teste: true` no body.
- Quando `true`, pular as verificações de: `estado_pool`, `fase_rampup / cota`, `bloquear_domingo` e `horario_inicio/fim`.
- Manter as verificações que **não podem** ser puladas: template aprovado, guardrail anti-MARKETING, imagem de header configurada, pausa automática por saúde da instância, `ativo=true`.
- Continuar gravando o envio no `meta_whatsapp_envios_log` marcando `template_nome` normal (comportamento inalterado).

### 2. Botão "Enviar teste" na página `Envio Meta`
No card **3. Destinatários**, adicionar ao lado de "Iniciar envio":
- Botão secundário **"Enviar teste para o 1º número"** (ícone `TestTube`).
- Chama diretamente `send-whatsapp-meta` (sem passar pelo `pick-meta-instance` e sem o loop) usando:
  - a **primeira instância marcada** no card 2 (independente do estado_pool),
  - o **primeiro destinatário** da lista (no seu caso: `5562991672674, Rodrigo`),
  - `modo_teste: true`.
- Mostra toast com o resultado real da Meta (sucesso + `waId`, ou o erro exato retornado — ex.: "(#132000) parâmetro faltando", "(#131053) mídia inacessível", etc.), em vez do genérico "Falha".

### 3. Melhorar a mensagem de erro do envio em massa
No `EnvioMetaSendingContext`, quando **todas** as instâncias forem removidas por `pool_blocked` / `tier_full`, mostrar toast explicativo:
> "Nenhuma instância está ativa no pool ainda. Use 'Enviar teste' para validar o template ou ative as instâncias em Configurar Meta → Pool."

Em vez do atual "Todas as instâncias atingiram o limite diário", que é enganoso.

## Fora do escopo
- Não vou ativar automaticamente as 16 instâncias no pool nem forçar `data_ativacao_api`, porque isso libera envios em massa que ainda não passaram pelo ramp-up e pode gerar banimento/custo. A ativação continua sendo decisão sua no painel do Pool.
- Sem mudanças no template `solicitacao_de_renegociacao` nem na imagem já salva (já corrigido na rodada anterior).

## Arquivos afetados
- `supabase/functions/send-whatsapp-meta/index.ts` — aceitar `modo_teste`.
- `src/pages/EnvioMeta.tsx` — botão "Enviar teste".
- `src/contexts/EnvioMetaSendingContext.tsx` — mensagem de erro mais útil quando todas as instâncias caem por pool.
