

# Gerador de Estrategias de Cobranca com IA

## Objetivo
Substituir o painel atual de segmentacao por regras por um **gerador de estrategias com IA**, onde o admin descreve sua carteira ou situacao e a IA responde com uma estrategia de cobranca personalizada, incluindo priorizacao de clientes, abordagens sugeridas e plano de acao.

## O que sera removido
- Todo o conteudo atual do componente `src/components/EstrategiasCobranca.tsx` (segmentacao por categorias, tabelas, filtros de atraso, filtro tipo de cliente)
- O componente sera reescrito do zero com a nova funcionalidade

## Nova funcionalidade

O componente tera:

1. **Campo de texto (textarea)** onde o admin descreve o que precisa. Exemplos:
   - "Quero uma estrategia para clientes que nunca pagaram nenhuma parcela"
   - "Como priorizar minha carteira de alto valor?"
   - "Crie um plano de acao para inadimplentes com mais de 60 dias"

2. **Botao "Gerar Estrategia"** que envia o prompt para a IA junto com um resumo automatico da carteira (totais agregados, nao dados individuais)

3. **Area de resposta** com renderizacao em markdown mostrando a estrategia gerada pela IA, com streaming token a token

4. **Contexto automatico**: Antes de enviar para a IA, o sistema busca um resumo da carteira (total de acordos ativos, total de devedores sem acordo, distribuicao por faixa de atraso, valores totais) para dar contexto ao modelo sem expor dados pessoais

5. **Botao "Exportar Clientes"** que, apos a estrategia gerada, permite baixar em Excel os clientes que se encaixam nos criterios sugeridos (usando filtros basicos de atraso e status)

## Arquitetura Tecnica

### Edge Function: `supabase/functions/gerar-estrategia-cobranca/index.ts`
- Recebe o prompt do usuario + resumo da carteira
- Usa Lovable AI (google/gemini-3-flash-preview) com system prompt de especialista em cobranca
- Retorna resposta em streaming (SSE)
- O system prompt instruira a IA a atuar como especialista em estrategia de cobranca brasileiro, sugerindo priorizacoes, scripts de abordagem, e planos de acao

### Frontend: `src/components/EstrategiasCobranca.tsx` (reescrito)
- Textarea para o prompt do usuario
- Busca resumo da carteira com useQuery (dados agregados)
- Streaming da resposta da IA com renderizacao progressiva
- Historico das ultimas estrategias geradas na sessao
- Botao de exportar clientes filtrados por faixa de atraso

### Config: `supabase/config.toml`
- Adicionar entrada para a nova edge function com `verify_jwt = false`

### Dependencia
- Instalar `react-markdown` para renderizar a resposta da IA formatada

## Fluxo do usuario

```text
1. Admin abre a pagina de Equipes
2. Rola ate "Estrategias de Cobranca"
3. Digita: "Quero uma estrategia para recuperar clientes inadimplentes ha mais de 30 dias"
4. Clica em "Gerar Estrategia"
5. A IA recebe o prompt + resumo da carteira (ex: "Voce tem 150 acordos ativos, 45 com atraso > 30 dias, valor total pendente R$ 500.000...")
6. A resposta aparece em streaming com sugestoes de priorizacao, scripts, e plano de acao
7. O admin pode exportar os clientes filtrados para Excel
```

## Resumo da carteira (contexto para IA)

Dados agregados enviados automaticamente (sem dados pessoais):
- Total de acordos ativos
- Total de devedores sem acordo
- Distribuicao por faixa de atraso (0-30d, 31-60d, 61-90d, 90+d)
- Valor total pendente por faixa
- Quantidade de clientes que nunca pagaram
- Quantidade com parcela unica pendente
- Top valores pendentes (sem nomes/CPFs)

## Arquivos alterados

1. `src/components/EstrategiasCobranca.tsx` - Reescrito completamente
2. `supabase/functions/gerar-estrategia-cobranca/index.ts` - Nova edge function
3. `supabase/config.toml` - Nova entrada para a function
4. `package.json` - Adicionar react-markdown

