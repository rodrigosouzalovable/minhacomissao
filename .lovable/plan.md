# Corrigir o atendimento da Clara na caixa CERTIFICADO

## Objetivo

Fazer a Clara interpretar corretamente respostas como **“Sim, meu contador informou”**, explicar a oferta de certificado digital e continuar o atendimento comercial. Quando precisar de ajuda, ela deverá marcar a conversa e avisar somente o WhatsApp administrativo principal.

## Atendimento comercial

1. Ajustar as instruções da Clara para que respostas ambíguas sobre contador ou emissão anterior não sejam tratadas como “número errado” nem fiquem sem resposta.
2. Na primeira resposta compatível, a Clara deverá informar que o contato é para verificar se o certificado digital já foi emitido e apresentar a promoção do **certificado digital PJ A1 por R$ 129,90**.
3. Finalizar essa abordagem perguntando se o cliente tem interesse em emitir o certificado.
4. Quando houver interesse, continuar usando as mensagens já configuradas para:
   - agendamento da videoconferência;
   - solicitação de CNPJ, e-mail e CNH;
   - confirmação de recebimento e entrega ao humano.
5. Manter silêncio somente para recusa clara, número realmente errado ou pedido de bloqueio.

## Auxílio humano

- Quando a Clara não puder continuar com segurança, aplicar a etiqueta **Aguardando Humano** e interromper novas respostas automáticas nessa conversa.
- Enviar um aviso somente ao WhatsApp administrativo principal já configurado, identificando cliente, telefone, motivo e caixa CERTIFICADO.
- Usar uma chave de idempotência por conversa e mensagem recebida para impedir alertas duplicados.
- Preservar o registro interno do encaminhamento mesmo se o WhatsApp administrativo estiver temporariamente indisponível.

## Correção do caso mostrado

- Reprocessar de forma controlada a conversa da **Gfo Store** após publicar a correção, para que a resposta pendente receba a abordagem comercial correta sem duplicar o template inicial.

## Validação

- Testar respostas sobre contador, certificado já emitido, interesse, dúvida, recusa, número errado e pedido de bloqueio.
- Confirmar que a Clara envia a oferta de R$ 129,90 no caso mostrado.
- Confirmar que a etiqueta é aplicada e que somente o administrador recebe o aviso de auxílio.
- Verificar histórico da conversa, estado da Clara, fila de aviso, compilação e publicação das funções afetadas.

## Custo e operação

Não será criado cron, polling ou nova rotina contínua. A mudança mantém uma chamada de IA por resposta recebida e acrescenta somente um aviso pela fila já existente quando houver encaminhamento humano, com impacto baixo e pontual.
