## Diagnóstico

Revisei `NotificacoesCpfBell.tsx`: o botão de copiar (`Copy` / `Check` verde quando `cpf_copiado_em` está preenchido) é renderizado **incondicionalmente** dentro do `.map(...)` — não há gate por `isAdmin` nem por role. Ou seja, no código atual o botão já aparece para todo usuário logado que abre o sino, inclusive Fernanda.

O motivo mais provável de Fernanda não estar vendo o botão é que **o login dela está usando a versão publicada antiga do app**, anterior ao ajuste do sino. As alterações que fiz existem só no ambiente de preview até a próxima publicação (`meusacordos.com.br` / `minhacomissao.lovable.app` continuam servindo a versão antiga).

## Plano

1. Confirmar por leitura do arquivo que o botão de copiar está fora de qualquer condicional de role — nenhum código a alterar aqui.
2. **Publicar o app** para que a versão nova (com botão de copiar + verde no card + rodízio com fallback admin) chegue ao login da Fernanda e dos demais funcionários.
3. Instruir Fernanda a fazer um refresh forçado (Ctrl+F5 / Cmd+Shift+R) depois do publish, para descartar cache do bundle JS antigo.

Nenhuma alteração de código é necessária para o comportamento pedido — o botão já é universal. O passo faltante é publicar.

## Escopo excluído

- Sem mudanças em RLS, edge functions ou outros componentes.
- Sem novo layout para o card.
