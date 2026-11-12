# Corrigir login UME do Wesley

## O que já sei
- As 2 tentativas do Wesley (17:10 e 17:12) chegaram até a UME e ela respondeu "Invalid user credentials".
- Não consegui testar o login dele daqui no modo de planejamento (o teste exige estar no Modo Construção).
- Suspeita principal: o sistema pode estar entrando no ambiente de **testes** da UME (onde o Wesley não tem cadastro), em vez do backoffice real, ou usando uma "porta" de login diferente da que o site do backoffice usa.

## O que vou fazer
1. Testar o login do Wesley direto na UME, nos dois ambientes (real e testes) e nas portas de login possíveis, para ver qual aceita.
2. Ajustar o login da calculadora para usar o ambiente/porta que funcionou.
3. Mostrar no quadro "Login UME" em qual ambiente está conectado e uma mensagem de erro mais clara.
4. Repetir o teste com o login do Wesley e encerrar a sessão de teste em seguida.

## Observação de segurança
A senha foi enviada aqui no chat. Depois do teste, peça ao Wesley para trocá-la no backoffice da UME.
