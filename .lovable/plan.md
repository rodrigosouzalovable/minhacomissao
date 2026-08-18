# Corrigir a visualização das conversas dos números UAZAPI na caixa AQUECIMENTO

## O que os dados mostram

A mensagem de teste **funcionou** e está gravada na caixa AQUECIMENTO:

```text
00:46:16  Novo Mundo 3144 (oficial)  -> envia para 62982436133
00:46:18  12 WORK N1 62982436133     <- recebe (caixa AQUECIMENTO)
00:46:36  IAGO responde pela UAZAPI
00:47:03  troca de mensagens continua normalmente
```

A conversa criada é **"556282183144" dentro da instância 12 WORK N1** (folder AQUECIMENTO). Ou seja: o número que aparece na lista é o do *remetente* (3144), não o do chip que recebeu. Três coisas atrapalham enxergar isso na tela:

1. **Nenhum espelho tem o número gravado** (`display_phone` vazio nas 12 instâncias UAZAPI, porque `telefone` está nulo na aba Acionamento). Sem isso, a lista não mostra por qual chip a conversa entrou, e o novo diálogo "Números conectados" exibe "—".
2. **A conversa nova não sobe na lista**: a ordenação atual joga para o topo as conversas com cliente esperando resposta (as vermelhas de 29/07). Como o IAGO já respondeu na hora, a conversa de teste ficou dezenas de linhas abaixo.
3. **Telefone gravado com 12 dígitos** (`556282183144`, sem o 9 do celular) no espelho, enquanto o lado oficial grava 13 (`5562982436133`). Isso quebra a busca por número e pode criar conversa duplicada do mesmo contato.

## O que será feito

### 1. Trazer o número real de cada chip da UAZAPI
- Nova rotina que consulta o status de cada instância conectada na aba Acionamento e grava o número (`telefone`) e propaga para o `display_phone` do espelho.
- Botão **"Atualizar números"** dentro do diálogo "Números conectados" para rodar na hora, além de preenchimento automático quando o número aparecer no webhook.
- Assim o diálogo passa a listar: nome do chip, número real formatado, status (ativo/inativo) e se o IAGO responde.

### 2. Mostrar o chip em cada conversa da caixa
- Na lista de conversas e no topo do chat, exibir o número/nome da instância que recebeu, com o selo **Não oficial**, para não confundir com os números oficiais.
- Busca na caixa passa a casar também pelo número da instância (procurar "62982436133" encontra as conversas daquele chip).

### 3. Fazer a conversa nova aparecer no topo
- Ajuste da ordenação da lista: mensagem recebida nos últimos minutos sobe ao topo junto com os alertas de espera, para que um teste ou um novo contato apareça imediatamente.

### 4. Padronizar o telefone do contato espelhado
- Espelhamento grava o telefone no padrão de 13 dígitos (55 + DDD + 9), igual ao lado oficial.
- Correção única dos registros já criados nesse padrão, mesclando conversas duplicadas do mesmo número na mesma instância (mensagens preservadas, nada é apagado).

## Detalhes técnicos

- `user_whatsapp_instances.telefone` preenchido via chamada `/instance/status` da UAZAPI (server_url + instance_token) em uma edge function nova (`uazapi-sync-numeros`), invocada manualmente pelo botão; trigger de espelho já existente propaga para `meta_whatsapp_instances.display_phone`, mais um `UPDATE` direto para os espelhos já criados.
- `supabase/functions/_shared/espelho-inbox-meta.ts`: normalizar telefone com a regra 55+DDD+9 antes do upsert do contato; migração de dados única para consolidar os contatos de 12 dígitos.
- `src/pages/InboxMeta.tsx`: incluir o número da instância no item da lista e no header; incluir `display_phone` da instância no filtro client-side de busca; ajustar o comparador de ordenação (janela de "recente" ~10 min por `ultima_mensagem_em`).
- `MetaNumerosConectadosDialog.tsx`: coluna de número real + botão de sincronizar.
- Sem novo cron, polling ou canal Realtime — sem impacto de custo recorrente no Lovable Cloud (a sincronização roda só quando você clicar).
