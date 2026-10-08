# Liberar a aplicação do template nas instâncias faltantes

## Diagnóstico confirmado
- O template **informacoes_sobre_seu_debito · pt_BR** possui um modelo mestre próprio de categoria Utility, **98 cópias Utility aprovadas**, uma cópia Marketing aprovada e uma cópia Utility rejeitada.
- O modelo mestre está marcado como tendo uma cópia reclassificada como Marketing. O carregamento e o catálogo do Envio Meta excluem esse modelo por causa dessa marcação.
- Como consequência, o catálogo perde o vínculo com o mestre e o botão fica desabilitado, mostrando incorretamente que é necessário cadastrar o modelo.
- A função de aplicação já permite distribuir um mestre Utility mesmo após a reclassificação de uma cópia, preservando proprietário, qualidade, bloqueios e deduplicação.

## Correção
1. **Recuperar o vínculo correto:** carregar os modelos Utility próprios sem descartar um mestre apenas porque uma de suas cópias foi reclassificada. Associar o template selecionado ao mestre por nome, idioma e proprietário.
2. **Liberar o botão neste caso:** permitir clicar em **Aplicar nas instâncias selecionadas** para o modelo da imagem, sem exigir novo cadastro. Manter a proteção contra cliques duplicados durante a aplicação e as permissões atuais.
3. **Aplicar apenas onde falta:** reutilizar a fila existente, sem repetir modelos aprovados, em análise ou já enfileirados. Mostrar o resultado por instância, incluindo espera ou bloqueio real.
4. **Separar aplicação de envio:** a cópia Marketing de uma instância não impede a distribuição para as demais. Ela continua identificada como Marketing e não conta como Utility aprovado para disparar uma campanha.
5. **Avisos corretos:** remover a orientação de cadastrar um mestre quando ele já existe. Caso realmente não haja modelo próprio ou permissão, explicar o motivo; não habilitar uma ação que o servidor recusaria.

## Proteções preservadas
- Aplicação somente nas instâncias próprias e autorizadas.
- GREEN e UNKNOWN com consulta válida podem seguir; RED/YELLOW e bloqueios reais permanecem em espera.
- Manter cotas por tier e aplicação sequencial. Colocar na fila não significa aprovação imediata pela Meta.
- Não alterar texto, variáveis, botões, categoria real, destinos dos links ou mensagens anteriores.

## Detalhes técnicos
- Ajustar `carregarUtilityMestres` e `catalogoUtility` para manter o vínculo de mestres Utility reclassificados, sem incluir mestres originalmente Marketing ou de outro proprietário.
- Revisar a condição do botão e os avisos em `EnvioMeta`, mantendo a autorização no servidor e reutilizando `meta-templates-onboarding-enfileirar`.
- Atualizar os testes do catálogo para diferenciar reclassificação de cópia e categoria do mestre, preservando testes de isolamento, aprovação e deduplicação.

## Validação
- Confirmar que o modelo da imagem recupera o identificador mestre e que o botão fica habilitado para o administrador autorizado.
- Testar que uma cópia Marketing não interrompe a aplicação nas demais e não é contada como Utility aprovado.
- Testar que cópias aprovadas, pendentes e na fila não são reenviadas, e que modelos alheios e bloqueios reais continuam protegidos.
- Validar a tela e os resultados com respostas simuladas, sem enviar mensagens nem submeter templates reais durante os testes.

## Custo
Sem novo agendamento, polling, função recorrente ou consulta adicional. A correção reutiliza o carregamento e a aplicação manual existentes.