# Experiência de teste para clientes USA B2B

## O que será criado

1. **Marcação no cadastro de usuários (Admin > Usuários/Equipes)**
   - Botão **USA B2B**: identifica o usuário como cliente americano.
   - Botão **USUÁRIO TESTE**: libera acesso por 3 dias a partir da marcação. Mostra a data/hora de expiração e permite prorrogar.
   - Ao expirar, o login mostra "Seu teste terminou" com botão para falar com você (sem apagar nada).

2. **Área do cliente USA B2B (ao entrar, ele vê só isso)**
   - Inbox Meta Oficial limitado às conversas do próprio WhatsApp dele — nunca vê suas caixas, cobranças ou clientes.
   - Interface em inglês (com opção espanhol/português).
   - Faixa no topo: "Trial — 2 days left".

3. **Configurar a IA (campo novo no Inbox)**
   - Caixa de texto livre: o cliente descreve o negócio, serviços, preços, horários, tom e regras. Aceita inglês, espanhol ou português; a IA entende qualquer um.
   - Idioma de resposta: automático (responde no idioma do cliente final), ou fixo.
   - Liga/desliga a IA e botão **Testar IA**: uma janela de chat simulado para ele ver como a IA responderia antes de ativar.

4. **Conectar WhatsApp por QR Code**
   - Botão **Connect WhatsApp** que cria um número próprio dele e mostra o QR Code; atualiza sozinho e mostra "Connected" ao ler.
   - Botão para desconectar. As mensagens recebidas nesse número caem na caixa dele e a IA responde com a configuração dele.

## Sugestões extras para a melhor experiência
- **Guia de primeiros passos** (3 etapas: conectar WhatsApp → configurar IA → testar).
- **Modelos prontos** de configuração (salão, restaurante, clínica, imobiliária) para ele não começar do zero.
- **Assumir conversa**: ele pode pausar a IA e responder manualmente.
- **Aviso a você** no seu WhatsApp quando o teste for ativado, quando ele conectar o número e 1 dia antes de expirar.
- **Limite no teste** (ex.: 200 respostas da IA nos 3 dias) para controlar custo.

## Pontos de atenção
- Custo: cada resposta da IA do cliente gasta créditos de IA; o limite do teste evita surpresas. Nenhuma rotina nova automática além da verificação de expiração ao entrar (sem custo recorrente).
- O WhatsApp dele conecta pelo método QR Code (não oficial). Para produção, podemos migrar depois para a API oficial.

## Detalhes técnicos
- Tabela `cliente_usa_config` (user_id, usa_b2b, teste_ate, prompt_ia, idioma, ia_ativa, limite) com RLS: dono lê/edita a sua; admin tudo. Marcações de USA B2B/teste só por admin (função segura), nunca editáveis pelo próprio cliente.
- Verificação de expiração em `ProtectedRoute`/guarda de rota e no servidor (funções recusam após `teste_ate`).
- Instância UAZAPI criada por função nova `cliente-whatsapp-qrcode` (criar/obter QR/status/desconectar), vinculada ao user_id e a uma caixa própria; o polling de status só roda com a janela do QR aberta.
- `iago-atendimento` passa a usar o prompt do dono da instância quando ela pertence a um cliente USA B2B, com teto de respostas.
- Permissões de navegação: perfil USA B2B recebe só a aba do Inbox (regra de abas concedidas explicitamente).
