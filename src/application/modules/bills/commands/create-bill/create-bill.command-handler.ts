import { Mapper } from '@automapper/core';
import { InjectMapper } from '@automapper/nestjs';
import { ForbiddenException, Inject } from '@nestjs/common';
import { ICommandHandler } from '@nestjs/cqrs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CommandHandlerStrict } from '../../../../../common';
import { EBillStatus, ERole, ESaleType } from '../../../../../infrastructure/persistence/entities';
import { BILL_REPO, PRODUCT_REPO } from '../../../../constants';
import { IProductRepo } from '../../../products';
import { Bill, BillItem } from '../../domain';
import { applyBillTotals, generateBillNumber } from '../../helpers';
import { IBillRepo } from '../..';
import { CreateBillCommand, CreateBillItemCommand } from './create-bill.command';

const BLACK_SALE_ROLES = new Set([ERole.OrgAdmin, ERole.SuperAdmin]);

@CommandHandlerStrict(CreateBillCommand)
export class CreateBillCommandHandler implements ICommandHandler<CreateBillCommand, Bill> {
  constructor(
    @Inject(BILL_REPO) private readonly repo: IBillRepo,
    @Inject(PRODUCT_REPO) private readonly productRepo: IProductRepo,
    @InjectMapper() private readonly mapper: Mapper,
    @InjectPinoLogger(CreateBillCommandHandler.name) private readonly logger: PinoLogger,
  ) {}

  public async execute(command: CreateBillCommand): Promise<Bill> {
    this.logger.info(`Executing ${CreateBillCommand.name}`);
    const saleType = command.saleType ?? ESaleType.Normal;

    if (saleType === ESaleType.Black && !(command.performedByRoles ?? []).some((r) => BLACK_SALE_ROLES.has(r))) {
      throw new ForbiddenException('Only Org Admin/Org Manager can create a black sale');
    }

    const bill = this.mapper.map(command, CreateBillCommand, Bill);
    // CreateBillCommand → Bill ignores items (see bill.profile); map them explicitly
    // so POS create-with-basket persists line items and header totals.
    bill.items = this.mapper.mapArray(command.items ?? [], CreateBillItemCommand, BillItem);
    bill.saleType         = saleType;
    bill.paymentMethod    = command.paymentMethod;
    bill.blackAmount      = 0;
    bill.commissionAmount = 0;
    bill.billNumber       = generateBillNumber();
    bill.status           = EBillStatus.Initiated;
    applyBillTotals(bill);

    if (saleType === ESaleType.Black) {
      let blackAmount = 0;
      for (const item of bill.items ?? []) {
        const product = await this.productRepo.getAsync(item.productId);
        const officialPrice = Number(product?.retailPrice ?? 0);
        blackAmount += (Number(item.unitPrice) - officialPrice) * Number(item.quantity);
      }
      bill.blackAmount = blackAmount;
      if ((command.facilitatorUserId || command.facilitatorName) && command.commissionPct) {
        bill.commissionAmount = (blackAmount * command.commissionPct) / 100;
      }
    }

    return this.repo.createAsync(bill);
  }
}
