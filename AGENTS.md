# Decisões técnicas

- A saúde do webhook Meta distingue indisponibilidade da consulta de inscrição incorreta confirmada; só alerta após tentativa de recuperação e confirmação, para evitar avisos falsos por timeout.
- Valores de parcelas pendentes próprias usam RPC atômica; vencimentos e baixas de qualquer acordo usam RPCs autenticadas específicas, mantendo valores, comissões e responsável protegidos.

- Inbox Meta: mídia privada valida conversa; IAGO atende PADRÃO 24/7 e escala espera+atendente atomicamente; rodízio por ordem só entre atendentes não admins.
- Reservas do Certificado são vinculadas a uma única instância: recusa da Meta marca só o contato como falha e não interrompe as demais, para preservar a cota e a auditabilidade por número.
- De 28/09 a 02/10/2026, o Certificado busca a data exata de um ano antes; não retoma D+5 a D+30 após o teste.
- A prospecção anual do Certificado roda em dias úteis, prioriza a data exata e amplia até ±15 dias, usa até 50 por instância marcada entre 08h–16h, com reserva atômica por número e custo estimado (teto conjunto R$120/dia); exige Meta CONNECTED, qualidade GREEN/UNKNOWN e template aprovado.
- Campanhas mostra jobs comuns; Certificado só inicia após preparar destinatários Casa dos Dados, sem Google Maps.
- Campanhas pontuais D+20 da Casa dos Dados são limitadas a 50 contatos já verificados e administradas separadamente da renovação diária, para impedir duplicidade e consumo acidental da coleta.
- Modelos Meta são isolados por dono e GREEN/CONNECTED; lotes param ao confirmar Marketing; status paginado distingue seleção e submissão, evitando propagação e falsos envios.
- Resposta automática é registrada sem encerrar Clara; ela interpreta mensagens consecutivas e resolve oferta→validade→agendamento→documentos por etapa antes da IA.
