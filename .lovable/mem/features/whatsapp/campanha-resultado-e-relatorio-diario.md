---
name: Resultado das campanhas + relatório diário 19h30
description: Tabela envio_meta_job_resultado e RPC calculam respostas/conversas/acordos por campanha (admin-only) e relatório WhatsApp às 19h30 BRT seg-sáb
type: feature
---
- `public.envio_meta_job_resultado` (1 linha por `job_id`): enviados, falhas, respostas, conversas_abertas, contatos_responderam, acordos_fechados, acordos_valor, taxa_resposta, taxa_acordo. SELECT só para `has_role(auth.uid(),'admin')`.
- RPC `envio_meta_job_resultado_calcular(_job_id)` (SECURITY DEFINER, admin/service_role): resposta = mensagem `direcao='entrada'` até 72h após o envio, casada por sufixo de 8 dígitos; acordo = `acordos.cliente_cpf` normalizado igual ao CPF do item, criado até 15 dias após o envio.
- Card `src/components/meta/CampanhaResultadoCard.tsx` dentro de `CampanhaDetalheDialog` — visível só para admin, com botão Atualizar (chama a RPC) e Excel.
- Edge function `envio-meta-relatorio-diario`: recalcula todas as campanhas do dia, envia consolidado, ranking e comparação com média de 7 dias apenas para 62991672674; idempotência `campanhas-diario-YYYY-MM-DD`; domingo não envia. Cron `envio-meta-relatorio-diario-1930` (`30 22 * * 1-6` UTC).
- O relatório diário lista **somente campanhas cujo `user_id` tem role admin** (`user_roles.role='admin'`); campanhas de parceiros Meta/funcionários ficam fora, inclusive na média de 7 dias.
- Cada linha mostra o `template_nome`, e o fim do relatório traz desempenho por modelo nos últimos 30 dias (mín. 20 enviadas).
- Acordo casa por **sufixo de 8 dígitos de `acordos.cliente_telefone`** OU CPF normalizado (quando o item tiver CPF — hoje a maioria dos envios vem sem CPF), sempre `criado_em` entre o envio e +15 dias. Índice funcional em `acordos` pelo sufixo do telefone.
