

# Adicionar botão "Testar Conexão" na configuração UAZAPI

## Alteração em `src/pages/Acionamento.tsx`

1. Adicionar estado `testingConnection` para controlar o loading do botão de teste.
2. Criar função `handleTestUazapiConnection` que faz uma requisição para o endpoint UAZAPI (ex: GET `{serverUrl}/status/{token}`) e exibe toast de sucesso ou erro.
3. Na linha 950, transformar o botão único em um `div` com `flex gap-2` contendo o botão "Salvar configuração" existente e um novo botão "Testar conexão" com ícone `Wifi` (ou `Zap`), desabilitado quando `testingConnection` ou quando os campos estão vazios.

### Lógica do teste de conexão
- Chamará `fetch(${uazapiServerUrl}/status/${uazapiInstanceToken})` para verificar se a instância responde.
- Mostra toast de sucesso se a API responder OK, ou toast de erro caso contrário.

### Resultado visual
Dois botões lado a lado: `[Salvar configuração] [Testar conexão]`

