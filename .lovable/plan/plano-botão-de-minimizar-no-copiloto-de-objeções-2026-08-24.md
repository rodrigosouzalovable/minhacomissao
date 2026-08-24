# Plano: Botão de minimizar no Copiloto de Objeções

## Objetivo
Adicionar um botão de minimizar/maximizar na caixinha de sugestões de respostas do Copiloto de Objeções (`SugestoesObjecaoPanel`), mantendo os botões existentes "Gerar outras" e "Fechar".

## Alterações

### 1. `src/components/inbox/meta/SugestoesObjecaoPanel.tsx`
- Adicionar estado local `minimizado` (`useState(false)`).
- Incluir ícone de minimizar/maximizar no header ao lado dos botões "Gerar outras" e "Fechar".
  - Usar `ChevronDown`/`ChevronUp` (ou `Minus`/`Plus`) do `lucide-react`.
  - `title` dinâmico: "Minimizar" / "Maximizar".
- Quando `minimizado === true`, renderizar apenas o header; ocultar a área de sugestões (`max-h-[45vh] overflow-y-auto`).
- Manter funcionalidade de "Gerar outras" mesmo minimizado (o clique gera novas sugestões; ao maximizar, as novas sugestões já estarão disponíveis).
- Preservar animação e posicionamento absoluto existente.

### 2. Não alterar `src/pages/InboxMeta.tsx`
- O controle de abertura/fechamento permanece via `sugestoesFechadas`; o minimizar é estado interno do painel.

## Critérios de aceitação
- A caixinha aparece normalmente com as 3 ações no header: minimizar/maximizar, gerar outras, fechar.
- Ao clicar em minimizar, o corpo das sugestões some, ficando apenas o header compacto.
- Ao clicar em maximizar, o corpo volta a ser exibido com as sugestões atuais.
- O botão "Gerar outras" continua funcionando no estado minimizado (recarrega sugestões em background).
