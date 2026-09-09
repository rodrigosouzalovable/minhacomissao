# Corrigir a verificação de templates das instâncias

## O que está acontecendo

A verificação ("Verificar templates de todas as instâncias") só olha o registro interno de injeções feitas pelo próprio sistema. Ela não olha os templates reais que a Meta já aprovou naquele número.

Conferido no banco para SOUZA 62 8270-2300: o número tem **11 templates aprovados** na Meta, mas **nenhum** registro interno de injeção. Por isso a verificação disse "faltam 12". Comparando pelos nomes, faltam de verdade apenas **3**: `atendimento_em_andamento`, `informacoes_sobre_seu_debito`, `registramos_seu_interesse_no_acordo`.

Isso afeta todos os números conectados antes da injeção automática existir (só 27 números têm registro interno).

## Como corrigir

1. A verificação passa a comparar pelos **templates reais de cada número** (nome + idioma), somando o que a Meta já aprovou/está analisando com o que o sistema já injetou. Assim "faltando" reflete a realidade.
2. Antes de enfileirar, o número já existente é ignorado — nada é reenviado à Meta para um modelo que já existe lá.
3. No momento do envio (fila gradual), última checagem: se o modelo já existe naquele número, o item é fechado como "já existe" em vez de criar duplicado na Meta.
4. A janela "Visualizar templates" passa a usar a mesma regra para o aviso de "modelos que faltam aqui", casando nome + idioma (hoje casa só nome).

Nada muda no ritmo seguro: 1 modelo por vez, 15–25 min de intervalo, 09h–18h, nunca no domingo, e nenhum número com qualidade amarela/vermelha é tocado.

## Detalhes técnicos

- `supabase/functions/meta-templates-auditar-instancias/index.ts`: além de `meta_templates_instancia`, carregar `meta_whatsapp_templates` (`instancia_id in elegíveis`, status `approved`/`pending`/`in_appeal`) e montar um `Set` de `nome|idioma` por instância; comparar `meta_templates_mestre` (`nome` + `idioma`) contra esse conjunto unido para calcular `possui`/`faltando`/`_novos`.
- `supabase/functions/meta-templates-onboarding-tick/index.ts`: antes do `POST` de criação na Meta, consultar `meta_whatsapp_templates` por `instancia_id` + `nome_template` + `idioma`; se existir, marcar o item da fila como `APPROVED` com motivo "já existente no número" e seguir para o próximo, sem chamar a Meta.
- `src/components/meta/InstanciaTemplatesDialog.tsx`: trocar o cruzamento por `nome_template` puro pelo par `nome_template|idioma` (`chaves` já existe no arquivo).
- Sem migração de banco e sem alteração de dados.
