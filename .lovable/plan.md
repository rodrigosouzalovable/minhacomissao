# Plano — Preenchimento automático do telefone UAZAPI

## Resultado esperado
- Toda nova instância conectada por QR Code ou código receberá automaticamente o número real do WhatsApp no cartão.
- A instância **Iphone B1**, conectada e atualmente sem telefone salvo, será corrigida.
- O preenchimento continuará funcionando mesmo se o número ainda não vier na primeira resposta de conexão.

## Correção
- Centralizar no servidor a extração e o salvamento do telefone retornado pela UAZAPI.
- Reconhecer os diferentes formatos de número já usados pelas respostas da UAZAPI, removendo símbolos e identificadores extras.
- Salvar o telefone em todos os caminhos de conexão: QR Code, código de pareamento, instância já conectada e verificação manual.
- Durante **Verificar conexões**, tentar completar automaticamente qualquer instância conectada que ainda esteja sem número, sem criar atualização periódica adicional.
- Manter o número já cadastrado quando uma resposta não trouxer um telefone válido.

## Ajuste da instância atual
- Consultar novamente a instância **Iphone B1** após a correção.
- Gravar o telefone identificado e atualizar imediatamente o cartão da tela.

## Segurança e custo
- A identificação continuará sendo feita somente no servidor, sem expor token ou endereço da instância ao navegador.
- Não será criado novo agendamento, cron ou consulta repetitiva; será aproveitada apenas a conexão e a verificação manual já existentes.

## Validação
- Confirmar que **Iphone B1** aparece com o telefone.
- Conectar ou simular uma nova instância e validar o preenchimento mesmo quando o telefone chega depois do primeiro estado “Conectado”.
- Validar QR Code, código de pareamento, “já conectado” e **Verificar conexões**.
- Confirmar que a lista e a exportação usam o número preenchido automaticamente.
