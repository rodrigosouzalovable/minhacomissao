# Decisões técnicas

- Todo novo acordo exige confirmação auditável do telefone antes da gravação e formalização por envio do termo na conversa Meta de origem, ou localizada por consulta protegida ao sufixo do telefone, ou download, mantendo o acordo pendente até uma dessas ações.

- A saúde do webhook Meta distingue indisponibilidade da consulta de inscrição incorreta confirmada; só alerta após tentativa de recuperação e confirmação, para evitar avisos falsos por timeout.
- Valores de parcelas próprias, inclusive pagas, e suas datas efetivas de pagamento usam RPC atômica com recálculo de totais e comissões; vencimentos e baixas seguem RPCs autenticadas específicas.

- Inbox Meta: toda entrada recebe um atendente por atribuição atômica; IAGO participa do rodízio somente na PADRÃO, responde apenas suas conversas sem follow-up; “Não lidas” filtra na base antes da paginação; custo mensal é atualizado sem polling.
- Inbox Meta preserves a restricted diagnostic fragment for unknown inbound formats and shows a clear Meta-unavailable notice instead of technical placeholders.
- Inbox media reads and signed URLs follow conversation-level authorization, not broad folder membership; this allows assigned staff to send attachments without exposing files in other folders.
- Migrações Meta→UAZAPI devem reaproveitar o registro da instância oficial, validar o telefone e fixar a caixa antes de desativar o canal antigo, preservando histórico e evitando duplicidade.
- Reservas do Certificado são vinculadas a uma única instância: recusa da Meta marca só o contato como falha e não interrompe as demais, para preservar a cota e a auditabilidade por número.
- De 28/09 a 02/10/2026, o Certificado busca a data exata de um ano antes; não retoma D+5 a D+30 após o teste.
- Cobmais diário envia o XLSX a armazenamento privado e processa no servidor; staging/publicação são atômicos, chave = CPF+credor+contrato+parcela e vencimento é substituível.
- Modelos Meta isolam criação, alteração e automação por dono; fluxos operacionais compartilhados podem ler os modelos necessários, e lotes param ao confirmar Marketing.
- A cópia automática de modelos Meta usa apenas Utility selecionado do mesmo dono em números CONNECTED com qualidade GREEN ou UNKNOWN verificada e sem bloqueio real; YELLOW/RED aguardam, tier 250 reserva duas submissões por número/dia e tiers 1.000/2.000 seguem a fila sequencial. A sincronização manual de HSM mantém a exigência de Utility aprovado na origem para evitar copiar rascunhos.
- Resposta automática é registrada sem encerrar Clara; ela interpreta mensagens consecutivas e resolve oferta→validade→agendamento→documentos por etapa antes da IA.
- Resultados de campanhas cruzam respostas e acordos por sufixo/CPF normalizados e janelas temporais indexadas, para manter a apuração manual rápida sem polling.
- “Não é o cliente” alterna a blacklist por sufixo sem sobrescrever bloqueios anteriores, fica visível no card; todos desfazem pelo card, somente admins listam/exportam.
- Permissões de navegação vêm apenas das abas explicitamente liberadas; `parceiro_meta` restringe instâncias e não concede telas extras.
- A captação nacional de candidatos a resposta automática tem agenda, configuração e trava próprias; usa o teto diário de consultas e limites mensais por conta Google, nunca um bloqueio diário em dólares, e não dispara mensagens.
- Destinatários confirmados sem WhatsApp usam categoria própria de supressão obrigatória por sufixo; falhas inconclusivas nunca são persistidas.
- Parcelas vencidas são derivadas de pagamentos pendentes em acordos ativos e compartilham a consulta entre sino, alerta e Retornos; o pop-up abre uma vez às 9h e às 15h BRT, inclusive no primeiro acesso posterior à janela.
- A comissão do funcionário usa a data efetiva do pagamento: até 30/09/2026 preserva 2/3/4/6/8/10%, e desde 01/10/2026 usa 2/3/4/5/7/9% para todos os credores; honorários do escritório permanecem separados.
- A calculadora UME carrega primeiro cliente e totais, busca tabelas alternativas sob demanda, limita a espera externa e mantém cache de 12 horas sem polling.
- Modelos de negociação por credor mantêm texto editável independente, mesmo quando compartilham extração e cálculo.
- O IAGO participa do rodízio somente na PADRÃO, mas responde toda entrada UAZAPI da AQUECIMENTO com uma resposta curta, sem transferência e sem follow-up.
- A recuperação automática de números próprios RED/YELLOW opera diariamente das 08h às 19h BRT, exceto domingos, e desativa imediatamente remetentes com bloqueio real confirmado pela Meta.
- Contatos confirmados do Google Maps podem ser colocados na blacklist pelo Aquecimento Meta; o bloqueio por sufixo remove o contato da fonte e impede que novas detecções o recriem.
