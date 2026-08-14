# Avisos de negociação fechada pelo IAGO não chegam no WhatsApp

## O que está acontecendo

O IAGO **está** disparando o aviso. No histórico de notificações do sistema existem os registros de hoje (ex.: cliente SONIA MARIA NASCIMENTO DE LIMA às 17:37 BRT, e vários outros de 17:20 a 17:37), enviados para os dois números configurados (62991672674 e 6484480875).

O problema é no envio: **todos esses avisos ficaram com status "erro"**. O detalhe do erro guardado mostra:

- a primeira tentativa recebe uma resposta da instância que o sistema classifica como "erro" apenas porque o texto da resposta contém a palavra "error" (a resposta é um bloco de dados de quota/limite do WhatsApp, não necessariamente uma falha);
- em seguida o sistema tenta outros endereços de envio da mesma instância e recebe "Method Not Allowed" (405), e desiste.

Ou seja: a regra de "deu erro / deu certo" está errada e/ou a instância usada não conseguiu entregar — e não existe nenhum caminho alternativo, então o aviso simplesmente morre no log e você não recebe nada.

## Correções

1. **Validar corretamente a resposta do envio**: em vez de procurar a palavra "error" no texto, interpretar a resposta como JSON e só considerar falha quando houver indicação real de falha (campo de erro/`success:false`/HTTP de erro). Resposta com identificador de mensagem = enviado.
2. **Guardar o erro completo** (hoje é cortado em 200 caracteres), para diagnóstico real quando voltar a falhar.
3. **Tentar todas as instâncias, não só a primeira**: se uma instância falhar de verdade, seguir o rodízio até esgotar as conectadas antes de marcar erro.
4. **Caminho alternativo pela API Oficial da Meta**: se nenhuma instância comum entregar, reenviar o aviso pela instância oficial (mesma função usada no Inbox) para os números de emergência, quando houver janela ativa.
5. **Aviso visível dentro do sistema**: registrar as escalações do IAGO também como notificação interna (sino/painel), com nome do cliente, telefone, CPF e motivo, para que nada dependa exclusivamente do WhatsApp.
6. **Reenvio automático dos pendentes**: os avisos que ficaram em erro nas últimas horas são reprocessados uma vez após a correção, para você receber as negociações de hoje.

## Detalhes técnicos

- `supabase/functions/_shared/notificar-admin.ts`: refazer `hasProviderError` com parsing de JSON; não truncar `erro_detalhe`; continuar o loop de instâncias após falha não-retryable; ao esgotar as instâncias UAZAPI, tentar `send-whatsapp-meta-text` para cada destinatário.
- `supabase/functions/_shared/iago.ts` (`avisarEmergencia`): além do WhatsApp, inserir registro em log/notificação interna com contato, motivo e link da conversa.
- Front: exibir esses avisos no sino/painel de notificações existente (somente leitura, sem novo polling — reaproveitando a consulta já existente do sino).
- Sem cron novo e sem Realtime novo: custo praticamente inalterado.
