# Corrigir erro ao bater ponto

## O que foi verificado

- A tabela de redes autorizadas do ponto está **vazia** (nenhum IP/rede cadastrada).
- Com a lista vazia, o servidor recusa qualquer batida de funcionário e devolve o erro
  "Nenhuma rede autorizada foi cadastrada ainda. Fale com o administrador."
- Admin é isento da restrição de IP, por isso o problema aparece só para a funcionária.

Ou seja: não é um bug de código, é falta de cadastro da rede do escritório — mas a tela
não deixa isso claro nem oferece caminho de saída.

## O que será feito

1. **Mensagem clara no card de ponto**: quando o erro for "sem rede cadastrada", mostrar um
   aviso fixo no card (não só um toast que desaparece), dizendo que o administrador precisa
   autorizar a rede do escritório — e não "você está fora da rede".
2. **Aviso para o admin**: no painel Controle de Ponto → Redes, exibir um alerta em destaque
   quando não houver nenhuma rede ativa, com o botão "Autorizar o IP atual" evidenciado,
   já que sem isso ninguém consegue bater ponto.
3. **Indicador de rede no card**: hoje fica preso em "Verificando rede..." quando a consulta
   falha; passar a mostrar o estado real (rede não cadastrada / não autorizada / autorizada).
4. **Ação imediata sua**: de um computador do escritório, abrir Controle de Ponto → Redes e
   clicar em "Autorizar o IP atual". Depois disso a funcionária consegue bater ponto.

Opcional (me diga se quer): um botão no painel admin para **liberar temporariamente** o ponto
sem restrição de IP (por exemplo por 1 dia), útil em dias de queda de internet.

## Detalhes técnicos

- `src/components/ponto/PontoCard.tsx`: guardar o último erro/código retornado por
  `ponto-registrar` e renderizar bloco de aviso conforme `codigo`
  (`sem_ip_cadastrado`, `ip_nao_autorizado`); tratar `isError` de `useMeuIpPonto` no rodapé.
- `src/hooks/usePonto.tsx`: propagar o campo `codigo` do erro da edge function (hoje só a
  mensagem é preservada).
- `src/pages/PontoAdmin.tsx`: alerta na aba Redes quando não existir registro ativo em
  `ponto_ips_autorizados`.
- Nenhuma migração de banco necessária.
