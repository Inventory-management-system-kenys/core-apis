import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { EActivityAction } from '../../../infrastructure/persistence/entities/activity-log.entity';
import { ACTIVITY_LOG_REPO, USER_REPO } from '../../constants';
import { IActivityLogRepo } from '../../modules/activity-logs';
import { ActivityLog } from '../../modules/activity-logs/domain';
import { IUserRepo } from '../../modules/users/i-user.repo';

export interface IActivityLogEntry {
  action: EActivityAction;
  entityType: string;
  entityId?: string;
  actorId?: string;
  organizationId: string;
  locationId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ActivityLogService {
  public constructor(
    @Inject(ACTIVITY_LOG_REPO) private readonly repo: IActivityLogRepo,
    @Inject(USER_REPO) private readonly userRepo: IUserRepo,
    @InjectPinoLogger(ActivityLogService.name) private readonly logger: PinoLogger,
  ) {}

  public record(entry: IActivityLogEntry): void {
    this.saveAsync(entry).catch((err: unknown) =>
      this.logger.error({ err }, 'Failed to write activity log'),
    );
  }

  private async saveAsync(entry: IActivityLogEntry): Promise<void> {
    const actorName = await this.resolveActorNameAsync(entry.actorId);
    const log = new ActivityLog();
    log.action = entry.action;
    log.entityType = entry.entityType;
    log.entityId = entry.entityId;
    log.userId = entry.actorId;
    log.actorName = actorName;
    log.organizationId = entry.organizationId;
    log.locationId = entry.locationId;
    log.metadata = entry.metadata;
    log.ipAddress = entry.ipAddress;
    log.userAgent = entry.userAgent;
    await this.repo.createAsync(log);
  }

  private async resolveActorNameAsync(actorId?: string): Promise<string | undefined> {
    if (!actorId) return undefined;
    try {
      const user = await this.userRepo.getAsync(actorId);
      return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined;
    } catch {
      return undefined;
    }
  }
}
