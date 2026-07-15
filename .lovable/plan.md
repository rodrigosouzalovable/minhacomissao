## Objetivo

1. Mostrar o status real de cada instância (banido, restrito, qualidade GREEN/YELLOW/RED, nome sob revisão, última verificação) em cada card da aba **API Oficial Meta** em `ConfigurarMeta.tsx`, exatamente com as mesmas informações já exibidas na página **Envio Meta**.
2. Garantir que os dados fiquem sincronizados entre as duas telas (mesma tabela, mesmos campos, mesmo botão de "Sincronizar agora" já existente que chama `check-meta-instance-health`).
3. Renomear o item de menu **"Envio Meta (massa)"** para **"Envio Meta"** e atualizar as duas referências de texto que citam o nome antigo.

## O que muda

### 1. Componente compartilhado de badges de saúde
Extrair os componentes `SaudeBadgeStatus` e `SaudeBadgeQuality` (hoje inline no fim de `src/pages/EnvioMeta.tsx`) para um arquivo novo `src/components/meta/SaudeBadges.tsx`, exportando também um wrapper `MetaHealthStatusRow` que renderiza:
- Badge de status (CONNECTED / FLAGGED / RESTRICTED / etc.)
- Badge de qualidade (verde/amarelo/vermelho)
- Badge "BANIDO" quando `saude_ban_info` tem conteúdo (mostra motivo em tooltip)
- Badge "Nome: <status>" quando `saude_name_status` está em FLAGGED/PENDING_REVIEW/REJECTED
- Timestamp "verificado às HH:MM" quando existe `saude_checked_at`

`EnvioMeta.tsx` passa a importar desse novo arquivo (comportamento inalterado).

### 2. Card da instância em ConfigurarMeta
- Adicionar os campos `saude_status`, `saude_ban_info`, `saude_checked_at`, `saude_name_status` ao type `Instancia` (o `select("*")` já traz esses valores; falta só o tipo).
- Renderizar `<MetaHealthStatusRow />` no cabeçalho do card, ao lado do badge "Ativa/Pausada" existente, para que uma instância banida como a LD 16 mostre imediatamente "BANIDO" + qualidade RED.
- Manter o botão "Sincronizar agora" já existente — ele já grava esses mesmos campos, então a aba **Envio Meta** vê a atualização imediatamente na próxima leitura (nenhum backend novo é necessário).

### 3. Renomear "Envio Meta (massa)" → "Envio Meta"
- `src/components/layout/AppLayout.tsx` linha 97: label do nav.
- `src/pages/InboxMeta.tsx` linhas 458 e 956: texto dos avisos que mencionam a página.

## Fora de escopo
- Nenhuma migration, nenhum edge function novo, nenhuma alteração em RLS.
- Nenhum refetch/polling adicional — a sincronização entre as duas abas continua sendo feita pelo botão manual "Sincronizar agora" (Lovable Cloud cost neutro).
