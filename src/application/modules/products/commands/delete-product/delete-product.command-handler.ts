import { Inject } from '@nestjs/common';
import { ICommandHandler } from '@nestjs/cqrs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CommandHandlerStrict } from 'src/common';
import { PRODUCT_REPO } from '../../../../constants';
import { IProductRepo } from '../..';
import { EProductLogAction } from 'src/application/shared/enums/e-product-log-action.enum';
import { ActivityLogService, ProductActivityLogger, ProductLogEntry } from 'src/application/shared';
import { EActivityAction } from 'src/infrastructure/persistence/entities/activity-log.entity';
import { DeleteProductCommand } from './delete-product.command';

@CommandHandlerStrict(DeleteProductCommand)
export class DeleteProductCommandHandler implements ICommandHandler<DeleteProductCommand, boolean> {
  constructor(
    @Inject(PRODUCT_REPO) private readonly repo: IProductRepo,
    private readonly activityLogger: ProductActivityLogger,
    private readonly activityLog: ActivityLogService,
    @InjectPinoLogger(DeleteProductCommandHandler.name) private readonly logger: PinoLogger,
  ) {}

  public async execute(command: DeleteProductCommand): Promise<boolean> {
    this.logger.info(`Executing ${DeleteProductCommand.name} id=${command.id}`);
    const product = await this.repo.getAsync(command.id);
    await this.repo.deleteAsync(command.id);
    const entry = Object.assign(new ProductLogEntry(), {
      action:         EProductLogAction.ProductDisabled,
      organizationId: product.organizationId,
      productId:      product.id,
    });
    await this.activityLogger.log(entry);
    this.activityLog.record({
      action: EActivityAction.ProductDeleted,
      entityType: 'Product',
      entityId: product.id,
      organizationId: product.organizationId,
    });
    return true;
  }
}
