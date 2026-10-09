# Corrigir a pesquisa de telefone no Inbox Meta

## O que foi confirmado
- A conversa do telefone **(61) 9871-1649** existe na **Novo Mundo 3144**, na caixa **PADRÃO**, e não está arquivada.
- Há mensagens de entrada registradas hoje, **09/10/2026**, às **10h28 e 10h30 BRT**. Portanto, essas mensagens chegaram ao sistema.
- A busca numérica usa `telefone LIKE '%1649'`. O plano de execução consultado mostra uma varredura integral da tabela, sem índice adequado para essa busca.
- O trecho da tela que trata falhas apaga os resultados e mostra o aviso genérico da imagem. Os registros disponíveis não contêm a resposta exata da pesquisa que falhou; o motivo específico desse erro ainda precisa ser confirmado.

## Correção proposta
1. **Confirmar a falha com o acesso do usuário**
   - Reproduzir a busca por `1649` e pelo telefone completo, capturando o erro real e o tempo da consulta.
   - Conferir a autorização da PADRÃO para a sessão usada. Diferenciar falha técnica de ausência de acesso, sem liberar conversas indevidamente.

2. **Buscar somente os telefones correspondentes, com índice**
   - Substituir a varredura integral por uma busca indexada pelos últimos dígitos, aceitando telefone completo, telefone formatado e quatro ou mais dígitos.
   - Manter a busca global entre conversas autorizadas, inclusive arquivadas e fora dos filtros de caixa, instância, etiqueta e leitura.
   - Preservar paginação e ordenação pelas mensagens mais recentes; não limitar candidatos antes da autorização.

3. **Corrigir o estado da pesquisa na tela**
   - Separar “Nenhuma conversa encontrada” de “Não foi possível concluir a pesquisa”.
   - Em caso de falha, não apresentar resultados antigos como se pertencessem ao telefone pesquisado; permitir tentar novamente e registrar o diagnóstico técnico sem expor mensagens ou dados pessoais.
   - Ignorar respostas de pesquisas anteriores quando o usuário mudar o texto.
   - Mostrar caixa e atendente nos resultados e, ao abrir, selecionar a caixa real da conversa.

4. **Validar sem enviar mensagens**
   - Buscar `1649`, `98711649` e `+55 (61) 9871-1649`, confirmando a conversa do 3144 e suas mensagens recebidas.
   - Testar conversa arquivada e filtros diferentes da caixa real.
   - Testar que usuários sem acesso continuam sem visualizar conversas restritas.
   - Testar erro de pesquisa, troca rápida do texto e nova tentativa.
   - Comparar o tempo e o plano da consulta antes/depois e conferir o funcionamento na tela.

## Detalhes técnicos
- Criar um índice de busca por prefixo do telefone normalizado e invertido, permitindo localizar sufixos de quatro a oito dígitos sem varrer todos os contatos.
- Expor a consulta parametrizada em uma função `SECURITY INVOKER`, restrita a usuários autenticados, mantendo as políticas atuais de leitura da tabela como autoridade. Validar dígitos e limites no servidor.
- Atualizar `src/lib/metaInboxPhoneSearch.ts`, a chamada em `src/pages/InboxMeta.tsx` e os testes existentes de busca; acrescentar validação de acesso da consulta.
- Não alterar webhook, retenção, não lidos, responsáveis, rodízio, instâncias nem regras de envio.

## Custo e segurança
A mudança busca reduzir o trabalho de cada pesquisa. Não cria consultas recorrentes, agendamentos, canais em tempo real nem envios de teste. O índice acrescenta armazenamento proporcional aos contatos existentes; não autoriza novas operações de custo recorrente.