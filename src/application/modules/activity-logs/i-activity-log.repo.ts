import { IBaseRepo, Filter, PageableFilter } from '../../../common';
import { EActivityAction } from '../../../infrastructure/persistence/entities/activity-log.entity';
import { ActivityLog } from './domain';

export interface ActivityLogFilter {
  organizationId?: string;
  action?: EActivityAction[];
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ActivityLogFilteredQuery {
  organizationId: string;
  action?: EActivityAction[];
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface IActivityLogRepo extends IBaseRepo<ActivityLog, string, PageableFilter<ActivityLogFilter>, Filter<ActivityLogFilter>> {
  listFilteredAsync(query: ActivityLogFilteredQuery): Promise<{ data: ActivityLog[]; total: number }>;
  listAllForExportAsync(query: ActivityLogFilteredQuery): Promise<ActivityLog[]>;
}
