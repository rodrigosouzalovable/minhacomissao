# Caixa AQUECIMENTO: nada vai para Arquivados + visualização dos números UAZAPI

## O que os dados mostram

- O espelhamento e o IAGO estão funcionando: a troca de mensagens do teste (Novo Mundo 3144 → 12 WORK N1 62982436133) está gravada na caixa AQUECIMENTO, com resposta do IAGO em segundos.
- Hoje a caixa AQUECIMENTO tem **176 conversas, das quais 67 estão arquivadas**. Elas foram arquivadas pela rotina de retenção (3 dias após um envio nosso sem resposta) — foi por isso que a caixa parecia vazia na aba "Conversas".
- Os 12 espelhos UAZAPI estão sem número gravado (`display_phone` vazio), então não é possível saber por qual chip cada conversa entrou.
- O espelho grava o telefone com 12 dígitos (`556282183144`), enquanto o lado oficial grava 13 (`5562982436133`), o que quebra a busca por número.

## O que será feito

### 1. Nada da caixa AQUECIMENTO vai para Arquivados
- A rotina de retenção passa a **ignorar a caixa AQUECIMENTO**: nenhuma conversa dessa caixa é arquivada, tenha resposta ou não.
- **Desarquivar agora as 67 conversas** já arquivadas dessa caixa, para todas voltarem à lista principal.
- Continua valendo a regra geral: mensagem que chega desarquiva a conversa automaticamente.

### 2. Trazer o número real de cada chip da UAZAPI
- Rotina que consulta cada instância conectada na aba Acionamento e grava o número real, propagando para o espelho.
- Botão **"Atualizar números"** no diálogo "Números conectados" para rodar na hora; o diálogo passa a mostrar nome, número formatado, status e se o IAGO responde.

### 3. Mostrar o chip em cada conversa da caixa
- Na lista de conversas e no topo do chat, exibir o número/nome da instância que recebeu, com o selo **Não oficial**.
- A busca da caixa passa a casar também pelo número da instância (procurar "62982436133" encontra as conversas daquele chip).

### 4. Conversa nova aparece no topo
- Ajuste da ordenação: conversa com mensagem recebida nos últimos minutos sobe ao topo, junto com os alertas de espera, para um teste aparecer imediatamente.

### 5. Padronizar o telefone do contato espelhado
- Espelhamento grava no padrão 55 + DDD + 9, igual ao lado oficial; correção única dos registros já criados, mesclando duplicados da mesma instância (nenhuma mensagem é apagada).

## Detalhes técnicos

- `supabase/functions/meta-inbox-retention/index.ts`: filtrar candidatos com `.neq('folder_id', '<AQUECIMENTO>')` (e tratar `folder_id` nulo normalmente); atualização de dados única `UPDATE meta_whatsapp_contatos SET arquivado = false WHERE folder_id = '<AQUECIMENTO>' AND arquivado`.
- Nova edge function `uazapi-sync-numeros`: lê `user_whatsapp_instances` (server_url + instance_token), consulta o status na UAZAPI, grava `telefone` e atualiza `meta_whatsapp_instances.display_phone` do espelho correspondente.
- `supabase/functions/_shared/espelho-inbox-meta.ts`: normalizar telefone (55+DDD+9) antes do upsert do contato.
- `src/pages/InboxMeta.tsx`: número da instância no item da lista e no header, inclusão do `display_phone` no filtro de busca client-side, ajuste do comparador de ordenação (janela "recente" ~10 min).
- `src/components/inbox/meta/MetaNumerosConectadosDialog.tsx`: coluna de número real + botão de sincronizar.
- Sem novo cron, polling ou canal Realtime — a sincronização de números roda só quando você clicar, sem impacto de custo recorrente.
