# Selecionar instâncias GREEN aprovadas no Envio Meta

## Alterações

1. **Trocar o botão:** substituir **Ver instâncias aprovadas** por **Selecionar instâncias aprovadas**, exibindo a quantidade que pode ser selecionada pelo novo critério.
2. **Selecionar com um clique:** ao clicar, substituir a seleção atual pelas instâncias acessíveis que tenham o template escolhido aprovado e qualidade **GREEN**. Não incluir YELLOW, RED, UNKNOWN, internacionais ou banidas. A seleção considera todas as instâncias autorizadas carregadas, independentemente dos filtros de BM e qualidade.
3. **Conferir a seleção:** manter o botão **Acessar Instâncias** e a janela existente, com as instâncias escolhidas marcadas. Limpar os filtros de BM e qualidade ao realizar a seleção automática para não esconder os números selecionados. O usuário poderá ajustar as marcações nessa janela.
4. **Nenhuma elegível:** desabilitar o botão quando não houver instâncias GREEN com o template aprovado. Atualizar a quantidade ao trocar o template ou atualizar a disponibilidade.
5. **Retirar o quadro de custos:** remover somente o quadro **Custo de envios (Meta)**, incluindo Hoje, Este mês e Total, da aba Envio Meta. Manter os demais contadores, estimativas e limites de orçamento existentes.

## Proteções

- Selecionar números não inicia envios, não ativa o pool e não altera qualidade, cotas ou permissões.
- Manter as verificações atuais de saúde e bloqueios reais antes de iniciar a campanha.
- Manter a validação dos templates de variação; selecionar pelo template principal não torna uma variação automaticamente aprovada.
- Não alterar campanhas em andamento nem mensagens anteriores.

## Detalhes técnicos

- `EnvioMeta.tsx` já disponibiliza o conjunto de aprovações do template (`todasInstanciasAprovadasIds`), a qualidade das instâncias e o estado compartilhado da seleção (`instanciaIds`). Usar esses dados para calcular os IDs elegíveis e atualizar a seleção.
- Substituir a ação de consulta de `TemplateApprovedInstances` pela ação de seleção, reutilizando o botão do sistema de interface. A conferência ficará na janela já aberta por **Acessar Instâncias**.
- Reutilizar as regras nacionais e de exclusão de banidos de `metaNationalInstances.ts`.
- Remover a renderização de `CustoEnvioCard`, seu import, a referência `custoRef` e a chamada de atualização associada nessa página. Isso também elimina as consultas feitas pelo quadro enquanto essa aba está aberta.
- Sem alteração no banco, novo agendamento, consulta adicional ou aumento de custo no Lovable Cloud.

## Validação

- Testar que somente GREEN com aprovação do template escolhido entra na seleção; excluir as demais qualidades, templates ausentes, internacionais e banidas.
- Testar que a ação substitui seleções anteriores, não duplica IDs e não seleciona instâncias fora da lista autorizada.
- Conferir na tela que **Acessar Instâncias** mostra os mesmos números marcados e permite ajustes manuais.
- Confirmar que o quadro de custos desaparece e os demais contadores permanecem.
- Verificar erros da aplicação e executar os testes pertinentes, sem disparar mensagens reais.