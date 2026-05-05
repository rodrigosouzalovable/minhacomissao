## Objetivo

Em cada card de acordo nas páginas **Meus Acordos** (`src/pages/Acordos.tsx`) e **Acordos da Equipe** (`src/pages/EquipeAcordos.tsx`), exibir uma nova linha logo abaixo de "Criado em ..." com a última parcela marcada como paga, no formato:

```
Última parcela paga: Parcela 3 em 04/05/2026
```

Quando o acordo ainda não tiver nenhuma parcela paga, a linha não aparece (para não poluir o card).

## Como será implementado

### 1) `src/pages/Acordos.tsx`

- Criar novo state `ultimaParcelaPagaPorAcordo: Map<string, { numero: number; data_paga: string }>`.
- Dentro do `loadAcordos` (linhas ~692–790), após carregar acordos, executar uma query paginada (mesmo padrão já usado para `pagamentos`):
  - `select('acordo_id, numero_parcela, data_paga')`
  - `.eq('status','pago')`
  - `.in('acordo_id', idsAcordos)` (em chunks de 200 para evitar URL longa)
  - paginação por `range` em lotes de 1000.
- Reduzir o resultado pegando, por `acordo_id`, a parcela com **maior `numero_parcela`** (e `data_paga` correspondente). Salvar no map.
- No `AcordoCard` (linhas ~227–235), adicionar nova `<p>` logo após a linha "Criado em":
  ```tsx
  {ultimaParcelaPaga && (
    <p className="text-xs text-secondary mt-1">
      Última parcela paga: Parcela {ultimaParcelaPaga.numero} em {formatarData(ultimaParcelaPaga.data_paga)}
    </p>
  )}
  ```
- Passar a prop `ultimaParcelaPaga` do pai para o `AcordoCard` em todos os locais onde ele é renderizado (abas Em Andamento, Realizados Pagos, Realizados Sem Pagamento, etc.).

### 2) `src/pages/EquipeAcordos.tsx`

- Já existe `pagamentosEquipe` com `numero_parcela` e `data_paga` (linhas 372–381). **Nenhuma query nova** é necessária.
- Construir um `useMemo` que reduz `pagamentosEquipe` para `Map<acordo_id, { numero, data_paga }>` (maior `numero_parcela`).
- No bloco de renderização do card (linhas 845–851), adicionar logo após o `<p>Criado em ...</p>`:
  ```tsx
  {ultima && (
    <p className="text-xs text-secondary mt-1">
      Última parcela paga: Parcela {ultima.numero} em {formatarData(ultima.data_paga)}
    </p>
  )}
  ```

## Custo (Lovable Cloud)

- **EquipeAcordos**: zero requisições adicionais (reusa dados já carregados).
- **Acordos**: 1 query paginada extra de `pagamentos` filtrada por `status='pago'` e pelos IDs do usuário. Em volume típico (centenas de parcelas pagas por usuário), 1–2 chamadas SELECT por carregamento da página. Impacto mensal estimado < US$ 0,05. Respeita a regra **Cloud Cost Awareness**.

## Fora de escopo

- Não alterar lógica de quebra de acordo, vencidos, comissões ou filtros.
- Não tocar no card de DevedorDetalhe (a parcela paga já é visível por lá).
