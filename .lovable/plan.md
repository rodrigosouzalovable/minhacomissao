# Google Maps Leads: coluna WhatsApp automática

## O que muda

- Ao concluir uma busca, o sistema verifica automaticamente quais telefones encontrados têm WhatsApp.
- Na tabela de leads, a coluna **Endereço** sai e entra a coluna **WhatsApp**, com marcação clara:
  - Verde "Sim" (tem WhatsApp)
  - Cinza "Não" (não tem)
  - Amarelo "?" (não verificado / erro na checagem)
- Contador no topo: quantos leads com WhatsApp x sem WhatsApp.
- Filtro rápido "Só com WhatsApp" ao lado do atual "Só com telefone".
- Botão "Copiar telefones" e a exportação Excel passam a respeitar o filtro e a exportação inclui a coluna WhatsApp (no lugar do Endereço).
- Botão "Verificar WhatsApp" para reexecutar a checagem em buscas antigas (leads ainda sem verificação).

## Como a verificação é feita

Reutiliza a checagem já existente no sistema (mesma usada em Envio Meta / Acionamento), que consulta os números por uma instância UAZAPI conectada. Nenhum custo Google adicional — a verificação não usa a API do Google Maps.

A instância usada para verificar é escolhida automaticamente entre as instâncias UAZAPI conectadas do usuário. Se nenhuma estiver conectada, os leads ficam com "?" e um aviso explica o motivo.

## Detalhes técnicos

1. Migração no banco: adicionar em `google_maps_leads` as colunas `tem_whatsapp boolean` (nulo = não verificado) e `whatsapp_verificado_em timestamptz`, mais índice por `busca_id, tem_whatsapp`.
2. Nova Edge Function `google-maps-verificar-whatsapp`:
   - recebe `busca_id`;
   - carrega os leads com telefone e `tem_whatsapp is null`;
   - seleciona uma instância UAZAPI conectada (server_url + token) do usuário;
   - chama a lógica de `/chat/check` em lotes (mesmo padrão de `check-whatsapp-numbers`);
   - grava `tem_whatsapp` true/false por lead (erros ficam null) e retorna totais.
3. `google-maps-buscar-leads` (ou o cliente logo após a busca) dispara essa verificação automaticamente para a busca recém-criada.
4. `src/pages/GoogleMapsLeads.tsx`: substituir a coluna Endereço pela coluna WhatsApp com badge, adicionar filtro/contadores/botão de reverificar e ajustar `exportarExcel` + `copiarTelefones`.
