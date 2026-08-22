# Liberar envios da instância SOUZA 62 8268-4860 (e tratar bloqueio real da Meta)

## O que os dados mostram

A instância do print é **SOUZA 62 8268-4860** (Phone ID 1261905507008798). No banco:

- `saude_status = CONNECTED`, `saude_quality = RED`, `qualidade_liberada_manual = false`
- `estado_pool = restrita`, pausa automática até **23/08 11:04 BRT**, motivo **"Business Account locked"**
- Todas as saídas recentes (textos e o PDF do print) estão com `status_envio = erro` e erro **"Business Account locked"** — desde 21/08.

Ou seja: **o que está travando não é a qualidade RED**, e não é uma regra nossa de janela de 24h. A própria Meta está recusando os envios com o erro `#131031 – Business Account locked` (Business Manager bloqueado / em revisão). Enquanto a Meta mantiver esse bloqueio, nenhum envio por esse número vai passar, mesmo se o sistema liberar. O banner "Qualidade da instância BAIXA" que aparece na conversa está confundindo o diagnóstico, porque esconde o motivo real.

## O que vou fazer

### 1. Mostrar o motivo real na conversa
No banner de saúde da conversa, quando a instância estiver restrita/pausada por motivo da Meta, mostrar isso em vermelho com o texto correto: "Business Manager bloqueado pela Meta (#131031) — envios recusados até a liberação", incluindo até quando a pausa vale. O aviso de qualidade RED/YELLOW continua, mas só aparece quando não houver bloqueio real.

### 2. Confirmar que qualidade baixa não bloqueia resposta
Manter e blindar a regra: RED/YELLOW **não** impede responder cliente com janela de 24h aberta (texto, áudio, mídia e documento). O único bloqueio permitido em resposta manual é bloqueio real da Meta (conta bloqueada/banida, número inacessível, pendência de pagamento).

### 3. Tradução do erro para o operador
Adicionar o `#131031` / "Business Account locked" na humanização de erros: explicar em português que o Business Manager está bloqueado, que é preciso resolver no Business Manager (verificar restrição/apelação e método de pagamento) e que o sistema já roteou os envios para os outros números.

### 4. Liberação automática quando a Meta desbloquear
- No diagnóstico/checagem de saúde da instância: se a Meta voltar a responder sem o `#131031`, remover a restrição automaticamente (`estado_pool = ativo`, limpar pausa) e avisar no WhatsApp uma vez.
- Adicionar no card da instância um botão **"Revalidar na Meta"** que faz essa checagem na hora, para não precisar esperar o cron.

### 5. Sem novos envios repetidos no vazio
Enquanto a conta estiver bloqueada, as respostas manuais dessa conversa mostram o motivo real imediatamente, em vez de gravar mensagem com erro a cada tentativa.

## Detalhes técnicos

- `src/components/inbox/meta/MetaInstanceHealthBanner.tsx`: passar a receber `estado_pool`, `pausa_automatica_ate`, `pausa_automatica_motivo` e avaliar bloqueio real antes de qualidade; `src/pages/InboxMeta.tsx` passa esses campos.
- `src/lib/humanizarErroEnvio.ts`: nova regra para `131031` / "Business Account locked".
- Novo helper em `supabase/functions/_shared/` para detectar `131031` no retorno da Graph (mesmo padrão do helper de `#100`) usado por `send-whatsapp-meta`, `send-whatsapp-meta-text` e `send-whatsapp-meta-media`.
- `check-meta-instance-health` / `meta-diagnose-instance`: ao confirmar número operacional, limpar `estado_pool='restrita'` + `pausa_automatica_*` quando o motivo gravado for de bloqueio Meta já resolvido, e notificar admin (1x).
- `ConfigurarMeta.tsx`: botão "Revalidar na Meta" no card, chamando a função de diagnóstico existente.
- Sem migração de banco e sem novo cron — nenhum aumento de custo no Cloud.

## Ação sua na Meta

Para esse número voltar a enviar, o bloqueio precisa ser resolvido do lado da Meta: no Business Manager da BM "BM Rodrigo Ribeiro (Facebook Avatus)", verificar a restrição da conta (Central de Qualidade / Central de Contas), enviar apelação se houver e conferir o método de pagamento. Também aparece "Meta: Souza e Ribeiro (DECLINED)" — o Display Name foi reprovado e precisa ser reenviado para aprovação. Enquanto isso, o sistema roteia os disparos para os outros números automaticamente.
