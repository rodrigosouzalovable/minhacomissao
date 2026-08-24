# Controle de Ponto e Monitoramento de Atividade

## Sobre o IP do escritório

Não é possível descobrir o IP da rede do escritório daqui — o IP visto pelo sistema é o da máquina que faz a requisição. A solução: uma tela admin "IPs autorizados" com um botão **"Autorizar o IP atual"**. Você (ou alguém no escritório) abre o sistema de um computador da rede, clica no botão, e o sistema grava o IP público daquela rede. Dá para cadastrar vários IPs/faixas (caso a operadora troque o IP) e apagar depois.

A validação do IP acontece no servidor (nunca no navegador), então não é burlável pelo celular: se o IP do celular/4G não estiver na lista, o registro é recusado.

## O que será construído

### 1. Bater ponto (4 marcações por dia)
- Entrada, saída para almoço, volta do almoço e saída final.
- Card no Dashboard com o relógio, o próximo passo esperado e o histórico do dia.
- Cada clique passa por uma função no servidor que: confere o IP, confere a ordem das marcações, impede duplicidade e grava com o horário do servidor (BRT) — o funcionário não consegue falsear horário mudando o relógio do PC.
- Se o IP não estiver autorizado: mensagem clara ("Você só pode bater ponto na rede do escritório").

### 2. Bloqueio total até bater a entrada
- Um "portão" no layout do app: enquanto o funcionário não registrar a entrada do dia, todas as telas ficam substituídas por uma tela de ponto (só sair da conta é permitido).
- Admins e gestores nunca são bloqueados.
- Depois do almoço, se ele marcou "saída almoço" e não voltou, o sistema mostra a tela de "volta do almoço" para liberar novamente.

### 3. Monitoramento de atividade/inatividade
- O sistema observa mouse, teclado, scroll e troca de aba. Sem interação por 10 minutos, aparece um aviso flutuante (canto da tela, presente em todas as páginas) com o cronômetro contando o tempo inativo — deixando claro que está sendo monitorado.
- Cada período de inatividade é gravado (início, fim, duração) e aparece só no seu relatório.
- Registro leve: envia batimento resumido em intervalos (economia de custo, sem polling agressivo), com pausa quando a aba está em segundo plano.

### 4. Painel de Presença ao Vivo (admin)
- Quem está online, em almoço, inativo agora ou fora do sistema; há quanto tempo; hora da última marcação.
- Atualização por Realtime + refresh leve.

### 5. Relatório de ponto (só admin)
- Filtro por funcionário e período.
- Colunas: dia, 4 marcações, horas trabalhadas, tempo de almoço, atraso, hora extra, tempo total inativo.
- Exportação em Excel e PDF (espelho de ponto mensal).
- Acesso protegido no banco: funcionário não consegue ver ponto de ninguém (nem o próprio relatório consolidado, só as marcações do dia dele no card).

### 6. Regras de jornada
- Configuração por funcionário: horário de entrada, saída, duração do almoço, tolerância de atraso.
- O relatório calcula atraso, saída antecipada, hora extra e almoço menor/maior que o previsto, com destaque visual.

## Sugestões adicionais

- **Justificativa de exceção**: quando o funcionário esquece de bater ponto ou está em home office, ele solicita ajuste e você aprova/recusa — evita ficar editando ponto na mão.
- **Alerta no seu WhatsApp**: resumo às 09:15 de quem não bateu entrada, e às 18:30 de quem esqueceu a saída (aproveita a infraestrutura de notificação que já existe).
- **Ponto por dispositivo**: além do IP, marcar o computador com um identificador para você ver de qual máquina cada ponto foi batido.
- **Feriados e folgas**: cadastro simples para o relatório não contar falta em dia não trabalhado.
- **Auditoria**: qualquer edição manual de ponto fica registrada com autor e data.

## Detalhes técnicos

**Banco (novas tabelas):**
- `ponto_registros` — user_id, data (date), tipo (entrada/saida_almoco/volta_almoco/saida), registrado_em, ip, user_agent, origem (auto/ajuste), ajustado_por.
- `ponto_ips_autorizados` — ip/cidr, descrição, ativo, criado_por.
- `ponto_jornada_config` — user_id, entrada_prevista, saida_prevista, minutos_almoco, tolerancia_min.
- `atividade_sessoes` / `atividade_inatividade` — user_id, inicio, fim, duracao_seg, ultima_interacao.
- `ponto_ajuste_solicitacoes` — user_id, data, tipo, horario_solicitado, motivo, status, aprovado_por.
- RLS: funcionário lê apenas as próprias marcações do dia corrente e grava só via função server-side; admin (has_role) lê/edita tudo; GRANTs explícitos para `authenticated` e `service_role`.

**Edge Functions:**
- `ponto-registrar` — valida JWT, extrai IP de `x-forwarded-for`, compara com `ponto_ips_autorizados` (inclusive CIDR via `inet`), valida sequência do dia, grava com `now()` no fuso BRT usando service role.
- `ponto-ip-autorizar` — admin-only: retorna o IP atual e cadastra na lista.
- `ponto-atividade-heartbeat` — grava/fecha janelas de inatividade.
- `ponto-alertas-diarios` — cron 09:15 e 18:30, dispara aviso no WhatsApp via `notificar-admin`.

**Frontend:**
- `src/components/ponto/PontoCard.tsx` no Dashboard; `PontoGate` dentro de `AppLayout` para o bloqueio; `InatividadeFlutuante.tsx` global; hook `useAtividadeMonitor` (listeners passivos + throttle, guard de `visibilitychange`).
- Páginas admin: `src/pages/admin/PontoRelatorio.tsx` e `PresencaAoVivo.tsx`, com rota protegida por role e entrada no menu apenas para admin.
- Exportação reaproveitando `src/lib/exportExcel.ts` + jsPDF para o espelho em PDF.

## Aviso de custo (Lovable Cloud)

Esse recurso adiciona escritas periódicas (batimento de atividade), 2 crons diários e 1 canal Realtime no painel de presença. Para manter o custo baixo: batimento a cada 60s apenas quando há interação (e nada quando a aba está oculta), agregação por sessão em vez de linha por evento, índices em `(user_id, data)`, `staleTime` alto nas consultas e Realtime somente na tela de presença ao vivo aberta pelo admin. Impacto estimado: baixo.
