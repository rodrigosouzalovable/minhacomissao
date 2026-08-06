# Corrigir FALHA_ENVIO "componente HEADER não contém os campos esperados"

## O que aconteceu (confirmado)

O template mestre `dados_cadastrais` está salvo com **cabeçalho do tipo TEXTO, mas com o texto vazio**. Ao submeter para a Meta, o sistema envia um componente de cabeçalho sem conteúdo, e a Meta recusa com a mensagem "o componente do tipo HEADER não contém o(s) campo(s) esperado(s)".

Ou seja: não é problema da conta nem da categoria UTILITY — é um cabeçalho vazio sendo enviado junto do template. Nas outras contas onde esse template já foi aprovado, ele foi criado sem cabeçalho.

## Correções

1. **Não enviar cabeçalho vazio**: ao montar o template para a Meta, o cabeçalho de texto só é incluído se realmente tiver texto. Cabeçalho de mídia só é incluído se a amostra do arquivo existir. Assim, esse mesmo template passa a ser submetido sem cabeçalho (como nas contas aprovadas).
2. **Bloquear antes de enviar**: na validação prévia, se o tipo de cabeçalho for TEXTO e o texto estiver vazio, o sistema avisa em português claro em vez de deixar a Meta rejeitar.
3. **Impedir o cadastro errado**: no formulário de criação/edição do template, se o cabeçalho for "Texto" e o campo estiver vazio, o salvamento é bloqueado com aviso (ou o cabeçalho é gravado como "nenhum").
4. **Limpar o registro atual**: o template `dados_cadastrais` passa a ficar sem cabeçalho, permitindo reenviar pelo botão "Reenviar falhas".

## Erros muito mais específicos

Hoje só aparece um trecho cortado da mensagem da Meta. Passará a:

- Guardar e exibir a mensagem completa da Meta + o código do erro e o detalhe técnico (`error_user_title`, `error_user_msg`, `code`, `error_subcode`, `details`).
- Traduzir os erros mais comuns em explicações acionáveis, por exemplo:
  - cabeçalho sem texto/mídia → "O cabeçalho está vazio: preencha o texto ou remova o cabeçalho".
  - variável sem exemplo → "Falta o exemplo da variável X".
  - nome duplicado → "Já existe um template com esse nome nessa conta".
  - token inválido/permissão → "O token da instância não tem permissão nessa WABA".
  - limite de templates → "A conta atingiu o limite de templates".
- Exibir na lista de status a explicação amigável em destaque, com o texto técnico original disponível ao passar o mouse (tooltip) e sem cortar a frase no meio.

## Detalhes técnicos

- `supabase/functions/meta-criar-template-lote/index.ts`
  - `buildComponents`: só empurra o componente HEADER quando `TEXT` tem `cabecalho_texto` não vazio ou quando mídia tem `header_handle`.
  - `validarMestre`: novo erro para `cabecalho_tipo === 'TEXT'` sem texto.
  - Captura de erro da Meta: montar mensagem com `error_user_title`, `error_user_msg`, `message`, `code`, `error_subcode` e `error_data.details`, salvando o texto completo em `erro`.
  - Nova função `explicarErroTemplate(dataErro)` para tradução dos casos comuns (mesma ideia de `src/lib/humanizarErroEnvio.ts`).
- `src/lib/humanizarErroTemplate.ts` (novo): tradutor reutilizado na UI.
- `src/pages/MetaTemplates.tsx`: validação do cabeçalho de texto no salvamento; exibição do erro humanizado + tooltip com o texto bruto nas listas de status e de falhas.
- Migração simples de dados: `update meta_templates_mestre set cabecalho_tipo = null where nome = 'dados_cadastrais' and coalesce(cabecalho_texto,'') = ''`.
