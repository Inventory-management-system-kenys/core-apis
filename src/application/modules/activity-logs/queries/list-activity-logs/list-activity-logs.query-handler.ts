import { Inject } from '@nestjs/common';
import { IQueryHandler } from '@nestjs/cqrs';
import { InjectMapper } from '@automapper/nestjs';
import { Mapper } from '@automapper/core';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { EOrder, QueryHandlerStrict } from '../../../../../common';
import { ACTIVITY_LOG_REPO } from '../../../../constants';
import { ActivityLog } from '../../domain';
import { IActivityLogRepo } from '../..';
import { ActivityLogResponse } from '../../models';
import { ListActivityLogsQuery } from './list-activity-logs.query';

@QueryHandlerStrict(ListActivityLogsQuery)
export class ListActivityLogsQueryHandler implements IQueryHandler<ListActivityLogsQuery, ActivityLogResponse[]> {
  public constructor(
    @Inject(ACTIVITY_LOG_REPO) private readonly repo: IActivityLogRepo,
    @InjectMapper() private readonly mapper: Mapper,
    @InjectPinoLogger(ListActivityLogsQueryHandler.name) private readonly logger: PinoLogger,
  ) {}

  public async execute(query: ListActivityLogsQuery): Promise<ActivityLogResponse[]> {
    this.logger.info(`Executing ${ListActivityLogsQuery.name}`);
    const items = await this.repo.allAsync({
      organizationId: query.organizationId,
      $orderBy: 'createdAt',
      $order: EOrder.Desc,
    });
    return this.mapper.mapArray(items, ActivityLog, ActivityLogResponse);
  }
}
