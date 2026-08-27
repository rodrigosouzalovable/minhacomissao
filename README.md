# MEUS ACORDOS - RODRIGO

🚀 Prompt para o Projeto: MINHA COMISSAO
📌 Descrição Geral do Projeto
Sistema web de gestão de comissões para funcionários, onde cada usuário pode registrar acordos de pagamento com clientes, acompanhar parcelas e visualizar sua comissão calculada automaticamente com base na faixa de dias em atraso.

🎯 Funcionalidades Principais
1. Autenticação de Usuários
Login com e-mail e senha

Cadastro inicial gerenciado pelo administrador

Sessão persistente

Logout seguro

2. Dashboard Personalizado
Visão geral dos acordos ativos

Total de comissão pendente

Total de comissão recebida

Gráfico simples de comissões por mês

Cards com status dos acordos

3. Cadastro de Acordos
Formulário com campos:

Nome do cliente

Valor total do acordo (R$)

Número de parcelas

Data do primeiro pagamento (date picker)

Dias em atraso (campo numérico)

Observações (opcional)

4. Cálculo Automático de Comissão
Tabela de Comissões:

javascript
const tabelaComissoes = [
  { min: 1, max: 60, percentual: 2 },
  { min: 61, max: 90, percentual: 4 },
  { min: 91, max: 180, percentual: 5 },
  { min: 181, max: 360, percentual: 7 },
  { min: 361, max: 720, percentual: 9 },
  { min: 721, max: 9999, percentual: 13 }
];
Cálculo:

Valor da parcela = Valor total ÷ Número de parcelas

% de comissão = Baseado nos dias em atraso

Comissão por parcela = Valor parcela × (% comissão ÷ 100)

Comissão total = Comissão por parcela × Número de parcelas

5. Gestão de Pagamentos
Lista de parcelas gerada automaticamente

Marcar parcelas como pagas (com data)

Histórico completo de pagamentos

Comissão liberada quando parcela é paga

6. Relatórios
Filtrar por período

Exportar lista de comissões

Visualizar por cliente

Dashboard de desempenho

🗂️ Estrutura do Banco de Dados
Tabela usuarios
sql
id (primary key)
nome (string)
email (string, unique)
senha (hash)
criado_em (datetime)
Tabela acordos
sql
id (primary key)
usuario_id (foreign key)
cliente_nome (string)
valor_total (decimal)
parcelas (integer)
valor_parcela (decimal)
data_primeiro_pagamento (date)
dias_atraso (integer)
percentual_comissao (integer)
comissao_total (decimal)
status (ativo/concluído/cancelado)
criado_em (datetime)
Tabela pagamentos
sql
id (primary key)
acordo_id (foreign key)
numero_parcela (integer)
data_prevista (date)
data_paga (date, nullable)
valor_parcela (decimal)
comissao_parcela (decimal)
status (pendente/pago)
criado_em (datetime)
🎨 Design e Interface
Cores Principais:
Primária: #2A5C99 (Azul confiança)

Secundária: #10B981 (Verde sucesso)

Fundo: #F9FAFB

Texto: #1F2937

Telas Principais:
Login - Formulário simples

Dashboard - Cards e resumos

Novo Acordo - Formulário em etapas

Meus Acordos - Lista com filtros

Detalhes do Acordo - Parcelas e pagamentos

Minhas Comissões - Relatório e histórico

⚙️ Regras de Negócio
Cada usuário só vê seus próprios acordos

Comissão calculada no momento do cadastro

Parcelas geradas automaticamente (1ª parcela na data informada, demais mensais)

Status do acordo muda automaticamente baseado nos pagamentos

Histórico imutável de transações

📱 Exemplo de Fluxo
Cenário: Funcionário registra acordo
Acessa "Novo Acordo"

Preenche:

Cliente: João Silva

Valor: R$ 759,99

Parcelas: 7

Data 1º pagamento: 18/12/2025

Dias em atraso: 222

Sistema calcula:

Parcela: R$ 108,57

Faixa: 181-360 dias → 7%

Comissão/parcela: R$ 7,60

Comissão total: R$ 53,20

Gera 7 parcelas mensais

Aparece no dashboard com status "Em andamento"

🔐 Segurança
Senhas criptografadas

Proteção contra XSS e SQL injection

Sessões com timeout

Cada usuário isolado

Backup automático de dados

🚀 Entrega Fases
Fase 1 (MVP):
Login e cadastro

CRUD de acordos

Cálculo de comissão

Dashboard básico

Fase 2:
Relatórios avançados

Notificações

Exportação PDF/Excel

Gráficos detalhados

Fase 3:
App mobile

Integração com email

API externa

📋 Requisitos Técnicos Lovable
Frontend: React.js

Backend: Node.js

Banco: PostgreSQL

Hospedagem: Lovable Cloud

Responsivo: Mobile-first

✨ Diferenciais
Cálculo automático instantâneo

Interface simples e intuitiva

Zero planilhas manuais

Acesso 24/7 de qualquer dispositivo

Transparência total nas comissões

Nome do Projeto: MINHA COMISSAO
Objetivo: Automatizar o cálculo e acompanhamento de comissões de funcionários baseado em acordos com clientes e dias em atraso.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://minhacomissao.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e157f9b2-2af4-4db6-924f-25fd94a375b9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
