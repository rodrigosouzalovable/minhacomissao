# Trava diária: 1 mensagem por telefone por dia

## Objetivo
Nenhum cliente recebe mais de 1 mensagem automática/de campanha (template) no mesmo dia, somando todas as campanhas, planilhas, lembretes e números. Evita os bloqueios que derrubaram a qualidade hoje.

## Como vai funcionar
- Antes de cada envio de template, o sistema confere se aquele telefone (pelos últimos 8 dígitos) já recebeu qualquer template hoje (dia em horário de Brasília), por qualquer número oficial.
- Se já recebeu, o envio é pulado e marcado como "Já recebeu mensagem hoje". Não entra em blacklist, não gasta cobrança e o contato volta a ficar disponível amanhã.
- A reserva é feita no momento do envio de forma atômica: duas campanhas rodando ao mesmo tempo não conseguem mandar para o mesmo telefone.
- Também elimina telefones repetidos dentro da mesma planilha/carteira antes de gerar os lotes.

## Onde vale
- Campanha diária da carteira UME/Odres (08h)
- Envio Meta por planilha (manual, incluindo Thiago e demais parceiros)
- Repescagem de 1ª parcela, mensagens de atraso, lembretes automáticos
- Prospecção (Certificado, Black Friday, USA)

## O que NÃO é bloqueado
- Respostas dentro de uma conversa aberta: atendentes no Inbox, IAGO, Clara, boleto/PIX do botão "Quero o boleto".
- Notificações internas para o admin/operadores.

## Prioridade
Quem envia primeiro no dia reserva o telefone. Como os lembretes de parcela rodam às 09h20 e a carteira às 08h, um cliente com acordo ativo nunca entra na carteira (já é excluído hoje), então o lembrete não é prejudicado.

## Na tela
- Contador "Pulados: já receberam hoje" no resultado de cada campanha do Envio Meta.

## Detalhes técnicos
- Nova tabela `meta_envio_diario_telefone (dia date, sufixo text, instance_id, template_nome, origem, created_at, PK(dia, sufixo))`, RLS staff-only, limpeza de linhas com mais de 7 dias via a rotina diária já existente (sem cron novo).
- RPC `reservar_envio_diario_telefone(p_telefone, p_template, p_origem)` com `INSERT ... ON CONFLICT DO NOTHING RETURNING` → true/false.
- Chamada central em `_shared/send-whatsapp-meta-handler.ts` para envios `type=template` com flag `proativo` (padrão true); chamadas de conversa (Inbox, IAGO, boleto imediato, notificar-admin) passam `proativo:false`. Se a Meta recusar o envio, a reserva é liberada.
- Dedup prévio por sufixo em `process-campanha-meta-diaria`, `envio-meta-massa-iniciar` e `meta-atrasados-handler`; status `pulado_ja_recebeu_hoje` em `envio_meta_job_item`.
- Teste Deno: segundo envio no mesmo dia para o mesmo sufixo retorna bloqueado; dia seguinte libera; envio de conversa não é bloqueado.

## Custo
Uma consulta indexada por envio (PK), sem cron, polling ou realtime novos — impacto desprezível.
