import { AutoMap } from '@automapper/classes';
import { CommandBase } from '../../../../../common';

export class CreateInvoiceCommand extends CommandBase {
  @AutoMap() public orderId: string;
  @AutoMap() public totalAmount?: number;
  @AutoMap() public status?: string;
  @AutoMap() public organizationId?: string;
  @AutoMap() public actorId?: string;
}
