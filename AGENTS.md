# Decisões técnicas

- A saúde do webhook Meta distingue indisponibilidade da consulta de inscrição incorreta confirmada; só alerta após tentativa de recuperação e confirmação, para evitar avisos falsos por timeout.
- Valores de parcelas pendentes próprias usam RPC atômica; vencimentos e baixas de qualquer acordo usam RPCs autenticadas específicas, mantendo valores, comissões e responsável protegidos.

- A Inbox Meta usa filtros paginados/RLS sem polling extra; admins de caixa gerenciam membros e etiquetas apenas da própria caixa.
- Reservas do Certificado são vinculadas a uma única instância: recusa da Meta marca só o contato como falha e não interrompe as demais, para preservar a cota e a auditabilidade por número.
- De 28/09/2026 a 02/10/2026, o Certificado busca a data-calendário exata de um ano antes para renovação; após o teste, não retoma D+5 a D+30 automaticamente.
- A prospecção anual do Certificado roda em dias úteis, prioriza a data exata e amplia até ±15 dias, usa até 50 por instância marcada entre 08h–16h, com reserva atômica por número e custo estimado (teto conjunto R$120/dia); exige Meta CONNECTED, qualidade GREEN/UNKNOWN e template aprovado.
- O painel Campanhas exibe somente jobs comuns; a prospecção do Certificado cria o job pausado para preparação e só o inicia após inserir destinatários e vínculos da Casa dos Dados, evitando campanhas vazias e sem misturar Google Maps.
- Campanhas pontuais D+20 da Casa dos Dados são limitadas a 50 contatos já verificados e administradas separadamente da renovação diária, para impedir duplicidade e consumo acidental da coleta.
- Modelos automáticos usam identidade de serviço e só contam aprovação confirmada pela Meta.
- Respostas automáticas Meta/UAZAPI são registradas uma vez por mensagem, após confirmar envio anterior no mesmo número e instância.
