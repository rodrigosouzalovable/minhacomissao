# Atendimento com IA na caixa "IA" (Inbox Meta Oficial)

Objetivo: quando um cliente escrever numa conversa que está na caixa **IA**, o sistema responde sozinho — consulta os débitos no sistema, monta a proposta e envia. Se o cliente já tiver acordo lançado, a IA não negocia: avisa um contato de emergência para um humano assumir.

## Como vai funcionar

1. Cliente manda mensagem numa conversa da caixa **IA**.
2. O sistema identifica o CPF pelo telefone (últimos 8 dígitos).
   - Não encontrou CPF: a IA pede o CPF e valida a resposta.
3. Com o CPF em mãos:
   - **Já tem acordo lançado** → a IA não faz proposta. Manda uma mensagem educada ("um atendente vai te chamar em instantes") e dispara aviso no WhatsApp para os contatos de emergência: nome, telefone do cliente, atendente que lançou o acordo e status do acordo. A conversa é marcada como "aguardando humano" e a IA para de responder ali.
   - **Sem acordo** → busca os débitos ativos, calcula a proposta pelas regras já usadas no portal (à vista com desconto, parcelado até N vezes, parcela mínima R$100) e envia a mensagem montada a partir do modelo configurado.
4. Cliente responde escolhendo à vista ou parcelado → a IA confirma a opção e avisa os contatos de emergência para um humano fechar o acordo (a IA nunca cria acordo sozinha).
5. Qualquer mensagem enviada por um atendente humano naquela conversa desliga a IA nela automaticamente (não atropela atendimento humano).
6. Todo o histórico da IA fica registrado para auditoria.

Escopo confirmado: a IA age **somente** em conversas dentro da caixa IA. Nada muda nas outras caixas.

## Botão de configuração dentro da caixa IA

Botão de engrenagem "Configurar IA" na caixa IA, abrindo um painel com:

- **Liga/desliga** o atendimento automático.
- **Modelos de mensagem** editáveis por etapa, com variáveis clicáveis:
  - saudação / pedido de CPF
  - proposta (à vista + parcelado)
  - CPF inválido ou sem débitos
  - cliente já tem acordo (mensagem ao cliente)
  - confirmação da escolha do cliente
  - Variáveis: `{primeiro_nome}`, `{cpf_formatado}`, `{credor}`, `{valor_total}`, `{valor_avista}`, `{desconto_avista_pct}`, `{max_parcelas}`, `{valor_parcela}`, `{valor_parcelado}`, `{telefone_contato}`
- **Parâmetros da proposta**: % desconto à vista, % desconto parcelado, máximo de parcelas, parcela mínima.
- **Contatos de emergência**: lista onde você adiciona/remove números (já pré-cadastrado 62991672674) com nome e liga/desliga cada um. É para esses números que vai o pedido de assumir a negociação.
- **Horário de atendimento** da IA (opcional) e limite de mensagens por conversa/dia como proteção anti-loop.

## Detalhes técnicos

Banco (nova migração):
- `meta_ia_config`: ativo, percentuais/parcelas, horário, limites — 1 linha global (admin).
- `meta_ia_templates`: etapa, texto, ativo.
- `meta_ia_contatos_emergencia`: nome, telefone, ativo.
- `meta_ia_conversas_estado`: por contato — etapa atual, cpf capturado, `aguardando_humano`, contadores, timestamps (evita loop e mensagens repetidas).
- RLS: leitura/escrita para admin; `service_role` liberado para as edge functions.

Backend:
- Nova edge function `meta-ia-atendimento`: recebe a mensagem recebida, resolve CPF (reaproveitando as RPCs existentes `buscar_devedores_por_documento`, `consultar_debitos_por_cpf`, `cpf_has_acordo`, `cpf_acordo_funcionario_nome`), decide a etapa, monta a mensagem e envia via `send-whatsapp-meta` pela própria instância da conversa. Aviso de emergência enviado via WhatsApp para os contatos cadastrados.
- Interpretação da resposta do cliente (CPF, "à vista", "parcelado", dúvidas) usando Lovable AI com fallback por palavra-chave, sempre limitada às regras e valores calculados pelo sistema — a IA não inventa valores.
- `meta-whatsapp-webhook`: ao gravar mensagem recebida, se a conversa estiver na caixa IA e a IA estiver ligada, chama a nova function em background. Mensagem enviada por humano marca a conversa como assumida.

Frontend:
- Novo `MetaIAConfigDialog.tsx` com as abas Modelos / Proposta / Contatos de emergência / Regras.
- Botão de acesso na barra da caixa IA em `InboxMeta.tsx` (visível para admin) + indicador visual "IA ativa / aguardando humano" na lista de conversas.

Custos: a IA só roda em mensagens recebidas dentro da caixa IA, com limite por conversa/dia — sem cron, sem polling novo.
