import { Inject } from '@nestjs/common';
import { ICommandHandler } from '@nestjs/cqrs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CommandHandlerStrict } from '../../../../../common';
import { EActivityAction } from '../../../../../infrastructure/persistence/entities/activity-log.entity';
import { USER_REPO } from '../../../../constants';
import { ActivityLogService } from '../../../../shared';
import { User } from '../../domain';
import { IUserRepo } from '../..';
import { CreateUserCommand } from './create-user.command';

@CommandHandlerStrict(CreateUserCommand)
export class CreateUserCommandHandler implements ICommandHandler<CreateUserCommand, User> {
  constructor(
    @Inject(USER_REPO) private readonly repo: IUserRepo,
    private readonly activityLog: ActivityLogService,
    @InjectPinoLogger(CreateUserCommandHandler.name) private readonly logger: PinoLogger,
  ) {}

  public async execute(command: CreateUserCommand): Promise<User> {
    this.logger.info(`Executing ${CreateUserCommand.name}`);
    const created = await this.repo.createAsync(command as never);
    this.activityLog.record({
      action: EActivityAction.UserCreated,
      entityType: 'User',
      entityId: created.id,
      organizationId: command.organizationId,
      metadata: { email: created.email },
    });
    return created;
  }
}
