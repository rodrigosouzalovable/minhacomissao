## Objetivo
Ajustar a página **Envio MetaMassa** (`src/pages/EnvioMeta.tsx`) com quatro mudanças de UI.

## Mudanças

### 1. Remover "Plano de escalonamento"
- Remover `<EscalonamentoPanel />` (linha 670) e o import correspondente (linha 20).
- Componente e hook continuam existindo no projeto, apenas deixam de ser renderizados aqui.

### 2. Substituir os 4 quadrantes de métricas por 3 cards
Substituir o bloco atual (Meta hoje / Únicos hoje / Únicos 7d / Mensagens hoje + banner verde "Meta de hoje atingida") por três cards simples:

- **Envios de hoje** — total de mensagens enviadas hoje.
- **Últimos 7 dias** — total das mensagens enviadas nos últimos 7 dias.
- **Todos os envios** — total histórico de envios já realizados.

Fonte de dados: `meta_whatsapp_mensagens` filtrando `direcao='saida'` e `user_id`. Vou criar um hook enxuto `useMetaEnviosTotais` (3 counts com `head:true, count:'exact'`) para popular os cards, ou usar o `resumo` existente para hoje/7d e uma query extra para o total.

Remover totalmente o banner verde "✅ Meta de hoje atingida (…)" — não haverá mais conceito de meta nesta tela.

### 3. Card "2. Instâncias" vira botão "Acessar Instâncias"
No card `2. Instâncias`, substituir a lista rolável de cards de instância por:
- Texto curto: quantas instâncias marcadas / total.
- Botão **Acessar Instâncias** que abre um `Dialog` (shadcn) contendo exatamente a mesma UI de seleção/round-robin/badges que hoje está inline (mover o JSX da lista para dentro do `DialogContent`).
- Botões "Selecionar todas" e "Verificar saúde" também vão para dentro do dialog (topo).

Assim o card fica compacto independentemente da quantidade de instâncias.

### 4. Remover botão "Enviar teste (1º número)"
No card "4. Delay e disparo", remover o botão amarelo `Enviar teste (1º número)` (linha ~1261) e o handler `enviandoTeste`/função de teste associada, mantendo apenas o botão **Disparar**.

## Arquivos afetados
- `src/pages/EnvioMeta.tsx` — todas as mudanças acima.
- (opcional) `src/hooks/useMetaEnviosTotais.ts` — novo hook para os 3 totais.

Nada muda no backend nem em `EscalonamentoPanel.tsx` (fica órfão mas preservado).
