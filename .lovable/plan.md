# Por que só algumas instâncias ativaram chamadas — e como corrigir

Rodei a ativação em massa real na Meta nas 21 instâncias da aba API Oficial Meta. Resultado: **4 ativadas**, 17 recusadas — e cada recusa tem um motivo diferente, nenhum deles aleatório.

## O que a Meta respondeu, número por número

**Ativaram (app "Avatus"):** SOUZA 8268-4833, SOUZA 8269-1378, AVATUS 8268-9973, SOUZA 8268-4860 — status `ENABLED`.

**Erro 138018 — "pré-requisitos técnicos" (app "Edna Souza"):** 8267-7298, SOUZA 8269-0775, SOUZA 8268-4834, 8268-4808.
Esses números pertencem a um **outro aplicativo Meta** (Edna Souza, ID 1633134858145645). Você ativou o campo de webhook `calls` apenas no app **Avatus** (ID 2328366971280850). O app Edna Souza continua sem `calls` assinado, então a Meta bloqueia a ativação. Já tentei reinscrever o WABA automaticamente e a Meta manteve a recusa — é configuração de painel, não de código.

**Erro 141000 (app "Avatus"):** MEMU 37, IPHONE B2, SOUZA 8268-4387, SOUZA 8268-9823, 4 WORK B1, Novo Mundo 3144.
Mesmo app dos que funcionaram, ou seja o problema é **do número**, não do app. São números que a Meta não considera aptos a Calling — o caso do 8267-7298, por exemplo, está com `code_verification_status: EXPIRED`. Para esses é preciso reverificar/registrar o número no WhatsApp Manager.

**Erro 190 — token expirado:** SOUZA 8268-4366, SOUZA 8269-0288. Access token vencido; precisa ser atualizado no card da instância.

**Erro 200 — "API access blocked":** 62 8269-1381. Acesso da conta bloqueado pela Meta para esse número.

**"Sem acesso a esta instância" (4 itens):** instâncias de outros donos (parceiros Meta) — comportamento correto, não são suas para ativar.

## O que vou fazer no sistema

O código não estava errado; o que faltava é a UI **mostrar o motivo real por número** em vez de um toast genérico, e não tentar de novo o que é impossível.

1. **Relatório de ativação por número**: ao clicar em "Ativar chamadas em todos", abrir um painel com a lista — número, resultado (Ativado / Falhou), motivo em português e o **app da Meta** ao qual aquele número pertence. Hoje só aparece um toast com 3 falhas resumidas.
2. **Agrupar por causa** com a ação certa em cada grupo:
   - App sem `calls` → indicar o nome/ID do app que precisa ter o campo `calls` assinado no webhook.
   - Número não apto (141000) → indicar reverificação do número no WhatsApp Manager, mostrando o `code_verification_status` real.
   - Token expirado (190) → atalho para editar o token daquela instância.
   - Bloqueio (200) e instâncias de parceiros → apenas informativo, sem retry.
3. **Selo por card**: cada instância passa a mostrar "Chamadas: Ativas / Indisponível" com o motivo no tooltip, atualizado com o status real lido da Meta, em vez de só o valor gravado no banco.
4. **Botão "Tentar novamente nas pendentes"**: reexecuta apenas as instâncias cuja falha é recuperável (138018 e 190 após correção), sem repetir as bloqueadas.

## O que depende de você no painel da Meta

- Assinar o campo de webhook **`calls`** no app **Edna Souza** (mesmo passo que você já fez no Avatus) — libera 4 números de uma vez.
- Reverificar os números com verificação expirada (inclui o Novo Mundo 3144) no WhatsApp Manager.
- Atualizar o access token das 2 instâncias com token vencido.

## Detalhes técnicos

- `src/pages/ConfigurarMeta.tsx`: `ativarChamadasTodas` passa a guardar `resultados` em estado e abrir um dialog novo (`ChamadasAtivacaoResultadoDialog`) com agrupamento por `codigo`; selo de chamadas por card usando `status` real.
- `supabase/functions/meta-call-settings/index.ts`: já retorna `codigo` e `app` por instância; incluir também `code_verification_status` e um campo `recuperavel: boolean` para alimentar o botão de retry.
- Nenhuma tabela, cron, polling ou canal Realtime novo — custo de backend inalterado.
