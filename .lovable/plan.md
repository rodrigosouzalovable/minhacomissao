# Corrigir scroll dos seletores de templates

## Diagnóstico confirmado
A lista de templates possui rolagem própria, mas é aberta em uma camada separada da janela **Nova conversa Meta**. O bloqueio de rolagem da janela intercepta o movimento da roda do mouse nessa camada, embora a barra lateral da lista esteja visível.

## Alteração
1. Ajustar o seletor reutilizável de templates para manter os eventos da roda do mouse dentro da própria lista.
2. Permitir rolagem fluida para cima e para baixo sem mover a página ou a janela atrás dela.
3. Manter pesquisa, favoritos, seleção, teclado e barra de rolagem funcionando como hoje.
4. Aplicar a correção automaticamente em todos os locais que usam esse seletor, incluindo **Nova conversa Meta**, reabertura de conversa, **Envio Meta**, Certificado Digital e Templates Meta.

## Validação
- Abrir **Nova conversa Meta** e percorrer a lista com a roda do mouse nos dois sentidos.
- Confirmar que a lista chega ao primeiro e ao último template.
- Confirmar que a janela e a página ao fundo não se movimentam indevidamente.
- Verificar seleção, pesquisa e favoritos após a rolagem.
- Testar também o seletor na aba **Envio Meta**.

## Detalhes técnicos
A correção ficará centralizada no componente compartilhado da lista, com contenção do evento de rolagem e do excesso de movimento. Não haverá alteração nos templates, envios ou regras de aprovação.
