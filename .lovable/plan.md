# Termo de acordo em PDF nos Meus Acordos

## Resultado esperado

- Cada acordo, novo ou antigo, terá um botão **Baixar termo em PDF** no card de **Meus Acordos**.
- O mesmo botão ficará disponível na página de detalhes do acordo.
- O PDF será gerado com os dados atuais já salvos no acordo e em suas parcelas, sem exigir um novo cadastro.
- No topo do documento aparecerão a marca da **Souza e Ribeiro Advocacia e Cobrança** e a marca do credor correspondente:
  - `ume_novo_mundo` → **Novo Mundo**;
  - `mundo_da_moda` → **UME**.

## Conteúdo do documento

1. Cabeçalho institucional com as duas marcas, título **Termo de Acordo Extrajudicial** e identificação única do acordo.
2. Identificação das partes apenas com os dados disponíveis:
   - credor pelo nome e marca;
   - cliente pelo nome e CPF;
   - Souza e Ribeiro como responsável pela negociação.
3. Quadro-resumo com valor total negociado, quantidade de parcelas, primeira data de vencimento e data de emissão.
4. Tabela completa das parcelas, trazendo número, vencimento e valor de cada uma.
5. Cláusulas profissionais e conservadoras sobre:
   - reconhecimento e objeto da negociação;
   - condições de pagamento;
   - comprovação e quitação dos pagamentos;
   - consequências do inadimplemento conforme contrato original e legislação aplicável, sem inventar multa, juros ou prazo de tolerância;
   - validade das demais condições da obrigação original;
   - proteção e uso dos dados apenas para execução do acordo;
   - disposições gerais, sem inventar endereço, CNPJ ou foro.
6. Espaços para assinatura do cliente, do credor e de duas testemunhas, com nome e CPF.
7. Rodapé com número do acordo, data de emissão e paginação.

## Experiência na tela

- No card do acordo, o botão usará o ícone de download e impedirá que o clique abra acidentalmente os detalhes.
- Durante a geração, o botão mostrará carregamento e evitará downloads repetidos.
- Se os dados das parcelas não puderem ser carregados, será exibido um aviso claro e nenhum PDF incompleto será baixado.
- O nome do arquivo seguirá um padrão identificável, como `termo-acordo-novo-mundo-nome-cliente.pdf`.

## Identidade visual e arquivos enviados

- As três imagens anexadas serão usadas como fontes oficiais das marcas no PDF.
- Elas serão armazenadas como recursos otimizados do projeto e carregadas na geração do documento.
- O PDF seguirá uma composição sóbria, com boa hierarquia, margens de impressão, divisores discretos e contraste adequado.
- A marca da Souza e Ribeiro também será preparada em formato quadrado e aplicada ao ícone do site, conforme o padrão de identidade do projeto.

## Detalhes técnicos

- Criar um gerador compartilhado em TypeScript com `jsPDF`, já instalado no projeto.
- O gerador receberá o registro do acordo e a lista real de pagamentos para manter datas e valores fiéis, inclusive quando a primeira parcela tiver valor diferente.
- Integrar o gerador em `Acordos.tsx` e `AcordoDetalhe.tsx`, reutilizando a mesma função e o componente de botão existente.
- Não será necessária alteração no banco, nova função de servidor, agendamento ou consulta recorrente; o carregamento das parcelas ocorrerá somente ao clicar no botão.
- Validar PDFs de Novo Mundo e UME, incluindo acordos com uma e várias parcelas, e inspecionar visualmente todas as páginas para corrigir cortes, sobreposições, logos distorcidos ou paginação incorreta.
