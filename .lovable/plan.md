# Boleto + PIX da UME direto na conversa (API oficial)

A API oficial da UME já está conectada e testada no ambiente de desenvolvimento: gerar boleto devolve de uma vez o PIX copia e cola, o link do boleto e o QR code. O código interno do cliente (borrowerId) já vem na consulta da calculadora UME e fica guardado no cache — não precisa de consulta extra.

## O que você vai ver

1. Na janela da calculadora UME (dentro da conversa), um novo botão **"Gerar boleto + PIX"**:
   - Você escolhe a data de vencimento (padrão: hoje + 3 dias).
   - O sistema gera o boleto na hora pela API oficial e mostra na tela:
     - **PIX copia e cola** (com botão de copiar);
     - **Link do boleto** (com botão de copiar);
     - Valor e vencimento.
   - Fica um botão para enviar esses dados na conversa do cliente.
2. No **IAGO**: quando o cliente de UME pedir boleto, PIX ou segunda via na conversa, o IAGO gera o boleto sozinho e responde com o PIX copia e cola e o link do boleto.
3. Cada boleto gerado fica registrado: quem gerou (atendente ou IAGO), CPF, valor, vencimento e horário.

## Limites desta etapa

- Tudo roda no **ambiente de testes da UME** até a homologação terminar. A produção só liga quando você autorizar (chave UME_PRD_LIBERADO).
- O boleto usa o código interno do cliente que já vem na consulta da calculadora. Se o cliente nunca foi consultado, o sistema consulta antes automaticamente.
- O fechamento de acordo pela API (simular/efetivar) fica para a próxima etapa — esta etapa é só boleto + PIX.

## Detalhes técnicos

- **Nova edge function `ume-boleto`:** usuário autenticado (não precisa ser admin — gerar boleto não altera dívida). Ações: `gerar` (cpf + vencimento → borrowerId via cache da calculadora → `gerarBoletoUnico` → devolve pixCode/invoiceUrl/valor). Reutiliza `_shared/ume-api.ts` (token, ritmo de 30 req/min, trava de produção).
- **Migração:** tabela `ume_boleto_log` (user_id, cpf, borrower_id, invoice_id, valor, vencimento, origem: 'atendente'|'iago', criado_em) com RLS: usuário vê os próprios, admin vê todos; GRANT authenticated insert/select, service_role all.
- **Frontend:** botão e painel de resultado dentro de `ConsultaUmeDialog.tsx` (sem tela nova); envio na conversa reutiliza o envio de mensagem já existente do Inbox Meta.
- **IAGO:** em `iago-atendimento`, detecção de pedido de boleto/PIX/segunda via no contexto UME → chama a mesma função → responde com PIX + link. Sem cron, sem polling, sem Realtime novo: tudo por clique ou por mensagem recebida.
- Custo de backend desprezível (uma chamada por boleto gerado).
