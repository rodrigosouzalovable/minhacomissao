# Permitir apagar BMs banidas sem perder histórico

## O que está acontecendo
A BM não pode ser apagada porque ainda existem registros de envios da Prospecção do Certificado Digital ligados a ela. O banco bloqueia a exclusão para não perder esse histórico (custos, resultados e auditoria).

## Solução
O botão de lixeira passa a **arquivar** a BM quando ela tem histórico:
- A BM some da lista de BMs, dos seletores (Envio Meta, Certificado, filtros) e das cotas diárias.
- Os WhatsApps vinculados a ela ficam "sem BM" (como já acontece hoje ao apagar).
- Configurações do Certificado que usavam essa BM ficam sem BM e o piloto é pausado até nova escolha.
- O histórico de envios e custos continua intacto e ainda mostra o nome da BM.
- BMs sem nenhum histórico continuam sendo apagadas de verdade.
- A confirmação explica: "Esta BM tem histórico e será arquivada; não aparecerá mais no sistema".

## Detalhes técnicos
- Migração: `meta_business_managers.arquivada_em timestamptz NULL` + índice parcial.
- `BusinessManagersManager.tsx`: no delete, se erro `23503` (FK), executar update `ativo=false, arquivada_em=now()`, desvincular `meta_whatsapp_instances.meta_bm_id` e `certificado_config.meta_bm_id`; toast de sucesso.
- Filtrar `arquivada_em is null` nas consultas de listagem de BMs (ConfigurarMeta, EnvioMeta/BmInstanceFilter, Certificado, `useBmCotas`/RPC `meta_bm_uso_24h`).
- Sem cron, polling ou custo recorrente novo.
