# Relatórios: novas regras de CPC/CPC-A + parcial no grupo do WhatsApp

## 1. O que verifiquei da 3C Plus (dados reais)

- Total de ligações no cache: **995**, todas do dia **05/08**. Hoje (06/08): **0 ligações**.
- Último evento recebido do webhook: **05/08 às 16:15 BRT** (`call-history-was-created`). Desde então nada chegou.
- Das 995: **89 marcadas como Alô**, 79 com agente identificado, apenas 38 com qualificação.
- Das 23 qualificações importadas da 3C, **nenhuma** está classificada como CPC ou CPC-A no painel. Por isso o CPC por ligação sempre sai **0** — e é exatamente o que aparece no seu print (Ligações 0 | Alô 0).

Conclusão: o formato dos dados que chegam está correto (telefone, hora, agente, tempo falado), mas **o fluxo parou de receber eventos** e o **mapeamento de qualificações nunca foi preenchido**. Com a regra nova que você pediu, o mapeamento deixa de ser necessário.

## 2. Novas regras do relatório

| Coluna | Nova regra |
|---|---|
| CPC | soma de três origens, contando **cada telefone uma vez por dia**: (a) cliente respondeu no Inbox Meta; (b) **qualquer ligação falada no discador** (Alô — tempo falado com agente > 0), sem depender de qualificação; (c) **cliente que consultou o portal de negociação**, na hora em que consultou |
| CPC-A | **todo acordo lançado no sistema**, contado na faixa de hora em que foi criado (não exige mais ter sido CPC antes) |
| Alô | mantém: ligações faladas |
| Tentativas | mantém: envios WhatsApp + ligações discadas |

Detalhes:
- Portal: cada consulta de CPF vira CPC na hora da consulta, casada por sufixo de 8 dígitos do telefone (e pelo CPF quando não houver telefone), sem contar duas vezes quem já entrou por WhatsApp ou ligação.
- Acordos: CPC-A passa a ser a contagem de acordos criados naquela hora; assim o total de CPC-A do dia bate com "Acordos lançados".
- Edições manuais do admin continuam intocadas (`*_manual` sempre prevalece).
- A mensagem do WhatsApp ganha a quebra das origens do CPC: `WhatsApp / Ligação / Portal`.

Também vou recalcular hoje e os últimos dias para o histórico refletir as regras novas.

### Sobre o webhook parado
Incluo no painel "3C Plus" um alerta quando o último evento tiver mais de 2 horas ("Webhook sem eventos desde HH:MM — verifique na 3C"), para você perceber na hora que a integração cair. Se hoje o discador estiver rodando, o alerta confirma que o problema está no cadastro do webhook na 3C e não aqui.

## 3. Enviar a parcial direto no grupo "UME | Souza e Ribeiro"

Sim, é possível. A instância **MEMU 37** é a única ativa e é a que já envia os informativos; o envio para grupo usa o mesmo endpoint de texto, trocando o número pelo **JID do grupo** (algo como `1203630...@g.us`).

Como fica:
1. No painel de Relatórios, um bloco **"Destinos do relatório"**: lista os grupos da MEMU 37 (já existe a rotina que lê os grupos da instância), você escolhe **UME | Souza e Ribeiro** e salva.
2. A partir daí, a parcial de hora em hora e o consolidado das 19h30 vão para os dois números atuais **e** para o grupo.
3. Botão **"Enviar teste no grupo"** para confirmar na hora.
4. Se o grupo falhar, o envio para os números não é afetado (e o erro fica registrado).

Ponto de atenção: para enviar em grupo, a MEMU 37 precisa continuar dentro do grupo; se sair, o envio falha e o alerta aparece.

## Detalhes técnicos

- `supabase/functions/relatorio-acionamentos-sync/index.ts`: CPC de ligação passa a usar `atendida = true` (ignora `tresc_qualificacoes`); nova leitura paginada de `consulta_cpf_notificacoes` do dia (`created_at`, `telefones_suffix`, `cpf`) para CPC de portal; CPC-A passa a contar acordos por faixa de hora via `criado_em`; mensagem com quebra por origem.
- Novas colunas em `relatorio_acionamentos`: `cpc_portal_auto`, `cpc_ligacao_auto`, `cpc_whatsapp_auto` (GRANT + RLS no padrão da tabela) para a tela mostrar a origem.
- `supabase/functions/_shared/notificar-numeros.ts`: aceitar destinos que já sejam JID de grupo (`@g.us`), enviando sem o prefixo `55`, com log próprio em `admin_notificacoes_log`.
- Nova tabela `relatorio_destinos` (ou coluna em `relatorio_acionamentos_meta`) guardando o JID do grupo escolhido e a instância; leitura autenticada, escrita admin/service role.
- Frontend: bloco de destinos + alerta de webhook em `src/components/relatorios/Config3CPlusDialog.tsx` e `src/pages/Relatorios.tsx`, reaproveitando `get-group-jid` para listar os grupos.
- Sem novo cron, sem novo polling, sem canal Realtime novo — o custo no Lovable Cloud fica igual (apenas mais uma mensagem por execução já existente).
