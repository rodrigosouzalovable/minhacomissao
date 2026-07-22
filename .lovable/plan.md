## Problema

No diálogo de detalhes da campanha, o cabeçalho mostra corretamente **1882/2302 processados** (esse número vem da linha do job, atualizada pelo backend), mas a lista **"Enviados"** e os cards de entrega (Aceito/Entregue/Lida/Falhou/Aguardando) ficam travados em **1000**, sem atualizar em tempo real. Só quando o usuário clica em "Atualizar" é que os números se aproximam, mas ainda assim param em 1000.

Duas causas somadas:

1. **Cap de 1000 do PostgREST**. A query em `carregarItens` (`EnvioMetaSendingContext.tsx`, linha ~201) usa `.limit(2000)`, mas o Supabase tem `max_rows=1000` na Data API — o `.limit(2000)` é ignorado. Por isso a lista/contadores derivados nunca passam de 1000, mesmo depois de "Atualizar".

2. **Polling só roda enquanto o job está `rodando`/`pausado`**. No print, o job já está com badge **"Erro"** (o worker encerrou porque a instância foi bloqueada). Como o status não é rodando/pausado, o `setInterval` (linha 61) nem é armado — e o realtime de `envio_meta_job_item` também não dispara mais eventos novos (o backend parou de escrever). Resultado: os itens que **ainda existem** no banco não são carregados até o usuário clicar em "Atualizar" manualmente.

Além disso, o realtime que existe hoje (`event: "*"` em `envio_meta_job_item`) é frágil: para uma campanha com 2 mil linhas mudando de status a cada segundo, os eventos podem ser descartados pelo canal, o que reforça a percepção de "só atualiza se eu apertar o botão".

## Correção

Editar `src/contexts/EnvioMetaSendingContext.tsx`:

### 1. Paginar `carregarItens` (elimina o teto de 1000)
Trocar a query única `.limit(2000)` por um loop que busca em páginas de 1000 usando `.range(from, to)` até acabar. Filtro/ordenação continuam iguais (`job_id`, `status in ('enviado','erro')`, `processado_em desc`). Aplicar teto de segurança em ~10.000 linhas por job para não travar o navegador em campanhas gigantes.

### 2. Reagir a mudanças nos contadores do job
Sempre que o realtime em `envio_meta_job` atualizar um job específico e os contadores `enviados+erros` do banco divergirem do que está em cache (`itensByJob.get(jobId).length`), disparar `carregarItens(jobId)` automaticamente. Isso garante refresh em tempo real mesmo depois que o job muda de `rodando` → `concluido`/`erro`, e evita depender só do stream de `envio_meta_job_item` (que é ruidoso).

### 3. Polling do diálogo — remover a condição de status
Em `src/components/meta/CampanhaDetalheDialog.tsx`, o `setInterval` (linhas 57–63) fica ativo sempre que o diálogo estiver aberto **e** os contadores do job ainda estiverem divergindo do cache local. Isso cobre também o caso do job em erro que ainda tem itens novos para sincronizar. Assim que os números baterem, o polling para sozinho e não consome nada.

## Efeito esperado

- O contador "Enviados (N)", os cards Aceito/Entregue/Lida/Falhou/Aguardando e a lista rolável passam a bater com o "1882/2302 processados" em tempo real, sem clicar em "Atualizar".
- Funciona também para campanhas grandes (>1000 itens) e para jobs que já mudaram para `erro`/`concluido`/`cancelado`.
- Zero custo adicional: o polling extra só existe enquanto há divergência e o diálogo está aberto.

## Fora do escopo

Nenhuma mudança em edge functions, no motor de disparo ou no schema do banco. Apenas leitura de dados no cliente.
