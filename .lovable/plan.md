# Exibir BM e corrigir o status das instâncias Teste Meta

## Diagnóstico confirmado

- A instância **TESTE 1 555-348-3641** está ativa e vinculada à **BM Hafamed (FB GEOVANNA)**.
- Ela aparece como **Desconectada** porque ainda não possui um status de saúde registrado. Hoje, a aba interpreta qualquer status diferente de `CONNECTED` — inclusive ausência de verificação — como desconexão.
- A instância **TESTE 1 555-482-5731** está vinculada à **BM Avivamed (FB AVATUS)** e possui status `CONNECTED`.

## Alterações

1. **Mostrar a BM em cada cartão Teste Meta**
   - Trazer o nome da BM vinculada junto com os dados seguros da instância.
   - Exibir uma linha visível `BM: nome da BM` abaixo do telefone.
   - Mostrar `BM não vinculada` caso uma instância não tenha vínculo, sem expor identificadores ou credenciais.

2. **Diferenciar “desconectada” de “ainda não verificada”**
   - `CONNECTED` continuará aparecendo como **Conectado**.
   - Um status oficial de desconexão aparecerá como **Desconectado**.
   - Status vazio ou desconhecido aparecerá como **Não verificada**, evitando o alerta vermelho incorreto.

3. **Atualizar a verificação da lista**
   - Preservar o nome da BM e o status detalhado ao clicar em **Verificar conexões**.
   - Garantir que a atualização da lista não apague essas informações dos cartões.
   - Manter as instâncias Teste Meta somente para consulta e exportação, sem liberar edição pela área UAZAPI.

4. **Validar o resultado**
   - Conferir as duas instâncias no perfil administrador e em um usuário autorizado.
   - Confirmar BM Hafamed na `555-348-3641` e BM Avivamed na `555-482-5731`.
   - Confirmar que a primeira aparece como **Não verificada**, e não **Desconectada**, enquanto não houver confirmação oficial.
   - Verificar que a exportação de números conectados continua funcionando sem duplicidades.

## Detalhes técnicos

- Ampliar as respostas `list-meta-test-instances` e `list-instances-status` para incluir o nome da BM por meio do vínculo já existente.
- Transportar `bm_nome` e o status original até a lista da aba UAZAPI.
- Usar um estado visual com três possibilidades para instâncias Teste Meta: conectado, desconectado confirmado ou não verificado.
- Não será criado novo agendamento, consulta recorrente ou processo automático; portanto, esta alteração não aumenta o consumo recorrente da nuvem.
