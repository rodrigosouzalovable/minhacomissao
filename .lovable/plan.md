# Google Maps Leads: menu lateral + retomada do projeto

## 1. Corrigir a página sem menu lateral

A página Google Maps Leads é a única do sistema que não está envolvida pelo layout padrão do app, por isso abre "solta", sem a barra lateral de abas. Todas as outras páginas (ex.: Auditoria) usam esse layout.

Correção: envolver o conteúdo da página com o layout padrão (`AppLayout`), como nas demais telas. Nada mais muda visualmente além de voltar a exibir o menu lateral, o cabeçalho e o botão de recolher.

## 2. De onde paramos

O módulo já está construído e funcional do lado do sistema:

- Tela de busca por categoria/nicho + localização, com limite de até 60 resultados.
- Guardrail financeiro: contador mensal de consultas (0 de 5000), bloqueio automático em 4800 e reset mensal.
- Gravação dos leads (nome, telefone, endereço, site, avaliação, coordenadas) e histórico de buscas.
- Lista de leads com filtro "só com telefone", copiar telefones e exportar Excel.

O que está travando a extração não é o código: as 4 últimas buscas (28/07) falharam todas com erro 403 do Google. As mensagens de erro gravadas mostram dois motivos, na chave do Google Cloud usada na conexão:

1. `API_KEY_SERVICE_BLOCKED` — a chave não permite a **Places API (New)** (`places.googleapis.com`).
2. `API_KEY_IP_ADDRESS_BLOCKED` — a chave tem restrição por endereço IP e bloqueou o IP de saída da chamada.

Ou seja: falta ajuste na chave do Google Cloud, feito somente pelo dono do projeto no Google Cloud Console.

## 3. O que precisa ser feito no Google Cloud (você)

1. Ativar a **Places API (New)** no projeto da chave (o Google identificou o projeto `801245426792`).
2. Na chave de servidor, em "Restrições de API", permitir `places.googleapis.com`.
3. Na mesma chave, em "Restrições de aplicativo", trocar a restrição por IP para **Nenhuma** (ou incluir o IP que o Google informar no erro — as chamadas saem de IPs variáveis, então "Nenhuma" é mais estável para uso de backend).
4. Salvar e aguardar 1–2 minutos.

Depois disso, basta rodar uma busca pequena (ex.: "pizzaria" em "Goiânia GO", máx. 20) para validar. A tela já exibe o motivo exato caso volte a dar 403.

## 4. Detalhes técnicos

- `src/App.tsx` mantém a rota `/admin/google-maps-leads` protegida por `AdminRoute`.
- Ajuste em `src/pages/GoogleMapsLeads.tsx`: importar `AppLayout` de `@/components/layout/AppLayout` e envolver o JSX raiz.
- Sem mudanças em banco, edge functions ou regras de custo.
