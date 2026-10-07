# Identificação da Odres Cred por lista de CPFs

## O que foi confirmado
- A planilha enviada contém **35.892 linhas de CPFs**, com **35.891 CPFs distintos** e uma repetição, na aba `Cobrança`, coluna `CPF/CNPJ`. Ela não contém valores de débitos nessa aba.
- A consulta pública atual busca a calculadora apenas no resultado UME, e a resposta dessa consulta identifica o credor como UME. A consulta Odres utiliza os registros locais. Isso explica por que um débito Odres encontrado pela calculadora pode aparecer com a marca UME.
- Você escolheu **substituir a lista** a cada nova importação, em vez de acumular os CPFs.

## Alterações propostas
### 1. Local exclusivo em Importar Devedores
- Adicionar a seção **“Clientes Odres Cred — identificação no portal”**, com envio de Excel, prévia, confirmação e resultado da importação.
- Ler a aba `Cobrança` e a coluna `CPF/CNPJ` do arquivo enviado; aceitar também uma lista simples de CPFs.
- Preservar zeros à esquerda, validar CPFs e remover duplicatas. Mostrar o total válido, repetido e inválido antes de confirmar.
- Não importar valores, parcelas, telefones, pagamentos ou acordos por esse local.
- Mostrar a data, o arquivo e o total de CPFs da lista vigente.

### 2. Substituição segura da lista
- Validar e preparar toda a nova lista antes de substituir a anterior.
- Publicar a substituição de uma só vez: se houver falha ou arquivo sem CPFs válidos, a lista anterior permanece vigente.
- CPFs ausentes da nova lista deixam de ser identificados como Odres por **essa lista**, sem excluir ou modificar seus débitos e acordos existentes.
- Após implementar e validar, usar a planilha anexada como primeira lista, com conferência dos totais efetivamente aceitos.

### 3. Credor correto no portal
- Consultar a lista vigente antes de atribuir o resultado da calculadora: CPF presente → **Odres Cred**; CPF ausente → manter a identificação UME desse resultado.
- Para CPF presente, continuar buscando o débito na mesma calculadora, mas apresentar **logo, nome e proposta da Odres Cred**, sem repetir o mesmo saldo na seção UME.
- A lista identifica o credor, mas **não comprova uma dívida**: se a calculadora não retornar pendência, não criar cobrança só porque o CPF está cadastrado.
- Manter pendências e acordos comprovadamente distintos separados por credor, inclusive Novo Mundo, e preservar as regras de acordos ativos e quitados.
- Se houver evidência de dívidas distintas UME e Odres para o mesmo CPF, não reclassificar tudo pelo CPF: preservar a separação comprovada ou solicitar conferência quando a calculadora não permitir distinguir os contratos.
- Preservar o visual azul atual, o cabeçalho Souza e Ribeiro, o favicon e as condições de negociação: principal sem juros à vista; principal +10% parcelado, até 18 parcelas de no mínimo R$100.

## Detalhes técnicos
- Criar um cadastro privado de identificação por CPF normalizado, com lista/importação vinculada à empresa do portal, chave única e índice para consulta exata.
- Proteger o cadastro com permissões de importação verificadas no servidor, RLS e concessões explícitas; não disponibilizar a lista completa publicamente.
- Usar preparação em lotes e publicação atômica, mantendo uma única lista vigente e sem leituras públicas de estado parcial.
- Ajustar `portal-consultar` e o mapeamento da resposta pública da calculadora; preservar as verificações de credor em `PublicPortalResults`, devolvendo cada carteira com sua identificação correta.
- Reutilizar a consulta essencial e seu cache de 12 horas; resolver o credor fora do cache financeiro para que a substituição da lista reflita na próxima pesquisa.
- Não adicionar rotinas automáticas, consultas periódicas ou uma segunda busca à calculadora para o mesmo resultado.
- Registrar as regras aprovadas na memória do projeto durante a implementação.

## Validação
- Testar importação com cabeçalho e sem cabeçalho, zeros à esquerda, duplicatas e CPFs inválidos.
- Testar substituição A→B, remoção de vínculos ausentes e preservação da lista anterior em falhas.
- Testar CPF da lista com débito remoto mostrando Odres; CPF fora da lista mantendo UME; CPF listado sem débito não exibindo cobrança.
- Testar Novo Mundo junto de Odres na mesma tela, sem somar ou duplicar saldos, e preservação de acordos por credor.
- Conferir logo e proposta no navegador, sem enviar mensagens nem criar acordos reais.

## Impacto de custo
**ALERTA DE CUSTO LOVABLE CLOUD:** haverá armazenamento de aproximadamente 36 mil vínculos e uma consulta indexada curta por pesquisa, além do processamento manual de cada importação. O impacto esperado é baixo, mas não há valor monetário exato confirmado; não haverá novos agendamentos ou consultas contínuas. A aprovação deste plano autoriza esse impacto limitado.