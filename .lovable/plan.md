## Plano B — Diagnóstico de performance (somente leitura)

Objetivo: descobrir EXATAMENTE o que deixa o sistema lento e entregar um relatório com prioridades, **sem alterar dados, acordos, WhatsApps ou criar/excluir tabelas**. Só depois você decide o que aplicar.

### Sintomas conhecidos (já mapeados)
- `WhatsAppInbox.tsx` com 1624 linhas, 49 efeitos/canais/queries — Realtime + polling 20s + visibilitychange.
- `Acordos.tsx` com 1439 linhas, 15 efeitos/queries.
- `Aquecimento.tsx` com 861 linhas, 22 efeitos/queries.
- Bundle único, sem code-split por rota (todas as 30+ páginas carregam de uma vez).
- Sem `React.lazy`/`Suspense` em nenhum lugar.
- Dependências pesadas no bundle inicial: `xlsx`, `jspdf`, `recharts`, `embla-carousel`, `react-markdown`, `react-day-picker`.
- Queries com `cpf_normalize()` e `LIKE '%suffix%'` (telefones) sem índices funcionais.
- Realtime ligado em várias tabelas grandes (mensagens, contatos, fila).

### Etapas do diagnóstico

**1. Profile real do navegador (na sua sessão)**
- Rodar `browser--performance_profile` na home, em `/inbox`, `/acordos`, `/aquecimento`, `/dashboard`.
- Coletar: Web Vitals (LCP/INP/CLS), long tasks, scripts mais lentos, contagem de DOM.
- Rodar `browser--start_profiling` → interagir 10s → `browser--stop_profiling` para achar funções que mais consomem CPU.

**2. Análise do bundle (sem build manual)**
- Mapear quais libs entram em cada rota (xlsx/jspdf/recharts são usadas só em poucas telas).
- Estimar ganho de code-split por rota e lazy-load de libs pesadas.

**3. Diagnóstico do banco (somente SELECT)**
- Listar índices existentes nas tabelas críticas: `whatsapp_mensagens`, `whatsapp_contatos`, `whatsapp_fila`, `devedores`, `acordos`, `pagamentos`, `whatsapp_aquecimento_*`.
- Identificar consultas lentas usando `pg_stat_statements` (se ativo) e logs do Supabase.
- Apontar onde faltam índices (ex.: `cpf_normalize(cpf)`, sufixo de telefone, `instancia_id+timestamp_msg`, `acordo_id+status`).

**4. Inventário de Realtime / polling**
- Listar todos os `supabase.channel(...)` e `setInterval` no frontend.
- Marcar quais são realmente necessários vs. quais podem virar `refetchOnWindowFocus` do React Query.

**5. Carga de dados por tela**
- Tamanho médio de payload em `/inbox` (mensagens carregadas por contato), `/acordos` (com filtros default), `/aquecimento`.
- Detectar queries que retornam centenas/milhares de linhas sem paginação.

**6. Compute do Lovable Cloud**
- Verificar status atual e se há sinais de saturação (timeouts, latência alta, erros 5xx em logs).
- Avaliar se faz sentido subir o tamanho da instância (Backend → Advanced settings → Upgrade instance).

### Entrega final do diagnóstico (relatório em chat)
Ao final você recebe:
1. **Top 5 gargalos** ordenados por impacto x esforço.
2. **Ganho estimado** de cada correção (ex.: "code-split de rotas → -60% no JS inicial").
3. **Plano C de execução** com fases pequenas e seguras (cada fase só refatora código, nunca toca em dados).
4. **Recomendação sobre instância** do Lovable Cloud.

### Garantias de segurança
- **Nenhuma migration**, nenhum `INSERT/UPDATE/DELETE`.
- Não toca em `acordos`, `pagamentos`, `devedores`, `user_whatsapp_instances`, `whatsapp_mensagens` etc.
- Não desconecta WhatsApps, não altera webhooks, não mexe em crons.
- Tudo é leitura: profiling no navegador + `SELECT` no banco + leitura de arquivos.

### O que fica fora deste plano (será decidido depois, com sua aprovação)
- Code-splitting por rota com `React.lazy`.
- Lazy-load de `xlsx`/`jspdf`/`recharts`.
- Quebra de `WhatsAppInbox.tsx` em componentes menores.
- Criação de índices no banco (migration separada e revisada).
- Substituir polling por Realtime focado.
- Upgrade da instância Cloud, se necessário.
