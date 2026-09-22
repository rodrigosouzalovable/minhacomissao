# Exibir instâncias de teste Meta na aba UAZAPI e no Excel

## Resultado esperado

- Todo número da API Oficial Meta marcado como **“Instância de teste da Meta — usar como destino do aquecimento”** aparecerá na lista da aba **UAZAPI**.
- O card será identificado com a tag **Teste Meta** e mostrará nome, número e situação da conexão.
- Administradores e demais usuários autorizados na aba UAZAPI poderão visualizar e pesquisar esses números.
- O botão **Exportar números (Excel)** incluirá também os números de teste Meta conectados, junto com os números UAZAPI conectados, sem cabeçalho e sem duplicidades.

## Implementação

1. **Ampliar a listagem protegida da aba UAZAPI**
   - Manter a consulta atual das instâncias UAZAPI.
   - Acrescentar somente instâncias oficiais com `instancia_teste_aquecimento = true`, ativas e com telefone cadastrado.
   - Entregar ao navegador apenas identificador, nome, telefone, origem e situação; nunca retornar token, WABA, Business ID ou outras credenciais Meta.
   - Preservar a exigência de login e permissão explícita para acessar a aba UAZAPI.

2. **Distinguir os dois tipos de número na tela**
   - Adaptar o modelo da lista para reconhecer a origem `uazapi` ou `meta_teste`.
   - Exibir a tag **Teste Meta** nos cards oficiais de teste.
   - Esses cards serão somente leitura na aba UAZAPI: sem editar, excluir, reconectar, reordenar ou habilitar controles próprios da UAZAPI.
   - A gestão continuará sendo feita exclusivamente na aba **API Oficial Meta**.

3. **Usar o estado correto de conexão**
   - Para UAZAPI, manter a verificação atual diretamente no provedor.
   - Para a instância Meta de teste, usar o estado oficial de saúde já salvo no sistema e considerá-la conectada somente quando estiver ativa e com estado `CONNECTED`.
   - Falha ou ausência de confirmação não impedirá a exibição do card, mas impedirá a inclusão no Excel até a conexão estar confirmada.

4. **Atualizar a exportação Excel**
   - Montar o arquivo a partir da lista protegida e verificada dos dois tipos.
   - Incluir apenas números conectados e válidos.
   - Manter uma única coluna, sem cabeçalho, removendo o DDI `55` somente de números brasileiros e preservando corretamente números internacionais.
   - Eliminar duplicidades caso o mesmo telefone apareça nas duas origens.

5. **Validação**
   - Confirmar com o administrador que o número de teste Meta aparece com sua tag e continua sem ações UAZAPI.
   - Confirmar com um usuário autorizado que o mesmo número aparece e pode ser exportado, sem exposição de dados sensíveis.
   - Conferir que números Meta comuns, não marcados como teste, continuam fora da aba e do Excel.
   - Conferir que instâncias desconectadas não entram no arquivo.

## Impacto de custo

Sem novo agendamento, atualização automática ou consulta contínua. A leitura adicional ocorrerá apenas quando a lista/conexões forem solicitadas, com impacto mínimo no Lovable Cloud.
