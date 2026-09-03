# Conversas do Inbox Meta abrindo devagar / vazias (caixas AMARAL NM e demais)

## Causa confirmada no banco

Medi a consulta que roda ao clicar num card, com as regras de acesso do usuário Thiago (perfil funcionário) aplicadas:

- Para devolver apenas **3 mensagens**, o banco leu **21.857 páginas de dados e levou ~1.069 ms**. Quase todo o tempo é gasto nas regras de acesso: para **cada mensagem candidata** o banco reexecuta uma busca na tabela de conversas e chama duas funções de permissão de caixa. Numa conversa longa isso multiplica e, com o banco ocupado, a chamada estoura o tempo limite — a conversa fica em branco ou "carregando".
- Administradores não sentem o problema: a regra deles é resolvida numa única checagem no início. Por isso só usuários comuns (Thiago) relatam.
- Existe também uma **inconsistência de formato de telefone**: a leitura da conversa casa telefones pelos 8 últimos dígitos, mas as regras de acesso exigem telefone **idêntico**. Hoje **103 mensagens** existentes ficam invisíveis por causa disso (conversas parecendo incompletas).
- O banco está muito carregado por outras chamadas do próprio Inbox (etiquetas e qualificações dos contatos somam mais de 1,9 milhão de execuções, com picos de 6–8 s), o que agrava os travamentos ao abrir conversas.

## O que será feito

1. **Uma única checagem de permissão por conversa (correção principal)**
   A leitura das mensagens passa a validar o acesso **uma vez** (o usuário pode ver aquela conversa/caixa?) e, aprovado, devolve a página de mensagens direto. Sai a validação repetida mensagem por mensagem. Expectativa: de ~1.000 ms para poucos milissegundos, e fim dos tempos limite. Nenhuma permissão é afrouxada: quem não tem acesso à caixa continua sem ver nada.

2. **Mensagens deixam de "desaparecer" por formato de telefone**
   O critério de acesso passa a usar o mesmo casamento por 8 dígitos da leitura, recuperando as 103 mensagens hoje escondidas e evitando novos casos.

3. **Índice alinhado à ordenação**
   Índice por instância + sufixo do telefone + data da mensagem, para a página mais recente sair direto do índice, sem ordenar o conjunto inteiro.

4. **Menos carga vinda da lista de conversas**
   Etiquetas e qualificações dos contatos passam a ser buscadas com cache curto e sem recarregar tudo a cada evento em tempo real (só o que mudou), reduzindo o volume de chamadas que hoje deixa o banco lento para todo mundo.

5. **Validação**
   Medir novamente a abertura da conversa com as permissões do Thiago (esperado: dezenas de ms) e abrir conversas das caixas AMARAL NM, AMARAL e Padrão no preview, conferindo que carregam na hora.

> Custo Lovable Cloud: este plano **reduz** custo (menos leitura de disco por abertura e menos chamadas repetidas). Não cria cron, polling novo nem canal em tempo real adicional.

## Detalhes técnicos

- Migração: recriar `public.meta_mensagens_thread(uuid, text, int, int)` como `SECURITY DEFINER, STABLE, SET search_path = public`, com guarda inicial — admin (`has_role`), dono da instância, `can_view_meta_contato_folder` / `can_access_meta_folder` da caixa do contato correspondente (`instancia_id` + `phone_suffix8`), e a checagem de cliente-parceiro (`pode_ver_cliente_parceiro`) — retornando vazio quando não autorizado. `REVOKE` de `anon`, `GRANT EXECUTE` para `authenticated`.
- Índice: `CREATE INDEX IF NOT EXISTS idx_meta_msgs_inst_suffix_ts ON public.meta_whatsapp_mensagens (instancia_id, phone_suffix8(telefone), timestamp_msg DESC);` (substitui o uso do índice atual sem `timestamp_msg`).
- `src/pages/InboxMeta.tsx`: `fetchContatoEtiquetas` / `fetchQualifContatos` deixam de ser chamadas em cheio nos eventos de Realtime e no `visibilitychange` (usar o evento incremental já existente + janela mínima de reconsulta); cache por conversa e skeleton atuais permanecem.
- Nenhuma mudança em regras de negócio, retenção de conversas, rodízio de atendimento ou envio de campanhas.
