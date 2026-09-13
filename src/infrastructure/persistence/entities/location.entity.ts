import { AutoMap } from '@automapper/classes';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CORE_SCHEMA, ECoreTableName } from './e-core-table-name';
import { OrganizationEntity } from './organization.entity';
import { BranchEntity } from './branch.entity';
import { InventoryEntity } from './inventory.entity';
import { StockMovementEntity } from './stock-movement.entity';

const PK_NAME = 'PK_' + ECoreTableName.Locations;

export enum ELocationType {
  Store     = 'store',
  Warehouse = 'warehouse',
  Branch    = 'branch',
}

@Entity({ schema: CORE_SCHEMA, name: ECoreTableName.Locations })
export class LocationEntity {
  @AutoMap()
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: PK_NAME })
  public id: string;

  @AutoMap()
  @Column({ name: 'organization_id', type: 'uuid' })
  public organizationId: string;

  @AutoMap()
  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  public branchId?: string;

  @AutoMap()
  @Column({ type: 'varchar', length: 150 })
  public name: string;

  @AutoMap(() => String)
  @Column({ type: 'enum', enum: ELocationType })
  public type: ELocationType;

  @AutoMap()
  @Column({ name: 'image_key', type: 'varchar', length: 500, nullable: true })
  public imageKey?: string;

  @AutoMap()
  @Column({ type: 'varchar', length: 300, nullable: true })
  public address?: string;

  @AutoMap()
  @Column({ type: 'varchar', length: 100, nullable: true })
  public city?: string;

  @AutoMap()
  @Column({ type: 'varchar', length: 100, nullable: true })
  public state?: string;

  @AutoMap()
  @Column({ type: 'varchar', length: 100, nullable: true })
  public country?: string;

  @AutoMap()
  @Column({ type: 'varchar', length: 50, nullable: true })
  public phone?: string;

  @AutoMap()
  @Column({ name: 'is_active', type: 'boolean', default: true })
  public isActive: boolean;

  @AutoMap(() => Date)
  @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @AutoMap(() => Date)
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true, onUpdate: 'CURRENT_TIMESTAMP' })
  public updatedAt?: Date;

  @AutoMap(() => Date)
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  public deletedAt?: Date;

  // ─── Relations ──────────────────────────────────────────────────────────────

  @AutoMap(() => OrganizationEntity)
  @ManyToOne(() => OrganizationEntity)
  @JoinColumn({
    name: 'organization_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: `FK__${ECoreTableName.Locations}__${ECoreTableName.Organizations}`,
  })
  public organization: OrganizationEntity;

  @AutoMap(() => BranchEntity)
  @ManyToOne(() => BranchEntity, (branch) => branch.locations, { nullable: true })
  @JoinColumn({
    name: 'branch_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: `FK__${ECoreTableName.Locations}__${ECoreTableName.Branches}`,
  })
  public branch?: BranchEntity;

  @AutoMap(() => [InventoryEntity])
  @OneToMany(() => InventoryEntity, (inv) => inv.location)
  public inventory?: InventoryEntity[];

  @AutoMap(() => [StockMovementEntity])
  @OneToMany(() => StockMovementEntity, (sm) => sm.location)
  public stockMovements?: StockMovementEntity[];
}
