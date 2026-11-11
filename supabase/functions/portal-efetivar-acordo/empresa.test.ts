import { expect, test } from 'bun:test';
import { empresaDoPortal } from './empresa';
test('portal UME lança como UME', () => expect(empresaDoPortal('ume')).toBe('mundo_da_moda'));
test('portal Odres lança como Odres Cred', () => expect(empresaDoPortal('odres_cred')).toBe('odres_cred'));
