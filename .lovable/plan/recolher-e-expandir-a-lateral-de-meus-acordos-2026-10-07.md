# Recolher e expandir a lateral de Meus Acordos

## O que será feito
- Adicionar um botão com ícone para **Ocultar lista de abas** e **Mostrar lista de abas**, semelhante ao controle de painel da Lovable.
- Ao recolher, esconder a lateral inteira e aproveitar o espaço liberado para exibir os acordos e demais páginas.
- Manter o botão de reabertura sempre visível, fora da lateral, sem cobrir informações ou ações da página.
- Ao expandir, restaurar a lista com as mesmas abas, ordem, contadores e destaque da página atual.
- Lembrar a escolha neste navegador por usuário, inclusive ao trocar de página ou recarregar.
- Preservar o menu atual das telas menores e suas ações de abrir e fechar.

## Situação conferida
- A lateral atual fica fixa e aberta nas telas maiores, com largura de 256 px; o conteúdo reserva esse mesmo espaço.
- Nas telas menores já existe um botão para abrir e fechar o menu.
- As abas usam ordenação personalizada, contadores e permissões, que serão preservados.

## Detalhes técnicos
- Ajustar o layout existente, sem substituir a navegação nem alterar permissões.
- Controlar a lateral e o espaço do conteúdo pelo mesmo estado de expansão.
- Usar o botão e os ícones do padrão visual atual, com descrição acessível, indicação de expandido/recolhido e dica ao passar o cursor.
- Guardar somente a preferência visual localmente; não adicionar consultas, atualizações periódicas ou serviços com custo adicional.
- Aplicar transição discreta e respeitar a preferência por movimento reduzido.

## Validação
- Conferir que ocultar libera o espaço e que mostrar restaura a lateral.
- Verificar que o botão permanece acessível nos dois estados e por teclado.
- Testar troca de página, recarregamento e isolamento da preferência entre usuários.
- Conferir que a navegação, a ordem das abas, os contadores e o menu das telas menores continuam funcionando, sem sobreposição.