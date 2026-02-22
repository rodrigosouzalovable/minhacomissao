

# Melhorar Feedback de Pesquisa na Pagina Clientes

## Problema

Quando o usuario filtra apenas pelo credor (ex: "UME | NOVO MUNDO"), a busca precisa carregar todos os registros do banco em lotes de 1000. Se houver milhares de registros, isso demora bastante e o usuario so ve "Pesquisando..." sem saber o progresso.

## Solucao

Adicionar um indicador de progresso em tempo real durante a busca, mostrando quantos registros ja foram carregados.

### Mudancas no arquivo `src/pages/Clientes.tsx`:

1. **Novo estado para contagem parcial**: Adicionar um estado `loadingCount` que e atualizado a cada lote carregado.

2. **Barra de progresso durante a busca**: Exibir um card informativo abaixo dos filtros enquanto a busca esta em andamento, contendo:
   - Icone de carregamento (spinner)
   - Texto: "Carregando registros... X registros encontrados ate agora"
   - Uma barra de progresso animada (indeterminada)
   - Mensagem: "Aguarde, esta operacao pode levar alguns segundos dependendo do volume de dados."

3. **Atualizar o loop de busca**: Dentro do `while` de paginacao, atualizar `loadingCount` a cada iteracao para que o usuario veja o progresso em tempo real.

4. **Botao de pesquisa**: Manter o texto "Pesquisando..." no botao, mas agora o card de progresso dara mais contexto.

### Detalhes Tecnicos

- Adicionar estado: `const [loadingCount, setLoadingCount] = useState(0);`
- No loop `while` da funcao `handleSearch`, apos cada lote: `setLoadingCount(prev => prev + (data?.length || 0));`
- Resetar `loadingCount` ao iniciar nova busca
- Renderizar condicional: `{loading && <Card>...</Card>}` entre o card de filtros e o card de resultados
- Usar componente `Progress` existente com animacao indeterminada (pulse)
- Usar icone `Loader2` do lucide-react com classe `animate-spin`

