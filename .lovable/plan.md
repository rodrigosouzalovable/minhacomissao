# Todos os templates de Utilidade no Envio Meta

## Objetivo
Depois de selecionar as instâncias, mostrar todos os seus templates de **Utilidade**, inclusive os que ainda não existem em nenhuma das instâncias escolhidas, com opção de aplicar sem sair do Envio Meta.

## Situação confirmada
- A lista atual é montada apenas com templates vinculados às instâncias selecionadas. Por isso um modelo ausente em todas elas não aparece.
- Os modelos cadastrados na aba Template são armazenados separadamente dos templates sincronizados por instância.
- Já existe um botão para aplicar o template nas instâncias incompatíveis, mas ele depende de conseguir selecionar o modelo primeiro.
- A aplicação atual exige administrador, mesmo proprietário do modelo e da instância, e usa a fila gradual de templates.

## Alterações
1. **Lista completa de Utilidade:** reunir os seus modelos cadastrados com os templates sincronizados acessíveis para envio, sem limitar a lista às instâncias escolhidas. Manter isolamento por proprietário e não mostrar Marketing.
2. **Disponibilidade clara:** cada opção mantém nome, idioma, texto, pesquisa e favoritos; mostra quantas instâncias selecionadas têm aprovação, inclusive **0/2**, por exemplo. Ao trocar as instâncias, atualizar a contagem sem perder um modelo que continua no catálogo.
3. **Aplicar aqui mesmo:** ao selecionar um modelo ausente, mostrar quais instâncias precisam dele e o botão **Aplicar nas instâncias selecionadas**. Aplicar somente onde falta; diferenciar ausente, em análise, aprovado, rejeitado e já na fila, sem duplicar submissões.
4. **Resultado por instância:** informar quais aplicações foram enfileiradas e quais aguardam ou estão bloqueadas, explicando o motivo. Manter as permissões atuais; quem não pode aplicar recebe uma orientação, sem erro que derrube a tela.
5. **Atualizar e enviar:** oferecer atualização manual da situação sem sair da página. A campanha permanece bloqueada enquanto houver instância selecionada sem aprovação dos templates usados, inclusive variações; permitir remover essas instâncias da seleção.

## Regras preservadas
- Somente Utilidade, conforme sua escolha; modelos reclassificados como Marketing não serão propagados.
- Aplicação não significa aprovação instantânea: a Meta precisa analisar o template antes do envio.
- GREEN e UNKNOWN com leitura válida e sem bloqueio real podem seguir; YELLOW/RED aguardam e bloqueios reais da Meta continuam respeitados.
- Tier 250: até dois templates por número/dia. Tiers 1.000/2.000: aplicação sequencial pelo fluxo existente.
- Nenhuma liberação adicional de permissões, novo agendamento ou consulta periódica será criada.

## Detalhes técnicos
- Ajustar `EnvioMeta.tsx` para carregar os modelos do proprietário de forma paginada e montar um catálogo independente da seleção de instâncias.
- Separar o modelo usado na prévia dos registros realmente aprovados para envio. Um modelo cadastrado sem cópia sincronizada não receberá um identificador fictício de template enviável.
- Preservar corpo, cabeçalho, botões, variáveis, links dinâmicos e prévias ao usar dados de um modelo mestre.
- Reutilizar `TemplateFavoriteSelect` e a fila existente. Ajustar o fluxo de `meta-templates-onboarding-enfileirar` apenas para a aplicação específica, a deduplicação e o retorno por instância, sem ampliar autorização.
- Para templates sincronizados sem modelo mestre aplicável, mostrar a limitação e a necessidade de cadastrá-lo, sem inventar um modelo nem copiar de outro proprietário.
- Consultas apenas ao carregar ou atualizar manualmente, paginadas e restritas ao usuário; sem nova rotina recorrente ou mudança de estrutura do banco prevista.

## Validação
- Um modelo Utility cadastrado e ausente nas instâncias aparece com contagem zero e prévia correta.
- Modelos presentes em parte das instâncias mostram a contagem exata, sem duplicidade na lista.
- A aplicação específica não reenfileira modelos já existentes ou em análise.
- Marketing e modelos de outro proprietário não entram no catálogo próprio nem podem ser aplicados indevidamente.
- Falta de aprovação, permissões e bloqueios continuam impedindo envios indevidos.
- Pesquisa, favoritos, variações e edição do link dinâmico continuam funcionando.
- Adicionar testes das regras de catálogo, contagem e deduplicação; conferir a tela sem enviar mensagens ou submeter templates reais durante os testes.