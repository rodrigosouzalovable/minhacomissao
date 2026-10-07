# Decisões técnicas

<!-- LOVABLE:BEGIN -->
- Campaign images persist in recipient vars keyed by name/language; use isolated send snapshots and path-keyed media caches without updating template defaults, so scheduled and resumed campaigns preserve the chosen image.
<!-- LOVABLE:END -->

- Resolve Meta redirects before rendering; save owner-scoped URLs atomically, override stale templates, preserve sent previews.

- Agreements require audited phone confirmation before saving; remain pending until terms are sent via source/authorized suffix-matched Meta chat or downloaded.
- Inbox dialogs share parsing/state; require body/header values and validated button links, never guesses.

- Meta webhook alerts need failed recovery and confirmed subscription errors, not timeouts.
- Valores de parcelas próprias, inclusive pagas, e suas datas efetivas de pagamento usam RPC atômica com recálculo de totais e comissões; vencimentos e baixas seguem RPCs autenticadas específicas.

- Inbox Meta: toda entrada recebe atendente elegível da própria caixa por atribuição atômica; envios manuais são autorizados no servidor pela caixa; IAGO roda somente na PADRÃO; abrir não conclui o não lido, que só encerra após saída confirmada e posterior à entrada; “Não lidas” filtra antes da paginação.
- Unknown Meta messages keep restricted diagnostics and show a clear content-unavailable notice.
- Inbox pool returns reuse authorized RPCs after individual Meta health confirmation; never bypass real blocks.
- Inbox media reads and signed URLs follow conversation-level authorization, not broad folder membership; this allows assigned staff to send attachments without exposing files in other folders.
- Meta→UAZAPI migrations reuse the official instance, verify its phone and fix its inbox before disabling Meta, preserving history and preventing duplicates.
- Reservas do Certificado são vinculadas a uma única instância: recusa da Meta marca só o contato como falha e não interrompe as demais, para preservar a cota e a auditabilidade por número.
- De 28/09 a 02/10/2026, o Certificado busca a data exata de um ano antes; não retoma D+5 a D+30 após o teste.
- Cobmais diário envia o XLSX a armazenamento privado e processa no servidor; staging/publicação são atômicos, chave = CPF+credor+contrato+parcela e vencimento é substituível.
- Meta stays owner-scoped; shared flows read authorized copies. Utility catalogs merge masters and copies, but sending requires approved copy IDs; batches stop on Marketing.
- A cópia automática de modelos Meta usa apenas Utility selecionado do mesmo dono em números CONNECTED com qualidade GREEN ou UNKNOWN verificada e sem bloqueio real; YELLOW/RED aguardam, tier 250 reserva duas submissões por número/dia e tiers 1.000/2.000 seguem a fila sequencial. A sincronização manual de HSM mantém a exigência de Utility aprovado na origem para evitar copiar rascunhos.
- Resposta automática é registrada sem encerrar Clara; ela interpreta mensagens consecutivas e resolve oferta→validade→agendamento→documentos por etapa antes da IA.
- Campaign results match replies/agreements by normalized phone suffix/CPF and indexed time windows for fast manual checks without polling.
- “Não é o cliente” alterna a blacklist por sufixo sem sobrescrever bloqueios anteriores, fica visível no card; todos desfazem pelo card, somente admins listam/exportam.
- Navigation uses explicitly granted tabs; `parceiro_meta` scopes instances, never grants extra screens.
- A captação nacional de candidatos a resposta automática tem agenda, configuração e trava próprias; usa o teto diário de consultas e limites mensais por conta Google, nunca um bloqueio diário em dólares, e não dispara mensagens.
- Destinatários confirmados sem WhatsApp usam categoria própria de supressão obrigatória por sufixo; falhas inconclusivas nunca são persistidas.
- Parcelas vencidas são derivadas de pagamentos pendentes em acordos ativos e compartilham a consulta entre sino, alerta e Retornos; o pop-up abre uma vez às 9h e às 15h BRT, inclusive no primeiro acesso posterior à janela.
- A comissão do funcionário usa a data efetiva do pagamento: até 30/09/2026 preserva 2/3/4/6/8/10%, e desde 01/10/2026 usa 2/3/4/5/7/9% para todos os credores; honorários do escritório permanecem separados.
- UME loads client/totals first and alternatives on demand; bound waits, cache 12h without polling.
- Creditor negotiation templates keep independent editable text despite shared extraction/calculation.
- O IAGO participa do rodízio somente na PADRÃO, mas responde toda entrada UAZAPI da AQUECIMENTO com uma resposta curta, sem transferência e sem follow-up.
- A recuperação automática de números próprios RED/YELLOW opera diariamente das 08h às 19h BRT, exceto domingos, e desativa imediatamente remetentes com bloqueio real confirmado pela Meta.
- Contatos confirmados do Google Maps podem ser colocados na blacklist pelo Aquecimento Meta; o bloqueio por sufixo remove o contato da fonte e impede que novas detecções o recriem.

- Meta payment errors share commercial classification and cached revalidation before alerts; inconclusive checks never claim unpaid billing or release protected senders.

- Campaign ticks reuse send/pick handlers and pace start-to-start globally, avoiding HTTP overhead.
