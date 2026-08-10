# Mostrar o nome da instância nas notificações de restrição

## Causa confirmada
A notificação "Instância Meta restringida/bloqueada" é gerada pelo webhook da Meta. Nesse ponto, os dados da instância são carregados sem o campo `nome` (só `id`, `user_id`, `display_phone`, `access_token`) e o `display_phone` está vazio no banco — então a mensagem cai no último recurso e imprime o ID interno.

Conferido no banco: as duas instâncias citadas têm nome preenchido ("62 8267-7571" e "62 8267-7580") e `meta_verified_name` = "Souza e Ribeiro", mas `display_phone` é nulo.

## O que será feito
1. Passar a carregar `nome`, `meta_verified_name` e `phone_number_id` da instância no webhook, para que o nome real esteja disponível na hora de montar o aviso.
2. Padronizar o texto do aviso para: nome da instância + nome verificado da Meta quando houver, por exemplo:
   `Instância: *62 8267-7571* (Souza e Ribeiro)`
3. Se, em algum caso raro, não houver nenhum nome cadastrado, mostrar o telefone/Phone Number ID em vez do ID interno.
4. Aplicar o mesmo texto padronizado nas outras notificações que falam de instância:
   - aviso de restrição no envio de template
   - aviso de bloqueio anti-marketing (hoje imprime o ID cru)
   - avisos nas funções de envio de texto e de mídia

## Detalhes técnicos
- `supabase/functions/meta-whatsapp-webhook/index.ts`: incluir `nome, meta_verified_name, phone_number_id` no `select` da instância e usar o rótulo padronizado.
- Criar um helper compartilhado em `supabase/functions/_shared/` (ex.: `rotulo-instancia.ts`) que recebe a instância e devolve o rótulo legível.
- Usar esse helper em `send-whatsapp-meta`, `send-whatsapp-meta-text` e `send-whatsapp-meta-media`.
- Sem mudanças de banco de dados e sem impacto de custo (nenhum cron/consulta nova).
