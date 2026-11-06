import { describe, expect, it } from 'bun:test';
import { roleAccessState } from '../src/lib/roleAccessState';

describe('Acesso administrativo durante carregamento da sessão', () => {
  it('aguarda o perfil quando a sessão chega após o estado deslogado', () => {
    expect(roleAccessState('admin-id', null, null, false)).toEqual({ role: null, loading: true });
  });
  it('permite o administrador somente após confirmar o perfil da sessão', () => {
    expect(roleAccessState('admin-id', 'admin-id', 'admin', false)).toEqual({ role: 'admin', loading: false });
  });
  it('não herda a permissão do administrador ao trocar de usuário', () => {
    expect(roleAccessState('employee-id', 'admin-id', 'admin', false)).toEqual({ role: null, loading: true });
  });
  it('mantém funcionários sem acesso administrativo após confirmação', () => {
    expect(roleAccessState('employee-id', 'employee-id', 'funcionario', false)).toEqual({ role: 'funcionario', loading: false });
  });
});