export function canReadCampaign(owner: string, viewer: string, sharedIds: string[], jobId: string) {
  return owner === viewer || sharedIds.includes(jobId);
}

export function shouldRefreshCampaign(visible: boolean, elapsed: number, interval: number) {
  return visible && elapsed >= interval;
}