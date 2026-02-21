

## Trocar telefone nas paginas do portal publico

### Alteracao

Substituir o telefone `(62) 98174-9600` por `(62) 98218-3144` em 3 arquivos:

| Arquivo | Linha | De | Para |
|---|---|---|---|
| `src/pages/PortalConsulta.tsx` | 25-26 | `5562981749600` / `(62) 98174-9600` | `5562982183144` / `(62) 98218-3144` |
| `src/pages/Antifraude.tsx` | 6-7 | `5562981749600` / `(62) 98174-9600` | `5562982183144` / `(62) 98218-3144` |
| `src/pages/PoliticaPrivacidade.tsx` | 6-7 | `5562981749600` / `(62) 98174-9600` | `5562982183144` / `(62) 98218-3144` |

Cada arquivo tem duas constantes no topo (`PHONE` e `PHONE_DISPLAY`) que serao atualizadas. Todas as referencias ao telefone no restante do codigo usam essas constantes, entao basta alterar nesses pontos.

