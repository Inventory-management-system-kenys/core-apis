import { Inject } from '@nestjs/common';
import type { ICommandHandler } from '@nestjs/cqrs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { CommandHandlerStrict } from '../../../../../common';
import { REPORT_GENERATION_LOG_REPO, IReportGenerationLogRepo } from '../../i-report-generation-log.repo';
import { ReportGenerationLog, EReportType, EReportPeriod, REPORT_TYPE_LABELS } from '../../domain';
import { GenerateReportCommand } from './generate-report.command';

interface TemplateContext {
  title: string;
  description: string;
  reportPeriod: string;
  fromDateLabel: string;
  toDateLabel: string;
  orgId: string;
  reportType: string;
  fromDate: string;
  toDate: string;
  note?: string;
  formattedValue?: string;
  summaryCards?: Array<{ label: string; value: string }>;
  tableHeaders?: string[];
  tableRows?: string[][];
}

type QueryRunner = ReturnType<DataSource['createQueryRunner']>;

@CommandHandlerStrict(GenerateReportCommand)
export class GenerateReportCommandHandler implements ICommandHandler<GenerateReportCommand, ReportGenerationLog> {
  constructor(
    @Inject(REPORT_GENERATION_LOG_REPO) private readonly repo: IReportGenerationLogRepo,
    @Inject(DataSource) private readonly dataSource: DataSource,
    @InjectPinoLogger(GenerateReportCommandHandler.name) private readonly logger: PinoLogger,
  ) {}

  public async execute(command: GenerateReportCommand): Promise<ReportGenerationLog> {
    this.logger.info(`Executing Command "${GenerateReportCommand.name}"`);

    const fromDate = new Date(command.fromDate);
    const toDate   = new Date(command.toDate);
    toDate.setHours(23, 59, 59, 999);

    const reportName = this.buildReportName(command.reportType, command.reportPeriod, fromDate, toDate);

    const log            = new ReportGenerationLog();
    log.orgId            = command.orgId;
    log.reportType       = command.reportType;
    log.reportPeriod     = command.reportPeriod;
    log.reportName       = reportName;
    log.fromDate         = fromDate;
    log.toDate           = toDate;
    log.locationId       = command.locationId;
    log.generatedById    = command.generatedById;
    log.status           = 'PROCESSING';

    const saved = await this.repo.createAsync(log);

    try {
      const ctx = await this.buildTemplateContext(command, fromDate, toDate, reportName);

      const updatable        = new ReportGenerationLog();
      updatable.id           = saved.id;
      updatable.status       = 'COMPLETED';
      updatable.reportData   = ctx as unknown as Record<string, unknown>;

      return this.repo.updateAsync(updatable);
    } catch (err) {
      const error = err as Error;
      this.logger.error({ err: error.message }, 'Report aggregation failed');

      const updatable          = new ReportGenerationLog();
      updatable.id             = saved.id;
      updatable.status         = 'FAILED';
      updatable.errorMessage   = error.message;

      return this.repo.updateAsync(updatable);
    }
  }

  private buildReportName(type: EReportType, period: EReportPeriod, from: Date, to: Date): string {
    const label = REPORT_TYPE_LABELS[type] ?? type;
    const fmt   = (dt: Date): string => dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    switch (period) {
      case EReportPeriod.Daily:   return `${label} — Daily (${fmt(from)})`;
      case EReportPeriod.Monthly: return `${label} — ${from.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
      case EReportPeriod.Yearly:  return `${label} — FY ${from.getFullYear()}–${to.getFullYear()}`;
      case EReportPeriod.Custom:  return `${label} — ${fmt(from)} to ${fmt(to)}`;
    }
  }

  private fmt(dt: Date): string {
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private inr(value: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
  }

  private async buildTemplateContext(
    command: GenerateReportCommand,
    from: Date,
    to: Date,
    reportName: string,
  ): Promise<TemplateContext> {
    const orgId      = command.orgId;
    const locationId = command.locationId ?? null;
    const qr         = this.dataSource.createQueryRunner();
    await qr.connect();

    const locFilter     = locationId ? `AND location_id = '${locationId}'` : '';
    const locBillFilter = locationId ? `AND b.location_id = '${locationId}'` : '';
    const fromIso       = from.toISOString();
    const toIso         = to.toISOString();

    const base: Omit<TemplateContext, 'formattedValue' | 'tableHeaders' | 'tableRows' | 'summaryCards' | 'note'> = {
      title:         reportName,
      description:   REPORT_TYPE_DESCRIPTIONS[command.reportType] ?? '',
      reportPeriod:  command.reportPeriod,
      fromDateLabel: this.fmt(from),
      toDateLabel:   this.fmt(to),
      orgId,
      reportType:    command.reportType,
      fromDate:      fromIso,
      toDate:        toIso,
    };

    try {
      switch (command.reportType) {
        case EReportType.TotalSales:
          return this.buildSalesReport(qr, orgId, locBillFilter, fromIso, toIso, '', 'Total Bills', base);

        case EReportType.CashSales:
          return this.buildSalesReport(qr, orgId, locBillFilter, fromIso, toIso, "AND b.payment_method='CASH'", 'Cash Bills', base);

        case EReportType.CreditSales:
          return this.buildSalesReport(qr, orgId, locBillFilter, fromIso, toIso, "AND b.sale_type='credit'", 'Credit Bills', base);

        case EReportType.TotalBills: {
          const val = Number(await this.scalar(qr, `SELECT COUNT(*) FROM core.bills WHERE organization_id='${orgId}' AND status='COMPLETED' ${locBillFilter} AND billed_at BETWEEN '${fromIso}' AND '${toIso}'`));
          return { ...base, formattedValue: String(val) };
        }

        case EReportType.AverageBillValue: {
          const total = Number(await this.scalar(qr, `SELECT COALESCE(SUM(total_amount),0) FROM core.bills WHERE organization_id='${orgId}' AND status='COMPLETED' ${locBillFilter} AND billed_at BETWEEN '${fromIso}' AND '${toIso}'`));
          const count = Number(await this.scalar(qr, `SELECT COUNT(*) FROM core.bills WHERE organization_id='${orgId}' AND status='COMPLETED' ${locBillFilter} AND billed_at BETWEEN '${fromIso}' AND '${toIso}'`));
          return { ...base, formattedValue: this.inr(count > 0 ? total / count : 0) };
        }

        case EReportType.TimeWiseSales: {
          const rows = await qr.query(`SELECT EXTRACT(HOUR FROM billed_at) AS hour, COALESCE(SUM(total_amount),0) AS total FROM core.bills WHERE organization_id='${orgId}' AND status='COMPLETED' ${locBillFilter} AND billed_at BETWEEN '${fromIso}' AND '${toIso}' GROUP BY hour ORDER BY hour`) as Array<Record<string, unknown>>;
          return { ...base, tableHeaders: ['Hour', 'Total Sales'], tableRows: rows.map(rr => [`${rr['hour']}:00`, this.inr(Number(rr['total']))]) };
        }

        case EReportType.TopSellingProducts: {
          const rows = await qr.query(`SELECT bi.product_id, SUM(bi.quantity) AS qty_sold, SUM(bi.line_total) AS revenue FROM core.bill_items bi JOIN core.bills b ON b.id = bi.bill_id WHERE b.organization_id='${orgId}' AND b.status='COMPLETED' ${locBillFilter} AND b.billed_at BETWEEN '${fromIso}' AND '${toIso}' GROUP BY bi.product_id ORDER BY qty_sold DESC LIMIT 20`) as Array<Record<string, unknown>>;
          return { ...base, tableHeaders: ['Product ID', 'Qty Sold', 'Revenue'], tableRows: rows.map(rr => [String(rr['product_id']), String(rr['qty_sold']), this.inr(Number(rr['revenue']))]) };
        }

        case EReportType.SlowMovingProducts: {
          const rows = await qr.query(`SELECT bi.product_id, COALESCE(SUM(bi.quantity),0) AS qty_sold FROM core.bill_items bi JOIN core.bills b ON b.id = bi.bill_id WHERE b.organization_id='${orgId}' AND b.status='COMPLETED' ${locBillFilter} AND b.billed_at BETWEEN '${fromIso}' AND '${toIso}' GROUP BY bi.product_id ORDER BY qty_sold ASC LIMIT 20`) as Array<Record<string, unknown>>;
          return { ...base, tableHeaders: ['Product ID', 'Qty Sold'], tableRows: rows.map(rr => [String(rr['product_id']), String(rr['qty_sold'])]) };
        }

        case EReportType.TotalExpense: {
          const val = Number(await this.scalar(qr, `SELECT COALESCE(SUM(amount),0) FROM core.expenses WHERE org_id='${orgId}' ${locFilter} AND expense_date BETWEEN '${fromIso}' AND '${toIso}'`));
          return { ...base, formattedValue: this.inr(val) };
        }

        case EReportType.ShopExpense: {
          const val = Number(await this.scalar(qr, `SELECT COALESCE(SUM(amount),0) FROM core.expenses WHERE org_id='${orgId}' AND category='shop' ${locFilter} AND expense_date BETWEEN '${fromIso}' AND '${toIso}'`));
          return { ...base, formattedValue: this.inr(val) };
        }

        case EReportType.OtherExpense: {
          const val = Number(await this.scalar(qr, `SELECT COALESCE(SUM(amount),0) FROM core.expenses WHERE org_id='${orgId}' AND category != 'shop' ${locFilter} AND expense_date BETWEEN '${fromIso}' AND '${toIso}'`));
          return { ...base, formattedValue: this.inr(val) };
        }

        case EReportType.OpeningCash: {
          const val = Number(await this.scalar(qr, `SELECT COALESCE(SUM(amount),0) FROM core.payment_transactions WHERE org_id='${orgId}' AND method='CASH' AND type='payment' AND status='completed' AND created_at < '${fromIso}'`));
          return { ...base, formattedValue: this.inr(val) };
        }

        case EReportType.ClosingCash: {
          const val = Number(await this.scalar(qr, `SELECT COALESCE(SUM(amount),0) FROM core.payment_transactions WHERE org_id='${orgId}' AND method='CASH' AND type='payment' AND status='completed' AND created_at <= '${toIso}'`));
          return { ...base, formattedValue: this.inr(val) };
        }

        case EReportType.TotalPurchase: {
          const val = Number(await this.scalar(qr, `SELECT COALESCE(SUM(total_amount),0) FROM core.purchase_orders WHERE organization_id='${orgId}' AND status IN ('received','partially_received') AND created_at BETWEEN '${fromIso}' AND '${toIso}'`));
          return { ...base, formattedValue: this.inr(val) };
        }

        case EReportType.PurchaseReturn: {
          const val = Number(await this.scalar(qr, `SELECT COALESCE(SUM(total_amount),0) FROM core.item_returns WHERE return_type='supplier' AND created_at BETWEEN '${fromIso}' AND '${toIso}'`));
          return { ...base, formattedValue: this.inr(val) };
        }

        case EReportType.TotalProfit: {
          const sales = Number(await this.scalar(qr, `SELECT COALESCE(SUM(total_amount),0) FROM core.bills WHERE organization_id='${orgId}' AND status='COMPLETED' ${locBillFilter} AND billed_at BETWEEN '${fromIso}' AND '${toIso}'`));
          const cost  = Number(await this.scalar(qr, `SELECT COALESCE(SUM(bi.quantity * p.cost_price),0) FROM core.bill_items bi JOIN core.bills b ON b.id=bi.bill_id JOIN core.products p ON p.id=bi.product_id WHERE b.organization_id='${orgId}' AND b.status='COMPLETED' ${locBillFilter} AND b.billed_at BETWEEN '${fromIso}' AND '${toIso}'`));
          return { ...base, formattedValue: this.inr(sales - cost), summaryCards: [{ label: 'Revenue', value: this.inr(sales) }, { label: 'COGS', value: this.inr(cost) }, { label: 'Gross Profit', value: this.inr(sales - cost) }] };
        }

        case EReportType.NetProfit: {
          const sales    = Number(await this.scalar(qr, `SELECT COALESCE(SUM(total_amount),0) FROM core.bills WHERE organization_id='${orgId}' AND status='COMPLETED' ${locBillFilter} AND billed_at BETWEEN '${fromIso}' AND '${toIso}'`));
          const cost     = Number(await this.scalar(qr, `SELECT COALESCE(SUM(bi.quantity * p.cost_price),0) FROM core.bill_items bi JOIN core.bills b ON b.id=bi.bill_id JOIN core.products p ON p.id=bi.product_id WHERE b.organization_id='${orgId}' AND b.status='COMPLETED' ${locBillFilter} AND b.billed_at BETWEEN '${fromIso}' AND '${toIso}'`));
          const expenses = Number(await this.scalar(qr, `SELECT COALESCE(SUM(amount),0) FROM core.expenses WHERE org_id='${orgId}' ${locFilter} AND expense_date BETWEEN '${fromIso}' AND '${toIso}'`));
          return { ...base, formattedValue: this.inr(sales - cost - expenses), summaryCards: [{ label: 'Revenue', value: this.inr(sales) }, { label: 'COGS', value: this.inr(cost) }, { label: 'Expenses', value: this.inr(expenses) }, { label: 'Net Profit', value: this.inr(sales - cost - expenses) }] };
        }

        case EReportType.ClosingStock: {
          const rows = await qr.query(`SELECT inv.product_id, inv.location_id, inv.quantity_on_hand FROM core.inventory inv WHERE inv.organization_id='${orgId}' ${locationId ? `AND inv.location_id='${locationId}'` : ''} ORDER BY inv.quantity_on_hand DESC LIMIT 50`) as Array<Record<string, unknown>>;
          const total = rows.reduce((acc, rr) => acc + Number(rr['quantity_on_hand'] ?? 0), 0);
          return { ...base, formattedValue: String(Math.round(total)), summaryCards: [{ label: 'Total Items', value: String(rows.length) }, { label: 'Total Qty', value: String(Math.round(total)) }], tableHeaders: ['Product ID', 'Location ID', 'Qty On Hand'], tableRows: rows.map(rr => [String(rr['product_id']), String(rr['location_id']), String(rr['quantity_on_hand'])]) };
        }

        case EReportType.LowStockItems: {
          const rows = await qr.query(`SELECT inv.product_id, inv.location_id, inv.quantity_on_hand, inv.reorder_level FROM core.inventory inv WHERE inv.organization_id='${orgId}' AND inv.quantity_on_hand <= inv.reorder_level AND inv.reorder_level > 0 ${locationId ? `AND inv.location_id='${locationId}'` : ''} ORDER BY (inv.quantity_on_hand - inv.reorder_level) ASC`) as Array<Record<string, unknown>>;
          return { ...base, formattedValue: String(rows.length), tableHeaders: ['Product ID', 'Location', 'Qty On Hand', 'Reorder Level'], tableRows: rows.map(rr => [String(rr['product_id']), String(rr['location_id']), String(rr['quantity_on_hand']), String(rr['reorder_level'])]) };
        }

        case EReportType.OutOfStockItems: {
          const rows = await qr.query(`SELECT inv.product_id, inv.location_id FROM core.inventory inv WHERE inv.organization_id='${orgId}' AND inv.quantity_on_hand <= 0 ${locationId ? `AND inv.location_id='${locationId}'` : ''}`) as Array<Record<string, unknown>>;
          return { ...base, formattedValue: String(rows.length), tableHeaders: ['Product ID', 'Location ID'], tableRows: rows.map(rr => [String(rr['product_id']), String(rr['location_id'])]) };
        }

        case EReportType.DamagedStock: {
          const rows = await qr.query(`SELECT sm.product_id, sm.location_id, SUM(sm.quantity) AS qty_damaged FROM core.stock_movements sm WHERE sm.movement_type='damage' ${locationId ? `AND sm.location_id='${locationId}'` : ''} AND sm.created_at BETWEEN '${fromIso}' AND '${toIso}' GROUP BY sm.product_id, sm.location_id`) as Array<Record<string, unknown>>;
          const total = rows.reduce((acc, rr) => acc + Number(rr['qty_damaged'] ?? 0), 0);
          return { ...base, formattedValue: String(Math.round(total)), tableHeaders: ['Product ID', 'Location', 'Qty Damaged'], tableRows: rows.map(rr => [String(rr['product_id']), String(rr['location_id']), String(rr['qty_damaged'])]) };
        }

        case EReportType.ReturnedItems: {
          const rows = await qr.query(`SELECT ir.id, ir.return_type, ir.total_amount, ir.created_at FROM core.item_returns ir WHERE ir.created_at BETWEEN '${fromIso}' AND '${toIso}' ORDER BY ir.created_at DESC LIMIT 50`) as Array<Record<string, unknown>>;
          const total = rows.reduce((acc, rr) => acc + Number(rr['total_amount'] ?? 0), 0);
          return { ...base, formattedValue: this.inr(total), tableHeaders: ['Return ID', 'Type', 'Amount', 'Date'], tableRows: rows.map(rr => [String(rr['id']).substring(0, 8) + '...', String(rr['return_type']), this.inr(Number(rr['total_amount'])), new Date(String(rr['created_at'])).toLocaleDateString('en-IN')]) };
        }

        case EReportType.TotalCustomers: {
          const val = Number(await this.scalar(qr, `SELECT COUNT(DISTINCT customer_id) FROM core.bills WHERE organization_id='${orgId}' AND status='COMPLETED' ${locBillFilter} AND billed_at BETWEEN '${fromIso}' AND '${toIso}'`));
          return { ...base, formattedValue: String(val) };
        }

        case EReportType.NewCustomers: {
          const val = Number(await this.scalar(qr, `SELECT COUNT(*) FROM core.customers WHERE organization_id='${orgId}' AND created_at BETWEEN '${fromIso}' AND '${toIso}'`));
          return { ...base, formattedValue: String(val) };
        }

        case EReportType.RepeatCustomers: {
          const val = Number(await this.scalar(qr, `SELECT COUNT(*) FROM (SELECT customer_id FROM core.bills WHERE organization_id='${orgId}' AND status='COMPLETED' ${locBillFilter} AND billed_at BETWEEN '${fromIso}' AND '${toIso}' GROUP BY customer_id HAVING COUNT(*) > 1) sub`));
          return { ...base, formattedValue: String(val) };
        }

        case EReportType.CreditGiven: {
          const val = Number(await this.scalar(qr, `SELECT COALESCE(SUM(amount),0) FROM core.customer_credit_transactions WHERE type='credit_sale' AND created_at BETWEEN '${fromIso}' AND '${toIso}'`));
          return { ...base, formattedValue: this.inr(val) };
        }

        case EReportType.CreditReceived: {
          const val = Number(await this.scalar(qr, `SELECT COALESCE(SUM(amount),0) FROM core.customer_credit_transactions WHERE type='payment' AND created_at BETWEEN '${fromIso}' AND '${toIso}'`));
          return { ...base, formattedValue: this.inr(val) };
        }

        case EReportType.PendingCredit: {
          const rows = await qr.query(`SELECT id, name, credit_balance FROM core.customers WHERE organization_id='${orgId}' AND credit_balance > 0 ORDER BY credit_balance DESC LIMIT 50`) as Array<Record<string, unknown>>;
          const total = rows.reduce((acc, rr) => acc + Number(rr['credit_balance'] ?? 0), 0);
          return { ...base, formattedValue: this.inr(total), tableHeaders: ['Customer ID', 'Name', 'Balance'], tableRows: rows.map(rr => [String(rr['id']).substring(0, 8) + '...', String(rr['name']), this.inr(Number(rr['credit_balance']))]) };
        }

        case EReportType.SupplierPayment: {
          const val = Number(await this.scalar(qr, `SELECT COALESCE(SUM(amount),0) FROM core.payment_transactions WHERE org_id='${orgId}' AND reference_type='purchase_order' AND created_at BETWEEN '${fromIso}' AND '${toIso}'`));
          return { ...base, formattedValue: this.inr(val) };
        }

        case EReportType.PendingSupplierPayment: {
          const rows = await qr.query(`SELECT po.po_number, po.supplier_id, po.total_amount, po.status FROM core.purchase_orders po WHERE po.organization_id='${orgId}' AND po.status NOT IN ('received','cancelled') ${locationId ? `AND po.location_id='${locationId}'` : ''} ORDER BY po.created_at DESC LIMIT 50`) as Array<Record<string, unknown>>;
          const total = rows.reduce((acc, rr) => acc + Number(rr['total_amount'] ?? 0), 0);
          return { ...base, formattedValue: this.inr(total), tableHeaders: ['PO Number', 'Supplier ID', 'Amount', 'Status'], tableRows: rows.map(rr => [String(rr['po_number']), String(rr['supplier_id']).substring(0, 8) + '...', this.inr(Number(rr['total_amount'])), String(rr['status'])]) };
        }

        case EReportType.StaffAttendance:
          return { ...base, formattedValue: 'N/A', note: 'Staff attendance data requires integration with an HR/attendance module. This data is not currently tracked in the ERP schema.' };

        case EReportType.WeeklyComparison: {
          const rows = await qr.query(`SELECT DATE_TRUNC('week', billed_at) AS week_start, COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS bills FROM core.bills WHERE organization_id='${orgId}' AND status='COMPLETED' ${locBillFilter} AND billed_at BETWEEN '${fromIso}' AND '${toIso}' GROUP BY week_start ORDER BY week_start`) as Array<Record<string, unknown>>;
          return { ...base, tableHeaders: ['Week Starting', 'Total Sales', 'Number of Bills'], tableRows: rows.map(rr => [new Date(String(rr['week_start'])).toLocaleDateString('en-IN'), this.inr(Number(rr['total'])), String(rr['bills'])]) };
        }

        default:
          return { ...base, note: 'Report data not available for this type.' };
      }
    } finally {
      await qr.release();
    }
  }

  private async buildSalesReport(
    qr: QueryRunner,
    orgId: string,
    locBillFilter: string,
    fromIso: string,
    toIso: string,
    extraBillFilter: string,
    billCountLabel: string,
    base: Omit<TemplateContext, 'formattedValue' | 'tableHeaders' | 'tableRows' | 'summaryCards' | 'note'>,
  ): Promise<TemplateContext> {
    const val = Number(await this.scalar(qr, `SELECT COALESCE(SUM(total_amount),0) FROM core.bills b WHERE b.organization_id='${orgId}' AND b.status='COMPLETED' ${extraBillFilter} ${locBillFilter} AND b.billed_at BETWEEN '${fromIso}' AND '${toIso}'`));
    const totalBills = Number(await this.scalar(qr, `SELECT COUNT(*) FROM core.bills b WHERE b.organization_id='${orgId}' AND b.status='COMPLETED' ${extraBillFilter} ${locBillFilter} AND b.billed_at BETWEEN '${fromIso}' AND '${toIso}'`));

    const rows = await qr.query(`
      SELECT 
        COALESCE(p.name, 'Unnamed Item') AS product_name,
        COALESCE(p.sku, '—') AS sku,
        COALESCE(SUM(bi.quantity), 0) AS qty_sold,
        COALESCE(SUM(bi.line_total), 0) AS revenue
      FROM core.bill_items bi
      JOIN core.bills b ON b.id = bi.bill_id
      LEFT JOIN core.products p ON p.id = bi.product_id
      WHERE b.organization_id = '${orgId}'
        AND b.status = 'COMPLETED'
        ${extraBillFilter}
        ${locBillFilter}
        AND b.billed_at BETWEEN '${fromIso}' AND '${toIso}'
      GROUP BY p.id, p.name, p.sku
      ORDER BY revenue DESC
      LIMIT 100
    `) as Array<Record<string, unknown>>;

    const totalQty = rows.reduce((acc, rr) => acc + Number(rr['qty_sold'] ?? 0), 0);

    if (rows.length > 0) {
      return {
        ...base,
        formattedValue: this.inr(val),
        summaryCards: [
          { label: 'Total Revenue', value: this.inr(val) },
          { label: billCountLabel, value: String(totalBills) },
          { label: 'Items Sold', value: String(totalQty) },
        ],
        tableHeaders: ['Product Name', 'SKU', 'Qty Sold', 'Total Amount'],
        tableRows: rows.map((rr) => [
          String(rr['product_name']),
          String(rr['sku'] || '—'),
          String(rr['qty_sold']),
          this.inr(Number(rr['revenue'])),
        ]),
      };
    }

    if (totalBills > 0) {
      const billRows = await qr.query(`
        SELECT b.bill_number, b.billed_at, b.payment_method, b.total_amount
        FROM core.bills b
        WHERE b.organization_id = '${orgId}'
          AND b.status = 'COMPLETED'
          ${extraBillFilter}
          ${locBillFilter}
          AND b.billed_at BETWEEN '${fromIso}' AND '${toIso}'
        ORDER BY b.billed_at DESC
        LIMIT 100
      `) as Array<Record<string, unknown>>;

      return {
        ...base,
        formattedValue: this.inr(val),
        summaryCards: [
          { label: 'Total Revenue', value: this.inr(val) },
          { label: billCountLabel, value: String(totalBills) },
        ],
        tableHeaders: ['Bill Number', 'Date', 'Payment Method', 'Total Amount'],
        tableRows: billRows.map((b) => [
          String(b['bill_number']),
          b['billed_at'] ? this.fmt(new Date(String(b['billed_at']))) : '—',
          String(b['payment_method'] ?? '—'),
          this.inr(Number(b['total_amount'])),
        ]),
      };
    }

    return {
      ...base,
      formattedValue: this.inr(val),
      summaryCards: [
        { label: 'Total Revenue', value: this.inr(val) },
        { label: billCountLabel, value: '0' },
        { label: 'Items Sold', value: '0' },
      ],
      tableHeaders: ['Product Name', 'SKU', 'Qty Sold', 'Total Amount'],
      tableRows: [],
    };
  }

  private async scalar(qr: QueryRunner, sql: string): Promise<unknown> {
    const result = await qr.query(sql) as Array<Record<string, unknown>>;
    if (!result.length) return 0;
    return Object.values(result[0])[0] ?? 0;
  }
}

const REPORT_TYPE_DESCRIPTIONS: Partial<Record<EReportType, string>> = {
  [EReportType.TotalSales]:             'Sum of all completed bill totals in the selected period.',
  [EReportType.CashSales]:              'Bills where the payment method was Cash.',
  [EReportType.CreditSales]:            'Bills where payment was deferred on credit.',
  [EReportType.TotalBills]:             'Count of all completed bills in the period.',
  [EReportType.AverageBillValue]:       'Total sales divided by the number of bills.',
  [EReportType.TimeWiseSales]:          'Hourly breakdown of sales volume.',
  [EReportType.TopSellingProducts]:     'Products ranked by quantity sold in the period.',
  [EReportType.SlowMovingProducts]:     'Products with the lowest sales volume in the period.',
  [EReportType.TotalExpense]:           'All expenses (shop + other) combined.',
  [EReportType.ShopExpense]:            'Operational store expenses in the period.',
  [EReportType.OtherExpense]:           'Miscellaneous expenses outside core operations.',
  [EReportType.OpeningCash]:            'Estimated cash balance at the start of the period.',
  [EReportType.ClosingCash]:            'Estimated cash balance at the end of the period.',
  [EReportType.TotalPurchase]:          'Total cost of received purchase orders.',
  [EReportType.PurchaseReturn]:         'Goods returned to suppliers in the period.',
  [EReportType.TotalProfit]:            'Gross profit — revenue minus cost of goods sold.',
  [EReportType.NetProfit]:              'Net profit after all expenses are deducted from gross profit.',
  [EReportType.ClosingStock]:           'Current stock levels across inventory.',
  [EReportType.LowStockItems]:          'Items at or below their reorder threshold.',
  [EReportType.OutOfStockItems]:        'Items with zero quantity on hand.',
  [EReportType.DamagedStock]:           'Stock marked as damaged in the period.',
  [EReportType.ReturnedItems]:          'Customer and supplier returns in the period.',
  [EReportType.TotalCustomers]:         'Distinct customers who transacted in the period.',
  [EReportType.NewCustomers]:           'Customers created (first purchase) in the period.',
  [EReportType.RepeatCustomers]:        'Customers with more than one bill in the period.',
  [EReportType.CreditGiven]:            'Credit extended to customers in the period.',
  [EReportType.CreditReceived]:         'Credit payments collected from customers.',
  [EReportType.PendingCredit]:          'Outstanding credit balances owed by customers.',
  [EReportType.SupplierPayment]:        'Payments made to suppliers in the period.',
  [EReportType.PendingSupplierPayment]: 'Purchase orders not yet fully paid.',
  [EReportType.StaffAttendance]:        'Staff attendance records for the period.',
  [EReportType.WeeklyComparison]:       'Week-over-week sales comparison within the period.',
};
