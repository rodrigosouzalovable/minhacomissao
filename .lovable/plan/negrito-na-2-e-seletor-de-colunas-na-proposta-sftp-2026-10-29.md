# Negrito na {{2}} e seletor de colunas na Proposta SFTP

## 1. Negrito no texto todo
- A frase da {{2}} passa a sair entre asteriscos, para UME e Odres Cred. Exemplo: `*UME com condições especiais de final de ano. ... volte a comprar a prazo!*`
- Os asteriscos entram sozinhos na hora de gerar a planilha, sem precisar digitá-los no editor. Se o texto editado já vier com asteriscos, eles não se repetem.
- A prévia da tela mostra o texto com os asteriscos.

## 2. Seletor de colunas depois de importar
- Depois de escolher o arquivo, abre uma janela no mesmo estilo da importação do Envio Meta. Ela mostra as colunas da planilha e as primeiras linhas como exemplo.
- Três campos de escolha: **CPF** (obrigatório), **Coluna da {{2}}** (obrigatório) e **CREDOR** (opcional, com a opção "Nenhuma — usar credor selecionado").
- O sistema já deixa pré-selecionadas as colunas que reconhecer pelo nome (CPF, {{2}}, CREDOR). Você confere ou troca.
- "Calcular" só fica liberado com CPF e {{2}} escolhidos. Aí o cálculo atual roda usando as colunas escolhidas. "Cancelar" descarta o arquivo.

## Detalhes técnicos
- `src/lib/propostaSftp.ts`: `textoProposta` passa a envolver o resultado em `*...*` (tirando asteriscos que já estejam nas pontas). Os testes atuais são atualizados e entra um teste novo para o negrito.
- `PropostaSftpTab.tsx`: a leitura do arquivo é separada do cálculo. Depois de ler, os cabeçalhos e as linhas ficam guardados e abre um Dialog com Selects (componentes do shadcn). O processamento passa a usar os índices escolhidos no lugar dos que o sistema encontra sozinho.
- O servidor e o banco não mudam.
