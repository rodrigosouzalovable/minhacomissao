# Aquecimento de tier apenas nos números que você escolher

Hoje o motor de aquecimento pega automaticamente **todos** os números Meta ativos, saudáveis e com token (filtro em `meta-aquecimento-planejar` e `meta-aquecimento-tick`). Vamos trocar isso por uma seleção explícita, feita por você, no momento de conectar o número (ou depois).

## Como vai funcionar

1. No formulário de conectar novo número Meta (aba API Oficial Meta), aparece um interruptor: **"Número de nova BM — entrar no aquecimento de tier"**, desligado por padrão.
2. O mesmo interruptor aparece na edição do número, para ligar/desligar depois.
3. O motor (planejamento diário por IA e ciclos de disparo a cada 10 min) passa a considerar **somente** os números com esse interruptor ligado. Se nenhum estiver ligado, o motor não faz nada e não gasta nada.
4. Na aba "Aquecimento Meta" ganha uma seção **"Números em aquecimento"**: lista dos números marcados, com liga/desliga rápido e aviso quando nenhum está selecionado.
5. Toda essa área (interruptor, abas "Aquecimento Meta" e "Ideias de Templates") continua visível apenas para o seu login de admin — as abas já são admin-only; o interruptor também ficará restrito a admin, inclusive no banco, para parceiros não poderem se inscrever no motor.

Nada muda para campanhas, recuperação de qualidade YELLOW/RED, lembretes ou inbox — apenas o aquecimento de tier fica restrito à sua seleção.

## Detalhes técnicos

Banco (migração):
- Nova coluna `meta_whatsapp_instances.aquecimento_meta_ativo boolean not null default false`, com índice parcial para o motor.
- Política/trigger de segurança: alterações em `aquecimento_meta_ativo` permitidas somente quando `has_role(auth.uid(), 'admin')` (trigger `before update` que rejeita a mudança do campo para não-admin, preservando as políticas atuais de update da tabela).
- Sem backfill: todos os números começam desligados, então o motor fica parado até você marcar as instâncias das novas BMs.

Edge functions:
- `meta-aquecimento-planejar`: adicionar `aquecimento_meta_ativo` ao select e `.eq('aquecimento_meta_ativo', true)` na consulta; encerrar com `skipped: 'nenhuma_selecionada'` quando vazio.
- `meta-aquecimento-tick`: mesmo filtro antes das checagens de saúde/pool/orçamento, para não gastar nada sem seleção.
- `meta-aquecimento-aprender` continua igual (só recalcula placar de nicho e repõe estoque).

Frontend:
- `src/pages/ConfigurarMeta.tsx`: campo `aquecimento_meta_ativo` em `FORM_VAZIO`/`adicionar` e em `abrirEdicao`/`salvarEdicao`, com `Switch` + texto explicativo, renderizado apenas quando `isAdmin`.
- `src/components/meta/AquecimentoMetaTab.tsx`: nova seção "Números em aquecimento" (query nas instâncias com o flag, switch por linha, invalidação das queries de trilha) e estado vazio explicando que o motor está parado.

## Custo (Lovable Cloud)

Nenhum cron novo, nenhum polling novo, nenhum Realtime novo. O efeito é de **redução** de custo e de gasto Meta, porque o motor passa a rodar só nos números selecionados (parado por padrão).
