# Corrigir erro ao cadastrar novo número Meta (Phone Number ID duplicado)

## Diagnóstico (confirmado no banco)

O Phone Number ID `1320501514475620` **já está cadastrado**, na instância **"SOUZA 62 8269-0288"** (WABA `1744973160103455`), ativa, provedor Meta, pertencente ao login admin RODRIGO RIBEIRO DE SOUZA. Ela não tem vínculo de parceiro, ou seja, ela aparece normalmente na lista da aba API Oficial Meta.

Ou seja: não é uma falha de permissão nem de RLS. O banco tem uma restrição de unicidade em `phone_number_id` e o cadastro está tentando criar uma segunda linha para o mesmo número (aparentemente para atualizar nome/token). O que está errado é a experiência: em vez de explicar isso, a tela mostra a mensagem técnica "duplicate key value violates unique constraint".

## O que muda

1. **Checagem antes de salvar**: ao clicar em "Adicionar", o sistema verifica se o Phone Number ID já existe. Se existir, nada é inserido.
2. **Mensagem clara**: em vez do erro técnico, aparece algo como "Este número já está cadastrado como 'SOUZA 62 8269-0288'. Você quer atualizar essa instância?".
3. **Atualizar em vez de duplicar**: confirmação para aplicar no cadastro existente os dados digitados (nome interno, WABA ID, Business Manager ID, Access Token, tier diário), fechando o diálogo e recarregando a lista.
4. **Mesmo tratamento na edição**: se ao editar uma instância o Phone Number ID digitado pertencer a outra instância, mostra a mensagem explicativa em vez do erro técnico.
5. **Rede de segurança**: caso o erro de unicidade ainda venha do banco (concorrência), a mensagem exibida é traduzida para o texto amigável, nunca o texto do Postgres.

## Detalhes técnicos

- Arquivo único: `src/pages/ConfigurarMeta.tsx`.
- Em `adicionar()` (linha ~381): antes do insert, consulta `meta_whatsapp_instances` por `phone_number_id` (com `maybeSingle`) trazendo `id, nome`. Se houver linha, guarda em estado (`duplicado`) e abre um `AlertDialog` de confirmação para atualizar; ao confirmar, faz `update` na instância existente com os campos do formulário e chama `carregar()`.
- Em `salvarEdicao()` (linha ~452): mesma consulta, ignorando o próprio `id`; se conflitar, exibe toast explicativo com o nome da instância dona do número.
- Tradução de erro: helper local que, ao detectar `phone_number_id_key` / `duplicate key`, troca a mensagem por "Este número (Phone Number ID) já está cadastrado em outra instância".
- Sem migração de banco: a restrição de unicidade é correta e permanece.
- Nenhuma mudança em edge functions ou no fluxo de inscrição de webhook (continua rodando somente quando uma instância nova é realmente criada).

## Verificação

Tentar cadastrar novamente o número `1320501514475620`: deve aparecer o aviso de número já cadastrado com o nome da instância existente e a opção de atualizar, sem mensagem de erro técnica.
