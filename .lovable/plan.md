

## Problem

The CPF column (A) contains values like `01239456158` that start with zero. When xlsx reads the spreadsheet, it interprets these as numbers, stripping the leading zero. The result is a 10-character string that fails the `cpf.length < 11` guard on line 280, causing ALL PAGA rows to be silently skipped.

## Fix

In `parsePagamentos` (line 279-280), after extracting digits from the CPF, pad it to 11 characters with leading zeros:

```typescript
// Line 279-280, change from:
const cpf = String(row['A'] ?? '').replace(/\D/g, '');
if (cpf.length < 11) continue;

// To:
let cpf = String(row['A'] ?? '').replace(/\D/g, '');
if (cpf.length >= 10 && cpf.length < 11) cpf = cpf.padStart(11, '0');
if (cpf.length < 11) continue;
```

This single change ensures CPFs like `01239456158` (read as `1239456158`) are correctly padded back to 11 digits, allowing PAGA rows to be processed.

### File: `src/pages/ImportarDevedores.tsx`
- Lines 279-280: Add `padStart(11, '0')` for CPFs with 10 digits (lost leading zero)

