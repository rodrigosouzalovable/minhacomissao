# Mostrar qualidade da instância no "Verificar status na Meta"

## Contexto

Ao clicar em **Verificar status na Meta** na aba **Templates Meta → Status & Aprovação**, hoje o sistema só mostra "Verificação iniciada" e depois recarrega a lista. O usuário quer ver, no retorno da verificação, o **nome da instância**, a **BM vinculada** e a **qualidade atual** de cada instância conferida.

Sobre a pergunta anterior das contas bloqueadas: o erro `#131031` é bloqueio real da Meta — ela recusa **todos** os envios daquele número, inclusive respostas dentro da janela de 24h. Não existe "liberar" pelo nosso lado. A única forma de responder o cliente é por outro número saudável. Se quiser, isso pode vir como um segundo passo (fallback automático para responder por outra instância).

## O que será feito

1. **Edge Function `meta-verificar-status-templates`**: incluir no retorno um array `resumo` com os dados de cada instância que foi conferida:
   - `id`
   - `nome`
   - `telefone` (`display_phone`)
   - `bm` (nome da Business Manager, usando `linhaBmInstancia`)
   - `qualidade` (valor atual de `saude_quality` no banco)

2. **Tela `src/pages/MetaTemplates.tsx`**:
   - Ao receber o retorno da função, abrir um pequeno dialog/toast estendido listando as instâncias conferidas.
   - Mostrar nome + BM + badge de qualidade (GREEN/YELLOW/RED/SEM LEITURA).
   - Manter o recarregamento da lista após a verificação.

## Detalhes técnicos

- `supabase/functions/meta-verificar-status-templates/index.ts`: após o loop de instâncias, montar `resumo` com os campos já carregados do banco (`nome`, `display_phone`, `meta_bm_id`, `saude_quality`) e resolver o nome da BM via `linhaBmInstancia`.
- `src/pages/MetaTemplates.tsx`: capturar o retorno em `verificarStatus`, exibir dialog com o resumo, usar cores existentes (`QUALIDADE_CORES`) para o badge.
- Sem mudança de banco de dados, sem cron, sem Realtime — sem impacto de custo.

## Verificação

- Build sem erros.
- Clicar em "Verificar status na Meta" abre o resumo com nome, BM e qualidade de cada instância conferida.
