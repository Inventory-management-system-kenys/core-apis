import { Mapper } from '@automapper/core';
import { InjectMapper } from '@automapper/nestjs';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';
import { BaseRepo, Filter, PageableFilter } from '../../../common';
import { ActivityLogEntity } from '../entities';
import { ActivityLog } from '../../../application/modules/activity-logs/domain';
import { IActivityLogRepo, ActivityLogFilter, ActivityLogFilteredQuery } from '../../../application/modules/activity-logs';

const PAGE_LIMIT = 50;

@Injectable()
export class ActivityLogRepo extends BaseRepo<ActivityLogEntity, ActivityLog, string, PageableFilter<ActivityLogFilter>, Filter<ActivityLogFilter>> implements IActivityLogRepo {
  constructor(
    @InjectRepository(ActivityLogEntity) internalRepo: Repository<ActivityLogEntity>,
    @InjectMapper() mapper: Mapper,
    @InjectPinoLogger(ActivityLogRepo.name) logger: PinoLogger,
  ) {
    super(internalRepo, mapper, logger, ActivityLogEntity, ActivityLog);
  }

  public override get idColumnName(): keyof ActivityLogEntity {
    return 'id';
  }

  public async listFilteredAsync(query: ActivityLogFilteredQuery): Promise<{ data: ActivityLog[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(PAGE_LIMIT, Math.max(1, query.limit ?? PAGE_LIMIT));
    const qb = this.internalRepo
      .createQueryBuilder('log')
      .where('log.organizationId = :orgId', { orgId: query.organizationId })
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.action?.length) {
      qb.andWhere('log.action IN (:...actions)', { actions: query.action });
    }
    if (query.userId) {
      qb.andWhere('log.userId = :userId', { userId: query.userId });
    }
    if (query.dateFrom) {
      qb.andWhere('log.createdAt >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }
    if (query.dateTo) {
      qb.andWhere('log.createdAt <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    const [entities, total] = await qb.getManyAndCount();
    return { data: entities.map((e) => this.mapper.map(e, ActivityLogEntity, ActivityLog)), total };
  }

  public async listAllForExportAsync(query: ActivityLogFilteredQuery): Promise<ActivityLog[]> {
    const qb = this.internalRepo
      .createQueryBuilder('log')
      .where('log.organizationId = :orgId', { orgId: query.organizationId })
      .orderBy('log.createdAt', 'DESC')
      .take(5000);

    if (query.action?.length) {
      qb.andWhere('log.action IN (:...actions)', { actions: query.action });
    }
    if (query.userId) {
      qb.andWhere('log.userId = :userId', { userId: query.userId });
    }
    if (query.dateFrom) {
      qb.andWhere('log.createdAt >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }
    if (query.dateTo) {
      qb.andWhere('log.createdAt <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    const entities = await qb.getMany();
    return entities.map((e) => this.mapper.map(e, ActivityLogEntity, ActivityLog));
  }
}
