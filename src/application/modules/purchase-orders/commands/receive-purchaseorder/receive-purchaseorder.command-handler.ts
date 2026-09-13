import { BadRequestException, Inject } from '@nestjs/common';
import { ICommandHandler } from '@nestjs/cqrs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CommandHandlerStrict } from '../../../../../common';
import { PURCHASE_ITEM_REPO, PURCHASE_ORDER_REPO } from '../../../../constants';
import { PurchaseOrder } from '../../domain';
import { IPurchaseOrderRepo } from '../..';
import { IPurchaseItemRepo } from '../../../purchase-items/i-purchase-item.repo';
import { ActivityLogService } from 'src/application/shared';
import { EPurchaseOrderStatus } from 'src/application/shared/enums';
import { EActivityAction } from 'src/infrastructure/persistence/entities/activity-log.entity';
import { ReceivePurchaseOrderCommand } from './receive-purchaseorder.command';

const BLOCKED_STATUSES: EPurchaseOrderStatus[] = [
  EPurchaseOrderStatus.Allocated,
  EPurchaseOrderStatus.Cancelled,
];

@CommandHandlerStrict(ReceivePurchaseOrderCommand)
export class ReceivePurchaseOrderCommandHandler implements ICommandHandler<ReceivePurchaseOrderCommand, PurchaseOrder> {
  constructor(
    @Inject(PURCHASE_ORDER_REPO) private readonly poRepo: IPurchaseOrderRepo,
    @Inject(PURCHASE_ITEM_REPO) private readonly itemRepo: IPurchaseItemRepo,
    private readonly activityLog: ActivityLogService,
    @InjectPinoLogger(ReceivePurchaseOrderCommandHandler.name) private readonly logger: PinoLogger,
  ) {}

  public async execute(command: ReceivePurchaseOrderCommand): Promise<PurchaseOrder> {
    this.logger.info(`Executing ${ReceivePurchaseOrderCommand.name} poId=${command.purchaseOrderId}`);

    const po = await this.poRepo.getAsync(command.purchaseOrderId);

    if (BLOCKED_STATUSES.includes(po.status)) {
      throw new BadRequestException(`Cannot receive items for a purchase order with status "${po.status}"`);
    }

    for (const recv of command.items) {
      const item = await this.itemRepo.getAsync(recv.purchaseItemId);
      item.quantityReceived = Number(item.quantityReceived ?? 0) + Number(recv.quantityReceived);
      await this.itemRepo.updateAsync(item);
    }

    const allItems = await this.itemRepo.allAsync({ purchaseOrderId: command.purchaseOrderId });
    const allDone  = allItems.every(ii => Number(ii.quantityReceived ?? 0) >= Number(ii.quantityOrdered));
    const anyDone  = allItems.some(ii => Number(ii.quantityReceived ?? 0) > 0);

    if (allDone) {
      po.status     = EPurchaseOrderStatus.Received;
      po.receivedAt = new Date();
    } else if (anyDone) {
      po.status = EPurchaseOrderStatus.PartiallyReceived;
    }

    const result = await this.poRepo.updateAsync(po);
    this.activityLog.record({
      action: EActivityAction.PurchaseOrderGoodsReceived,
      entityType: 'PurchaseOrder',
      entityId: result.id,
      organizationId: result.organizationId,
      metadata: { poNumber: result.poNumber, status: result.status },
    });
    return result;
  }
}
