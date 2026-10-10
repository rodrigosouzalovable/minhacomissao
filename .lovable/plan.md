# Busca, tamanho ajustável e tier nos seletores de BM

## 1. Seletores de BM com o mesmo padrão

Aplicar o comportamento já usado no Envio Meta em todos os locais de escolha de BM encontrados:
- Filtro BMs do Envio Meta, preservando o funcionamento atual.
- Filtro BMs da aba Instâncias em API Oficial Meta.
- Campo Business Manager de Nova instância.
- Campo Business Manager de Editar instância.
- Escolha de BM diretamente no card da instância.

Todos terão:
- Campo **Buscar BM pelo nome**, sem diferenciar acentos ou maiúsculas.
- Alça no canto inferior direito para aumentar ou diminuir largura e altura **da lista de BMs**, sem redimensionar a janela principal.
- Busca fixa no topo e lista rolável pela roda do mouse.
- Tamanho limitado à área disponível na tela e mantido ao fechar e reabrir enquanto a página estiver aberta.
- Nome completo acessível, opção de desvincular onde ela já existe e aviso quando a busca não encontrar resultados.

Preservar a diferença entre escolher uma única BM e filtrar várias. Nos filtros, a pesquisa não apaga marcações; selecionar todas atua nos resultados visíveis e limpar remove todo o filtro.

## 2. Preencher o tier ao escolher a BM

Hoje, os campos de BM e limite dos formulários são independentes; escolher a BM não preenche o limite. O vínculo feito pelo card também atualiza apenas a BM.

- Ao escolher uma BM em Nova instância, Editar instância ou no card, utilizar o limite já cadastrado para essa BM, incluindo o tier das outras instâncias vinculadas.
- Priorizar o limite explícito da própria BM. Quando ela segue o automático, usar o limite efetivo compartilhado, coerente com a cota exibida no sistema, e não escolher arbitrariamente a primeira instância.
- Exemplo: uma BM que já utiliza **TIER_2K** preencherá **2.000 mensagens** para a instância que está sendo vinculada.
- Preservar **Ilimitado** e valores personalizados, sem arredondar para outro tier.
- Preservar a origem automática quando o valor vem da Meta: exibir o limite herdado sem transformá-lo em uma configuração manual permanente.
- Se não houver informação válida, manter Automático; ao trocar de BM, não carregar o tier herdado da BM anterior.
- O valor continua editável. Apenas abrir a edição não muda o tier existente; o preenchimento ocorre quando a BM é escolhida ou trocada.
- Nos formulários, nada é gravado antes de salvar. No card, manter o salvamento do vínculo e aplicar o limite herdado à instância vinculada, sem reconfigurar as demais por simples herança.
- Alterações manuais de tier continuam seguindo a confirmação e a propagação já existentes; herdar um tier não deve disparar essa propagação.

## Detalhes técnicos

- Reutilizar a busca e o redimensionamento de `BmInstanceFilter`, compartilhando a apresentação entre seleção única e múltipla, sem generalizar para controles de outros assuntos.
- Adaptar os seletores de `ConfigurarMeta.tsx`, preservando listas autorizadas, opções especiais, filtros e nomes/IDs das BMs.
- Incluir os campos de tier da BM na consulta que já carrega as BMs e reutilizar as instâncias e cotas já carregadas. Centralizar a resolução do tier para os três fluxos de vínculo.
- Separar no estado o limite herdado e uma alteração manual explícita, evitando que o salvamento da edição propague um valor apenas preenchido automaticamente.
- Não alterar permissões, regras de envio, qualidade, bloqueios Meta, orçamento ou frequência de consultas. Sem novo cron, polling ou consulta por seleção.

## Validação

- Testar pesquisa, resultado vazio, seleção preservada e seleção dos resultados visíveis.
- Testar herança de **2.000**, prioridade do limite explícito da BM, Ilimitado, valor personalizado, troca de BM, ausência de tier e preservação do modo automático.
- Conferir no navegador os cinco pontos de seleção: alça para expandir/retrair, roda do mouse, reabertura e preenchimento do limite nos formulários.
- Validar sem enviar mensagens nem salvar mudanças em instâncias reais durante os testes visuais.