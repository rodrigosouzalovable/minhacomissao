# Fix "Texto do template indisponível" no lembrete_pagamento (Thiago)

## Diagnóstico confirmado
- Thiago Nogueira tem 18 cópias aprovadas de `lembrete_pagamento`; 17 com texto, 1 vazia (instância AMARAL 62 8277-6510, sincronizada 29/10 00:22).
- O catálogo (`src/lib/metaUtilityCatalog.ts`) usa a primeira cópia encontrada como "amostra" do grupo. Calhou de ser a vazia, então a tela mostra o aviso e a prévia/variáveis ficam sem base.

## Correção
1. `metaUtilityCatalog.ts`: ao montar o grupo, preferir como amostra uma cópia aprovada **com texto**; se a amostra atual estiver sem texto e aparecer outra aprovada com texto, trocar. Vale para Envio Meta, Nova Conversa e Reabrir (todos usam o mesmo catálogo/campo).
2. Envio: na hora de enviar por uma instância cuja cópia está vazia, usar o texto da amostra só para prévia (o envio real já usa nome+idioma do template, aprovado na Meta).
3. Dados: preencher o `body_text` da cópia vazia com o texto das outras cópias do mesmo template (mesmo nome/idioma, mesmo dono), via migração pontual — sem custo recorrente.
4. Teste em `metaUtilityCatalog` garantindo que um grupo com cópia vazia + cópia com texto exibe o texto.

Sem novo cron, polling ou consulta pesada.
