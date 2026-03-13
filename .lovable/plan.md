

## Problem

The console shows `[PAGAMENTOS] Total dataRows: 0` — the xlsx parser returns zero rows despite the spreadsheet clearly containing data. The `sheet_to_json` call produces 0 or 1 entries.

## Root Cause

The `ArrayBuffer` from `FileReader.readAsArrayBuffer` may not be correctly interpreted by `XLSX.read(data, { type: 'array' })` for this specific file. Per the project's existing memory note about large file imports, the buffer must be explicitly converted to `Uint8Array` before parsing.

Additionally, there's no debug visibility into what the workbook/sheet actually contains, making it hard to diagnose.

## Fix in `src/pages/ImportarDevedores.tsx`

**1. Convert ArrayBuffer to Uint8Array before XLSX.read (line ~392)**

Change:
```typescript
const data = evt.target?.result;
const workbook = XLSX.read(data, { type: 'array' });
```
To:
```typescript
const data = new Uint8Array(evt.target?.result as ArrayBuffer);
const workbook = XLSX.read(data, { type: 'array' });
```

**2. Add workbook/sheet debug logging inside the pagamentos branch (after line 396)**

```typescript
console.log('[PAGAMENTOS] SheetNames:', workbook.SheetNames);
console.log('[PAGAMENTOS] Sheet ref:', sheet['!ref']);
console.log('[PAGAMENTOS] json.length:', json.length);
if (json.length > 0) {
  console.log('[PAGAMENTOS] First row keys:', Object.keys(json[0]));
}
```

This ensures that even if the Uint8Array fix doesn't resolve it, we'll have the exact diagnostic data to identify the real cause.

