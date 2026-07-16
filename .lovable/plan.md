## Objetivo
Adicionar botão **"Ativar no pool"** direto no modal de seleção de instâncias em `Envio Meta`, para instâncias com `estado_pool` diferente de `ativo`, sem precisar abrir `Configurar Meta → Pool`.

## Onde
Arquivo: `src/pages/EnvioMeta.tsx` — dentro do `<Dialog>` de "Instâncias" (linhas ~940–1046), na linha de cada instância, logo ao lado do badge "restantes" / botão editar.

## Comportamento
- O botão aparece **apenas** quando `(inst.estado_pool || "aguardando_templates") !== "ativo"`.
- Quando `pausado` → texto **"Retomar"**; quando `aguardando_templates` → **"Ativar no pool"**.
- Ao clicar:
  1. `confirm(...)` reaproveitando a mesma mensagem do `PoolMetaPanel` ("Dia 1 = 20 msg máx") só no fluxo de ativação inicial (não no retomar).
  2. `UPDATE meta_whatsapp_instances` com os mesmos campos usados em `PoolMetaPanel.ativarNoPool` / `retomar`:
     - Ativação inicial: `estado_pool='ativo'`, `data_ativacao_api=hoje`, `fase_rampup='fase1'`, `pausa_automatica_ate=null`, `pausa_automatica_motivo=null`.
     - Retomar (estava `pausado`): só zera `estado_pool='ativo'`, `pausa_automatica_ate=null`, `pausa_automatica_motivo=null` (preserva `fase_rampup` / `data_ativacao_api`).
  3. Toast de sucesso/erro (reaproveita `toast` já importado).
  4. Recarrega a lista de instâncias chamando a função que já popula `instancias` no `EnvioMeta` (a mesma usada no `useEffect` inicial / após editar).
- Estado local `ativandoPoolId` para desabilitar o botão e mostrar `<Loader2 className="animate-spin" />` durante o `UPDATE`.
- `e.preventDefault(); e.stopPropagation();` no `onClick` para não disparar o `Checkbox` do `<label>`.

## Efeito colateral positivo
Depois da ativação, o aviso amarelo "Nenhuma instância marcada está ativa no pool" (linha 930) some sozinho, pois é derivado de `estado_pool`. O botão de disparo em massa desbloqueia sem sair do modal.

## Fora do escopo
- Sem mudança em `PoolMetaPanel`, edge functions ou RLS.
- Sem alterar lógica de ramp-up, tier ou saúde.
- Nenhuma mudança de banco.