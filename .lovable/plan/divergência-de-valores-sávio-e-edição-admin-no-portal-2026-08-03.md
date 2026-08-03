# Divergência de valores (Sávio) e edição admin no portal

## Por que o valor ficou diferente

Consultei os dados reais do CPF 046.438.493-12 no banco. Existem 7 linhas de dívida, todas importadas na mesma data (16/04/2026), 6 delas ainda marcadas como ativas:

```text
Parcela 2  — venc. 30/09/2025 — R$ 206,00   ativa
Parcela 3  — venc. 31/10/2025 — R$ 206,00   ativa
Parcela 4  — venc. 30/11/2025 — R$ 206,00   INATIVA (já ocultada)
Parcela 4  — venc. 30/11/2025 — R$  29,84   ativa
Parcela 0  — venc. 08/12/2025 — R$ 412,00   ativa   <-- linha estranha
Parcela 5  — venc. 31/12/2025 — R$ 206,00   ativa
Parcela 6  — venc. 31/01/2026 — R$ 206,00   ativa
```

O Cobmais hoje mostra apenas 3 parcelas em aberto (04 = 29,84; 05 = 206,00; 06 = 206,00 → R$ 441,84). Ou seja:

1. As parcelas 2 e 3 (R$ 206 cada) foram pagas/baixadas no Cobmais depois da importação, mas nunca foram baixadas aqui — o portal é um retrato do dia da importação e não se atualiza sozinho.
2. Há uma linha "Parcela 0" de R$ 412,00 que não existe no contrato do Cobmais (provável resíduo de layout/parcela sem número na planilha) — é ela que infla o total.

Soma das ativas: 206 + 206 + 29,84 + 412 + 206 + 206 = R$ 1.265,84, exatamente o que o portal exibe. Confirmado: o problema é dado desatualizado/duplicado, não cálculo do portal.

## O que fazer

Sua ideia é boa e é o caminho mais seguro: dar ao admin logado a capacidade de corrigir na própria tela do cliente, sem mexer em nada do fluxo do cliente. As permissões do banco já permitem isso (admin já tem gerência total sobre a tabela de dívidas), então não é preciso criar acesso novo nem afrouxar segurança.

### Modo admin no portal de negociação

- Na tela de resultado da consulta, se — e somente se — houver um usuário logado com papel admin naquele navegador, aparece uma faixa discreta "Modo admin" acima da lista de débitos. Para o cliente (visitante anônimo) nada muda.
- Em cada parcela listada, com o modo admin ativo:
  - editar o valor e a data de vencimento na própria linha;
  - editar/definir o número da parcela e o contrato;
  - remover a parcela da consulta (marca como inativa, sem apagar o histórico — mesmo padrão já usado no sistema);
  - botão de adicionar uma parcela faltante ao contrato.
- O total, o desconto e as simulações recalculam na hora após cada alteração.
- Toda alteração é auditável: registra quem alterou e quando.
- Sem modo admin, a tela continua exatamente como está hoje.

### Correção imediata deste cliente

Depois que a edição estiver no ar, você mesmo ajusta o Sávio em segundos: remover as parcelas 2 e 3 (pagas) e a linha "Parcela 0" de R$ 412 → total volta para R$ 441,84.

### Prevenção (para não repetir)

- Ajuste no importador do Cobmais para não gerar mais linhas "Parcela 0" quando a planilha vier sem número de parcela (usa a numeração real ou descarta a linha órfã).
- Recomendação de rotina: reimportar a carteira do Cobmais periodicamente, pois é a reimportação que baixa as parcelas pagas. Se quiser, num próximo passo posso montar uma verificação que aponta CPFs cuja soma no portal difere do último arquivo importado.

## Detalhes técnicos

- `src/pages/ConsultaResultado.tsx`: usar `useAuth` + `useUserRole` para detectar admin; adicionar estado de edição inline por débito e recarregar via `consultar_debitos_por_cpf` após salvar.
- Escrita direta em `public.devedores` (update de `valor_original`/`valor_atualizado`/`data_vencimento`/`descricao`/`contrato`, e `ativo=false` para remover) — a policy "Admins podem gerenciar devedores" já cobre; nenhuma migração de permissão necessária.
- Inserção de parcela nova reaproveita os campos do débito existente (cpf, nome, credor, contrato, estágio).
- Ajuste no parser/ingestão de `src/pages/ImportarDevedores.tsx` para o caso de parcela sem número (hoje virando "Parcela 0").
- Nenhuma alteração no cálculo de desconto (`src/lib/descontoPortal.ts`) nem no fluxo público.
