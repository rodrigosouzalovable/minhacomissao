# Corrigir a aplicação do template pelo Envio Meta

## O que a conferência mostrou
- O botão **Aplicar nas instâncias selecionadas** atualmente apenas coloca o modelo na fila automática; não inicia diretamente sua submissão à Meta. Ele envia todas as instâncias em uma única solicitação, processadas uma a uma.
- Para `acesse_o_portal_de_negociacao`, a consulta encontrou 38 cópias Utility aprovadas, 28 Utility em análise, uma Marketing em análise e duas rejeitadas. Na fila desse modelo, há 27 aplicações enviadas, duas concluídas e 11 pendentes. Portanto, existe aplicação em andamento, mas isso não comprova que o clique tenha tratado todas as 75 instâncias da imagem.
- A tela ainda informa o horário antigo de aplicação e não diferencia adequadamente todos os motivos de espera, impedimento e falha.
- Há também um caminho de silêncio no código: quando já existe um registro encerrado na fila, a tentativa de inserção pode retornar zero e ser anunciada como “já na fila”. O botão não possui a recuperação específica de falhas internas de reserva que a auditoria já utiliza. Isso é um defeito identificado no código, mas não foi confirmado como a causa das 75 instâncias desta seleção.

## Correção proposta
1. **Iniciar pelo clique:** aplicar exclusivamente o template escolhido a todas as instâncias selecionadas que ainda precisam dele, em lotes pequenos. Usar o caminho existente de submissão manual para iniciar as elegíveis sem aguardar a passagem da fila automática.
2. **Conferir antes de copiar:** sincronizar as instâncias em lotes limitados; se a consulta falhar, mostrar a falha sem interpretar isso como template ausente. Preservar modelos já aprovados ou em análise, inclusive quando os números compartilham a mesma conta WhatsApp.
3. **Não perder nenhuma instância:** apresentar um resultado para cada número: iniciado, já aprovado, em análise, aguardando limite diário, bloqueado ou falha. Uma falha individual não deve interromper os demais lotes; novo clique não deve duplicar submissões.
4. **Manter continuidade:** encaminhar ao processamento existente os casos que precisam aguardar cota ou retomada segura, sem reativar cópias automáticas de todos os modelos por causa da aplicação manual de um único template.
5. **Atualizar o aviso:** recarregar os estados após a operação e substituir o texto antigo por aplicação 24 horas, inclusive domingos. Não mostrar “Ausente” para itens que estejam na fila ou em análise; falhas devem trazer a causa e a orientação disponível.

## Limites preservados
- Aplicar somente em instâncias próprias autorizadas; não enviar mensagens aos clientes.
- Respeitar bloqueios reais, qualidade elegível, pausas por reprovação e o limite de dois templates por número/dia BRT no tier 250; demais tiers mantêm aplicação sequencial.
- O clique inicia a submissão; a aprovação continua dependendo da Meta e não pode ser garantida imediatamente.
- Reutilizar funções e agendamentos existentes, dentro do custo de aplicação já autorizado, sem novo acompanhamento periódico.

## Detalhes técnicos e validação
- Ajustar o manipulador do botão em `EnvioMeta.tsx` para usar a submissão manual existente, com lotes limitados, identificação exata do mestre e agregação dos resultados.
- Reutilizar as proteções de `meta-criar-template-lote` e a fila atual, ajustando somente a reconciliação/retomada necessária para evitar duplicação e itens perdidos.
- No enfileiramento, reutilizar a recuperação já existente para falhas identificadas como internas de reserva; registros encerrados por recusa real da Meta não devem ser recuperados automaticamente nem anunciados como fila ativa.
- Testar que 75 instâncias são consideradas sem truncamento, que uma falha não cancela as demais, que somente o modelo escolhido é aplicado e que o segundo clique preserva submissões existentes.
- Manter testes concretos para propriedade, cota diária e preservação de aprovados/em análise. Conferir o botão no navegador com respostas controladas e, após a implementação, verificar os registros reais antes de afirmar quais aplicações foram iniciadas.