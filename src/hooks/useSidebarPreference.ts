import { useEffect, useState } from 'react';
import { readSidebarPreference, writeSidebarPreference } from '@/lib/sidebarPreference';

function read(userId: string | undefined) {
  try { return userId ? readSidebarPreference(window.localStorage, userId) : false; }
  catch { return false; }
}

export function useSidebarPreference(userId: string | undefined) {
  const [preference, setPreference] = useState(() => ({ userId, collapsed: read(userId) }));
  const collapsed = preference.userId === userId ? preference.collapsed : false;
  useEffect(() => { setPreference({ userId, collapsed: read(userId) }); }, [userId]);
  const toggle = () => {
    const next = !collapsed;
    setPreference({ userId, collapsed: next });
    try { if (userId) writeSidebarPreference(window.localStorage, userId, next); }
    catch { /* Keep in-memory preference when storage is blocked. */ }
  };
  return { collapsed, toggle };
}