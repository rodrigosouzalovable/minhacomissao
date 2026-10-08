# Continuar a distribuição de modelos após reclassificação

## Objetivo

Para todos os modelos, uma cópia reclassificada como Marketing pela Meta não deve interromper a aplicação nas demais instâncias autorizadas. Conferir e retomar a distribuição de **duvidas_ou_informacoes_gui_2**, preservando as cópias já aprovadas e as submissões em análise.

## Diagnóstico confirmado

- O modelo está marcado como reclassificado no cadastro mestre. Há **23 APPROVED, 36 PENDING, 61 ENVIADO e 4 FALHA_ENVIO**, totalizando 124 registros.
- A tela desabilita aplicação e reenvio quando encontra essa marca. A criação em lote também bloqueia a operação, interrompe as demais instâncias e cancela itens da fila; a verificação de status reproduz esse cancelamento.
- As quatro falhas registradas incluem duas restrições da Meta à criação de modelos e duas falhas de acesso ao recurso. Não são automaticamente solucionadas removendo a trava de reclassificação.

## Alterações

1. **Separar distribuição de envio de mensagens.** Registrar a categoria real de cada cópia e manter o aviso de Marketing, sem bloquear outras instâncias apenas por essa reclassificação. Não alterar o conteúdo para disfarçar a categoria nem liberar disparos Marketing aos clientes.
2. **Continuar os lotes e filas existentes.** Ajustar criação, verificação de status, aplicação manual e os caminhos automáticos de distribuição dos modelos Utility selecionados. Uma reclassificação não cancela os demais itens nem desliga a distribuição por si só. Não ativar automaticamente modelos que não estavam selecionados.
3. **Liberar os controles da tela.** Permitir aplicar em faltantes e reenviar falhas mesmo com o aviso de reclassificação. Mostrar separadamente aprovado, aguardando Meta, falta aplicar e bloqueado.
4. **Retomar o modelo solicitado.** Conferir todas as instâncias oficiais conectadas dentro das permissões e do proprietário do modelo, consultando a existência real na Meta antes de criar uma cópia. Preservar aprovadas e pendentes; verificar os 61 registros ENVIADO antes de decidir se há algo a reenviar. Recolocar na fila apenas faltantes e falhas elegíveis, incluindo eventuais cancelamentos exclusivamente por reclassificação desse modelo.
5. **Preservar as proteções.** Não excluir ou recriar aprovadas, não duplicar submissões por WABA/nome/idioma, não usar instâncias de outro proprietário e não contornar bloqueios reais ou falhas de acesso. GREEN/UNKNOWN continuam sujeitos à verificação; YELLOW/RED aguardam GREEN. Tier 250 mantém duas submissões por número/dia; tiers maiores seguem sequencialmente. Aprovação e categoria final permanecem decisões da Meta.

## Validação e entrega

- Testar que uma reclassificação não impede a próxima instância, preserva a categoria real e não libera mensagens Marketing.
- Testar preservação de aprovadas/pendentes, ausência de duplicatas, isolamento por proprietário, bloqueios, qualidade e cotas.
- Publicar as funções alteradas e conferir o resultado da retomada: já existentes, aguardando análise, novos itens enfileirados e bloqueados com motivo. Nenhuma mensagem será enviada a clientes nos testes ou na retomada.

## Detalhes técnicos

- Ajustar `MetaTemplates.tsx`, `meta-criar-template-lote`, `meta-verificar-status-templates`, `meta-templates-onboarding-enfileirar`, `meta-templates-onboarding-tick` e `meta-templates-auditar-instancias`, além dos caminhos equivalentes encontrados durante a implementação.
- Reutilizar fila, limites, verificações e processamento existentes; sem novo cron, polling ou Realtime. Registrar a nova regra e atualizar os testes pertinentes.

## Alerta de custo Lovable Cloud

**Esta alteração aumenta o trabalho de distribuição:** a retomada exige consultas à Meta e submissões somente onde faltam cópias elegíveis. A conferência poderá abranger os 124 registros e outras instâncias conectadas autorizadas; o total efetivo de novas submissões depende dessa conferência. As rotinas já existentes também poderão processar itens antes interrompidos pela reclassificação.

Não há novo agendamento nem envio de mensagens a clientes. O processamento permanece limitado e sequencial, sem repetição indefinida. Aprovar o plano autoriza esse trabalho adicional e a retomada das submissões elegíveis do modelo solicitado, mas não custos de disparos Marketing.