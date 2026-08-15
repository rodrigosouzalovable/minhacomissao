# Token do webhook para parceiros (Thiago Nogueira)

## Por que deu erro

O Verify Token do webhook é hoje um único valor global do sistema, gravado numa tabela liberada apenas para o seu login de admin. Quando o Thiago clica em Salvar, o banco bloqueia a gravação — daí a mensagem "new row violates row-level security policy".

## Como vai funcionar

- Cada parceiro passa a ter o **seu próprio Verify Token**, salvo no login dele.
- Na aba API Oficial Meta, o campo de token do Thiago mostra, salva e regenera só o token dele. Ele não vê nem altera o seu.
- O webhook da Meta passa a aceitar **qualquer** token válido: o global (seus números) ou o de qualquer parceiro. Nada muda para os seus números — não é preciso reconfigurar nada na Meta.
- Ao inscrever/reinscrever o webhook de um número, o sistema usa o token do dono daquele número (parceiro) ou o global (seus números).
- Você, como admin, continua editando o token global normalmente.

## Detalhes técnicos

**Banco (migração)**
- Nova tabela `meta_webhook_tokens (user_id uuid PK, token text not null, atualizado_em)`.
- GRANTs: `select, insert, update, delete` para `authenticated`; `all` para `service_role`.
- RLS: o próprio usuário gerencia a sua linha (`auth.uid() = user_id`); admin gerencia todas.
- Índice único em `token` para evitar colisão entre parceiros.

**Frontend — `src/pages/ConfigurarMeta.tsx`**
- `carregarToken` / `salvarToken` passam a ler e gravar em `meta_webhook_tokens` (upsert por `user_id`) quando o usuário é parceiro (`parceiroMeta`), mantendo `meta_whatsapp_config` para admin.
- Texto de ajuda do campo indica que o token é pessoal do parceiro.

**Edge functions**
- `meta-whatsapp-webhook` (GET challenge): aceita o token se casar com o global **ou** com alguma linha de `meta_webhook_tokens` (consulta por `token`, service role).
- `meta-subscribe-waba` e `meta-webhook-health`: resolvem o token pelo dono da instância — se a instância estiver vinculada a um parceiro (`meta_instance_parceiros`), usam o token dele; senão, o global. Sem token do parceiro, cai no global com aviso claro no retorno.

Sem impacto de custo: nenhum novo cron, polling ou canal em tempo real.
