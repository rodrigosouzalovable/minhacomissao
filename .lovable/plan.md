# Corrigir falha de envio da instância AMARAL 62 8237-0544

## Causa confirmada

A instância está saudável (CONNECTED, sem pausa). A falha vem do template, não do número.

O log de envios da instância mostra 5 tentativas, todas com o mesmo erro da Meta:

```text
(#132018) There's an issue with the parameters in your template
| header: Template does not contain title component, no parameters allowed
```

Motivo: o template `lembrete_envio_boleto` desta instância tem components aprovados
apenas com BODY, FOOTER e BUTTONS — **não tem cabeçalho (HEADER)**. Mesmo assim os
campos `_header_format: IMAGE`, `_header_image_url` e um `_header_media_ids` ficaram
gravados nele (herdados de uma instância irmã que tem header com imagem). O envio
então anexa um parâmetro de header que a Meta recusa.

Como o sistema ignora a instância no primeiro erro e ela era a única selecionada,
o job encerra com "Todas as instâncias foram ignoradas por falhas consecutivas" e
0/38 enviados.

## O que será feito

1. **Envio (`send-whatsapp-meta`)**: passar a decidir o cabeçalho pelos components
   reais do template. Se o template tem components conhecidos e nenhum HEADER, não
   envia parâmetro de header (ignora `_header_format`). `_header_format` volta a ser
   só um fallback para templates sem components cadastrados.
2. **Fallback entre instâncias irmãs**: parar de copiar `_header_format` /
   `_header_image_url` para templates cujos components já provam que não há header —
   a herança de imagem continua funcionando para os templates que realmente têm
   header IMAGE.
3. **Limpeza de dados**: remover `_header_format`, `_header_image_url` e
   `_header_media_ids` do template `lembrete_envio_boleto` da AMARAL (e de qualquer
   outro template aprovado que tenha components sem HEADER com esses campos
   gravados), para que o preview e o envio fiquem coerentes.
4. **Retentar o disparo**: com a correção, os 38 contatos podem ser reenviados
   normalmente por essa instância (o job antigo permanece encerrado; basta iniciar
   um novo).

## Detalhes técnicos

- `getHeaderFormat()` em `supabase/functions/send-whatsapp-meta/index.ts` retorna ''
  quando `variaveis._components` existe e não contém `{type:'HEADER'}`.
- Ajuste no bloco de fallback de irmãs (linhas ~417-449) para não sobrescrever
  `_header_format` quando os components locais já indicam ausência de header.
- Migração/UPDATE pontual em `meta_whatsapp_templates` removendo as chaves de header
  dos templates nessa condição.
- Nenhuma mudança na lógica de round-robin, quality gate ou auto-ignore de instâncias.
