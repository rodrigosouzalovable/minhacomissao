# Aba "BMs" na API Oficial Meta

Nova aba ao lado de "Instâncias" e "Templates HSM", para ver os WhatsApps agrupados por Business Manager.

## Como vai funcionar

1. Novo botão de aba **BMs (n)** à direita de "Templates HSM", onde n é a quantidade de BMs ativas.
2. Dentro da aba, um botão **"Selecionar BMs"** abre um painel flutuante (popover) com a lista das BMs ativas, cada uma com caixa de seleção, o nome e o Business ID. O painel tem busca por nome, além de "Selecionar todas" e "Limpar".
3. Ao marcar uma ou mais BMs, a área abaixo mostra um bloco por BM selecionada, cada bloco listando todos os WhatsApps vinculados àquela BM: foto de perfil, nome, nome verificado na Meta, telefone, status ativa/inativa e a qualidade (verde/amarelo/vermelho/desconhecida), com a contagem de números no cabeçalho do bloco.
4. Quando nenhuma BM está selecionada, aparece um aviso curto pedindo para selecionar pelo menos uma BM.
5. Um bloco extra "Sem BM vinculada" aparece apenas se essa opção for marcada no painel, para localizar rapidamente números que ainda não têm BM.

Nenhum dado novo é gravado: a aba apenas reorganiza a visualização das instâncias e BMs que já existem no sistema.

## Detalhes técnicos

- Arquivo: `src/pages/ConfigurarMeta.tsx`. Os estados `instancias` (com `meta_bm_id`) e `bms` (de `meta_business_managers`, já filtrado por `ativo`) são carregados na função `carregar()` — nenhuma query nova, nenhum custo adicional de banco.
- Adicionar `TabsTrigger value="bms"` no `TabsList` e um `TabsContent value="bms"`.
- Seleção múltipla via `useState<Set<string>>` (chaves = `bms.id`, mais a chave especial `"__none__"`), com painel em `Popover` + `Command`/checkboxes do shadcn já usados no projeto.
- Agrupamento em memória: `instancias.filter(i => i.meta_bm_id === bm.id)`; para "Sem BM", `!i.meta_bm_id`.
- Reaproveitar os componentes visuais de badge de qualidade/status e `Avatar` já presentes nos cards de instância, extraindo-os para um subcomponente leve dentro do mesmo arquivo se necessário.
