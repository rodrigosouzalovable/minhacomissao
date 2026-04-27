Diagnóstico imediato

O problema principal agora não parece ser senha nem tela de login. O backend de dados está com timeout: uma consulta mínima de saúde (`select now()`) falhou com erro 544 / connection timeout. Isso explica o login não concluir ou travar logo após autenticar, porque o sistema precisa consultar perfil, permissões e dashboard.

Sobre adicionar US$10: eu não consigo colocar saldo diretamente na Lovable Cloud por você. Isso precisa ser feito na interface da Lovable: Settings → Cloud & AI balance. Aviso importante: adicionar saldo ou aumentar instância pode aumentar seus custos de Cloud. Como regra do projeto, vou priorizar primeiro correções econômicas e redução de carga.

Plano de correção urgente

1. Restaurar acesso o mais rápido possível
- Remover do fluxo de login qualquer consulta não essencial ao banco antes de redirecionar.
- Manter apenas autenticação + sessão local; validações como `profiles.ativo` passam a rodar depois, sem bloquear a entrada.
- Adicionar fallback de timeout curto nas checagens de perfil/permissão para o usuário não ficar preso em “Carregando...”.
- Exibir mensagem clara quando o backend estiver lento, em vez de deixar o sistema parecer quebrado.

2. Criar “modo emergência” temporário de baixa carga
- Reduzir consultas automáticas e polling enquanto o backend está instável.
- Evitar carregar dashboards pesados imediatamente após login.
- Redirecionar após login para uma tela mais leve, ou carregar o dashboard em blocos com fallback.
- Suspender temporariamente componentes que disparam consultas grandes no carregamento inicial.

3. Otimizar pontos pesados já encontrados
- Dashboard: substituir `select('*')` em acordos/pagamentos por colunas específicas e limites.
- Dashboard: evitar buscar todos os acordos/pagamentos do usuário só para calcular totais; usar consultas contadas/agregadas ou limites quando possível.
- Monitor de Envios: limitar a leitura de mensagens do dia e/ou usar consulta agregada em vez de baixar todas as mensagens para contar no frontend.
- WhatsApp Inbox: limitar contatos carregados inicialmente, remover contagem exata pesada onde não for essencial e evitar `select('*')` nas mensagens.

4. Banco de dados: criar índices de alívio sem apagar dados
- Adicionar índices para consultas críticas:
  - `user_roles(user_id)`
  - `user_permissions(user_id)`
  - `profiles(id, ativo)` se necessário
  - `acordos(user_id, criado_em desc)`
  - `pagamentos(status, data_paga)`
  - `pagamentos(acordo_id, numero_parcela)`
  - `whatsapp_mensagens(direcao, timestamp_msg desc)`
  - `whatsapp_contatos(instancia_id, arquivado, ultima_mensagem_em desc)` já existe, manter/verificar
- Usar `CREATE INDEX IF NOT EXISTS` para não quebrar se já existir.
- Não excluir mensagens, acordos, clientes ou pagamentos.

5. Reduzir automações enquanto o login estiver comprometido
- Revisar jobs automáticos de aquecimento, lembretes, relatórios e filas.
- Pausar somente tarefas não críticas se estiverem contribuindo para saturação.
- Não remover funcionalidades; apenas desacelerar/desativar temporariamente automações pesadas até estabilizar.
- Manter regras essenciais do WhatsApp: não carregar grupos/status, manter mensagens persistidas, manter delays randomizados e respeitar domingo.

6. Reativação automática dos webhooks UAZAPI depois que o sistema voltar
- Implementar a correção planejada de auto-heal dos webhooks, mas não como primeiro passo se o banco estiver travando.
- Primeiro restaurar login e estabilidade; depois automatizar reativação dos webhooks para evitar que o Inbox pare novamente.

7. Validação
- Testar login no preview e no domínio publicado.
- Testar consulta básica do backend.
- Testar carregamento do dashboard.
- Testar entrada no WhatsApp Inbox sem carregar volume excessivo.
- Validar TypeScript/build.

Plano técnico resumido

Arquivos prováveis:
- `src/hooks/useAuth.tsx`: login não deve depender de query de perfil antes de entrar; adicionar fallback resiliente.
- `src/hooks/useUserRole.tsx`: timeout e fallback para `funcionario` sem travar rotas.
- `src/hooks/useUserPermissions.tsx`: timeout/fallback e cache mais conservador.
- `src/pages/Dashboard.tsx`: reduzir consultas amplas e carregar blocos separadamente.
- `src/hooks/useMonitorEnvios.ts`: reduzir/otimizar contagem de mensagens.
- `src/pages/WhatsAppInbox.tsx`: limitar contatos/mensagens e evitar contagens exatas pesadas.
- Nova migração: índices de performance e possível pausa temporária de cron jobs não críticos.

Risco/custo

- Correções de código e índices: custo Cloud baixo/normal, foco em economia.
- Pausar automações: pode atrasar aquecimento, relatórios ou envios automáticos enquanto estabiliza.
- Aumentar instância ou adicionar saldo: pode resolver gargalo de capacidade mais rápido, mas aumenta custo. Eu só recomendo isso se, após aliviar consultas/automações, o backend continuar com timeout.

Ordem recomendada

1. Corrigir login para não bloquear em consultas ao banco.
2. Reduzir dashboard e polling inicial.
3. Criar índices de performance.
4. Se o banco permitir, pausar/desacelerar automações não críticas temporariamente.
5. Testar acesso.
6. Implementar auto-heal dos webhooks UAZAPI.

Se você aprovar, executo esse plano começando pelo caminho mais rápido para voltar o acesso sem apagar dados.