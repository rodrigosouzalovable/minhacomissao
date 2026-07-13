## Objetivo

Permitir múltiplas campanhas Meta rodando em paralelo, cada uma com seu próprio conjunto de instâncias (números) e template, e um widget flutuante global para monitorar e abrir cada campanha em um dialog dedicado.

Sim, é totalmente viável — o backend já roda job-a-job (a função `envio-meta-massa-tick` já opera por `job_id`, e a tabela `envio_meta_job` suporta N jobs por usuário). O que precisa mudar é: (a) parar de cancelar jobs antigos ao iniciar um novo, (b) o contexto do frontend passar a listar N jobs em vez de 1, e (c) adicionar um mini painel flutuante.

## Mudanças

### 1. Backend — `envio-meta-massa-iniciar/index.ts`

- Remover o trecho que cancela silenciosamente jobs `rodando`/`pausado` anteriores do mesmo usuário.
- Manter o restante do fluxo (validação de template MARKETING, inserção do job + itens, primeiro tick + loop).
- Adicionar `nome_campanha?: string` (opcional) no payload para o usuário identificar a campanha.

Nenhuma alteração em `envio-meta-massa-tick`, `pick-meta-instance`, `envio-meta-massa-control` (todas já operam por `job_id`).

### 2. Migração SQL

- `ALTER TABLE public.envio_meta_job ADD COLUMN nome_campanha text NULL;` (rótulo amigável para exibir no widget; opcional).

### 3. Frontend — `EnvioMetaSendingContext.tsx` (refactor para multi-job)

- State passa de `job` (1) para `jobs: any[]` (todos ativos + últimos finalizados, digamos os 20 mais recentes).
- `carregar()` lista todos os jobs do usuário nos status `rodando|pausado|concluido|cancelado|erro`, mais recentes primeiro.
- `itens` e `logStatus` viram maps indexados por `job_id`: `itensByJob: Map<string, any[]>`, `logStatusByJob: Map<string, Map<string, {status, erro}>>`. Cada dashboard carrega sob demanda por job.
- Realtime: o filtro atual já é por `user_id`, então continua funcionando; ao receber um evento em `envio_meta_job_item` recarregamos o job específico afetado.
- API do contexto passa a expor:
  - `jobs`: lista completa (com progresso derivado por job).
  - `jobsAtivos`: filtro para `rodando|pausado`.
  - `iniciar(p)`: idêntico ao atual, mas SEM aviso de "um envio já está rodando".
  - `togglePausa(jobId)`, `cancelar(jobId)`, `limpar(jobId)`, `reativar(jobId)`, `refreshStatus(jobId?)`.
  - `getDetalhes(jobId)`, `getDeliveryResumo(jobId)`, `getProgresso(jobId)`, `getResultado(jobId)`.
- Mantém compat mínima para não quebrar `EnvioMeta.tsx`: expõe também getters equivalentes que aceitam `jobId` como argumento.

### 4. Novo componente — `src/components/meta/CampanhasFlutuante.tsx`

- Botão flutuante fixo no canto inferior direito (badge circular com número de campanhas ativas). Renderizado globalmente pelo `AppLayout` quando `jobsAtivos.length > 0`.
- Ao clicar, abre um Popover/Sheet compacto com a lista de campanhas ativas + últimas 5 finalizadas: nome/template, instâncias em uso, progresso `X/Y`, próximo envio em `Ns`, status (rodando/pausado/concluido/cancelado), botões de ação rápidos (pausar/retomar/cancelar).
- Cada linha tem "Ver detalhes" que abre `CampanhaDetalheDialog` (novo).

### 5. Novo componente — `src/components/meta/CampanhaDetalheDialog.tsx`

- Dialog em tela cheia (max-w-5xl) exibindo tudo o que hoje aparece inline em `EnvioMeta.tsx` para um job:
  - Header com nome/template/instâncias/status/progresso.
  - Barra de progresso + próximo envio.
  - Abas "Enviados", "Erros", "Sem WhatsApp" (essa aba vem só se `LocalExtras` conhece esse job).
  - Delivery resumo (aceito/entregue/lida/falhou/aguardando).
  - Controles: Pausar/Retomar, Cancelar, Reativar (se finalizado com pendentes), Limpar (se finalizado sem pendentes).
- Recebe `jobId` e busca via `getDetalhes(jobId)` etc.

### 6. `EnvioMeta.tsx`

- Card de composição de envio (template + instâncias + destinatários) permanece igual.
- Botão "Enviar em massa" NÃO bloqueia mais quando há campanha rodando; ele apenas cria um novo job.
- Novo campo opcional "Nome da campanha" no card do template (usado para diferenciar no widget).
- O painel de progresso inline atual continua funcionando, mas passa a mostrar somente o último job iniciado nesta sessão (`ultimoJobIdIniciado`), com um link "Ver todas as campanhas" que abre o widget flutuante expandido.

### 7. `App.tsx` / `AppLayout.tsx`

- Renderizar `<CampanhasFlutuante />` uma vez dentro do `EnvioMetaSendingProvider`, para ficar disponível em qualquer rota autenticada.

## Regras / considerações

- **Compartilhamento de instância**: se o usuário selecionar a mesma instância em duas campanhas concorrentes, o backend continua funcionando (o `pick-meta-instance` respeita cota diária/health por instância, então o round-robin de cada job simplesmente compete pelo pool). Nenhum lock exclusivo — é intencional para não engessar o usuário.
- **Custo**: a confirmação de custo (dialog que exige digitar o valor em BRL) continua sendo feita por campanha antes de iniciar — cada campanha exige nova confirmação.
- **Bloqueios globais** (domingo, fora do horário, tier cheio, pool pausado) continuam sendo aplicados pelo `pick-meta-instance` a cada tick, independente por job.
- **Limites de custo**: templates MARKETING permanecem bloqueados para envio em massa (regra já existente na função iniciar).

## Fora do escopo

- Sem reordenação/priorização entre campanhas concorrentes; cada uma segue seu delay configurado.
- Sem "clone campanha" ou reagendamento pelo widget (só controles básicos).
- Sem alteração no `AgendarCampanhaBox` (agendamento multi-dia).

## Testes manuais

1. Iniciar campanha A com instância X. Iniciar campanha B com instância Y sem cancelar A — confirmar que ambos rodam simultaneamente (badge mostra "2").
2. Abrir o widget flutuante, clicar em A → dialog mostra progresso/detalhes de A; fechar; clicar em B → detalhes de B.
3. Pausar A pelo dialog — B continua enviando.
4. Iniciar campanha C compartilhando instância X com A — verificar que a instância vai sendo escolhida por ambas conforme cota disponível, sem duplicar envio.
5. Concluir A — sumir dos "ativos", aparecer na lista de últimas 5 finalizadas do widget.