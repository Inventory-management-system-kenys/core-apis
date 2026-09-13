jest.mock('@automapper/classes', () => ({
  AutoMap: () => () => undefined,
}));

jest.mock('../../../../../common', () => ({
  CommandHandlerStrict: () => () => undefined,
  CommandBase: class CommandBase {},
}));

jest.mock('../../../../../common/push-notification', () => ({
  PUSH_NOTIFICATION_SERVICE: 'PUSH_NOTIFICATION_SERVICE',
}));

jest.mock('../../../../shared/services/stock-orchestration.service', () => ({
  StockOrchestrationService: class StockOrchestrationService {},
}));

jest.mock('../../../../constants', () => ({
  STOCK_TRANSFER_REQUEST_REPO: 'STOCK_TRANSFER_REQUEST_REPO',
  STOCK_TRANSFER_REPO: 'STOCK_TRANSFER_REPO',
  INVENTORY_REPO: 'INVENTORY_REPO',
}));

jest.mock('../../../inventory', () => ({
  IInventoryRepo: {},
}));

import { EStockTransferRequestStatus } from '../../../../shared/enums/e-stock-transfer-request-status';
import { EStockTransferStatus } from '../../../../shared/enums/e-stock-transfer-status';
import { ClaimStockTransferRequestCommand } from './claim-stock-transfer-request.command';
import { ClaimStockTransferRequestCommandHandler } from './claim-stock-transfer-request.command-handler';

describe('ClaimStockTransferRequestCommandHandler', () => {
  const logger = { info: jest.fn(), warn: jest.fn() };
  let repo: {
    getAsync: jest.Mock;
    updateAsync: jest.Mock;
    findUsersForLocationAsync: jest.Mock;
  };
  let transferRepo: { getAsync: jest.Mock; updateAsync: jest.Mock };
  let inventoryRepo: { findByOrgLocationProductAsync: jest.Mock };
  let orchestrator: { addStock: jest.Mock };
  let pushNotification: { sendBatchAsync: jest.Mock };
  let handler: ClaimStockTransferRequestCommandHandler;

  const acceptedRequest = {
    id: 'req-1',
    organizationId: 'org-1',
    requestingLocationId: 'loc-requesting',
    acceptedByLocationId: 'loc-accepting',
    productId: 'prod-1',
    quantityRequested: 4,
    fulfillmentTransferId: 'xfer-1',
    status: EStockTransferRequestStatus.Accepted,
  };

  beforeEach(() => {
    repo = {
      getAsync: jest.fn(async () => ({ ...acceptedRequest })),
      updateAsync: jest.fn(async (request) => request),
      findUsersForLocationAsync: jest.fn(async () => ['u-accepting']),
    };
    transferRepo = {
      getAsync: jest.fn(async () => ({ id: 'xfer-1', status: EStockTransferStatus.Pending })),
      updateAsync: jest.fn(async (transfer) => transfer),
    };
    inventoryRepo = {
      findOrCreateAsync: jest.fn(async () => ({ id: 'inv-req' })),
    };
    orchestrator = { addStock: jest.fn(async () => undefined) };
    pushNotification = { sendBatchAsync: jest.fn(async () => undefined) };
    handler = new ClaimStockTransferRequestCommandHandler(
      repo as never,
      transferRepo as never,
      inventoryRepo as never,
      orchestrator as never,
      pushNotification as never,
      logger as never,
    );
  });

  const command = (over: Partial<ClaimStockTransferRequestCommand> = {}) =>
    Object.assign(new ClaimStockTransferRequestCommand(), {
      requestId: 'req-1',
      organizationId: 'org-1',
      claimingUserId: 'u-claiming',
      ...over,
    });

  it('rejects org mismatch as not found', async () => {
    await expect(handler.execute(command({ organizationId: 'org-other' }))).rejects.toThrow(
      /not found/,
    );
  });

  it('rejects requests that are not ACCEPTED', async () => {
    repo.getAsync.mockResolvedValue({ ...acceptedRequest, status: EStockTransferRequestStatus.Open });
    await expect(handler.execute(command())).rejects.toThrow(/not in ACCEPTED state/);
  });

  it('auto-creates requesting-location inventory when missing or present', async () => {
    (inventoryRepo.findOrCreateAsync as jest.Mock).mockResolvedValue({ id: 'inv-req' });
    await handler.execute(command());
    expect(inventoryRepo.findOrCreateAsync).toHaveBeenCalledWith('org-1', 'loc-requesting', 'prod-1');
  });

  it('adds stock, completes transfer, marks request COMPLETED', async () => {
    const updated = await handler.execute(command());

    expect(orchestrator.addStock).toHaveBeenCalledWith(
      expect.objectContaining({
        inventoryId: 'inv-req',
        locationId: 'loc-requesting',
        quantity: 4,
        referenceId: 'req-1',
      }),
    );
    expect(transferRepo.updateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'xfer-1', status: EStockTransferStatus.Completed }),
    );
    expect(updated.status).toBe(EStockTransferRequestStatus.Completed);
    expect(updated.claimedAt).toBeInstanceOf(Date);
    expect(pushNotification.sendBatchAsync).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 'u-accepting', type: 'STOCK_REQUEST_CLAIMED' }),
    ]);
  });
});
