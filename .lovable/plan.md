

## Plan: Add Excel import and WhatsApp instance selector to Campanhas de Voz

### What changes

**File: `src/pages/CampanhasVoz.tsx`**

1. **Add Excel spreadsheet import** in the "Adicionar Contatos" section (alongside the existing Acordos/Devedores selector):
   - New option `'planilha'` in the contact source selector
   - When selected, show a file input for `.xlsx/.xls` files
   - Parse the file using the `xlsx` library (already used in the project for imports)
   - Read column C (index 2) as TELEFONE and column B (index 1) as NOME
   - Display parsed contacts in the same table with checkboxes for selection
   - User can then select which contacts to add to the campaign

2. **Always show WhatsApp instance selector** in the campaign detail header:
   - Currently the instance selector only shows when `instances.length > 1`
   - Change to always show the selector (like in Acionamento page), so the user can pick any connected WhatsApp instance regardless of count
   - Show instance selector prominently, not conditionally

### Technical details

- Import `read` and `utils` from `xlsx` library (already a project dependency)
- Add state: `importedContacts` array, `excelFile` for the uploaded file
- Parse logic: `XLSX.read(buffer, { type: 'array' })` then `XLSX.utils.sheet_to_json` with `header: 1` to get raw rows, skip header row, extract column B (nome) and column C (telefone)
- Generate unique IDs for imported contacts using `crypto.randomUUID()` so they work with the existing checkbox selection system
- The imported contacts feed into the same `availableContacts` display and selection flow

### No database changes needed

