import { describe, expect, test } from 'bun:test';
import { metaFirstRowIsHeader, metaImportDataRows } from '../src/lib/metaImportHeader';

describe('Envio Meta first row', () => {
  test.each([
    [['62994790340', 'Guilherme'], ['62991672674', 'Rodrigo'], ['62981810202', 'Guilherme']],
    [['Guilherme', '62994790340'], ['Rodrigo', '62991672674'], ['Guilherme', '62981810202']],
    [['', 'Guilherme', '62994790340']],
    [['Guilherme', '62994790340']],
    [['Cliente Silva', '62994790340', 'Valor aprovado']],
  ])('keeps headerless first client: %j', (...rows) => {
    const header = metaFirstRowIsHeader(rows);
    expect(header).toBe(false);
    expect(metaImportDataRows(rows, header)).toHaveLength(rows.length);
    expect(metaImportDataRows(rows, header)[0]).toEqual(rows[0]);
  });
  test('excludes actual header only', () => {
    const rows = [['Nome', 'Telefone', 'CPF/CNPJ'], ['Guilherme', '62994790340', '12345678900']];
    expect(metaFirstRowIsHeader(rows)).toBe(true);
    expect(metaImportDataRows(rows, true)).toEqual([rows[1]]);
  });
  test('manual choice preserves uncommon first row when not a header', () => {
    const rows = [['Nome', 'Telefone'], ['Guilherme', '62994790340']];
    expect(metaImportDataRows(rows, false)).toHaveLength(2);
  });
});