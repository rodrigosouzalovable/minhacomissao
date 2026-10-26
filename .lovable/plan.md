# Botão "Não precisa de resposta" na seleção múltipla do Inbox Meta Oficial

## O que muda
Na barra que aparece ao dar duplo clique em uma conversa (com "X selecionada(s)", Arquivar, Excluir e Cancelar), entra um novo botão **"Não precisa de resposta"** entre Arquivar e Excluir.

## Comportamento
- Aplica a dispensa a **todas as conversas selecionadas** de uma vez: o alerta amarelo/vermelho e o indicador de não lida somem na hora.
- Mesma regra de hoje: vale só para a última mensagem recebida; nova mensagem do cliente volta a marcar normalmente.
- Após aplicar, mostra aviso de quantas conversas foram marcadas e sai do modo de seleção.
- Se a gravação falhar, a tela volta ao estado anterior e mostra o erro.
- Para desfazer em uma conversa específica, continua valendo "Voltar a exigir resposta" no clique direito ou no topo da conversa.

## Detalhes técnicos
- `src/pages/InboxMeta.tsx`: nova função `dispensarSelecionados` que faz um único `update` em `meta_whatsapp_contatos` com `sla_dispensado_em = now()` e `nao_lido = 0` para os ids selecionados (`.in('id', ...)`), com atualização otimista e reversão em erro.
- Novo botão ícone (`CheckSquare`, já importado) na barra de seleção, com title "Não precisa de resposta".
- Sem nova tabela, cron, polling ou realtime: custo inalterado.
