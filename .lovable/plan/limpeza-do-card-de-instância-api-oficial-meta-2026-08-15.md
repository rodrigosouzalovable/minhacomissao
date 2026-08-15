# Limpeza do card de instância (API Oficial Meta)

## O que muda em cada card de instância

1. Botões removidos: **Importar fatura**, **Testar**, **Diagnosticar**.
   Permanecem: WhatsApp Manager, Faturamento, Webhook, Templates (+ ícones editar/ativar/excluir).
2. Campo **Telefone** (com o link "editar") sai da grade de identificação e é substituído por **Templates**, mostrando a quantidade de templates sincronizados daquela instância (ex: "12 · 9 aprovados").
   A grade fica: Templates · Phone ID · WABA · Enviadas hoje.
3. Bloco inferior **"Faturas importadas: US$ ..."** (com total, pendentes e "Ver histórico") é removido do card.

## Detalhes técnicos

- Arquivo: `src/pages/ConfigurarMeta.tsx`.
- A contagem de Templates usa os dados já carregados de `meta_whatsapp_templates` na página, agrupados por `instancia_id` (um `useMemo` com mapa id → total/aprovados). Nenhuma query nova, sem impacto de custo.
- Os handlers `abrirImportPdf`, `testar` e `diagnosticar`, além dos estados de edição de telefone e do histórico de faturas, deixam de ser usados no card e serão removidos junto se não tiverem outro uso na página (o dialog de importação de PDF e o card de totais no topo permanecem inalterados, a menos que fiquem órfãos).
- Nenhuma alteração de banco de dados ou de Edge Functions.
