## Objetivo

Quando um cliente consulta o CPF no portal, a notificação do sininho já vai para um atendente (rodízio). A partir de agora esse vínculo CPF → atendente também deve valer no WhatsApp: se o cliente responder no Inbox Meta Oficial, a conversa recebe a TAG do atendente que recebeu a notificação.

## Regras definidas

- **Prioridade:** se o CPF já tem acordo lançado, a TAG é do atendente do acordo. A consulta do portal só vale quando não há acordo.
- **Validade:** a consulta do portal só etiqueta se a resposta chegar em até 7 dias.
- Vale apenas para a caixa "Padrão" (caixas customizadas continuam sem etiqueta de atendente).
- A TAG entra travada (só admin remove), como já acontece hoje.

## Ordem de decisão na chegada de mensagem

```text
mensagem recebida (caixa Padrão, sem etiqueta de atendente ainda)
  1. telefone casa com acordo?            -> TAG do dono do acordo
  2. telefone -> CPF (devedor_telefones)
     -> consulta no portal nos últimos 7 dias?  -> TAG do atendente notificado
  3. nenhum dos dois                      -> rodízio atual (como hoje)
```

## Alterações

**1. Sininho mostra o telefone vinculado**
- Garantir que, ao criar a notificação, os telefones do CPF (vindos de `devedor_telefones`, os que foram importados) sejam gravados e exibidos no card do sininho, junto com nome/CPF/credor.
- Exibir os números no item da notificação, com botão de copiar.

**2. Registro do vínculo telefone → atendente**
- Na criação da notificação, gravar também o(s) sufixo(s) de 8 dígitos dos telefones do CPF, para busca rápida na hora que a mensagem chegar (índice por sufixo).

**3. Webhook do Inbox Meta**
- Após a tentativa de match por acordo (que continua tendo prioridade), acrescentar a busca: sufixo do telefone → CPF → consulta mais recente daquele CPF nos últimos 7 dias → atendente designado → aplicar a TAG "Atendente: <nome>" correspondente.
- Mantém o comportamento atual: só aplica TAG que já existe (não cria etiqueta nova), marca origem automática (travada) e pula caixas customizadas.
- Se não houver nome de etiqueta correspondente ao atendente, cai no rodízio atual.

## Detalhes técnicos

- Nova coluna de sufixos de telefone em `consulta_cpf_notificacoes` (array de texto) + índice GIN, preenchida pela função `notify-cpf-consulta`.
- Consulta no webhook usa uma função de banco `security definer` (o webhook usa service role, mas isolamos a lógica de busca em uma função só de leitura, com limite de 7 dias) para evitar múltiplas queries.
- Alteração no arquivo do webhook `meta-whatsapp-webhook` no bloco de auto-etiquetagem, inserindo o novo passo entre o match por acordo e o rodízio.
- Ajuste visual em `NotificacoesCpfBell.tsx` para mostrar o telefone.
- Sem novos crons, pollings ou realtime — impacto de custo praticamente nulo (apenas 1 consulta indexada por mensagem recebida sem acordo).
