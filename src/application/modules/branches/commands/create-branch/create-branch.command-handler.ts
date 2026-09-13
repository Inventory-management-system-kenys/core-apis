import { Inject } from '@nestjs/common';
import { ICommandHandler } from '@nestjs/cqrs';
import { InjectMapper } from '@automapper/nestjs';
import { Mapper } from '@automapper/core';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CommandHandlerStrict } from '../../../../../common';
import { EActivityAction } from '../../../../../infrastructure/persistence/entities/activity-log.entity';
import { BRANCH_REPO, LOCATION_REPO } from '../../../../constants';
import { ActivityLogService } from '../../../../shared';
import { Branch } from '../../domain';
import { IBranchRepo } from '../..';
import { ILocationRepo } from '../../../locations';
import { assignLocationsToBranch, loadBranchLocationIds } from '../../helpers/branch-location.util';
import { CreateBranchCommand } from './create-branch.command';

@CommandHandlerStrict(CreateBranchCommand)
export class CreateBranchCommandHandler implements ICommandHandler<CreateBranchCommand, Branch> {
  constructor(
    @Inject(BRANCH_REPO) private readonly repo: IBranchRepo,
    @Inject(LOCATION_REPO) private readonly locationRepo: ILocationRepo,
    private readonly activityLog: ActivityLogService,
    @InjectMapper() private readonly mapper: Mapper,
    @InjectPinoLogger(CreateBranchCommandHandler.name) private readonly logger: PinoLogger,
  ) {}

  public async execute(command: CreateBranchCommand): Promise<Branch> {
    this.logger.info(`Executing ${CreateBranchCommand.name}`);
    const branch = this.mapper.map(command, CreateBranchCommand, Branch);
    branch.isActive = true;
    const created = await this.repo.createAsync(branch);

    if (command.locationIds?.length) {
      await assignLocationsToBranch(this.locationRepo, {
        branchId: created.id,
        organizationId: command.organizationId,
        locationIds: command.locationIds,
      });
    }

    created.locationIds = await loadBranchLocationIds(this.locationRepo, created.id);
    this.activityLog.record({
      action: EActivityAction.BranchCreated,
      entityType: 'Branch',
      entityId: created.id,
      organizationId: command.organizationId,
      metadata: { name: created.name },
    });
    return created;
  }
}
