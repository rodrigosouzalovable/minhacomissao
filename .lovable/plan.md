# URL estática ou dinâmica nos Templates Meta

## Objetivo
Ao adicionar um botão **URL** na criação de um Template Meta, permitir escolher **Estática** ou **Dinâmica**, seguindo o formato exibido pela Meta.

## Alterações na tela
- Incluir em cada botão URL o seletor **Tipo de URL** com as opções **Estática** e **Dinâmica**.
- Para URL estática, manter um único campo com o endereço completo.
- Para URL dinâmica:
  - permitir uma variável no final do endereço, no padrão `{{1}}`;
  - exibir um campo separado para a **URL da amostra**, exigida pela Meta para analisar o template;
  - mostrar orientações e erros claros quando o endereço-base, a variável ou a amostra estiverem inválidos.
- Manter texto do botão, exclusão, limite atual de três botões e pré-visualização do WhatsApp.

## Gravação e envio à Meta
- Salvar o tipo e a URL de amostra junto aos dados JSON já existentes do botão, sem criar nova tabela.
- Ao aplicar o template nas instâncias:
  - enviar URL estática sem `example`;
  - enviar URL dinâmica com a variável na URL e a amostra no formato aceito pela Meta.
- Preservar compatibilidade com templates já cadastrados, tratando URLs antigas como estáticas, exceto quando já contiverem variável e amostra.
- Garantir que cópia, nova versão e aplicação automática em novas instâncias preservem essa configuração.

## Validação
- Conferir na interface os dois tipos de URL e a prévia do botão.
- Testar os formatos enviados usando validação local, sem submeter um template real nem disparar mensagens.
- Verificar compilação e ausência de erros na prévia do projeto.
