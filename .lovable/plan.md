# Campanha que "inicia" mas não aparece + pausa que não segura

## O que os dados mostram

- Sua última campanha criada no banco é a **MMP** (hoje 12:17 BRT, 260/346, rodando). Não existe nenhum job criado por volta das 15:0x BRT — ou seja, a campanha nova **não foi criada de fato**; o disparo falhou no servidor.
- O aviso verde "Campanha iniciada. Acompanhe no botão Campanhas." é exibido **sempre**, mesmo quando o início falha: a função de início captura o erro internamente e a tela mostra o sucesso logo depois. Por isso você viu "iniciada" sem campanha nenhuma.
- A causa mais provável da falha é a **sessão/token expirado**: o comando de início envia o token do navegador sem renovar (diferente do comando de pausar/retomar, que renova antes), e a função rejeita com "usuário inválido" (401). Isso combina com você estar agora na tela de login: o comando de controle, ao falhar em renovar, faz logout. Se ao repetir com a correção o erro for outro (ex.: template/instância), a mensagem real passará a aparecer na tela.
- Confirmado: o motor de envio só pega jobs com `status = 'rodando'`, então pausar deveria segurar. O que quebra a pausa hoje é o comando falhar (mesma questão de sessão) ou o botão decidir a ação por um status desatualizado na tela — nesse caso o clique manda "retomar" em vez de "pausar".

## Correções

### 1. Nunca mais dizer "iniciada" sem campanha
- O início passa a devolver o `job_id` (ou lançar o erro) para a tela.
- A tela só mostra "Campanha iniciada" quando o job existir de verdade; se falhar, mostra o **motivo real** vindo do servidor, sem limpar a lista de destinatários (você não perde o trabalho e pode tentar de novo).

### 2. Sessão renovada antes de disparar
- O disparo passa a usar o mesmo cuidado do comando de pausar: renova a sessão e envia o token novo. Se a sessão realmente expirou, aparece "Sua sessão expirou, entre novamente" em vez de um sucesso falso.
- A função de início passa a registrar no log o motivo de cada recusa (401, template, instância, categoria), para diagnóstico rápido.

### 3. Pausa que fica pausada
- O botão de pausar/retomar decide a ação pelo status **atual no servidor**, não pelo status desenhado na tela.
- Ao pausar: o job é gravado como pausado, a trava do worker é liberada e o `proximo_em` zerado, e a tela reflete "Pausado" imediatamente (sem esperar o próximo refresh).
- Blindagem no motor: a atualização de contadores/próximo envio só mexe no `proximo_em` quando o job ainda está `rodando`, então um envio em andamento no momento da pausa não reagenda a campanha.
- A retomada automática (que existe para jobs que caíram em erro/concluído com pendentes) continua **ignorando** jobs pausados.

## Detalhes técnicos

- `src/contexts/EnvioMetaSendingContext.tsx`: `iniciar` retorna `string | null` e reaproveita a rotina de refresh de sessão; `togglePausaJob` relê `status` do job no banco antes de escolher `pausar`/`retomar` e faz update otimista do estado local.
- `src/pages/EnvioMeta.tsx`: toast de sucesso e limpeza do formulário passam a depender do retorno de `iniciar`.
- `supabase/functions/envio-meta-massa-iniciar/index.ts`: `console.error`/`console.log` com motivo em cada retorno não-2xx.
- `supabase/functions/envio-meta-massa-control/index.ts`: em `pausar`, também limpa `worker_lock_token`/`worker_locked_until`.
- `envio_meta_job_bump`: adicionar `AND status = 'rodando'` na atualização (migração de função, sem mudança de tabela).

Sem novos crons, polling ou canais Realtime — nenhum impacto de custo no Cloud.
