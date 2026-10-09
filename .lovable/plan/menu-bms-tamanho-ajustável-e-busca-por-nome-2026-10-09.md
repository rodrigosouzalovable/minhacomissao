# Menu BMs: tamanho ajustável e busca por nome

## Alterações
- Adicionar uma alça no canto inferior direito **somente do menu BMs**, para arrastar e ajustar sua largura e altura. A janela principal de Instâncias permanece igual.
- Limitar o tamanho à área disponível na tela, mantendo a lista rolável e sem esconder os controles.
- Adicionar no topo o campo **Buscar BM pelo nome**, filtrando enquanto você digita, sem diferenciar maiúsculas/minúsculas ou acentos.
- Manter o campo de busca visível durante a rolagem e mostrar uma mensagem quando nenhuma BM corresponder.
- Preservar as BMs já marcadas ao pesquisar; no menu BMs, “Selecionar todas” atua sobre os resultados visíveis e “Limpar filtro” continua removendo todas as marcações.
- Manter o tamanho escolhido enquanto a página estiver aberta, inclusive ao fechar e reabrir o menu.

## Detalhes técnicos
- O menu atual em `EnvioMeta.tsx` usa largura fixa e altura máxima, com a lista de BMs sem campo de pesquisa.
- Ajustar apenas a apresentação e o estado local do menu, usando os controles e cores existentes. Não alterar permissões, cotas, elegibilidade, campanhas ou envios; nenhuma consulta adicional ou aumento de custo.
- Garantir que digitar na busca e arrastar a alça não fechem o menu nem acionem uma seleção acidental.

## Validação
- Conferir busca, resultado vazio, marcações preservadas, seleção dos resultados e limpeza.
- Verificar redimensionamento, rolagem e reabertura dentro dos limites da tela, sem realizar disparos.