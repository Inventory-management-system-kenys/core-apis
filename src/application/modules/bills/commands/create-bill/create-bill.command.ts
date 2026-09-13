import { AutoMap } from '@automapper/classes';
import { CommandBase } from '../../../../../common';
import {
  ECustomerType,
  EPaymentMethod,
  EPaymentTiming,
  ESaleType,
} from '../../../../../infrastructure/persistence/entities';
import { ERole } from '../../../../../infrastructure/persistence/entities/role.entity';

export class CreateBillItemCommand {
  @AutoMap() public productId: string;
  @AutoMap() public variantId?: string;
  @AutoMap() public quantity: number;
  @AutoMap() public unitPrice: number;
  @AutoMap() public taxRate?: number;
  @AutoMap() public discountAmount?: number;
}

export class CreateBillCommand extends CommandBase {
  /** Set by the controller from the authenticated user, not the request body. */
  @AutoMap() public organizationId: string;
  @AutoMap() public createdById: string;

  @AutoMap() public locationId: string;
  @AutoMap() public customerId?: string;
  @AutoMap() public walkInName?: string;
  @AutoMap() public walkInPhone?: string;
  @AutoMap() public walkInGstin?: string;
  @AutoMap() public notes?: string;
  @AutoMap(() => String) public paymentMethod?: EPaymentMethod;
  @AutoMap(() => String) public saleType?: ESaleType;
  @AutoMap(() => String) public customerType?: ECustomerType;
  @AutoMap(() => String) public paymentTiming?: EPaymentTiming;
  @AutoMap() public partialAmount?: number;
  @AutoMap() public facilitatorUserId?: string;
  @AutoMap() public facilitatorName?: string;
  /** Handler-only input — not persisted on Bill. */
  public commissionPct?: number;
  /** Set by the controller from AuthenticatedUser.roles. */
  public performedByRoles: ERole[] = [];
  @AutoMap(() => [CreateBillItemCommand]) public items: CreateBillItemCommand[];
}
