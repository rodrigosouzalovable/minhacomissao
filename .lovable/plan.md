# Garantir rodízio por ordem nas caixas administradas pelo Thiago

## Diagnóstico confirmado

- A distribuição normal das novas conversas já chama um rodízio circular que guarda a última posição **por caixa** e escolhe a próxima posição da fila; não compara quantos clientes cada pessoa recebeu. O antigo critério de “menor quantidade no dia” ainda existe no banco, mas seu gatilho foi removido e não há chamada ativa para ele.
- Nas caixas do Thiago, AMARAL NM tem Gabriel e Lais como atendentes; ODRES, ODRES-Entradas e ODRES-Vencido têm equipe ativa na fila. As últimas atribuições automáticas nessas caixas avançaram pelo rodízio. Administradores marcados apenas para acompanhar, como Bruno, são excluídos enquanto houver atendentes.
- ODRES-Confirmação tem **somente Bruno marcado como administrador**; não há atendente comum selecionado. A regra atual usa administradores como alternativa quando não há atendentes, por isso Bruno recebeu conversas ali. AQUECIMENTO AMARAL não tem membros selecionados.
- A tela não mostra claramente a próxima pessoa do rodízio nem quando uma caixa está sem atendente, o que dificulta conferir a distribuição. Também há um comentário antigo no processamento que ainda descreve incorretamente o critério como “menor carga”.

## O que será feito

1. **Manter a ordem, sem compensar quantidades.** Preservar o rodízio circular atômico por caixa para novas conversas sem responsável, inclusive quando os atendentes têm totais diferentes. Prioridades por acordo, consulta recente e atendimento manual permanecem; elas não avançam a posição da fila.
2. **Somente atendentes na distribuição automática.** Remover a alternativa que coloca administradores no rodízio quando são os únicos membros. Uma caixa sem atendente selecionado ficará sem nova atribuição automática até que um atendente seja marcado; não alterar conversas já atribuídas nem incluir pessoas sem autorização.
3. **Dar visibilidade ao administrador da caixa.** Na configuração de atendentes das caixas administradas pelo Thiago, mostrar a ordem dos atendentes elegíveis, quem é o próximo e um aviso claro quando não houver ninguém apto. Administradores ficam identificados como “só acompanha”.
4. **Validar sem redistribuir clientes existentes.** Verificar, em simulação e consulta de leitura, uma sequência completa em AMARAL NM e ODRES com quantidades históricas desiguais; confirmar o avanço independente por caixa, a exclusão dos administradores, prioridades preservadas, e o aviso em ODRES-Confirmação. Não enviar mensagens reais nem alterar etiquetas antigas.

## Detalhes técnicos

- Ajustar a função `atribuir_atendente_rodizio` para selecionar somente membros `admin = false`, mantendo `FOR UPDATE` no estado de `meta_atendimento_rodizio_estado`, a filtragem por perfil/permissão/etiqueta ativos e a ordem `meta_atendimento_fila.ordem`. Não reiniciar o ponteiro salvo nem ativar o gatilho legado `atribuir_atendente_fila`.
- Alinhar a elegibilidade no webhook `meta-whatsapp-webhook` com a função: retirar o fallback de administradores e corrigir o comentário “menor carga”; conservar os caminhos de acordo, consulta, atendimento manual e plantão IAGO.
- Usar uma leitura autorizada por caixa para expor a ordem e próxima posição no diálogo de atendentes, sem expor dados de outras caixas. Evitar atualização automática periódica: recarregar ao abrir, ao alterar membros e ao solicitar atualização.
- Nenhum novo cron, polling ou canal em tempo real; a leitura ocorre sob demanda, com custo adicional apenas ao abrir/atualizar o diálogo.
