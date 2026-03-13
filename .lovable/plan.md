

## Plano: Novo layout "Pagamentos" na importação de devedores

### O que será feito

Adicionar uma nova opção de layout chamada **"Pagamentos"** no seletor de credor/layout da página Importar Devedores. Ao selecionar esse layout:

1. O credor é automaticamente definido como **UME | NOVO MUNDO** (seletor desabilitado)
2. A planilha é parseada com o layout: A=CPF, B=Cliente, C=Credor, D=Contrato, E=Inclusão, F=Arquivo, G=Número, H=Vencimento, I=Valor, J=Observação, K=Status
3. O sistema filtra apenas linhas com **STATUS = "PAGA"** na coluna K
4. Para cada linha PAGA, busca no banco o acordo ativo do CPF (coluna A normalizada) na tabela `acordos`
5. Cruza o `numero_parcela` (coluna G) com a tabela `pagamentos` daquele acordo
6. Se a parcela está com status `pendente`, atualiza para `pago` com `data_paga` extraída da coluna H (vencimento)
7. O preview mostra as parcelas que serão marcadas como pagas, com indicador de quais já estavam pagas no sistema

### Mudanças em `src/pages/ImportarDevedores.tsx`

**1. Tipo e constantes**
- Adicionar `'pagamentos'` ao tipo `CredorLayout`
- Adicionar descrição do layout no `DESCRICOES`
- Adicionar `<SelectItem value="pagamentos">Pagamentos</SelectItem>` no seletor

**2. Nova interface `PagamentoRow`**
```typescript
interface PagamentoRow {
  cpf: string;
  cliente: string;
  numero_parcela: number;
  vencimento: string;
  valor: number;
  observacao: string;
  status_planilha: string; // "PAGA"
  // Campos preenchidos após matching:
  acordo_id?: string;
  pagamento_id?: string;
  ja_pago?: boolean; // true se já estava pago no sistema
}
```

**3. Novo state e parser**
- `pagamentoRows` state para armazenar as linhas de pagamento parseadas
- Função `parsePagamentos()` que lê a planilha e filtra apenas STATUS = "PAGA"

**4. Lógica de matching (ao parsear)**
- Após parsear, buscar todos os acordos ativos por CPFs únicos encontrados
- Para cada acordo, buscar os pagamentos
- Cruzar `numero_parcela` da planilha com `numero_parcela` do banco
- Marcar quais já estão pagas (`ja_pago = true`) e quais precisam ser atualizadas

**5. Importação especial para pagamentos**
- O botão "Confirmar Importação" executa UPDATE em lote na tabela `pagamentos`:
  - `status = 'pago'`
  - `data_paga` = data do vencimento da planilha (coluna H)
- Apenas parcelas com `ja_pago = false` são atualizadas
- Progresso em tempo real com contadores

**6. Preview especial**
- Tabela mostrando: CPF, Cliente, Parcela, Valor, Vencimento, Status no Sistema
- Parcelas já pagas em verde com badge "Já pago"
- Parcelas a serem atualizadas em amarelo com badge "Será marcado como pago"
- Parcelas sem match em vermelho com badge "Acordo não encontrado"

**7. Auto-seleção de credor**
- Quando `credorSelecionado === 'pagamentos'`, setar automaticamente `credorDestino = 'UME | NOVO MUNDO'` e esconder o seletor de credor

