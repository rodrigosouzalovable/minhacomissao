
# Nova aba "Acionamento" - Disparo individual de WhatsApp

## Resumo
Criar a pagina **Acionamento** no menu lateral (admin only) para importar planilha Excel de clientes, definir mensagem padrao com variaveis dinamicas (incluindo `{primeiro_nome}` com formatacao capitalizada), e enviar WhatsApp individualmente por cliente.

---

## Funcionalidades

### Importacao de planilha
- Upload de arquivo Excel (.xlsx/.xls)
- Parsing automatico das 5 colunas: CPF (A), Nome (B), Telefone (C), Atraso (D), Saldo (E)
- Exibicao da lista importada em tabela

### Mensagem padrao com persistencia
- Textarea para definir a mensagem modelo
- Botao "Salvar mensagem padrao" que persiste no `localStorage`
- Ao abrir a pagina, carrega a mensagem salva automaticamente

### Variaveis dinamicas
Painel com botoes clicaveis que inserem a variavel na posicao do cursor:
- `{nome}` - Nome completo do cliente
- `{primeiro_nome}` - Primeiro nome com primeira letra maiuscula e demais minusculas
- `{cpf}` - CPF do cliente
- `{atraso}` - Dias de atraso
- `{saldo}` - Valor do saldo formatado em R$

### Lista de clientes
Tabela com colunas:
- Nome do cliente
- Telefone
- Atraso (dias)
- Saldo (R$)
- Botao WhatsApp (icone verde) a direita de cada linha para envio individual

Ao clicar no botao WhatsApp:
- Substitui as variaveis na mensagem pelos dados daquela linha
- Envia via edge function `send-whatsapp`
- Feedback visual: icone muda para check (sucesso) ou X (erro)

---

## Alteracoes tecnicas

### 1. `src/pages/Acionamento.tsx` (novo)
- Pagina com `AppLayout` wrapper
- Estado: lista de clientes importados, mensagem template, status de envio por linha
- Parsing Excel com biblioteca `xlsx` (ja instalada)
- Funcao `formatPrimeiroNome(nome)`: pega primeira palavra, converte para primeira maiuscula + resto minusculo
- Envio individual: `supabase.functions.invoke('send-whatsapp', { body: { telefone, mensagem } })`
- Persistencia da mensagem padrao em `localStorage` com chave `acionamento_mensagem_padrao`

### 2. `src/components/layout/AppLayout.tsx` (editado)
- Importar `MessageSquare` do lucide-react
- Adicionar no array `navItems`: `{ href: '/admin/acionamento', label: 'Acionamento', icon: MessageSquare, adminOnly: true }`

### 3. `src/App.tsx` (editado)
- Importar pagina `Acionamento`
- Adicionar rota: `<Route path="/admin/acionamento" element={<AdminRoute><Acionamento /></AdminRoute>} />`
