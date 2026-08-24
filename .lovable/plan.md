# Copiloto de Objeções — sugestões de resposta no Inbox

Objetivo: quando o cliente traz uma objeção ("não tenho condições de pagar", "está caro", "vou pensar", "só mês que vem"), o sistema mostra discretamente, no canto inferior direito da conversa, 2 ou 3 sugestões de resposta criadas pela IA com base na conversa real, nos valores da proposta e no que já funcionou em negociações anteriores. Com o tempo o sistema aprende quais respostas convertem e passa a sugerir as melhores primeiro.

## Aviso de custo (Lovable Cloud / IA)

Essa função chama IA durante o atendimento. Para manter o custo baixo, o plano é:

- A sugestão só é gerada quando o atendente está com a conversa aberta na tela e a última mensagem é do cliente. Nada roda em background nem no webhook.
- Uma chamada por mensagem do cliente, com cache no banco: reabrir a conversa não gera nova chamada.
- Detector local (sem IA) de objeção: se a mensagem claramente não é objeção, não chama IA.
- Modelo rápido e barato para a sugestão; o aprendizado roda 1x por dia.

Estimativa: cerca de 1 chamada curta de IA por objeção atendida (dezenas por dia, não milhares). Confirme antes de eu implementar.

## Como fica na tela

- Card flutuante pequeno no canto inferior direito da área de conversa, acima do campo de digitação, com título "Sugestões" e um X para fechar.
- Aparece apenas quando há objeção detectada na última mensagem do cliente; some quando o atendente responde.
- Cada sugestão: texto curto, rótulo da objeção (ex. "sem condições"), e dois botões: **Usar** (joga o texto no campo de digitação para o atendente editar/enviar) e **Copiar**.
- Botão "Gerar outras" para pedir novas variações.
- Um pequeno botão de lâmpada no cabeçalho da conversa permite reabrir/ocultar o painel manualmente.
- Só aparece para o atendente vinculado à conversa e para admins; nunca interfere no IAGO.

## Aprendizado (melhora com o tempo)

- Cada sugestão exibida/usada é registrada com a objeção detectada.
- Resultado da negociação é medido depois: cliente respondeu positivamente / conversa virou acordo (cruzando CPF ou telefone com `acordos`) / conversa morreu.
- Rotina diária revisa esses resultados, calcula taxa de conversão por resposta e por tipo de objeção, mantém as vencedoras no catálogo, reescreve/descarta as fracas e grava novos padrões aprendidos.
- O catálogo aprendido entra no prompt das próximas sugestões, então as respostas melhoram sozinhas.
- Tela de administração simples (dentro da configuração do IAGO, nova aba "Objeções") para ver o catálogo, taxa de conversão de cada resposta, editar, fixar favoritas ou desativar uma resposta.

## Detalhes técnicos

Banco (migração com GRANT + RLS):
- `objecao_catalogo`: `id`, `objecao_chave` (sem_condicoes, caro, vou_pensar, mes_que_vem, desconfianca, outro), `resposta`, `origem` (ia | manual | aprendizado), `credor` (nullable), `usos`, `conversoes`, `score`, `ativo`, timestamps.
- `objecao_sugestoes_log`: `id`, `instancia_id`, `telefone`, `mensagem_id` (mensagem do cliente que disparou), `objecao_chave`, `sugestoes` (jsonb), `catalogo_ids`, `usada_idx`, `usuario_id`, `resultado` (pendente | respondeu | acordo | sem_retorno), `criado_em`. Índice único em (`instancia_id`, `telefone`, `mensagem_id`) para servir de cache.
- RLS: leitura/escrita para `authenticated` limitada às conversas que o usuário já pode ver (reaproveitar `pode_ver_instancia_meta` / helpers de caixa existentes); `service_role` total.

Edge function `sugerir-resposta-objecao`:
- Entrada: `instancia_id`, `telefone`, `mensagem_id`, `forcar?`.
- Se já existe log para aquela `mensagem_id` e `forcar` não veio, devolve o cache.
- Carrega as últimas ~20 mensagens de `meta_whatsapp_mensagens`, credor da caixa, CPF/nome do contato e a última proposta enviada (valores já no histórico; se credor UME, reaproveita `consultarUme`/`propostaDaUme` de `_shared/ume-desconto.ts`).
- Classifica a objeção e gera 3 sugestões em uma única chamada ao gateway (`chamarIA` de `_shared/iago.ts`, JSON estrito), injetando no prompt as melhores respostas do catálogo para aquela objeção/credor e as regras de negociação (parcela mínima R$ 100, grades por credor, nunca prometer o que o sistema não calcula).
- Grava o log e devolve `{ objecao, sugestoes: [{ texto, catalogo_id }] }`. Erros do gateway (429/402/403) voltam com mensagem clara para a UI, sem retry automático.

Edge function `objecao-aprender` (cron diário, junto do horário do `iago-aprender`):
- Fecha os logs pendentes: marca `respondeu` / `acordo` / `sem_retorno` olhando mensagens posteriores e `acordos`.
- Atualiza `usos`, `conversoes` e `score` do catálogo; usa IA uma vez por dia para consolidar/reescrever as respostas vencedoras e criar novas entradas de aprendizado.

Frontend:
- Novo `src/components/inbox/meta/SugestoesObjecaoPanel.tsx`: card flutuante, chama a função, lista sugestões, botões Usar/Copiar/Gerar outras, marca `usada_idx` ao usar.
- `src/pages/InboxMeta.tsx`: detector local de objeção na última mensagem de entrada, montagem do painel dentro da área da conversa, botão de lâmpada no cabeçalho, e uso do `composerRef` existente para inserir o texto escolhido.
- Nova aba "Objeções" em `src/components/admin/IagoConfigDialog.tsx` para o catálogo e as métricas.
