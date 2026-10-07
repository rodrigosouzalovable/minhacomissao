# Reestruturação da página inicial de consulta

## Direção escolhida

Recuperar a identidade anterior da **Souza e Ribeiro Advogados**, com **azul escuro, detalhes verdes e a logo original completa**, reorganizando a página em uma **coluna centralizada**, com aparência clássica e elegante.

- **Títulos:** Libre Baskerville.
- **Textos e campos:** IBM Plex Sans.
- **Cores anteriores:** azul `#001a33`, `#003366` e `#004080`; verde `#00a86b`; branco para contraste.
- **Logo:** utilizar a imagem original do escritório, em branco sobre azul, com tamanho suficiente para leitura. Não recriar a marca como texto nem acrescentar outro nome ao lado.

## O que será reorganizado

### 1. Cabeçalho

Logo original do escritório em destaque, contato oficial e acesso à área restrita. Somente a marca Souza e Ribeiro no cabeçalho; os credores ficam junto à consulta.

### 2. Consulta centralizada

Uma sequência clara, sem dividir a tela em duas colunas:

1. Título **“Consulte suas dívidas”**.
2. Texto curto identificando Novo Mundo, UME e Odres Cred.
3. As três logos reais, alinhadas e com proporções preservadas.
4. Campo de CPF e botão verde **“Consultar dívidas”**, com grande destaque.
5. Aviso de consulta autorizada e identificação do atendimento oficial.

O fundo principal volta ao azul anterior. O formulário permanece integrado à página, sem caixas decorativas envolvendo toda a experiência. Ajustar espaços para que o início do próximo conteúdo apareça na primeira tela.

### 3. Informações abaixo da consulta

Reorganizar **Como funciona**, **Quem somos** e **Dúvidas frequentes** em faixas bem definidas, com divisórias discretas e alternância de azul e branco. Reduzir repetição e dar prioridade à consulta, sem criar promessas de desconto, segurança absoluta ou prazo de atendimento.

### 4. Rodapé

Manter identificação do escritório, contato conforme o domínio e links de privacidade e antifraude, com apresentação coerente com a identidade recuperada.

## O que permanece intacto

- Consulta dos três credores e separação dos resultados.
- Cálculos, descontos, parcelamentos e regras de negociação.
- Acordos, comissões, Inbox e automações.
- Favicon e logos dos credores.
- Página de resultados: esta alteração é restrita à página inicial.

## Detalhes técnicos

A versão anterior ainda presente em `PortalConsulta` confirma a paleta azul/verde e a imagem `logo-souza-ribeiro.png`, exibida em branco no cabeçalho. A página atual usa essa imagem reduzida e acompanhada de texto; o ajuste recuperará sua apresentação completa e legível.

Aplicar a nova composição em `PublicPortalHome`, com uma variante visual exclusiva da página inicial em `PortalShell`. Definir cores e tipografia em estilos delimitados para não alterar a página de resultados nem outras telas. Carregar as fontes somente onde necessário e manter os controles existentes e a validação de CPF.

As propostas visuais geradas não respeitaram as fontes e a logo escolhidas; não serão usadas como referência de implementação. Este plano mantém as escolhas confirmadas, sem substituí-las por outras fontes ou marcas.

## Conferência antes de concluir

- Logo original nítida e proporcional no cabeçalho.
- Fundo azul anterior e botão verde com contraste adequado.
- Consulta e três credores centralizados, sem sobreposições.
- CPF, botão de consulta, contato e dúvidas funcionando.
- Verificação da apresentação em telas largas e estreitas.
- Nenhuma alteração na página de resultados, nas condições de negociação ou no favicon.

**Impacto:** mudança visual, sem novas consultas periódicas, automações ou custos de processamento do Lovable Cloud.