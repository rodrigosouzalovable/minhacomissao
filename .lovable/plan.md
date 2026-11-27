# Calculadora UME em aba própria

## O que muda
- Nova aba "Calculadora UME" no menu lateral, abrindo uma tela com a mesma calculadora usada hoje no topo das conversas.
- Na tela: campo de CPF para consultar o cliente, tabelas de desconto, teto de parcelas e geração da proposta.
- Sem conversa aberta, o botão de enviar vira "Copiar proposta" (texto vai para a área de transferência). Boleto/PIX e efetivação de acordo continuam usando o login UME do próprio atendente, como hoje.
- A calculadora dentro das conversas continua igual.
- Acesso: todos os atendentes veem a aba automaticamente, sem precisar liberar em Usuários.

## Detalhes técnicos
- Nova página `src/pages/CalculadoraUme.tsx` renderizando o conteúdo do `ConsultaUmeDialog` em modo página (extrair o corpo para um componente reutilizável ou abrir com `open` fixo, sem `onEnviar`, mostrando cópia).
- Teto de parcelas na aba avulsa: usa o teto da caixa PADRÃO (`caixa='padrao'`); só admins alteram.
- Rota `/calculadora-ume` em `App.tsx` com `PermissionRoute`; item no menu de `AppLayout.tsx` visível para todo usuário da equipe (sem depender de aba liberada).
- Sem novas tabelas, crons ou consultas recorrentes; custo de Cloud inalterado.
