# Ajustes das logos e do cabeçalho do portal

## Logos dos três credores

- **Novo Mundo:** substituir o ícone atual pela logo horizontal enviada, “novomundo.com”, preservando as cores e proporções.
- **UME:** usar a imagem enviada, ajustando o espaço branco excedente para que a marca fique legível, sem distorção.
- **Odres Cred:** usar a logo enviada, transformar as letras escuras em branco e preservar o símbolo azul. Aumentar seu tamanho para facilitar a leitura sobre o fundo azul.
- Retirar as pequenas caixas brancas padronizadas. Apresentar as marcas com tamanhos equilibrados conforme seus formatos; manter o branco necessário à leitura da UME.
- Essas substituições serão exclusivas da página inicial, sem trocar as logos nos termos de acordo ou nas páginas de resultados.

## Destaque do título

Aumentar **“PORTAL DE NEGOCIAÇÃO”** de 12 px para 18 px, com peso mais forte e o verde atual. Manter **“Consulte suas dívidas”** como título principal, sem alterar a consulta centralizada.

## Cabeçalho conforme a referência

Manter a logo original de Souza e Ribeiro Advogados e restaurar, nesta ordem:

**Benefícios · Quem somos · Como funciona · Dúvidas · telefone oficial · acesso restrito**

- Cada atalho levará à seção correspondente da própria página.
- “Benefícios” apresentará apenas informações já sustentadas pelo portal: consulta das três carteiras, resultados separados e atendimento oficial; sem promessas novas de desconto ou segurança absoluta.
- “Como funciona” apontará para os três passos existentes; os demais atalhos apontarão para a apresentação do escritório e as perguntas frequentes.
- Telefone com ícone e destaque verde, mantendo o contato configurado para o domínio.
- Em telas estreitas, acomodar os atalhos em um menu acessível, sem comprimir a logo nem causar sobreposições.

## Preservar

Fundo azul, logo do escritório, fontes atuais, CPF, regras de negociação, resultados e favicon permanecem intactos. O pedido de novas logos dos credores não autoriza trocar o favicon.

## Detalhes técnicos

Aplicar a variante das marcas somente em `PublicPortalHome`/`PortalShell`, sem alterar o catálogo compartilhado dos credores. Armazenar as imagens enviadas como assets do projeto; produzir uma variante da Odres a partir da imagem original, sem recriar a marca. Delimitar os estilos à página inicial em `src/index.css` e adicionar destinos reais aos links do cabeçalho.

## Conferência

- Três logos legíveis, proporcionais e sem as caixas brancas atuais.
- Odres com letras brancas e símbolo azul, maior e contrastada.
- “Portal de Negociação” mais destacado.
- Quatro atalhos funcionando, além de telefone e acesso restrito.
- Apresentação sem sobreposição em telas largas e estreitas.
- Consulta de CPF preservada; resultados e favicon sem alterações.

**Impacto:** apenas apresentação e navegação da página inicial, sem novas rotinas ou consultas periódicas no Lovable Cloud.