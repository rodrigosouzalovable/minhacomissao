# Script de vendas e objeções no Google Maps Leads

## Objetivo

Adicionar um botão **Script** na aba Google Maps Leads para apoiar as ligações de prospecção. Cada usuário terá sua própria versão do roteiro e das respostas a objeções, sem alterar o conteúdo dos demais.

## Acesso

- **Administrador:** visualiza e personaliza seu próprio script.
- **Colaborador autorizado:** visualiza e personaliza seu próprio script na tela “Minha lista de prospecção”.
- **Parceiro Meta:** não visualiza o botão nem o conteúdo do script.
- A proteção será aplicada também no banco, garantindo que cada pessoa leia e altere somente sua configuração.

## Botão e diálogo

- Colocar o botão **Script**, com ícone de documento, no cabeçalho da página.
- Ao clicar, abrir um diálogo adaptado para computador e celular, organizado em duas abas:
  1. **Script de ligação**
  2. **Objeções e respostas**
- Exibir ações claras para **Salvar**, **Copiar** e **Restaurar padrão**.
- “Restaurar padrão” pedirá confirmação antes de apagar a personalização.

## Script padrão

Criar uma versão revisada do roteiro enviado, mantendo os pontos que funcionaram e melhorando a condução:

1. apresentação curta e pedido de permissão;
2. elogio baseado na avaliação real do Google;
3. confirmação de que a empresa não possui site próprio;
4. pergunta para entender o motivo antes de oferecer a solução;
5. explicação objetiva do site e dos benefícios;
6. valor transparente de **R$ 500,00**, sem mensalidade;
7. oferta de prévia em PDF;
8. fechamento com dia e horário exatos para o retorno.

O texto ficará totalmente editável e será salvo por usuário.

## Objeções e respostas

- Exibir uma lista editável com dois campos por item: **Objeção do cliente** e **Resposta sugerida**.
- Incluir inicialmente objeções comuns:
  - “Já tenho Instagram e não preciso de site”;
  - “Está caro”;
  - “Não tenho interesse”;
  - “Preciso pensar”;
  - “Mande o material primeiro”;
  - “Agora não tenho tempo”;
  - “Tem mensalidade ou manutenção?”;
  - “Preciso falar com meu sócio”;
  - “Como sei que é confiável?”;
  - “Entre em contato outro dia”.
- Permitir adicionar, editar e remover objeções da lista pessoal.
- Adicionar busca rápida por objeção e botão **Copiar resposta** em cada item.
- O padrão orientará respostas consultivas, sem pressionar o cliente nem inventar condições.

## Persistência e segurança

- Criar armazenamento próprio para a configuração pessoal, associado ao login.
- Conceder acesso somente a usuários autenticados e aplicar regras para leitura, criação, alteração e exclusão apenas do próprio registro.
- O conteúdo padrão será usado enquanto a pessoa ainda não tiver salvo uma personalização.
- Essa funcionalidade não fará consultas ao Google, não usará IA e não aumentará custos de API.

## Validação

- Confirmar que administrador e colaborador veem o botão, enquanto Parceiro Meta não vê.
- Confirmar que alterações de uma pessoa não aparecem para outra.
- Testar salvar, copiar, adicionar/remover objeções e restaurar o padrão.
- Validar o diálogo em computador e celular.
