import { Inject, NotFoundException } from '@nestjs/common';
import { ICommandHandler } from '@nestjs/cqrs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CommandHandlerStrict } from '../../../../../common';
import { BILL_REPO, CUSTOMER_REPO, LOCATION_REPO, ORDER_ITEM_REPO, ORDER_REPO } from '../../../../constants';
import { Order, OrderItem } from '../../domain';
import { IOrderRepo } from '../..';
import { IOrderItemRepo } from '../../i-order-item.repo';
import { CreateOrderCommand } from './create-order.command';
import { OrdersMailService } from '../../mail';
import { IPushNotificationService, PUSH_NOTIFICATION_SERVICE } from '../../../../../common';
import { BillCompletionService, CreditLimitExceededError } from '../../../../shared/services/bill-completion.service';
import { IBillRepo } from '../../../bills';
import { Bill } from '../../../bills/domain';
import { generateBillNumber } from '../../../bills/helpers';
import { EBillStatus, EPaymentMethod, EPaymentTiming, ESaleType } from '../../../../../infrastructure/persistence/entities';
import { EOrderStatus } from '../../../../shared/enums/e-order-status';
import { EFulfillmentMode } from '../../../../shared/enums/e-fulfillment-mode';
import { ILocationRepo } from '../../../locations';

@CommandHandlerStrict(CreateOrderCommand)
export class CreateOrderCommandHandler implements ICommandHandler<CreateOrderCommand, Order> {
  constructor(
    @Inject(ORDER_REPO) private readonly repo: IOrderRepo,
    @Inject(ORDER_ITEM_REPO) private readonly itemRepo: IOrderItemRepo,
    @Inject(LOCATION_REPO) private readonly locationRepo: ILocationRepo,
    @Inject(BILL_REPO) private readonly billRepo: IBillRepo,
    private readonly billCompletionService: BillCompletionService,
    @Inject(CUSTOMER_REPO) private readonly customerRepo: { getAsync: (id: string) => Promise<{ email?: string; name?: string } | null> },
    private readonly mailService: OrdersMailService,
    @Inject(PUSH_NOTIFICATION_SERVICE) private readonly pushService: IPushNotificationService,
    @InjectPinoLogger(CreateOrderCommandHandler.name) private readonly logger: PinoLogger,
  ) {}

  public async execute(command: CreateOrderCommand): Promise<Order> {
    this.logger.info(`Executing ${CreateOrderCommand.name}`);

    const sellingLocation = await this.locationRepo.getAsync(command.locationId);
    if (!sellingLocation) {
      throw new NotFoundException(`Location ${command.locationId} not found`);
    }

    const fulfillmentLocationId = command.fulfillmentLocationId ?? command.locationId;
    const orderData = {
      ...command,
      organizationId: sellingLocation.organizationId,
      fulfillmentLocationId,
      fulfillmentMode: command.fulfillmentMode ?? EFulfillmentMode.Delivery,
      status: command.status ?? EOrderStatus.Confirmed,
      orderNumber: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      items: undefined,
    };

    const order = await this.repo.createAsync(orderData as never);

    const savedItems: OrderItem[] = [];
    for (const input of command.items ?? []) {
      const taxAmount = Number(input.taxAmount ?? 0);
      const lineTotal = Number(input.quantity) * Number(input.unitPrice) + taxAmount;
      const item = new OrderItem();
      item.orderId = order.id;
      item.productId = input.productId;
      item.quantity = input.quantity;
      item.unitPrice = input.unitPrice;
      item.taxAmount = taxAmount;
      item.lineTotal = lineTotal;
      item.packQuantity = input.packQuantity;
      item.packSizeSnapshot = input.packSizeSnapshot;
      savedItems.push(await this.itemRepo.createAsync(item));
    }

    order.items = savedItems;

    try {
      await this.createOrderBillAsync(order, sellingLocation.organizationId, command);
    } catch (err) {
      if (err instanceof CreditLimitExceededError) throw err;
      this.logger.warn({ error: (err as Error).message }, 'Auto-bill creation failed — non-fatal');
    }
    await this.sendOrderConfirmedAsync(order).catch((err: Error) =>
      this.logger.warn({ error: err.message }, 'Order confirmed mail failed — non-fatal'),
    );
    await this.sendOrderPushAsync(order).catch((err: Error) =>
      this.logger.warn({ error: err.message }, 'Order push notification failed — non-fatal'),
    );

    return { ...order, items: savedItems };
  }

  private async createOrderBillAsync(order: Order, organizationId: string, command: CreateOrderCommand): Promise<void> {
    if (!order.locationId) return;
    const bill = new Bill();
    bill.billNumber = generateBillNumber();
    bill.organizationId = organizationId;
    bill.locationId = order.locationId;
    bill.customerId = order.customerId;
    bill.sourceOrderId = order.id;
    bill.status = EBillStatus.Initiated;
    bill.saleType = command.saleType ?? ESaleType.Normal;
    bill.customerType = command.customerType;
    bill.paymentTiming = command.paymentTiming ?? EPaymentTiming.Cod;
    if (bill.paymentTiming === EPaymentTiming.Cod) {
      bill.paymentMethod = EPaymentMethod.Cash;
    }
    bill.partialAmount = command.paymentTiming === EPaymentTiming.Half ? command.partialAmount : undefined;
    bill.subtotal = Number(order.subtotal ?? order.totalAmount ?? 0);
    bill.taxAmount = Number(order.taxAmount ?? 0);
    bill.discountAmount = 0;
    bill.totalAmount = Number(order.totalAmount ?? 0);
    bill.blackAmount = 0;
    bill.commissionAmount = 0;
    const saved = await this.billRepo.createAsync(bill);

    if (command.performedById && saved.saleType === ESaleType.Credit) {
      await this.billCompletionService.assertCreditLimitForBill(saved, command.performedById);
    }
  }

  private async sendOrderConfirmedAsync(order: Order): Promise<void> {
    if (!order.customerId) return;
    const customer = await this.customerRepo.getAsync(order.customerId);
    if (!customer?.email) return;

    const fmt = (n: number): string =>
      new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n));

    await this.mailService.sendTemplatedAsync(customer.email, 'order-confirmed', {
      customerName: customer.name ?? 'Valued Customer',
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: fmt(order.totalAmount),
      createdAt: order.createdAt?.toLocaleDateString('en-IN') ?? new Date().toLocaleDateString('en-IN'),
    });
  }

  private async sendOrderPushAsync(order: Order): Promise<void> {
    if (!order.organizationId) return;
    await this.pushService.broadcastToOrgAsync(
      order.organizationId,
      'ORDER_CREATED',
      `New order ${order.orderNumber}`,
      `Order placed — total ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(order.totalAmount))}`,
      { orderId: order.id },
    );
  }
}
