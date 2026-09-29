# Respostas durante a campanha

No detalhe da campanha em andamento, mostrar em destaque:

- **Mensagens enviadas até agora**: total efetivamente enviado, separado do número de contatos apenas processados.
- **Mensagens respondidas**: total de respostas recebidas de destinatários dessa campanha após o envio.
- **Taxa de resposta**: percentual de destinatários que responderam pelo menos uma vez sobre os destinatários com envio confirmado. Assim, várias respostas da mesma pessoa não inflacionam a taxa.
- **Pessoas que responderam**: indicador adicional recomendado, ao lado das respostas, para deixar clara essa diferença.

Mostrar a hora da última apuração e manter o botão **Atualizar** para recalcular sob demanda. Enquanto não houver apuração, exibir “Ainda não calculado”, sem tratar ausência de dados como 0%. Preservar os dados já exibidos de acordos, custo e progresso e o acesso administrativo atual a resultados.

## Detalhes técnicos

Reutilizar `CampanhaResultadoCard`, `envio_meta_job_resultado` e a função existente de cálculo, que já guarda enviados, respostas, pessoas que responderam e taxa; apresentar os números no topo do detalhe, inclusive enquanto o envio ocorre. Conciliar o total de envios do acompanhamento da campanha com a apuração e identificar que respostas são contadas até 72 horas após cada envio. Não criar agendamento, atualização automática ou novas consultas repetitivas.

## Custo e validação

**Alerta de custo Lovable Cloud:** cada clique em **Atualizar** executa a apuração de mensagens e acordos da campanha. Impacto adicional previsto: baixo e proporcional apenas aos cliques; nenhum custo contínuo novo. A aprovação deste plano autoriza esse uso sob demanda.

Conferir uma campanha em andamento e uma concluída, incluindo taxa com múltiplas mensagens da mesma pessoa, números ainda não apurados, atualização manual e disposição em tela pequena. Nenhum novo envio de mensagens será iniciado.
