# Corrigir a seleção de instâncias brasileiras

## Diagnóstico confirmado
A classificação atual aceita assinantes de oito dígitos somente quando começam com 2–5, ou celulares de nove dígitos começando com 9. Por isso, os brasileiros **+55 62 8243-5419** e **+55 62 8243-5531**, exibidos pela Meta sem o nono dígito, estão recebendo incorretamente o aviso “Fora da seleção nacional”. A reprodução confirmou que ambos são excluídos; o internacional **+1 555-945-7201** também é excluído, como desejado.

## Correção
- Reconhecer como nacionais os telefones brasileiros com DDI 55, DDD brasileiro válido e celular de oito dígitos no formato antigo, incluindo os dois exemplos da imagem.
- Permitir sua seleção individual e pelo “Selecionar todas”, respeitando as regras atuais de qualidade, aprovação e bloqueios.
- Corrigir automaticamente o aviso nos cartões e as contagens nacionais gerais e por BM, usando a mesma classificação.
- Continuar excluindo números internacionais, especialmente os testes **+1 555**, tanto da seleção quanto das contagens nacionais.
- Preservar cadastros, cartões internacionais, pool e campanhas em execução. Não alterar o telefone salvo nem inventar o nono dígito.

## Detalhes técnicos
Ajustar apenas a classificação compartilhada em `metaNationalInstances.ts`, distinguindo números brasileiros em formato antigo de internacionais. Não substituir a regra por uma lista que exclua somente +1 555: os demais países também devem continuar fora da seleção nacional. Não alterar a validação de destinatários importados nem as regras de envio.

## Validação
- Acrescentar testes com **+55 62 8243-5419** e **+55 62 8243-5531**, com e sem formatação: devem ser nacionais, selecionáveis e contados.
- Testar **+1 555-945-7201** com `+`, sem `+` e com `00`: deve permanecer excluído.
- Manter testes de outros países, DDD inválido, seleção por qualidade/BM e limpeza de seleções antigas.
- Conferir os cartões e contadores na tela, se a sessão permitir, sem disparos reais.