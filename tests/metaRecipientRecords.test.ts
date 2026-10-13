import { describe, expect, test } from 'bun:test';
import { mappedRecipientFields, recipientRecordCells, recipientRecordLines, serializeRecipientRecord } from '../src/lib/metaRecipientRecords';
import { partitionRecipientLines } from '../src/lib/metaRecipientValidation';

describe('Meta imported records', () => {
  const cells = ['75991525199', 'Edson', 'Texto, com; detalhes e "aspas"', '✅ Benefício\n✅ Outro\n\nPergunta?', '(62) 98274-9908'];
  test('99 clients remain 99 records with five literal columns', () => {
    const raw = Array.from({ length: 99 }, () => serializeRecipientRecord(cells)).join('\n');
    const records = recipientRecordLines(raw);
    expect(records).toHaveLength(99);
    for (const record of records) expect(recipientRecordCells(record)).toEqual(cells);
  });
  test('variables are not interpreted as CPF, delay or balance', () => {
    const fields = mappedRecipientFields(cells, ['telefone', 'tplvar:1', 'tplvar:2', 'tplvar:3', 'tplvar:4']);
    expect(fields.cpf).toBe('');
    expect(fields.atraso).toBe('');
    expect(fields.saldo).toBe(0);
    expect(fields.vars).toEqual({ '1': 'Edson', '2': cells[2], '3': cells[3], '4': cells[4] });
  });
  test('invalid phone filtering preserves the complete valid record', () => {
    const valid = serializeRecipientRecord(cells);
    const invalid = serializeRecipientRecord(['123', ...cells.slice(1)]);
    expect(partitionRecipientLines(`${valid}\n${invalid}`)).toEqual({ validRaw: valid, ignored: 1 });
  });
  test('headerless manual clients and decimal balances remain supported', () => {
    const raw = '75991525199, Edson, , 45, R$ 4.607,58\n62991672674, Maria';
    expect(recipientRecordLines(raw)).toHaveLength(2);
    expect(recipientRecordCells(recipientRecordLines(raw)[0])).toEqual(['75991525199', 'Edson', '', '45', 'R$ 4.607,58']);
  });
});