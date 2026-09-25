# Decisões técnicas

- Leituras da Inbox Meta acionadas por eventos devem ser agrupadas e evitadas com a aba oculta; filtros por etiqueta e contagens de não lidas usam índices específicos para evitar consultas repetidas de alto custo.
- Reservas do Certificado são vinculadas a uma única instância: recusa da Meta marca só o contato como falha e não interrompe as demais, para preservar a cota e a auditabilidade por número.