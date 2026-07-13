## Objetivo

1. Fazer o botão flutuante **Campanhas** aparecer apenas para admins (invisível para todos os outros usuários).
2. Corrigir o bug em que, após iniciar uma campanha, o botão flutuante mostra o badge mas **não exibe a campanha ativa** no painel.

## Diagnóstico do bug

Em `src/pages/EnvioMeta.tsx`, dentro de `enviar()` (linha ~608), após chamar `iniciar(...)` do contexto, o código chama `limpar()` do mesmo contexto para "resetar" a UI legada. Mas `limpar()` é um wrapper que executa `limparJob(currentJob.id)` — e `currentJob` acabou de virar a campanha recém-criada (via `lastStartedId`). O `limparJob`:

- Detecta que o job está `rodando`, dispara `toast.error("Não é possível limpar enquanto a campanha está em andamento")` e sai.
- Mesmo saindo cedo, essa chamada é indevida e polui o fluxo.

Além disso, `iniciar()` já chama `carregarJobs()` internamente, mas há uma corrida: a função edge retorna o `job_id` antes de todos os `job_item` serem inseridos, então o primeiro `carregarJobs()` traz o job com `total = 0` até o realtime disparar o próximo refresh. Isso pode fazer o card aparecer vazio/sem progresso por alguns segundos e reforça a percepção de "não apareceu nada".

## Mudanças

### 1. `src/components/meta/CampanhasFlutuante.tsx`
- Importar `useUserRole` e retornar `null` enquanto `isLoading` for true ou quando `role !== "admin"`.
- Não alterar mais nada do componente.

### 2. `src/pages/EnvioMeta.tsx`
- Remover a chamada `limpar()` dentro de `enviar()` (linha ~608). O reset do formulário (`setRecipientsRaw`, `setRecipientsHeaders`, `setVarsByTel`, `setValidacaoPreview`, `setNomeCampanha`) continua igual.
- Após `iniciar(...)`, agendar um `refreshStatus()` extra ~1.5s depois via `setTimeout` para garantir que o job apareça com `total` correto assim que a edge terminar de popular os `job_item` (mitiga a corrida).

### 3. Sem mudanças em
- `EnvioMetaSendingContext.tsx` (a lógica de jobs, realtime, `jobsAtivos` está correta).
- Edge functions.
- `CampanhaDetalheDialog.tsx`.
- `App.tsx` (a montagem global do widget continua — o gate é feito dentro do próprio componente).

## Comportamento esperado após o fix

- Somente admin vê o botão flutuante "Campanhas".
- Ao clicar em "Disparar":
  - O formulário é liberado imediatamente (sem toast de erro do `limpar`).
  - O botão flutuante mostra a nova campanha em "Ativas" com nome, template, progresso e ações Pausar/Cancelar.
  - Campanhas subsequentes empilham na mesma lista, cada uma independente.
