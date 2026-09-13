import { LocationAccessDeniedException, LocationNotFoundException } from '../../../../common';
import { ILocationRepo } from '../../locations';

export async function assignLocationsToBranch(
  locationRepo: ILocationRepo,
  params: {
    branchId: string;
    organizationId: string;
    locationIds: string[];
  },
): Promise<void> {
  if (!params.locationIds.length) return;

  const uniqueIds = [...new Set(params.locationIds)];
  for (const locationId of uniqueIds) {
    const location = await locationRepo.getAsync(locationId);
    if (!location) {
      throw new LocationNotFoundException(locationId);
    }
    if (location.organizationId !== params.organizationId) {
      throw new LocationAccessDeniedException(undefined, 'Location does not belong to this organization.');
    }
  }

  await locationRepo.assignBranchAsync(params.branchId, uniqueIds);
}

export async function loadBranchLocationIds(locationRepo: ILocationRepo, branchId: string): Promise<string[]> {
  return locationRepo.findIdsByBranchIdAsync(branchId);
}
