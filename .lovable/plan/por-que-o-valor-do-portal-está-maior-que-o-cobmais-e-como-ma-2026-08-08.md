# Por que o valor do portal está maior que o Cobmais — e como manter sincronizado

## O que aconteceu com a Selma (CPF 979.537.921-68)

Consultei as linhas reais no banco. Existem 12 parcelas ativas para o contrato 76579109, todas vindas da mesma importação (arquivo `UME 12.xlsx`, de 16/04/2026):

```text
Parcela 2  venc. 24/12/2024   R$  98,00   ativa
Parcela 3  venc. 24/01/2025   R$  98,00   ativa
Parcela 4  venc. 24/02/2025   R$  98,00   INATIVA
Parcela 4  venc. 24/02/2025   R$  95,98   ativa
Parcela 5  venc. 24/03/2025   R$  98,00   ativa
Parcela 6  venc. 24/04/2025   R$  98,00   ativa
Parcela 7  venc. 24/05/2025   R$  98,00   ativa
Parcela 8  venc. 24/06/2025   R$  98,00   ativa
Parcela 0  venc. 26/01/2026   R$ 200,00   ativa   <- linha sem número de parcela
Parcela 0  venc. 20/03/2026   R$ 122,00   ativa   <- linha sem número de parcela
Parcela 1  venc. 20/04/2026   R$ 120,82   ativa
Parcela 2  venc. 20/05/2026   R$ 120,82   ativa
Parcela 3  venc. 20/06/2026   R$ 120,82   ativa
```

Soma das ativas = **R$ 1.368,44**, exatamente o que o portal mostra. Já o Cobmais hoje mostra só 3 parcelas em aberto (06 = 61,05; 07 = 98,00; 08 = 98,00 = **R$ 257,05**).

Ou seja, o portal não erra o cálculo — ele está somando um retrato de abril/2026 que nunca foi baixado. Três causas somadas:

1. **Parcelas pagas/renegociadas depois da importação continuam ativas.** O importador atual só *insere o que é novo* (chave CPF + contrato + parcela + vencimento) e nunca desativa o que saiu da planilha. Nada some sozinho.
2. **Convivência de dois acordos no mesmo contrato.** As parcelas antigas de R$ 98 e as novas de R$ 120,82/122,00 são renegociações diferentes do mesmo contrato e estão empilhadas.
3. **Linhas "Parcela 0"** (planilha veio sem número de parcela) — entram como parcela 0 e inflam o total, além de furarem a deduplicação.

Isso não é um caso isolado: qualquer CPF cuja carteira mudou no Cobmais desde 16/04/2026 tem o mesmo desvio.

## O que eu recomendo fazer

Reimportar resolve, mas **só se a importação passar a funcionar como espelho** do Cobmais (hoje ela é só acréscimo). Proposta:

### 1. Modo "Espelho do Cobmais" na importação (novo)

- Na tela de importação, uma opção **"Sincronizar carteira (espelho)"** para o layout UME/Novo Mundo.
- Ao importar com essa opção ligada: para cada CPF+contrato presente na planilha, o sistema
  - insere as parcelas novas (como hoje),
  - atualiza valor e vencimento das que já existem,
  - e **desativa** (`ativo = false`, sem apagar histórico) as parcelas daquele CPF+contrato que **não** vêm mais na planilha — isto é, as pagas/renegociadas.
- CPFs que não aparecem na planilha ficam intactos (não mexe em quem não veio no arquivo).
- Um resumo no fim: inseridas / atualizadas / baixadas automaticamente.

### 2. Corrigir as linhas "Parcela 0"

- Quando a planilha vier sem número de parcela, usar a numeração sequencial pelo vencimento dentro do contrato em vez de gravar "Parcela 0". Assim a deduplicação passa a funcionar e não aparecem mais parcelas fantasma.

### 3. Frequência de sincronização

- **Semanal** é o ponto de equilíbrio recomendado (por exemplo, toda segunda de manhã). Cobre pagamentos da semana e mantém o portal confiável.
- **Diária** só se o volume de pagamentos justificar — o arquivo é grande (≈50 mil linhas por lote) e cada importação consome bastante processamento do backend, o que impacta custo.
- Não recomendo automatizar via integração agora: hoje o arquivo é gerado manualmente no Cobmais; automatizar exigiria acesso de API/exportação agendada do Cobmais.

### 4. Rede de segurança

- Um card de **conferência** na tela de importação: aponta os CPFs em que a soma ativa no portal difere da soma da última planilha importada, com botão para baixar a lista em Excel. Serve para pegar sobras antes que o cliente veja.
- Correção imediata da Selma: com o editor de débitos admin que já existe na tela do cliente, desativar as parcelas 2, 3, 5 e as duas "Parcela 0", deixando 06/07/08 → volta para R$ 257,05.

## Detalhes técnicos

- `src/pages/ImportarDevedores.tsx`: nova flag de sincronização; após montar o lote, agrupar por `cpf + contrato`, comparar com as linhas ativas em `devedores` pela chave `cpf|contrato|descricao|data_vencimento`, fazer `update` de `valor_original`/`valor_atualizado` nas coincidentes e `update ativo=false` nas ausentes (em lotes, respeitando o limite de 1000 linhas do PostgREST). Reaproveitar `filtrarParcelasNovas` para o lado das inserções.
- Correção da numeração: no parser do layout UME (`row['D']`/`row['E']`), quando o número vier vazio/0, derivar por ordem de vencimento dentro do contrato em vez de `Parcela 0`.
- Card de conferência: agregação por CPF da soma ativa em `devedores` vs. soma da planilha carregada, exportando via `src/lib/exportExcel.ts`.
- Sem migração de permissões: as policies de admin sobre `devedores` já permitem update/desativação.
- Nenhuma alteração no cálculo do portal (`src/lib/descontoPortal.ts`) nem no fluxo público.
