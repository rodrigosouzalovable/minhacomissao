# Chave da Casa dos Dados no Certificado Digital

## Objetivo
Adicionar no início da aba **Coleta** um campo administrativo para cadastrar, substituir, testar e remover a chave API da Casa dos Dados.

## Como funcionará
- A chave será enviada diretamente ao backend e armazenada criptografada; nunca será salva no navegador nem retornará completa à tela.
- A tela mostrará apenas **Configurada / Não configurada**, os quatro últimos caracteres e a data da última alteração.
- Ao salvar, o sistema testará a chave em uma consulta mínima antes de ativá-la.
- Todas as buscas manuais, automáticas e o botão **Iniciar processamento e envios** usarão prioritariamente a chave cadastrada nessa tela.
- A chave atual já configurada no ambiente continuará como alternativa até que uma nova chave válida seja cadastrada.

## Segurança e permissões
- Somente administradores poderão consultar o status ou alterar a chave.
- A tabela de configuração ficará bloqueada para acesso direto da tela; apenas a função protegida do backend poderá ler o valor descriptografado.
- Nenhum log, aviso ou resposta exibirá a chave completa.

## Validação
- Testar cadastro válido e inválido, substituição, remoção e mascaramento.
- Confirmar uma busca manual usando a chave cadastrada.
- Confirmar que a tela compila e que não há erros no painel.
