## Problema
- Ao importar Excel na aba **Destinatários**, o código só lê a coluna A (telefone) e a coluna B (nome) — todas as demais colunas (CNPJ, atraso, saldo, etc.) são descartadas. Por isso o `{cpf}` sai vazio ({}) na mensagem enviada.
- O mapeamento de placeholders do template (`{{1}} = {cpf}`) é fixo, gravado em `meta_whatsapp_templates.variaveis`, sem UI de edição — se estiver errado, não há como corrigir na tela de envio.

## Escopo (somente frontend, sem tocar em edge functions / banco)

### 1. Diálogo de mapeamento de colunas ao importar planilha
Novo componente `src/components/meta/MapearColunasImportDialog.tsx`:
- Aberto automaticamente após clicar em **Importar Excel** (substitui o fluxo atual que grava direto no textarea).
- Lê as primeiras 8 linhas da planilha e mostra uma tabela: **Coluna A / B / C / …** com preview dos valores.
- Para cada coluna detectada, um `<Select>` permite escolher o papel:
  - `Telefone` (obrigatório, único)
  - `Nome`
  - `CPF / CNPJ`
  - `Atraso (dias)`
  - `Saldo (R$)`
  - `Ignorar` (default)
- Auto-detecção por cabeçalho (regex em `telefone|celular|whats`, `nome`, `cpf|cnpj|documento`, `atraso|dias`, `saldo|valor|divida`) — se acertar, deixa pré-selecionado; senão, o admin ajusta.
- Botão **Confirmar** transforma cada linha da planilha na string CSV que o `parseRecipients` já entende: `telefone, nome, cpf, atraso, saldo` (na ordem fixa esperada), grava em `recipientsRaw` e fecha o dialog.
- Trata a linha de cabeçalho: se a coluna de telefone da linha 0 não tiver dígitos, pula.

### 2. Editor de variáveis do template
Novo componente `src/components/meta/EditarVariaveisTemplateDialog.tsx`:
- Botão "Editar variáveis" ao lado do bloco `<strong>Variáveis:</strong> {{1}}={cpf} · …` (linhas 793-802 de `EnvioMeta.tsx`).
- Detecta os placeholders reais do `body_text` do template (`{{1}}`, `{{2}}`, `{{nome}}`, etc.).
- Para cada placeholder, um `<Select>` com as opções válidas: `{nome}`, `{primeiro_nome}`, `{cpf}`, `{atraso}`, `{saldo}`, `{avista}`, `{parcelado}`.
- Ao salvar, faz `update` em `meta_whatsapp_templates.variaveis` preservando as chaves internas (`_format`, `_components`, `_header_image_url`, `_header_format`) e chama `carregar()` para refletir a mudança.
- Só admin/usuário dono pode editar (usa a RLS existente da tabela — sem migration).

### 3. Ajuste no `parseRecipients`
- Aceitar CPF/CNPJ com pontuação: já hoje pega `parts[2]` como CPF cru — mudar para remover não-dígitos ao popular `cpf`. Isso resolve o caso do usuário (`67853380000188`) sair corretamente na mensagem quando o template estiver mapeado para `{cpf}`.

## Arquivos
- **Criar**: `src/components/meta/MapearColunasImportDialog.tsx`
- **Criar**: `src/components/meta/EditarVariaveisTemplateDialog.tsx`
- **Editar**: `src/pages/EnvioMeta.tsx`
  - `importarExcel` passa a abrir o dialog em vez de gravar direto.
  - Adiciona botão "Editar variáveis" no bloco de variáveis do template.
  - `parseRecipients` normaliza CPF (`replace(/\D/g, "")`).

## Fora do escopo
- Nenhuma migration, edge function, cron, realtime, tabela nova ou mudança no `send-whatsapp-meta`.
- Sem mexer em `client.ts`, `types.ts`, `.env`, `config.toml`.
- Nenhum novo polling / channel — custo Lovable Cloud inalterado.
