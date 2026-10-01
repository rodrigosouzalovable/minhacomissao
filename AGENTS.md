# Decisões técnicas

- A saúde do webhook Meta distingue indisponibilidade da consulta de inscrição incorreta confirmada; só alerta após tentativa de recuperação e confirmação, para evitar avisos falsos por timeout.
- Valores de parcelas próprias, inclusive pagas, e suas datas efetivas de pagamento usam RPC atômica com recálculo de totais e comissões; vencimentos e baixas seguem RPCs autenticadas específicas.

- Inbox Meta: o badge conta somente não lidas da PADRÃO; mídia valida caminhos atual/legado; IAGO atende exclusivamente a PADRÃO sem follow-up, escala por ordem sem admins e mantém “Aguardando Humano” sem atendente apto; custo mensal por conversa é alimentado pelos eventos Meta e atualizado sem polling novo.
- Migrações Meta→UAZAPI devem reaproveitar o registro da instância oficial, validar o telefone e fixar a caixa antes de desativar o canal antigo, preservando histórico e evitando duplicidade.
- Reservas do Certificado são vinculadas a uma única instância: recusa da Meta marca só o contato como falha e não interrompe as demais, para preservar a cota e a auditabilidade por número.
- De 28/09 a 02/10/2026, o Certificado busca a data exata de um ano antes; não retoma D+5 a D+30 após o teste.
- Cobmais diário envia o XLSX a armazenamento privado e processa no servidor; staging/publicação são atômicos, chave = CPF+credor+contrato+parcela e vencimento é substituível.
- Modelos Meta isolam criação, alteração e automação por dono; fluxos operacionais compartilhados podem ler os modelos necessários, e lotes param ao confirmar Marketing.
- Resposta automática é registrada sem encerrar Clara; ela interpreta mensagens consecutivas e resolve oferta→validade→agendamento→documentos por etapa antes da IA.
- Resultados de campanhas cruzam respostas e acordos por sufixo/CPF normalizados e janelas temporais indexadas, para manter a apuração manual rápida sem polling.
- “Não é o cliente” alterna a blacklist por sufixo sem sobrescrever bloqueios anteriores, fica visível no card; todos desfazem pelo card, somente admins listam/exportam.
- Permissões de navegação vêm apenas das abas explicitamente liberadas; `parceiro_meta` restringe instâncias e não concede telas extras.
- A captação nacional de candidatos a resposta automática tem agenda, configuração e trava próprias; usa o teto diário de consultas e limites mensais por conta Google, nunca um bloqueio diário em dólares, e não dispara mensagens.
- Destinatários confirmados sem WhatsApp usam categoria própria de supressão obrigatória por sufixo; falhas inconclusivas nunca são persistidas.
