## Objetivo

Expandir o botão "Aplicar perfil em todas as instâncias" (na aba Acionamento → editar instância → seção Perfil WhatsApp) para:

1. Aplicar **todos os campos** do perfil de uma vez (foto, nome, descrição, endereço, e-mail) — não apenas nome e foto.
2. Permitir **selecionar quais instâncias** receberão a atualização (uma, várias ou todas), em vez de aplicar a todas as conectadas.
3. Reduzir o intervalo aleatório entre instâncias de **20–40s para 10–30s**.

## Mudanças em `src/pages/Acionamento.tsx`

### Estado novo
- `bulkUpdateApplyDescription`, `bulkUpdateApplyAddress`, `bulkUpdateApplyEmail` (booleans, default `true`).
- `bulkSelectedInstanceIds: Set<string>` — IDs marcados manualmente para receber a atualização.
- Inicialização: ao abrir o diálogo, pré-selecionar todas as outras instâncias conectadas.

### Diálogo de confirmação `bulkUpdateConfirmOpen`
- Adicionar três checkboxes: "Aplicar descrição", "Aplicar endereço", "Aplicar e-mail" (com prévia do valor atual entre `<strong>`).
- Adicionar uma seção "Selecione as instâncias" com:
  - Botões "Selecionar todas" / "Limpar".
  - Lista rolável (max-h ~48) das instâncias `ativo && connectionStatus==='connected'` (excluindo a editada), cada uma com `Checkbox` controlando `bulkSelectedInstanceIds`.
- Estimativa de tempo recalculada com base em `bulkSelectedInstanceIds.size` e novo range (10–30s ⇒ ~0,5 a 1,5 min por instância).
- Botão "Iniciar" desabilitado se nenhum campo marcado **ou** nenhuma instância selecionada.

### `handleBulkProfileUpdate`
- Trocar `connectedOthers` por `instances.filter(i => bulkSelectedInstanceIds.has(i.id))`.
- Para cada instância selecionada, dentro do try:
  - Manter blocos de nome e foto existentes.
  - Adicionar bloco para dados comerciais quando qualquer um dos três (descrição/endereço/e-mail) estiver marcado: um único POST a `${cleanUrl}/business/update/profile` enviando apenas os campos marcados (mesmos valores usados em `handleSaveProfileBusiness`), seguido de update no DB (`whatsapp_profile_description/address/email`) e em `setInstances`.
  - Inserir pequenas pausas randomizadas (5–10s) entre as três sub-etapas (nome → foto → dados comerciais) quando mais de uma estiver ativa, mantendo o padrão atual de pausa entre nome e foto.
- Trocar o delay entre instâncias: `randomDelay(20000, 40000)` → `randomDelay(10000, 30000)`.
- Ajustar condição `disabled` do botão "Aplicar perfil em todas as instâncias" para considerar também `profileDescription`, `profileAddress`, `profileEmail`.

### Texto auxiliar
- Atualizar a frase informativa abaixo do botão (atualmente diz "20-40s entre cada" e está duplicada): trocar para texto único "Atualiza foto, nome, descrição, endereço e e-mail gradativamente, uma instância por vez (10–30s entre cada)".

## Memória
Atualizar `mem://features/whatsapp/bulk-profile-update-anti-ban` para refletir o novo intervalo (10–30s) e a cobertura completa de campos + seleção manual de instâncias.

## Não muda
- Endpoints UAZAPI usados (`/profile/name`, `/profile/image`, `/business/update/profile`).
- Lógica de cache em `user_whatsapp_instances`.
- Pausa de 5 minutos em caso de erro entre instâncias.