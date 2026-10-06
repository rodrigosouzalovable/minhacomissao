# Editar o link do botão URL dinâmico no Envio Meta

## Problema

No Envio Meta, ao selecionar um template cujo botão (ex.: "Detalhes") usa URL dinâmica (`{{1}}` no final), não existe campo para informar o link. Além disso, o envio (`send-whatsapp-meta`) monta apenas header e corpo — nunca envia o componente de botão com o valor da variável da URL, então a Meta não recebe o link correto.

## Objetivo

- Exibir, na aba Envio Meta, um campo **"Link do botão"** sempre que o template selecionado tiver botão URL dinâmico.
- Esse link é enviado à Meta como parâmetro do botão, completando a URL dinâmica.
- Para o template `liberado_para_emissao_2`, pré-preencher com `https://sathgoldficha.42web.io/inss/number/ame_0826.php` como valor padrão salvo.

## Como ficará

1. Ao selecionar um template com botão de URL dinâmica, aparece abaixo das variáveis um campo "Link do botão (URL dinâmica)".
2. O campo vem preenchido com o último link salvo para aquele template; o usuário pode editar antes de enviar.
3. Ao salvar/editar, o link fica gravado no próprio template (em `variaveis._button_url`), valendo para os próximos envios — inclusive campanhas agendadas.
4. A prévia estilo WhatsApp mostra o botão normalmente.
5. Se o campo ficar vazio, o envio é bloqueado com aviso claro ("informe o link do botão"), evitando erro da Meta.

## Alterações técnicas

- `src/pages/EnvioMeta.tsx`:
  - Detectar botão URL dinâmico em `template.variaveis._components` (componente `BUTTONS` com botão `URL` contendo `{{1}}`).
  - Novo estado `buttonUrl` + campo de input com validação (`https://` obrigatório).
  - Persistir em `meta_whatsapp_templates.variaveis._button_url` (mesma chave replicada nas instâncias do grupo, como já ocorre em "Editar variáveis").
  - Enviar `button_url` no payload para a edge function.
- `supabase/functions/send-whatsapp-meta/index.ts`:
  - Em `buildMetaComponents`, quando o template tiver botão URL dinâmico, adicionar componente `{ type: 'button', sub_type: 'url', index: <índice do botão>, parameters: [{ type: 'text', text: <sufixo/link> }] }`.
  - Prioridade do valor: `button_url` recebido no payload → `variaveis._button_url` salvo → erro claro se ausente.
  - Se a URL dinâmica da Meta espera apenas o sufixo após a base, extrair a parte variável; se a base for vazia, enviar o link completo.
- Gravar `https://sathgoldficha.42web.io/inss/number/ame_0826.php` como `_button_url` padrão do template `liberado_para_emissao_2` em todas as instâncias que o possuem.
- Deploy da edge function `send-whatsapp-meta`.

## Fora de escopo

- Nenhuma mudança em templates com botões de resposta rápida ou URL estática.
- Nenhum envio real de mensagem nos testes.

## Validação

- Conferir na tela o campo aparecendo só para templates com URL dinâmica.
- Validar bloqueio quando o link está vazio.
- Verificar o payload montado localmente (sem disparo real).
- Build + `git diff --check` + verificação de tipos.
