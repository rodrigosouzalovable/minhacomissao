# Instâncias Meta: cadastro automático, separação de testes e criação pela UAZAPI

## Resultado esperado

- Corrigir o aviso incorreto de “conta bloqueada” quando apenas a leitura de foto/sobre falhar, sem esconder bloqueios reais de envio.
- Toda nova instância oficial terá, logo após o cadastro, chamadas ativadas, perfil sincronizado e webhook inscrito/verificado automaticamente.
- Na aba **API Oficial Meta**, números reais e números de teste ficarão em áreas separadas.
- Usuários autorizados na aba **UAZAPI** poderão cadastrar somente instâncias Meta de teste das próprias BMs, seguindo um passo a passo dentro da tela.
- Instâncias de teste continuarão isoladas de campanhas, cobrança e evolução de tier, sendo usadas apenas como destino/atendimento do aquecimento.

## 1. Corrigir a sincronização de perfil

- Tratar separadamente o resultado do nome oficial e o resultado da foto/sobre.
- Quando o nome e o estado do número estiverem válidos, mas a consulta de foto/sobre retornar `#131031`, confirmar a situação do número antes de apresentar qualquer bloqueio.
- Se o número estiver conectado e sem restrição confirmada, mostrar: **“Nome sincronizado. A Meta não permitiu consultar foto e descrição neste momento.”**
- Preservar a foto e o texto “sobre” já salvos quando essa consulta falhar.
- Manter o aviso de conta bloqueada somente quando a própria saúde do número ou uma tentativa real de envio confirmar a restrição.

## 2. Pós-cadastro automático

Após salvar uma nova instância, executar uma sequência única e visível:

1. inscrever e conferir o webhook;
2. ativar **Chamadas**;
3. sincronizar nome, foto e descrição;
4. consultar o estado atual do número;
5. apresentar um resumo com sucesso ou pendência de cada etapa.

Uma falha parcial não apagará a instância nem desfará etapas concluídas. O cartão mostrará claramente o que precisa ser corrigido e permitirá repetir apenas a etapa pendente.

## 3. Separar números reais e números de teste

Na área **Instâncias** da API Oficial Meta, criar duas visualizações:

- **Números de clientes**: instâncias reais disponíveis para atendimento, campanhas e demais envios permitidos.
- **Números de teste**: instâncias marcadas exclusivamente para a caixa AQUECIMENTO.

A contagem e os filtros por BM serão independentes em cada visualização. Ao cadastrar ou editar uma instância, o tipo escolhido definirá automaticamente onde ela aparece.

Para números de teste:

- o nome interno receberá o prefixo **“TESTE ”** automaticamente, sem duplicá-lo se já existir;
- ficará na caixa AQUECIMENTO;
- permanecerá fora do pool comercial;
- não poderá ser escolhido em campanhas, lembretes, certificado ou mensagens para clientes;
- não participará da evolução de tier nem da recuperação comercial.

## 4. Cadastro de teste dentro da UAZAPI

Adicionar uma seção própria **“Instâncias Meta de teste”**, separada dos cartões UAZAPI. Ela terá:

- lista dos testes que o usuário pode visualizar;
- botão **“Adicionar instância Meta de teste”** para usuários autorizados na aba UAZAPI;
- formulário com nome, Phone Number ID, WABA ID, BM e token permanente;
- validação de duplicidade e validação das informações junto à Meta antes de concluir;
- criação obrigatória como teste, sem opção de transformá-la em número comercial nessa tela;
- execução automática de webhook, chamadas, perfil e verificação após o cadastro.

A criação será feita por uma ação protegida no servidor. O sistema confirmará que o usuário está autenticado e autorizado na UAZAPI, vinculará a instância ao próprio usuário e aplicará todas as proteções do modo teste. Tokens não serão devolvidos nas listagens nem exibidos novamente após salvar.

## 5. Passo a passo na UAZAPI

Exibir um guia recolhível junto ao botão de cadastro, explicando onde encontrar na Meta:

1. a BM e a conta do WhatsApp;
2. o **WABA ID**;
3. o **Phone Number ID** do número de teste;
4. o token permanente com as permissões necessárias;
5. como conferir se o número aparece conectado e com qualidade disponível;
6. como finalizar o cadastro e interpretar o resumo automático.

O guia alertará que essa opção é exclusiva para números de teste e que números reais continuam sendo administrados na aba API Oficial Meta.

## 6. Permissões e proteção

- Ajustar a proteção atual, que hoje permite marcar teste somente para administradores, para aceitar também o cadastro protegido feito por usuários autorizados na UAZAPI.
- Usuários comuns não poderão alterar diretamente uma instância real para teste, nem teste para real.
- Administradores continuarão podendo corrigir a classificação na API Oficial Meta.
- Manter o isolamento por proprietário e as permissões atuais de visualização compartilhada.
- Reforçar os filtros de todos os caminhos de envio para excluir `instancia_teste_aquecimento = true` quando o destino for cliente.

## 7. Validação

- Repetir a sincronização da **SOUZA 62 8275-5786** e confirmar que o aviso não acusa bloqueio sem confirmação.
- Criar uma instância de teste por um usuário autorizado na UAZAPI e confirmar o prefixo “TESTE”, a separação visual e as quatro etapas automáticas.
- Confirmar que um usuário sem acesso à UAZAPI não consegue cadastrar.
- Confirmar que o teste aparece na caixa AQUECIMENTO e não aparece nos seletores de campanhas ou envios reais.
- Confirmar que uma instância real permanece na área de clientes e segue disponível normalmente.

## Impacto de custo

Não será criado cron, polling ou processo recorrente novo. Haverá apenas chamadas pontuais à Meta no momento de cada cadastro ou repetição manual, com impacto mínimo e sem aumento relevante de custo recorrente.
