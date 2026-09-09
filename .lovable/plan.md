# Avaliação de resultado das campanhas (respostas, taxa de retorno e acordos)

Sim, é possível — e os dados necessários já existem no sistema. Fiz um teste com a campanha "Colchão vencido 09_09" (377 envios): o sistema identificou 61 clientes que responderam, ou seja 16,2% de taxa de resposta. Acordos: nenhum ainda vinculado a essa campanha.

## O que você vai ter

**1. Painel "Resultado das campanhas" (somente admin)**
Na aba de campanhas, cada campanha passa a mostrar:
- Enviadas, entregues e falhas
- Conversas abertas (quantos clientes responderam pela primeira vez)
- Total de respostas recebidas
- Taxa de resposta (%)
- Acordos fechados vindos da campanha e taxa de conversão (%)
- Botão para atualizar os números na hora e exportar em Excel

**2. Relatório diário no WhatsApp (só 62991672674), às 19h30 BRT**
Uma mensagem por dia com todas as campanhas enviadas naquele dia:
- Nome da campanha, enviadas, respostas, conversas abertas, taxa de resposta
- Acordos fechados e valor total desses acordos
- Comparação com a média dos últimos 7 dias (subiu/caiu)
- Ranking: melhor e pior campanha do dia por taxa de resposta
- Aviso destacado quando alguma campanha ficar abaixo de 8% de resposta

Domingo não envia (segue a regra atual do sistema).

## Como a contagem é feita

- **Resposta**: mensagem recebida daquele telefone depois do envio da campanha, dentro de 72h. Casamento por sufixo de 8 dígitos, como no resto do sistema.
- **Conversa aberta**: cliente distinto que respondeu ao menos uma vez.
- **Acordo da campanha**: acordo criado depois do envio, com o mesmo CPF do contato da campanha, dentro de 15 dias.
- Cada contato conta uma única vez, mesmo que responda várias mensagens.

## Detalhes técnicos

- Nova tabela `envio_meta_job_resultado` (1 linha por campanha): `respostas`, `conversas_abertas`, `contatos_responderam`, `acordos_fechados`, `acordos_valor`, `taxa_resposta`, `taxa_acordo`, `calculado_em`. GRANT para `authenticated` + `service_role`, RLS com SELECT apenas para `has_role(auth.uid(),'admin')` e escrita apenas via `service_role`.
- RPC `envio_meta_job_resultado_calcular(job_id uuid)` (SECURITY DEFINER, admin-only): cruza `envio_meta_job_item` (status `enviado`, `processado_em`, `telefone`, `cpf`) com `meta_whatsapp_mensagens` (`direcao='entrada'`, janela 72h, sufixo 8 dígitos) e com `acordos` (`cliente_cpf` normalizado, janela 15 dias), e grava/atualiza a linha do resultado.
- Índices de apoio: `meta_whatsapp_mensagens (direcao, timestamp_msg)` e expressão de sufixo já usada nas buscas; `envio_meta_job_item (job_id, status, processado_em)`.
- Nova edge function `envio-meta-relatorio-diario`: recalcula as campanhas do dia, monta a mensagem e envia por `notificarNumeros` com idempotência `campanhas-diario-YYYY-MM-DD`, destinatário único `62991672674`. Cron diário `30 22 * * 1-6` UTC (19h30 BRT).
- Frontend: novo componente `CampanhaResultadoCard.tsx` usado no detalhe da campanha em `EnvioMeta.tsx`, visível somente quando `useUserRole` retorna admin; recálculo sob demanda via RPC e export Excel com `exportExcel`.
- Custo: o recálculo roda 1x/dia por campanha do dia mais quando você clicar em atualizar — sem polling nem cron extra além do relatório das 19h30.
