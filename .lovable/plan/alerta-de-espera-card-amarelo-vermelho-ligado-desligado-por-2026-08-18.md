# Alerta de espera (card amarelo/vermelho) ligado/desligado por caixa

## O que muda

- No menu do botão direito da caixa → **Configurar caixa**, entra uma nova chave: **Alerta de cliente esperando resposta**.
  - Ligada: o card continua piscando amarelo (15–30 min) e vermelho (mais de 30 min).
  - Desligada: os cards daquela caixa nunca ficam amarelos nem vermelhos.
- A chave já vem **desligada na caixa AQUECIMENTO** (é a que você pediu) e **ligada nas demais**, para não mudar o comportamento atual das outras caixas.
- O botão "Dispensar alerta" dentro da conversa também deixa de aparecer quando o alerta está desligado na caixa.

## Detalhes técnicos

- Banco: adicionar coluna `alerta_espera_ativo boolean not null default true` em `meta_qualificacao_caixa` (tabela já usada para config por caixa) e gravar `false` para a linha da caixa AQUECIMENTO.
- `MetaFolderConfigDialog.tsx`: carregar/salvar o novo campo no mesmo upsert por `folder_id`, com um `Switch` novo no bloco de cima.
- `InboxMeta.tsx`: carregar o campo junto do mapa de qualificação por caixa e, quando desligado, não aplicar as classes `pisca-sla-amarelo` / `pisca-sla-vermelho` (linhas ~1794) nem exibir o controle de dispensar alerta.
- Sem novo cron, polling ou canal Realtime — nenhum impacto de custo.
