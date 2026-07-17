## Objetivo

Manter o botão **"Simular (dry-run)"** e adicionar um novo botão **"Testar instâncias"** que roda um teste real em cada instância selecionada antes do disparo em massa, separando visualmente as que passaram das que falharam.

## Fluxo do novo botão "Testar instâncias"

1. Usuário abre pequeno diálogo pedindo **telefone de teste** (default = primeiro número de `notificar_telefones`, ex: `62991672674`, persistido em `localStorage`).
2. Ao confirmar, para **cada instância marcada** na configuração:
   - Busca o template `lembrete_envio_boleto` aprovado nessa instância.
   - Envia 1 mensagem real via `send-whatsapp-meta` com `{{1}} = "Teste"` e `{{2}} = data de hoje (BR)`.
   - Aguarda 2–4s entre instâncias pra não estourar rate limit.
   - Registra o resultado em memória: `{ instancia_id, nome, ok, erro, message_id }`.
3. Mostra o resultado em tempo real na UI: cada card de instância ganha um badge:
   - ✅ **OK** (verde) — chegou.
   - ❌ **Falhou** (vermelho) com o texto do erro no tooltip.
   - ⏳ **Testando…** enquanto roda.
4. Ao fim, oferece botão **"Desmarcar instâncias com falha"** que remove as reprovadas da seleção (`instanciaIds`) e salva a config automaticamente. Assim o próximo "Enviar agora" só usa as que passaram.
5. Cada envio de teste também vai pra tabela `meta_lembrete_log` com `tipo = 'teste'` pra aparecer no histórico.

## Como fica implementado

### Backend — nova edge function `meta-lembrete-teste-instancias`
- Input: `{ instancia_ids: string[], telefone: string }`.
- Para cada `instancia_id`:
  - Confere `saude_quality` (marca falha imediata se RED/YELLOW, sem gastar template).
  - Busca template `lembrete_envio_boleto` aprovado (falha se não achar).
  - Chama `send-whatsapp-meta` com variáveis `Teste` + data de hoje.
  - Grava em `meta_lembrete_log` (`tipo = 'teste'`).
  - Retorna item do resultado.
- Delay 2–4s aleatório entre chamadas.
- Response: `{ resultados: [{ instancia_id, nome, ok, erro }] }`.

### Frontend — `src/pages/LembreteMeta.tsx`
- Novo botão **"Testar instâncias"** (ícone `TestTube`) ao lado de "Simular (dry-run)".
- Diálogo simples com input de telefone (default do `notificar_telefones`, salvo em `localStorage`).
- Estado `testeResultados: Record<instanciaId, {status, erro?}>` para pintar os cards.
- Badge no card de cada instância (OK / Falhou / Testando).
- Botão **"Desmarcar falhadas"** aparece só após o teste terminar, se houver ≥1 falha.
- Toast final: "X passaram, Y falharam".

## Fora do escopo
- Remover ou alterar o dry-run.
- Mudar template, variáveis ou lógica do cron 08:30.
- Reordenar/redesenhar cards de instância.