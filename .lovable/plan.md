# Plano — Instâncias conectadas compartilhadas na aba UAZAPI

## Resultado esperado
- Qualquer usuário que recebeu permissão para acessar a aba UAZAPI poderá consultar as instâncias conectadas de todo o sistema.
- Instâncias de outros usuários serão somente leitura: nome, número e situação da conexão.
- O botão **Editar** continuará disponível apenas nas instâncias pertencentes ao próprio usuário; o administrador proprietário mantém os controles completos.
- **Exportar números (Excel)** incluirá todas as instâncias conectadas visíveis, sem DDI e sem duplicidades.
- **Conectar via QR Code** continuará criando e manipulando somente instâncias do próprio usuário.

## Funcionamento
- Adicionar o botão **Verificar conexões** também para usuários autorizados.
- A verificação será executada somente quando esse botão for clicado, sem consultas automáticas, atualização periódica ou polling.
- Depois da verificação, a tela apresentará as instâncias conectadas e atualizará o total exibido.
- A pesquisa por nome ou número continuará funcionando sobre a lista compartilhada.
- Falhas individuais de consulta serão exibidas como conexão não confirmada, sem impedir o resultado das demais instâncias.

## Segurança e privacidade
- Não ampliar a leitura direta da tabela de instâncias, que contém tokens, endereço técnico e senha de proxy.
- Entregar ao navegador somente os campos necessários para visualização: identificador, proprietário, nome, telefone e estado da conexão.
- Fazer a consulta e a verificação por uma função protegida, exigindo sessão válida e permissão explícita para a aba UAZAPI.
- Nunca retornar tokens, servidor, proxy, configurações de automação ou dados internos aos usuários comuns.
- Bloquear edição, teste individual, exclusão, ativação, reordenação e demais ações administrativas em instâncias alheias, tanto na tela quanto na função protegida.

## Detalhes técnicos
- Criar uma operação autenticada na função UAZAPI para listar/verificar todas as instâncias sem expor credenciais.
- Manter a política atual de alteração: usuário gerencia somente suas próprias instâncias; administrador mantém acesso global.
- Ajustar a lista da tela para distinguir instância própria de instância compartilhada e renderizar ações conforme a propriedade.
- Fazer a exportação a partir do resultado conectado e sanitizado retornado pela função protegida.

## Validação
- Testar com o administrador proprietário: lista completa e todos os controles atuais preservados.
- Testar com usuário autorizado: vê todas as conectadas, exporta todas, edita apenas as próprias e conecta uma nova via QR Code.
- Confirmar que usuário sem permissão da aba continua sem acesso.
- Confirmar que nenhuma resposta de rede expõe token, servidor ou credenciais de proxy.
