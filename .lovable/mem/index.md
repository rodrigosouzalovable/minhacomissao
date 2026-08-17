- [Etiqueta no Envio](mem://features/whatsapp/etiqueta-atendente-no-envio) — Conversa recebe etiqueta do atendente nomeado já no envio, sem esperar resposta
- [IAGO Atendente IA](mem://features/whatsapp/iago-atendente-ia) — Atendente de IA na fila do Inbox Meta: caixas por membership, follow-up único 2h (08-19h), opt-out, escalada Aguardando Humano
- [Rodízio circular Inbox Meta](mem://features/whatsapp/inbox-meta-rodizio-circular) — Fila sequencial por caixa, sem compensação de carga; IAGO recebe somente a própria vez
- [Storage Mídia Privado](mem://technical/whatsapp/storage-public-access) — Bucket inbox-media é PRIVADO; usar URLs assinadas (1 ano) para exibir e para Meta/UAZAPI baixarem
- [Plantão IAGO por Caixa](mem://features/whatsapp/iago-plantao-caixa) — Janela horária por caixa em que o IAGO assume todos os novos clientes (default 17h-08h, fds 24h)
- [Entrega Avisos IAGO](mem://features/whatsapp/iago-aviso-humano-entrega) — Validação real da resposta do provedor, fallback Meta oficial, sino interno admin e reenvio de pendentes
- [Data de Pagamento IAGO](mem://features/whatsapp/iago-confirmacao-data-pagamento) — Após a escolha: pergunta se paga hoje, depois que dia; data fora do mês escala para humano

- [IAGO Silêncio Humano/Dúvida](mem://features/whatsapp/iago-silencio-humano-e-duvida) — Não responde quando não sabe (só escala) e fica calado 10 min após resposta humana, inclusive no plantão
- [IAGO entende imagens](mem://features/whatsapp/iago-entende-imagens) — Leitura de imagem via meta-descrever-imagem; comprovante escala para humano, ilegível não é respondida
- [Conversas nunca desaparecem](mem://constraints/whatsapp/inbox-meta-conversas-nunca-desaparecem) — Conversa com resposta do cliente não pode ser excluída/arquivada; exclusão admin-only; retenção 3 dias com dupla checagem
- [Admin de caixa Inbox Meta](mem://features/whatsapp/inbox-meta-admin-de-caixa) — Coluna admin nos membros da caixa permite gerenciar atendentes só daquela caixa
- [Etiqueta só por envio manual](mem://features/whatsapp/etiqueta-atendente-envio-manual) — Campanhas/template HSM não vinculam atendente; conversa vai ao rodízio da caixa


- [Relatório no grupo](mem://features/relatorios/envio-grupo-auto-cura) — Envio em grupo tenta todas as instâncias conectadas, grava a que funcionou e avisa falha total
- [Arquivo UME vínculo CPF](mem://features/relatorios/ume-vinculo-telefone-cpf) — Arquivo diário UME só exporta acionamentos com CPF identificado via acionamento_telefone_cpf
