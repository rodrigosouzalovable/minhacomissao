# Reformular a lista de Templates HSM no Envio Meta

## Objetivo

Na seleção **Template HSM** da aba **Envio Meta**, manter em cada opção:

- título/nome do template;
- idioma;
- categoria **Utilidade**;
- quantidade de instâncias selecionadas que possuem o template aprovado.

Remover somente os vários selos com os nomes das instâncias. No mesmo espaço, exibir o **texto real da mensagem** daquele template.

## Como ficará

Cada opção da lista terá duas partes:

1. Linha principal: `nome do template · idioma · Utilidade · 18/23 instâncias`.
2. Abaixo: corpo real do template, preservando as variáveis como `{{1}}`, `{{2}}` e as quebras de linha.

O texto será mostrado em até algumas linhas dentro da lista, com continuação visual quando for longo, para a seleção continuar fácil de percorrer. Ao selecionar o template, a prévia completa estilo WhatsApp que já existe abaixo continuará funcionando normalmente.

Se um registro não tiver corpo salvo, será exibido **“Texto do template indisponível — sincronize com a Meta”**, sem inventar conteúdo.

## Alteração técnica

- Ajustar somente `src/pages/EnvioMeta.tsx`, na montagem das opções de `templateGroups` dentro do seletor.
- Remover a criação e renderização de `instBadges` nessa lista.
- Renderizar `g.sample.body_text` como resumo do conteúdo real.
- Manter intactos agrupamento por nome/idioma, contagem de aprovações, filtro de Utilidade, validação das instâncias, variáveis, variações, aplicação de templates e envio.
- Garantir que textos longos não alarguem a janela nem criem rolagem horizontal.

## Escopo

- Nenhuma mudança no banco, nas campanhas ou no envio.
- Nenhuma consulta adicional e nenhum aumento recorrente de custo.
- O botão **Gerar acordo UME** fica em stand-by, sem alteração agora.

## Validação

- Conferir opções com texto curto, longo, variáveis e quebras de linha.
- Confirmar que nome, Utilidade e contagem de instâncias continuam visíveis.
- Confirmar que os nomes das instâncias não aparecem mais nas opções.
- Confirmar que selecionar um template continua atualizando a prévia, as variáveis e as validações de compatibilidade.
