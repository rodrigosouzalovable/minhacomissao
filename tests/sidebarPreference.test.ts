import { describe, expect, test } from 'bun:test';
import { readSidebarPreference, writeSidebarPreference } from '../src/lib/sidebarPreference';

describe('Preferência da lateral por usuário', () => {
  test('lembra o recolhimento e a expansão sem alterar a escolha de outro usuário', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(readSidebarPreference(storage, 'ana')).toBe(false);
    writeSidebarPreference(storage, 'ana', true);
    expect(readSidebarPreference(storage, 'ana')).toBe(true);
    expect(readSidebarPreference(storage, 'bruno')).toBe(false);
    writeSidebarPreference(storage, 'bruno', true);
    writeSidebarPreference(storage, 'ana', false);
    expect(readSidebarPreference(storage, 'ana')).toBe(false);
    expect(readSidebarPreference(storage, 'bruno')).toBe(true);
  });
  test('armazenamento indisponível não impede usar a lateral', () => {
    const storage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readSidebarPreference(storage, 'ana')).toBe(false);
    expect(() => writeSidebarPreference(storage, 'ana', true)).not.toThrow();
  });
});