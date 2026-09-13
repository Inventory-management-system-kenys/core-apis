import { Module } from '@nestjs/common';
import { ActivityLogService } from './services/activity-log.service';
import { ProductActivityLogger } from './services/product-activity-logger.service';
import { StockOrchestrationService } from './services/stock-orchestration.service';
import { BillCompletionService } from './services/bill-completion.service';
import { OrderDispatchPaymentService } from './services/order-dispatch-payment.service';

const PROVIDERS = [ActivityLogService, ProductActivityLogger, StockOrchestrationService, BillCompletionService, OrderDispatchPaymentService];

@Module({
  providers: PROVIDERS,
  exports:   PROVIDERS,
})
export class SharedModule {}
