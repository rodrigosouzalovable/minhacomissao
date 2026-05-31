## Objetivo

Na seção "Performance por cobrador" da página `/admin/comite-novomundo`, manter os números do mês selecionado e acrescentar, ao lado, uma coluna agrupada **"Histórico total (desde a criação do login)"** com os dados acumulados de cada cobrador no credor `ume_novo_mundo`.

Lista fixa: **Wallace Veríssimo, Ana Flávia, Fernanda, Yasmin, Rodrigo**.

## O que muda

### 1. Hook `useComiteNovoMundo.ts`

Adicionar:

- **`COBRADORES_FIXOS`**: array com os 5 primeiros nomes (match por `ILIKE` em `profiles.nome`, case-insensitive, primeiro nome basta — ex.: `wallace`, `ana flávia`, `fernanda`, `yasmin`, `rodrigo`).
- **`useCobradoresFixos()`**: busca em `profiles` os 5 ids correspondentes + `data_admissao` + `created_at` (a "criação do login" vem de `auth.users.created_at`; como não temos acesso direto, usar `profiles.created_at` que é gravado pelo trigger `handle_new_user` na mesma transação).
- **`useHistoricoCobradores(userIds, cpfsCarteira)`**: para cada user_id, agrega **todos** os acordos do Novo Mundo (sem filtro de mês) e seus pagamentos pagos:
  - `qtdAcordosHist`
  - `valorAcordadoHist`
  - `valorRecebidoHist`
  - `tmrHist` (média de dias entre `criado_em` do acordo e 1º pagamento pago)
  - `desdeData` = `profiles.created_at` formatado

Paginação igual à já existente (`pageSize = 1000`).

### 2. Página `ComiteNovoMundo.tsx`

Na tabela "09 Performance por Cobrador":

- Trocar a fonte da lista de cobradores: passa a iterar sobre os 5 fixos (não mais sobre `porUser` do mês — entram mesmo sem acordo no mês).
- Reordenar colunas em 2 grupos com cabeçalho duplo:
  - **Mês de {mesAno}**: Acordos, Valor acordado, Valor recebido, TMR
  - **Histórico (desde {desdeData})**: Acordos, Valor acordado, Valor recebido, TMR
- Coluna "Tempo em casa" continua à direita (depende de `data_admissao`).
- Se um nome não encontrar profile correspondente, exibir linha com aviso "Usuário não encontrado".

## Dados / custo

- Nenhuma alteração de schema, nenhuma edge function, nenhum cron.
- Custo Lovable Cloud: leitura adicional única de `acordos` + `pagamentos` filtrados pelos 5 user_ids — impacto desprezível, query cacheada por React Query (`staleTime` 5 min).

## Pontos a confirmar depois (não bloqueia)

- Se algum dos 5 nomes na `profiles` estiver grafado diferente do esperado, ajusto o match após você apontar.
