import { AutoMap } from '@automapper/classes';
import { QueryBase } from '../../../../../common';
import { EActivityAction } from '../../../../../infrastructure/persistence/entities/activity-log.entity';

export class ExportActivityLogsQuery extends QueryBase {
  @AutoMap() public organizationId: string;
  @AutoMap() public action?: EActivityAction[];
  @AutoMap() public userId?: string;
  @AutoMap() public dateFrom?: string;
  @AutoMap() public dateTo?: string;
}
