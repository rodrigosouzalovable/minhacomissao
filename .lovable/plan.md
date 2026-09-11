# Corrigir o aviso ao sincronizar perfil Meta

## Diagnóstico confirmado

A sincronização da instância **SOUZA 62 8274-9929** ocorreu parcialmente:

- a Meta autorizou e retornou o nome oficial **“Souza e Ribeiro”** e o status **APPROVED**;
- a Meta recusou apenas a consulta da foto e do texto “sobre”, retornando **`(#10) Application does not have permission for this action`**;
- por isso a tela exibiu “Perfil atualizado com aviso”. Não é falha da conexão do número nem da qualidade: o aplicativo/token atual não tem acesso suficiente ao perfil comercial dessa conta.

## O que será ajustado

1. Tratar nome, foto e “sobre” como resultados independentes, preservando tudo que foi sincronizado com sucesso.
2. Trocar a mensagem genérica pelo resultado exato, por exemplo: **“Nome oficial atualizado. A Meta não autorizou acessar foto e sobre desta conta.”**
3. Não apagar foto ou dados já salvos quando a Meta negar temporariamente essa consulta.
4. Incluir no retorno da sincronização um diagnóstico específico para o erro `#10`, indicando que a permissão/acesso do aplicativo Meta precisa ser concedida novamente para essa BM/WABA.
5. Validar novamente nessa instância e confirmar que o nome continua salvo e que o aviso não sugere falha total.

## Limitação externa

A alteração melhora o comportamento e a explicação no sistema. Para trazer a foto e o “sobre”, a Meta ainda precisa conceder ao aplicativo/token acesso de gerenciamento do WhatsApp Business dessa conta; o sistema não consegue contornar essa autorização da Meta.
