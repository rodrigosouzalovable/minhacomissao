# Corrigir: IA para de responder após pedir o CPF

## O que eu verifiquei nos dados

- A IA pediu o CPF às 17:51 e a mensagem dela ficou gravada como mensagem de **saída** na conversa.
- Você respondeu `07460640204` às 17:59 e, nesse momento, a conversa foi marcada como **"aguardando humano"** (`aguardando_humano = true`, etapa ainda `pedir_cpf`). Com essa marca, a IA para de responder de propósito.
- O CPF tem débitos ativos: 7 parcelas ativas do credor UME/Novo Mundo (R$ 85,14 + 5x R$ 255,42 + 2x R$ 213,00). Ou seja, havia proposta a enviar — o bloqueio foi só a marca de "humano assumiu".

## Causa

A IA usa a regra "se existir mensagem de saída depois do meu último envio, então um humano assumiu". A própria mensagem da IA é gravada **depois** do horário registrado como "último envio da IA", então ela se confundiu com um atendente humano e se desligou sozinha na conversa.

## Correção

1. **Marcar as mensagens da própria IA**
   - Gravar o identificador da mensagem enviada pela IA no estado da conversa e ignorá-la na checagem de "humano assumiu".
   - Atualizar o corte de tempo somente **após** a gravação do envio, com uma pequena margem, para nunca capturar o próprio envio.
   - Só considerar "humano assumiu" quando a mensagem de saída não for uma das mensagens da IA.

2. **Destravar a conversa do William/Rodrigo**
   - Limpar a marca `aguardando_humano` desse contato e reprocessar o CPF já enviado, para que a proposta calculada seja enviada agora.

3. **Deixar a IA mais inteligente na conversa**
   - Aceitar CPF em qualquer etapa (inclusive se o cliente mandar o documento antes de ser pedido) e seguir direto para a proposta.
   - Se o cliente responder algo fora do previsto (dúvida, saudação, "quanto fica em 12x"), usar Lovable AI para interpretar a intenção — à vista, parcelado, pedir CPF de novo, ou dúvida real — em vez de simplesmente chamar humano.
   - Manter a chamada de humano apenas quando: já existe acordo lançado, o cliente aceita a proposta (para fechar), ou a dúvida realmente exige uma pessoa.
   - Ao aceitar, continuar avisando os contatos de emergência com nome, telefone, CPF, credor e opção escolhida.

4. **Custos**
   - Sem cron novo, sem polling. A IA continua rodando apenas quando chega mensagem na caixa IA, dentro do horário e do limite diário por conversa. A interpretação por Lovable AI só é chamada quando a detecção local por palavras-chave não resolve.

## Detalhes técnicos

- `supabase/functions/meta-ia-atendimento/index.ts`: guardar `wa_message_id`/id das mensagens enviadas em `contexto.msgs_ia`, excluir esses ids na consulta de `meta_whatsapp_mensagens` (direção saída), atualizar `ultimo_envio_ia` após o insert do envio; aceitar documento em qualquer etapa; fallback de intenção via Lovable AI Gateway (`LOVABLE_API_KEY`) com saída estruturada (`avista` | `parcelado` | `cpf` | `duvida`); logs por etapa.
- `supabase/functions/send-whatsapp-meta-text/index.ts`: retornar o id da mensagem gravada e aceitar uma flag `origem: 'ia'` para não marcar `aguardando_humano`.
- Reaproveita as RPCs existentes: `consultar_debitos_por_cpf`, `cpf_has_acordo`, `cpf_acordo_funcionario_nome`.
- Update pontual no estado da conversa do contato `901a6dba…` para destravar o teste.

## Como validar

Depois de aplicar, envie novamente `07460640204` do 62 98181-0202: a IA deve responder com a proposta calculada sobre o total das 7 parcelas ativas (à vista com 50% e parcelado com 30%, respeitando parcela mínima de R$ 100). Respondendo "quero parcelado", ela deve confirmar e avisar o 62 99167-2674.
