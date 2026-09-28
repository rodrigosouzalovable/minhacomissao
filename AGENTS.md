# Decisões técnicas

- A saúde do webhook Meta distingue indisponibilidade da consulta de inscrição incorreta confirmada; só alerta após tentativa de recuperação e confirmação, para evitar avisos falsos por timeout.
- Edições de valor e vencimento de parcelas pendentes do próprio acordo são atômicas por RPC com verificação do dono e recálculo do total; gatilhos impedem mudanças diretas de campos restritos e de acordos alheios, preservando a edição administrativa.

- Leituras da Inbox Meta acionadas por eventos devem ser agrupadas e evitadas com a aba oculta; filtros por etiqueta e contagens de não lidas usam índices específicos para evitar consultas repetidas de alto custo.
- Reservas do Certificado são vinculadas a uma única instância: recusa da Meta marca só o contato como falha e não interrompe as demais, para preservar a cota e a auditabilidade por número.
- De 28/09/2026 a 02/10/2026, o Certificado busca a data-calendário exata de um ano antes para renovação; após o teste, não retoma D+5 a D+30 automaticamente.
- A prospecção diária do Certificado usa a meta individual de cada instância marcada, com reserva atômica por número; exige Meta CONNECTED, qualidade GREEN/UNKNOWN e template aprovado, sem interromper as demais quando uma falha.
- O painel Campanhas exibe somente jobs comuns; a prospecção do Certificado cria o job pausado para preparação e só o inicia após inserir destinatários e vínculos da Casa dos Dados, evitando campanhas vazias e sem misturar Google Maps.
- Campanhas pontuais D+20 da Casa dos Dados são limitadas a 50 contatos já verificados e administradas separadamente da renovação diária, para impedir duplicidade e consumo acidental da coleta.
- A aplicação automática de modelos chama a criação com identidade de serviço e só conta aprovações confirmadas pela Meta, para não confundir envio à análise com aprovação.
