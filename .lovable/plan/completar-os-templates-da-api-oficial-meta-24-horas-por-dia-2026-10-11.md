# Completar os templates da API Oficial Meta, 24 horas por dia

## Diagnóstico confirmado
- O cadastro possui **36 modelos mestres Utility com uma cópia Utility aprovada no mesmo proprietário**. Apenas 16 estão marcados para aplicação automática; os outros 20 ficam fora da seleção usada pela auditoria.
- O botão **Verificar templates de todas as instâncias** atualmente gera somente um relatório. A criação da fila depende de uma segunda ação.
- Há **528 falhas em 41 instâncias** relacionadas à reserva diária: a função tenta reservar até 40 vagas, enquanto a tabela aceita somente as vagas 1 e 2. Essa inconsistência interrompe a aplicação.
- O levantamento geral encontrou 180 instâncias oficiais ativas e conectadas: 10 com dois templates aprovados, 130 com mais de dois e 39 sem aprovados no catálogo interno. São dados registrados, não uma nova confirmação diretamente na Meta, e não representam necessariamente os 168 números nacionais da imagem.
- O processador já permite execução **24h, inclusive domingos**, mas textos e previsão de conclusão ainda indicam 07h–20h e bloqueio no domingo.
- As consultas da auditoria e do painel de progresso não paginam os resultados; serão corrigidas para não limitar o acompanhamento a uma página de registros.

## O que será alterado
1. **Conferir e aplicar pelo mesmo botão:** ao clicar, atualizar a informação dos templates nas instâncias próprias e autorizadas, identificar os faltantes e colocá-los automaticamente na fila. Exibir o resultado por número, sem exigir uma segunda confirmação para iniciar a aplicação.
2. **Incluir todos os pré-aprovados:** usar todos os modelos Utility próprios com pelo menos uma cópia Utility aprovada no mesmo proprietário, independentemente da marcação atual. Aplicar também aos novos números conectados, reutilizando a automação existente. Uma cópia reclassificada como Marketing não elimina o mestre Utility nem interrompe as outras instâncias.
3. **Corrigir a reserva diária:** restaurar a coerência do limite de **dois novos templates por número/dia BRT no tier 250**, com reserva atômica. Os demais tiers continuam com aplicação sequencial e seus intervalos atuais. Ter dois aprovados não será considerado conclusão se ainda faltarem outros modelos.
4. **Recuperar as falhas internas:** retornar à fila somente itens afetados pela inconsistência da reserva, depois de verificar propriedade, elegibilidade e existência do template. Remover apenas pausas comprovadamente causadas por essa falha interna; preservar reprovações, bloqueios e pausas reais da Meta.
5. **Garantir funcionamento 24/7:** retirar referências e eventuais reagendamentos para “próximo dia útil” exclusivos dos templates. A cota do tier 250 reinicia no próximo dia BRT, inclusive domingo. Não alterar horários de campanhas, lembretes ou aquecimento de mensagens.
6. **Mostrar o andamento real:** totais completos, aprovados, aguardando análise, faltantes, fila, cota diária e erros por instância. Corrigir a previsão para considerar execução contínua e o tier; não mostrar “concluído” enquanto houver análise ou pendências não resolvidas.

## Proteções
- Nada de copiar modelos de outro proprietário, parceiros ou instâncias não autorizadas.
- GREEN e UNKNOWN com consulta válida podem receber templates; RED/YELLOW, banimentos, restrições reais, problemas de pagamento e pausas por reprovação permanecem protegidos.
- Não repetir templates aprovados, em análise ou já enfileirados. Fazer a última conferência antes de criar cada cópia.
- Uma falha individual não interrompe os demais números; falhas de consulta não são tratadas como ausência de templates.
- Aplicar um modelo não significa aprovação imediata: cada conta WhatsApp continua sujeita à análise da Meta.
- Não alterar textos, variáveis, imagens, links, categorias reais ou mensagens anteriores.

## Detalhes técnicos
- Compartilhar a seleção por proprietário + nome + idioma + aprovação real entre auditoria, conexão/enfileiramento e sincronização diária, sem depender de `injetar_em_novos` neste modo completo.
- Corrigir `reserve_tier_250_template_slot` e a constante compartilhada para o mesmo teto; manter trava transacional, idempotência e registros auditáveis. Aplicar a correção do banco por migração.
- Recuperar itens existentes por atualização condicionada, sem usar inserção com `ignoreDuplicates` como tentativa de reativar falhas.
- Paginar ou agregar as leituras de templates/fila, mantendo filtros de autorização e índices existentes; processar a conferência em lotes limitados para evitar timeout.
- Ajustar `ConfigurarMeta`, auditoria, enfileiramento, processador e `TemplatesInjecaoProgresso`; registrar as regras permanentes e a decisão técnica durante a implementação.

## Validação e início
- Testar seleção dos 36 modelos, isolamento entre proprietários, reclassificação de cópia, deduplicação e leituras com mais de 1.000 registros.
- Testar duas reservas por dia no tier 250, concorrência e retomada na virada BRT, incluindo domingo e madrugada.
- Testar recuperação apenas das falhas internas, preservação dos bloqueios e totais sem falsa conclusão.
- Conferir o botão e o painel com respostas simuladas, sem enviar mensagens a clientes.
- Após a correção e os testes, executar a conferência real das instâncias próprias autorizadas e iniciar a aplicação gradual dos templates faltantes. Registrar os totais e motivos de espera; não prometer aprovação pela Meta.

## Custo autorizado
O usuário autorizou completar os modelos e operar 24h todos os dias. Reutilizar o agendamento existente de dois em dois minutos, **sem aumentar a frequência**, sem novo agendamento ou canal de atualização. O trabalho adicional consiste na conferência e aplicação dos modelos faltantes; o custo em reais depende do volume efetivamente processado.