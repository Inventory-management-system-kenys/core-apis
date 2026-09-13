jest.mock('@automapper/classes', () => ({
  AutoMap: () => () => undefined,
}));

jest.mock('../../../../../common', () => ({
  CommandHandlerStrict: () => () => undefined,
  CommandBase: class CommandBase {},
}));

jest.mock('typeorm', () => ({
  DataSource: class MockDataSource {},
}));

import { GenerateReportCommandHandler } from './generate-report.command-handler';
import { GenerateReportCommand } from './generate-report.command';
import { EReportPeriod, EReportType } from '../../domain';

describe('GenerateReportCommandHandler', () => {
  let handler: GenerateReportCommandHandler;
  let mockRepo: any;
  let mockDataSource: any;
  let mockQueryRunner: any;
  let mockLogger: any;

  beforeEach(() => {
    mockQueryRunner = {
      query: jest.fn(),
      release: jest.fn().mockResolvedValue(undefined),
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    mockRepo = {
      createAsync: jest.fn().mockImplementation((log) => Promise.resolve({ ...log, id: 'log-123' })),
      updateAsync: jest.fn().mockImplementation((log) => Promise.resolve(log)),
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    handler = new GenerateReportCommandHandler(mockRepo, mockDataSource as any, mockLogger);
  });

  it('generates TotalSales report with item breakdown table and KPI cards', async () => {
    mockQueryRunner.query
      .mockResolvedValueOnce([{ coalesce: 107.0 }]) // scalar sum
      .mockResolvedValueOnce([{ count: 2 }]) // total bills count
      .mockResolvedValueOnce([ // bill items breakdown
        { product_name: 'Super Widget', sku: 'WGT-01', qty_sold: 5, revenue: 80.0 },
        { product_name: 'Mini Cable', sku: 'CBL-02', qty_sold: 2, revenue: 27.0 },
      ]);

    const command = Object.assign(new GenerateReportCommand(), {
      orgId: 'org-test',
      reportType: EReportType.TotalSales,
      reportPeriod: EReportPeriod.Yearly,
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      generatedById: 'user-test',
    });

    const result = await handler.execute(command);

    expect(result.status).toBe('COMPLETED');
    const data = result.reportData as any;
    expect(data.formattedValue).toContain('107.00');

    // Verify summaryCards
    expect(data.summaryCards).toEqual([
      { label: 'Total Revenue', value: expect.stringContaining('107.00') },
      { label: 'Total Bills', value: '2' },
      { label: 'Items Sold', value: '7' },
    ]);

    // Verify detailed table headers and rows
    expect(data.tableHeaders).toEqual(['Product Name', 'SKU', 'Qty Sold', 'Total Amount']);
    expect(data.tableRows).toHaveLength(2);
    expect(data.tableRows[0][0]).toBe('Super Widget');
    expect(data.tableRows[0][1]).toBe('WGT-01');
    expect(data.tableRows[0][2]).toBe('5');
    expect(data.tableRows[0][3]).toContain('80.00');

    expect(data.tableRows[1][0]).toBe('Mini Cable');
    expect(data.tableRows[1][1]).toBe('CBL-02');
    expect(data.tableRows[1][2]).toBe('2');
    expect(data.tableRows[1][3]).toContain('27.00');

    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('falls back to bill list table when bills exist but without bill items', async () => {
    mockQueryRunner.query
      .mockResolvedValueOnce([{ coalesce: 107.0 }]) // scalar sum
      .mockResolvedValueOnce([{ count: 1 }]) // total bills count
      .mockResolvedValueOnce([]) // no bill_items
      .mockResolvedValueOnce([ // fallback bills query
        { bill_number: 'BILL-001', billed_at: '2026-03-15T10:00:00.000Z', payment_method: 'CASH', total_amount: 107.0 },
      ]);

    const command = Object.assign(new GenerateReportCommand(), {
      orgId: 'org-test',
      reportType: EReportType.TotalSales,
      reportPeriod: EReportPeriod.Daily,
      fromDate: '2026-03-15',
      toDate: '2026-03-15',
      generatedById: 'user-test',
    });

    const result = await handler.execute(command);

    expect(result.status).toBe('COMPLETED');
    const data = result.reportData as any;
    expect(data.tableHeaders).toEqual(['Bill Number', 'Date', 'Payment Method', 'Total Amount']);
    expect(data.tableRows).toHaveLength(1);
    expect(data.tableRows[0][0]).toBe('BILL-001');
    expect(data.tableRows[0][2]).toBe('CASH');
    expect(data.tableRows[0][3]).toContain('107.00');
  });

  it('handles CashSales and CreditSales with items table', async () => {
    mockQueryRunner.query
      .mockResolvedValueOnce([{ coalesce: 50.0 }])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ product_name: 'Cash Item', sku: 'CSH-1', qty_sold: 1, revenue: 50.0 }]);

    const command = Object.assign(new GenerateReportCommand(), {
      orgId: 'org-test',
      reportType: EReportType.CashSales,
      reportPeriod: EReportPeriod.Monthly,
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
      generatedById: 'user-test',
    });

    const result = await handler.execute(command);
    expect(result.status).toBe('COMPLETED');
    const data = result.reportData as any;
    expect(data.summaryCards[1].label).toBe('Cash Bills');
    expect(data.tableHeaders).toEqual(['Product Name', 'SKU', 'Qty Sold', 'Total Amount']);
    expect(data.tableRows[0][0]).toBe('Cash Item');
  });
});
