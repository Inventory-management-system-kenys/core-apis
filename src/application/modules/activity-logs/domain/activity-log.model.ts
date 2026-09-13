import { AutoMap } from '@automapper/classes';
import { EActivityAction } from '../../../../infrastructure/persistence/entities/activity-log.entity';

export class ActivityLog {
  @AutoMap() public id: string;
  @AutoMap() public organizationId: string;
  @AutoMap() public userId?: string;
  @AutoMap() public locationId?: string;
  @AutoMap(() => String) public action: EActivityAction;
  @AutoMap() public entityType?: string;
  @AutoMap() public entityId?: string;
  @AutoMap() public actorName?: string;
  @AutoMap() public ipAddress?: string;
  @AutoMap() public userAgent?: string;
  @AutoMap() public metadata?: Record<string, unknown>;
  @AutoMap(() => Date) public createdAt?: Date;
}
