
## Problema

Cada instância Meta guarda uma cópia própria do template (linha em `meta_whatsapp_templates`) com o campo `variaveis._header_image_url`. Hoje:

- **Preview em Envio Meta** usa apenas a primeira linha do grupo (`templateGroup.sample`). Se essa instância específica não tem a imagem cadastrada, aparece "Sem imagem configurada — cadastre em Templates HSM", mesmo que outras instâncias do grupo tenham a imagem.
- **Envio (`send-whatsapp-meta`)** lê `template.variaveis._header_image_url` da linha da instância que vai disparar. Se qualquer instância selecionada estiver sem a imagem, o envio dela quebra com "exige header IMAGE mas não tem _header_image_url configurada".

Ou seja: basta 1 das 25 instâncias não ter a imagem para o preview mostrar erro e o envio falhar naquela instância.

## Correção

Compartilhar a imagem entre todas as linhas do mesmo template (mesmo `nome_template` + `idioma`), usando qualquer linha que já tenha `_header_image_url` como fallback.

### 1. Preview (`src/pages/EnvioMeta.tsx`)

- Calcular `sharedHeaderImageUrl` percorrendo `templateGroup.rows` e pegando o primeiro `variaveis?._header_image_url` não vazio.
- Passar como `imageUrlOverride` para `<TemplateWhatsAppPreview />`, para que o preview mostre a imagem sempre que pelo menos 1 instância do grupo tiver cadastrado.

### 2. Envio (`supabase/functions/send-whatsapp-meta/index.ts`)

Dentro de `buildMetaComponents` (ou na função `sendOne` antes de montar componentes):

- Se `headerFormat === 'IMAGE'` e a linha do template atual não tem `_header_image_url`, consultar `meta_whatsapp_templates` por outras linhas com mesmo `nome_template` + `idioma` + `status = 'approved'` que tenham `variaveis->>'_header_image_url'` preenchido, e usar essa URL.
- Também usar a mesma consulta para recuperar `_components` / `_header_format` quando estiverem ausentes (mesma raiz do problema quando a sincronização de uma instância vem incompleta).
- Só lançar o erro "não tem _header_image_url configurada" quando nenhuma linha irmã tiver a imagem.

Efeito: se você cadastrou a imagem em pelo menos 1 instância aprovada, todas as demais herdam essa URL automaticamente no momento do envio, sem precisar reconfigurar 25 vezes.

### 3. Persistência opcional (mesma migração — recomendado)

Após o envio bem-sucedido com fallback, ou como uma ação one-shot, executar um UPDATE que preenche `variaveis._header_image_url` nas linhas irmãs faltantes, para que futuras sincronizações e outras telas (Templates HSM, Inbox Meta Nova Conversa) também mostrem a imagem sem depender do fallback em runtime.

Proponho fazer isso via um botão discreto **"Propagar imagem HSM para todas as instâncias"** no card do template em `MetaTemplates.tsx`, disparado sob demanda — não automático — para não sobrescrever configurações intencionalmente diferentes.

## Escopo do que NÃO muda

- Não altero o schema, o fluxo de aprovação Meta, nem a UI de cadastro em Templates HSM.
- Não toco na lógica de round-robin, filtro RED/YELLOW, ou seleção de instâncias.
- Nenhuma outra tela que já usa `TemplateWhatsAppPreview` (Inbox, Templates) é impactada em comportamento — só ganha a possibilidade de receber `imageUrlOverride` (opcional).

## Arquivos afetados

- `src/pages/EnvioMeta.tsx` — calcular `sharedHeaderImageUrl` e passar ao preview.
- `supabase/functions/send-whatsapp-meta/index.ts` — fallback de `_header_image_url` (e `_components`/`_header_format`) por `nome_template`+`idioma`.
- `src/pages/MetaTemplates.tsx` — botão opcional "Propagar imagem para todas as instâncias".
