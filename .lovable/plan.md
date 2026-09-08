# Aplicar em lote: ignorar quem já tem o template + incluir qualidade desconhecida

## Objetivo
Na aba Templates Meta → Aplicar em Lote:
1. Detectar se o template escolhido já existe em cada número da lista, avisar na tela e não marcá-lo na seleção em massa.
2. A seleção em massa passa a incluir também os números com qualidade desconhecida / sem leitura, junto com os GREEN.

## O que já existe (confirmado)
- A tela carrega os registros por instância do template mestre (`meta_templates_instancia`), com status e motivo de rejeição, e já mostra esse status em cada linha.
- Os templates realmente existentes em cada número ficam em `meta_whatsapp_templates` (`instancia_id`, `nome_template`, `status`), sincronizados da Meta.
- A caixa "Todas as N instâncias GREEN" hoje marca apenas quem está com qualidade GREEN.

## Mudanças (somente `src/pages/MetaTemplates.tsx`)

### 1. Detecção de "já possui"
- Carregar também `meta_whatsapp_templates` (instância, nome do template, status).
- Um número conta como "já possui" o template selecionado quando:
  - existe registro do mestre para aquele número com status aprovado ou em análise, ou
  - existe em `meta_whatsapp_templates` um template com o mesmo nome do mestre naquele número, com status aprovado ou em análise.
- Rejeitado / erro NÃO conta como "já possui" — esses continuam podendo ser reenviados.

### 2. Aviso na lista
- Cada linha que já possui recebe um selo azul "Já possui" e o texto fica levemente esmaecido.
- Acima da lista, uma frase de resumo: "X número(s) já possuem este template e ficam fora da seleção em massa."
- O usuário ainda pode marcar manualmente um número que já possui (a caixinha continua clicável).

### 3. Seleção em massa
- Rótulo passa a ser: "Todas as N instâncias liberadas (GREEN + qualidade desconhecida)".
- Entram na marcação: qualidade GREEN, UNKNOWN e sem leitura.
- Ficam fora: YELLOW, RED e qualquer número que já possua o template.
- Desmarcar continua limpando o mesmo conjunto.

## Impacto
- Só leitura extra de uma tabela já existente; sem migração, sem cron, sem função nova — sem custo adicional relevante.
- Evita reenviar template duplicado para a Meta (reduz rejeições e ruído na conta).

## Verificação
- Build sem erros.
- No preview, com `pedido_permissao_chamada` selecionado: números que já têm aparecem com "Já possui" e não são marcados pelo "selecionar todas"; números com qualidade desconhecida passam a ser marcados.
