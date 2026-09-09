# Botão Templates com duas opções + limpeza do topo da aba

## O que muda no card de cada WhatsApp (aba API Oficial Meta)

O botão **Templates** passa a abrir um menu com duas opções:

1. **Aplicar templates** — mantém exatamente o comportamento atual do botão (sincroniza/aplica os templates na instância, como já funciona hoje).
2. **Visualizar templates** — abre uma janela com todos os templates vinculados àquela instância.

## Janela "Visualizar templates"

- Título com o nome/número da instância e a contagem (total e aprovados), a mesma base usada no selo "Templates 7/9" do card, para conferir se o selo está correto.
- Lista de todos os templates daquela instância com: nome, categoria, idioma, status (aprovado / pendente / rejeitado, com cor) e data da última sincronização.
- Campo de busca por nome e filtro rápido por status.
- Clicar em um template abre a prévia estilo WhatsApp (cabeçalho, texto, rodapé, botões, imagem quando houver), reaproveitando a prévia já existente.
- Selo indicando quais desses templates fazem parte do conjunto marcado como "Injetar em números novos", e um aviso listando os marcados que **faltam** nessa instância.
- Botão para sincronizar com a Meta ali mesmo e atualizar a lista.

## Topo da aba

- Remover o botão **Ativar chamadas em todos**. O botão de chamadas dentro de cada card continua existindo.
- Os demais botões (Verificar saúde dos webhooks, BMs, Verificar templates de todas as instâncias, Nova instância) permanecem, agora com o espaçamento reorganizado para caber melhor em uma linha.

## Detalhes técnicos

- `src/pages/ConfigurarMeta.tsx`: trocar o `Button` "Templates" do card por `DropdownMenu` (Aplicar → `sincronizar(inst)`; Visualizar → abre novo estado `instanciaTemplatesOpen`). Remover o bloco do botão `ativarChamadasTodas` na barra superior (manter a função `toggleChamadas` por card; remover `ativarChamadasTodas` se ficar sem uso).
- Novo componente `src/components/meta/InstanciaTemplatesDialog.tsx`: recebe `instancia`, lista `meta_whatsapp_templates` filtrados por `instancia_id` (ou consulta própria), cruza com `meta_templates_mestre` onde `injetar_em_novos = true` por `nome_template`+`idioma`, e usa `TemplateWhatsAppPreview` para a prévia.
- Somente leitura: nenhuma alteração de dados, migração ou Edge Function.
