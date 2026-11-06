export function roleAccessState<T extends string>(
  userId: string | null,
  resolvedUserId: string | null,
  role: T | null,
  loading: boolean,
): { role: T | null; loading: boolean } {
  const resolved = userId !== null && resolvedUserId === userId;
  return {
    role: resolved ? role : null,
    loading: userId !== null && (!resolved || loading),
  };
}