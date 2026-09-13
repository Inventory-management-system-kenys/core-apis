import { Inject } from '@nestjs/common';
import { IQueryHandler } from '@nestjs/cqrs';
import { InjectMapper } from '@automapper/nestjs';
import { Mapper } from '@automapper/core';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { QueryHandlerStrict } from '../../../../../common';
import { ACTIVITY_LOG_REPO } from '../../../../constants';
import { ActivityLog } from '../../domain';
import { IActivityLogRepo } from '../..';
import { ActivityLogResponse, PaginatedActivityLogResponse } from '../../models';
import { ListActivityLogsQuery } from './list-activity-logs.query';

const DEFAULT_PAGE_LIMIT = 50;

@QueryHandlerStrict(ListActivityLogsQuery)
export class ListActivityLogsQueryHandler implements IQueryHandler<ListActivityLogsQuery, PaginatedActivityLogResponse> {
  public constructor(
    @Inject(ACTIVITY_LOG_REPO) private readonly repo: IActivityLogRepo,
    @InjectMapper() private readonly mapper: Mapper,
    @InjectPinoLogger(ListActivityLogsQueryHandler.name) private readonly logger: PinoLogger,
  ) {}

  public async execute(query: ListActivityLogsQuery): Promise<PaginatedActivityLogResponse> {
    this.logger.info(`Executing ${ListActivityLogsQuery.name}`);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(DEFAULT_PAGE_LIMIT, Math.max(1, query.limit ?? DEFAULT_PAGE_LIMIT));

    const { data, total } = await this.repo.listFilteredAsync({
      organizationId: query.organizationId,
      action: query.action,
      userId: query.userId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      page,
      limit,
    });

    return {
      data: this.mapper.mapArray(data, ActivityLog, ActivityLogResponse),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
