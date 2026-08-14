- [Etiqueta no Envio](mem://features/whatsapp/etiqueta-atendente-no-envio) — Conversa recebe etiqueta do atendente nomeado já no envio, sem esperar resposta
- [IAGO Atendente IA](mem://features/whatsapp/iago-atendente-ia) — Atendente de IA na fila do Inbox Meta: caixas por membership, follow-up único 2h (08-19h), opt-out, escalada Aguardando Humano
- [Rodízio circular Inbox Meta](mem://features/whatsapp/inbox-meta-rodizio-circular) — Fila sequencial por caixa, sem compensação de carga; IAGO recebe somente a própria vez
- [Storage Mídia Privado](mem://technical/whatsapp/storage-public-access) — Bucket inbox-media é PRIVADO; usar URLs assinadas (1 ano) para exibir e para Meta/UAZAPI baixarem
- [Plantão IAGO por Caixa](mem://features/whatsapp/iago-plantao-caixa) — Janela horária por caixa em que o IAGO assume todos os novos clientes (default 17h-08h, fds 24h)
- [Entrega Avisos IAGO](mem://features/whatsapp/iago-aviso-humano-entrega) — Validação real da resposta do provedor, fallback Meta oficial, sino interno admin e reenvio de pendentes
- [Data de Pagamento IAGO](mem://features/whatsapp/iago-confirmacao-data-pagamento) — Após a escolha: pergunta se paga hoje, depois que dia; data fora do mês escala para humano

- [IAGO Silêncio Humano/Dúvida](mem://features/whatsapp/iago-silencio-humano-e-duvida) — Não responde quando não sabe (só escala) e fica calado 10 min após resposta humana, inclusive no plantão
