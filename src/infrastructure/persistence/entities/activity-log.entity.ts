import { AutoMap } from '@automapper/classes';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CORE_SCHEMA, ECoreTableName } from './e-core-table-name';
import { UserEntity } from './user.entity';
import { OrganizationEntity } from './organization.entity';
import { LocationEntity } from './location.entity';

const PK_NAME = 'PK_' + ECoreTableName.ActivityLogs;

export enum EActivityAction {
  // Auth
  AuthLogin             = 'auth.login',
  AuthLogout            = 'auth.logout',
  AuthLoginFailed       = 'auth.login_failed',
  // Products
  ProductCreated        = 'product.created',
  ProductUpdated        = 'product.updated',
  ProductDeleted        = 'product.deleted',
  ProductEnabled        = 'product.enabled',
  ProductDisabled       = 'product.disabled',
  ProductPriceChanged   = 'product.price_changed',
  // Inventory / Stock
  StockAdded            = 'stock.added',
  StockRemoved          = 'stock.removed',
  StockAdjusted         = 'stock.adjusted',
  StockTransferred      = 'stock.transferred',
  StockDamaged          = 'stock.damaged',
  StockWrittenOff       = 'stock.written_off',
  StockReserved         = 'stock.reserved',
  StockReservationReleased = 'stock.reservation_released',
  // Sales / POS
  SaleCreated           = 'sale.created',
  SaleConfirmed         = 'sale.confirmed',
  SaleVoided            = 'sale.voided',
  SalePaymentReceived   = 'sale.payment_received',
  SaleRefunded          = 'sale.refunded',
  // Purchase Orders
  PurchaseOrderCreated        = 'purchase_order.created',
  PurchaseOrderSent           = 'purchase_order.sent',
  PurchaseOrderGoodsReceived  = 'purchase_order.goods_received',
  PurchaseOrderCancelled      = 'purchase_order.cancelled',
  // Invoices
  InvoiceCreated        = 'invoice.created',
  InvoiceSent           = 'invoice.sent',
  InvoicePaid           = 'invoice.paid',
  InvoiceVoided         = 'invoice.voided',
  // Bills
  BillCreated           = 'bill.created',
  BillPaid              = 'bill.paid',
  // Customers
  CustomerCreated       = 'customer.created',
  CustomerUpdated       = 'customer.updated',
  CustomerCreditLimitChanged = 'customer.credit_limit_changed',
  CustomerDeactivated   = 'customer.deactivated',
  // Suppliers
  SupplierCreated       = 'supplier.created',
  SupplierUpdated       = 'supplier.updated',
  SupplierDeactivated   = 'supplier.deactivated',
  // Users & Staff
  UserCreated           = 'user.created',
  UserUpdated           = 'user.updated',
  UserRoleChanged       = 'user.role_changed',
  UserDeactivated       = 'user.deactivated',
  UserReactivated       = 'user.reactivated',
  // Branches / Stores
  BranchCreated         = 'branch.created',
  BranchUpdated         = 'branch.updated',
  // Reports
  ReportGenerated       = 'report.generated',
  ReportExported        = 'report.exported',
  // Org Settings
  OrgSettingsUpdated    = 'org.settings_updated',
  OrgModuleToggled      = 'org.module_toggled',
  OrgBillingChanged     = 'org.billing_changed',
}

@Entity({ schema: CORE_SCHEMA, name: ECoreTableName.ActivityLogs })
export class ActivityLogEntity {
  @AutoMap()
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: PK_NAME })
  public id: string;

  @AutoMap()
  @Column({ type: 'uuid', nullable: true })
  public userId?: string;

  @AutoMap()
  @Column({ type: 'uuid' })
  public organizationId: string;

  @AutoMap()
  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  public locationId?: string;

  @AutoMap(() => String)
  @Column({ type: 'enum', enum: EActivityAction })
  public action: EActivityAction;

  /** Entity type affected e.g. "Product", "Inventory", "PurchaseOrder" */
  @AutoMap()
  @Column({ type: 'varchar', length: 100, nullable: true })
  public entityType?: string;

  /** PK of the entity that was affected */
  @AutoMap()
  @Column({ type: 'uuid', nullable: true })
  public entityId?: string;

  /** Full JSON diff / payload snapshot for audit trail */
  @AutoMap()
  @Column({ type: 'jsonb', nullable: true })
  public metadata?: Record<string, unknown>;

  /** Display name of the actor, snapshotted at log time */
  @AutoMap()
  @Column({ type: 'varchar', length: 150, nullable: true })
  public actorName?: string;

  /** IP address of client */
  @AutoMap()
  @Column({ type: 'varchar', length: 50, nullable: true })
  public ipAddress?: string;

  @AutoMap()
  @Column({ type: 'varchar', length: 255, nullable: true })
  public userAgent?: string;

  @AutoMap(() => Date)
  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  // ─── Relations ──────────────────────────────────────────────────────────────

  @AutoMap(() => UserEntity)
  @ManyToOne(() => UserEntity, (user) => user.activityLogs, { nullable: true })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: `FK__${ECoreTableName.ActivityLogs}__${ECoreTableName.Users}`,
  })
  public user?: UserEntity;

  @AutoMap(() => OrganizationEntity)
  @ManyToOne(() => OrganizationEntity)
  @JoinColumn({
    name: 'organization_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: `FK__${ECoreTableName.ActivityLogs}__${ECoreTableName.Organizations}`,
  })
  public organization: OrganizationEntity;

  @AutoMap(() => LocationEntity)
  @ManyToOne(() => LocationEntity, { nullable: true })
  @JoinColumn({
    name: 'location_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: `FK__${ECoreTableName.ActivityLogs}__${ECoreTableName.Locations}`,
  })
  public location?: LocationEntity;
}
