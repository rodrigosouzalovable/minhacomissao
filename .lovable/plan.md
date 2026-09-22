# Exibição completa de números virtuais internacionais

## Objetivo
Ao comprar um número internacional em **UAZAPI > Números Virtuais**, mostrar imediatamente os dados necessários para cadastrá-lo no WhatsApp, separando o código internacional do número completo.

## Alterações

### 1. Normalizar o retorno da compra
- Tratar o número retornado pelo provedor somente como dígitos, removendo espaços, parênteses e símbolos inconsistentes.
- Identificar o DDI conforme o país selecionado e validar que o número completo começa com esse código.
- Manter o formato brasileiro atual: `55 + DDD + número`.
- Para números internacionais, preservar todos os dígitos fornecidos pelo provedor, sem aplicar regras brasileiras.

### 2. Mostrar os dados separadamente
No pedido ativo e no último número recebido, exibir:
- **País** selecionado.
- **DDI** isolado, por exemplo `+1`.
- **Número completo para WhatsApp**, por exemplo `+1 325 567 5949`.
- Botões individuais para copiar o DDI e copiar o número completo.

O histórico também mostrará o país, o DDI e o número completo de forma legível.

### 3. Integração com “Conectar na UAZAPI”
- Enviar ao formulário de conexão o número internacional completo, com DDI e sem caracteres de formatação.
- Não acrescentar `55` quando o número for internacional.
- Manter a inclusão automática do `55` somente para números brasileiros que ainda não o contenham.

### 4. Compatibilidade com compras existentes
- Derivar a apresentação dos pedidos antigos a partir do país e do número já armazenados.
- Se o provedor devolver um formato inesperado, mostrar o número original e um aviso, sem alterar ou truncar o telefone.

## Validação
- Testar um pedido brasileiro e confirmar `+55 + DDD + número`.
- Testar um pedido internacional e confirmar DDI separado, número completo e cópia correta.
- Confirmar que “Conectar na UAZAPI” preenche exatamente o número comprado, sem duplicar ou remover o DDI.
- Conferir a visualização em tela pequena e no computador.

## Detalhes técnicos
- A tela atualmente armazena o país pelo identificador do provedor e o telefone completo em `numero`; o pedido internacional mais recente, por exemplo, veio com `pais=12`, `ddd` vazio e `numero=13255675949`.
- O processamento será centralizado em uma função de formatação por país, reutilizada no aviso de compra, pedido ativo, histórico, cópia e conexão.
- A resposta da função de compra passará a incluir os dados normalizados necessários à exibição, sem expor credenciais do provedor.
