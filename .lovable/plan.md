# Corrigir verificação de WhatsApp e exportação de leads (Google Maps Leads)

## 1. Erro "Nenhuma instância WhatsApp conectada"

Causa confirmada: a função de verificação consulta a coluna `status` na tabela de instâncias UAZAPI, e essa coluna não existe. A consulta falha, a lista de instâncias volta vazia e o sistema conclui, erradamente, que não há WhatsApp conectado — mesmo com a instância MEMU 25 ativa e conectada.

Correção:
- Consultar apenas as colunas que existem (nome, URL do servidor, token, ativo, tipo, ordem).
- Escolher a instância validadora entre as ativas e, antes de usar, confirmar em tempo real na UAZAPI se ela está realmente conectada; se a primeira não estiver, tentar a próxima.
- Só exibir a mensagem "nenhuma instância conectada" quando nenhuma instância ativa responder como conectada, e nesse caso incluir o motivo real (ex.: desconectada) na mensagem.
- Registrar em log o nome da instância usada e o retorno da UAZAPI, para diagnóstico futuro.

## 2. Exportar Excel apenas com quem tem WhatsApp

- O botão "Exportar Excel" passa a gerar uma planilha com apenas duas colunas: **Nome** e **Telefone**.
- Exporta somente os leads com WhatsApp confirmado (independente dos filtros marcados na tela).
- Se não houver nenhum lead com WhatsApp confirmado, mostrar aviso pedindo para rodar a verificação antes.

## Detalhes técnicos

- `supabase/functions/google-maps-verificar-whatsapp/index.ts`: remover `status` do `select`, adicionar checagem `GET /instance/status` (header `token`) por instância candidata, e propagar erro do Supabase no log/resposta em vez de silenciar.
- Reimplantar a função após a alteração.
- `src/pages/GoogleMapsLeads.tsx`: em `exportarExcel()`, montar as linhas a partir de `leadsBase.filter(l => l.tem_whatsapp === true)` com apenas `Nome` e `Telefone`.
