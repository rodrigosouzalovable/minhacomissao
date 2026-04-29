## Objetivo

Na tela **Clientes**, adicionar um botão **"Exportar Parcelas (Excel)"** ao lado do botão "Exportar Telefones" que já existe. Esse botão vai gerar uma planilha Excel com **todas as parcelas (pagas e pendentes)** dos clientes que estão sendo exibidos no resultado atual da busca (respeitando o filtro de credor — ex.: Montreal — e o filtro de estágio).

## Comportamento

1. O botão só faz sentido após uma busca, então só aparece quando já houver resultados (`filteredGrouped.length > 0`), igual ao "Exportar Telefones".
2. Ao clicar:
   - Coleta todos os CPFs dos clientes listados (incluindo CPFs de Grupos Empresariais).
   - Busca em `acordos_devedor` os acordos ativos desses CPFs.
   - Para cada acordo, busca as parcelas em `parcelas_acordo_devedor` (ou tabela equivalente de parcelas dos acordos do devedor).
   - Gera um Excel com uma linha por parcela.
3. Mostra toast de progresso/sucesso/erro e estado de "Exportando..." no botão (`exportingParcelas`).

## Colunas da planilha

- CPF
- Nome do Cliente
- Credor
- Nº do Acordo (ID curto)
- Data do Acordo
- Valor Total do Acordo
- Nº da Parcela (ex.: 3/12)
- Valor da Parcela
- Data de Vencimento
- Data de Pagamento (vazio se pendente)
- Status (Paga / Pendente / Atrasada)

Nome do arquivo: `parcelas-clientes-{credor-slug}-{yyyy-mm-dd}.xlsx`.

## Detalhes técnicos

Arquivo a alterar: `src/pages/Clientes.tsx`.

1. Adicionar estado `const [exportingParcelas, setExportingParcelas] = useState(false);`.
2. Criar função `handleExportParcelas` semelhante à `handleExportTelefones`:
   - Reutilizar a lógica de coletar CPFs únicos a partir de `filteredGrouped` (incluindo `cpfsGrupo`).
   - Buscar acordos em batches de 50 CPFs:
     ```ts
     supabase.from('acordos_devedor')
       .select('id, devedor_cpf, valor_total, num_parcelas, data_primeiro_vencimento, criado_em, status')
       .in('devedor_cpf', batch)
       .eq('status', 'ativo')
     ```
   - Buscar as parcelas desses acordos (verificar nome real da tabela de parcelas — provavelmente `parcelas_acordo_devedor` ou listar via `code--exec` antes de implementar; fallback: usar a tabela `pagamentos` filtrando por `acordo_id` se for o caso).
   - Construir array de linhas e chamar `exportarParaExcel` com as colunas listadas acima.
3. Adicionar o botão logo após "Exportar Telefones" (linha ~708):
   ```tsx
   <Button variant="outline" size="sm" onClick={handleExportParcelas} disabled={exportingParcelas}>
     <Download className="h-4 w-4 mr-2" />
     {exportingParcelas ? 'Exportando...' : 'Exportar Parcelas (Excel)'}
   </Button>
   ```
4. Antes de implementar, vou inspecionar o schema real das tabelas de parcelas dos acordos do devedor (ex.: `parcelas_acordo_devedor`) para garantir os nomes corretos de colunas (`numero_parcela`, `valor_parcela`, `data_vencimento`, `data_pagamento`, `status`).

## Validação

- Filtrar por credor "MONTREAL" + Pesquisar todos → clicar em "Exportar Parcelas" → planilha contém todas as parcelas de todos os acordos desses clientes Montreal, com as colunas acima.
- Caso nenhum cliente listado tenha acordo, mostrar toast "Nenhuma parcela encontrada".