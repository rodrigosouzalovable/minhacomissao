export function canManageCampaign(ownerId: string | null | undefined, viewerId: string | null | undefined): boolean {
  return Boolean(ownerId && viewerId && ownerId === viewerId);
}