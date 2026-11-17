# Acordo UME lançado no login do atendente (Wesley)

## O que já verifiquei
- Os dois cadastros do Wesley ("Wesley" e "Wesley Amaral") têm o login UME dele salvo (`wesley.martins@amaral.com.br`), mas **nenhum acordo efetivado por eles aparece no histórico de acordos da calculadora UME**. Os últimos acordos enviados hoje foram da Anna, Fernanda, Thailinny e Rodrigo.
- Em **todos** os acordos de hoje, a UME gravou o mesmo código de operador (58612), não importa quem lançou. O nome muda (ex.: "FERNANDA ESTOCK..."), mas o código do operador não muda. Por isso o backoffice não mostra quem realmente lançou.
- A Thailinny e o Wallace estão conectados com o login UME da Anna, então os acordos deles saem como "ANNA FLAVIA". O Leonardo está com o login da Bianca.
- Os acordos que o Rodrigo fecha pelo portal saem como "Souza e Ribeiro", o que está certo.

## O que vou fazer
1. **Descobrir de onde vem o código 58612**: ler o que vem dentro do login UME de cada atendente e conferir se a UME manda um código de operador diferente para cada pessoa. Se ela não mandar, buscar esse código no cadastro do operador na UME (perfil do usuário logado).
2. **Mandar o código do operador certo** ao fechar o acordo, usando o login do próprio atendente. Se o login dele for recusado, **o acordo não será fechado** e o atendente verá um pedido para entrar de novo na UME. O sistema não vai mais usar a conta da empresa escondido.
3. **Registrar no histórico** o login UME e o código de operador usados em cada acordo, para conferir depois.
4. **Avisar na calculadora** quando o login UME conectado não for da pessoa (ex.: Thailinny usando o login da Anna), mostrando com qual login ela está.
5. **Achar o acordo do Wesley**: procurar o CPF dele no histórico da UME para ver se o acordo passou por outro caminho (portal ou fechamento manual) e corrigir esse caminho também.

## Detalhes técnicos
- `_shared/ume-sessao.ts` `operadorDoToken`: ler `operator-id` / claims reais; fallback via endpoint de perfil UME com o token do atendente.
- `_shared/ume-api.ts` `comFallback`: em `fecharAcordo` com sessão do atendente, não usar a conta da empresa em 401/403; retornar `login_ume`.
- `ume-acordo-api`: gravar `ume_username`/`operatorId` em `ume_acordo_api_log.resposta` meta.
- `AcordoUmeApiDialog.tsx`: mostrar o login UME conectado.
- Testar com um acordo real do Wesley e conferir o operador no retorno da UME.

## Preciso de você
- O CPF do cliente do acordo que o Wesley fez, para eu localizar o registro.
