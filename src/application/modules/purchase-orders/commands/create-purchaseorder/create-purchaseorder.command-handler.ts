import { Inject } from '@nestjs/common';
import { ICommandHandler } from '@nestjs/cqrs';
import { Mapper } from '@automapper/core';
import { InjectMapper } from '@automapper/nestjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CommandHandlerStrict } from '../../../../../common';
import { PURCHASE_ITEM_REPO, PURCHASE_ORDER_REPO } from '../../../../constants';
import { PurchaseOrder } from '../../domain';
import { IPurchaseOrderRepo } from '../..';
import { IPurchaseItemRepo } from '../../../purchase-items/i-purchase-item.repo';
import { PurchaseItem } from '../../../purchase-items/domain';
import { CreatePurchaseItemCommand } from '../../../purchase-items/commands';
import { ActivityLogService } from 'src/application/shared';
import { EPurchaseOrderStatus } from 'src/application/shared/enums';
import { EActivityAction } from 'src/infrastructure/persistence/entities/activity-log.entity';
import { CreatePurchaseOrderCommand } from './create-purchaseorder.command';

@CommandHandlerStrict(CreatePurchaseOrderCommand)
export class CreatePurchaseOrderCommandHandler implements ICommandHandler<CreatePurchaseOrderCommand, PurchaseOrder> {
  constructor(
    @Inject(PURCHASE_ORDER_REPO) private readonly poRepo: IPurchaseOrderRepo,
    @Inject(PURCHASE_ITEM_REPO) private readonly itemRepo: IPurchaseItemRepo,
    private readonly activityLog: ActivityLogService,
    @InjectMapper() private readonly mapper: Mapper,
    @InjectPinoLogger(CreatePurchaseOrderCommandHandler.name) private readonly logger: PinoLogger,
  ) {}

  public async execute(command: CreatePurchaseOrderCommand): Promise<PurchaseOrder> {
    this.logger.info(`Executing ${CreatePurchaseOrderCommand.name}`);

    const po        = this.mapper.map(command, CreatePurchaseOrderCommand, PurchaseOrder);
    po.poNumber     = `PO-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    po.status       = EPurchaseOrderStatus.Draft;
    po.totalAmount  = 0;

    const savedPo = await this.poRepo.createAsync(po);

    let totalAmount = 0;
    for (const input of command.items) {
      const itemCmd             = new CreatePurchaseItemCommand();
      itemCmd.purchaseOrderId   = savedPo.id;
      itemCmd.productId         = input.productId;
      itemCmd.quantityOrdered   = input.quantityOrdered;
      itemCmd.unitCost          = input.unitCost;
      const item = this.mapper.map(itemCmd, CreatePurchaseItemCommand, PurchaseItem);
      await this.itemRepo.createAsync(item);
      totalAmount += item.totalCost;
    }

    savedPo.totalAmount = totalAmount;
    const result = await this.poRepo.updateAsync(savedPo);
    this.activityLog.record({
      action: EActivityAction.PurchaseOrderCreated,
      entityType: 'PurchaseOrder',
      entityId: result.id,
      actorId: command.createdById,
      organizationId: command.organizationId,
      metadata: { poNumber: result.poNumber, totalAmount: result.totalAmount },
    });
    return result;
  }
}
