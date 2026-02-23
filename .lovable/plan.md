

# Historico de planilhas e feedback visual no Acionamento

## Alteracoes no arquivo `src/pages/Acionamento.tsx`

### 1. Historico de planilhas importadas
- Abaixo do botao "Selecionar arquivo Excel", adicionar uma lista com o historico de planilhas importadas
- Cada item mostra: nome do arquivo, quantidade de clientes e data/hora da importacao
- Botao de lixeira (icone Trash2 do lucide) ao lado de cada item para excluir
- Historico persistido no `localStorage` (chave `acionamento_historico`)
- Ao clicar em um item do historico, recarrega os dados daquela planilha na lista de clientes
- Ao excluir, remove do historico e limpa a lista se for a planilha ativa

### 2. Feedback visual no botao WhatsApp
- O codigo atual ja troca o icone para Check (verde) ao enviar com sucesso e X (vermelho) em caso de erro
- Porem, o status so muda apos a resposta da API. Vou garantir que ao clicar, o botao mude imediatamente para o spinner e depois para o check verde permanente
- O check permanece mesmo apos recarregar a lista (status mantido no estado local por indice)

---

## Detalhes tecnicos

### Estrutura do historico no localStorage
```typescript
interface HistoricoItem {
  id: string;           // uuid gerado no momento da importacao
  nomeArquivo: string;  // nome do arquivo Excel
  qtdClientes: number;  // quantidade de clientes importados
  dataImportacao: string; // ISO date string
  clientes: ClienteData[]; // dados completos dos clientes
}
```

### Alteracoes especificas
- Adicionar estado `historico` com array de `HistoricoItem`
- No `useEffect` inicial, carregar historico do localStorage
- No `handleFileUpload`, alem de setar clientes, salvar no historico
- Adicionar funcao `handleDeleteHistorico(id)` para remover item
- Adicionar funcao `handleLoadHistorico(id)` para carregar planilha do historico
- Renderizar lista do historico entre o botao de upload e o card de mensagem
- Importar icone `Trash2` do lucide-react

### Sobre o botao WhatsApp -> Check
- O comportamento ja existe no codigo atual (linhas que tratam `sendStatus[i] === 'success'`)
- Confirmar que o icone Check aparece corretamente e permanece apos o clique, sem necessidade de alteracao adicional nessa parte

