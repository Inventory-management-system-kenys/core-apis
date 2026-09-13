// src/common/auth/rbac-guard-coverage.spec.ts
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MODULES_ROOT = join(__dirname, '../../application/modules');
const EXPECTED_UNGUARDED = new Set<string>();

// Guard/role list extraction below uses `[^)]*`, which breaks if a @UseGuards(...) or @Roles(...)
// argument is itself a call (e.g. `AuthGuard('jwt')`). Every controller in this plan uses bare
// guard classes and ERole.X identifiers only (see plan's Role tiers section), so this is fine for
// this plan's scope — but it will misreport silently if that convention changes later.

function readController(relativePath: string): string {
  return readFileSync(join(MODULES_ROOT, relativePath), 'utf8');
}

function hasClassGuard(source: string, guard: string): boolean {
  // Match @UseGuards and @Controller on consecutive decorator lines (in either order, with other decorators possibly between them)
  const decoratorBlockPattern = /((?:@\w+\([^)]*\)[\s\n]*)+)export\s+class/;
  const blockMatch = source.match(decoratorBlockPattern);
  if (!blockMatch) {
    return false;
  }
  const decorators = blockMatch[1];

  // Extract guards from @UseGuards. Absence of @UseGuards falls through here (guardsMatch is null).
  const guardsMatch = decorators.match(/@UseGuards\(([^)]*)\)/);
  if (!guardsMatch) {
    return false;
  }

  return guardsMatch[1].split(',').map((entry) => entry.trim()).includes(guard);
}

function methodDecorators(source: string, methodName: string): string {
  // Match decorators that may span multiple lines (like @ApiOperation with multi-line object literals)
  // Decorators can have nested parens/braces; match from @ to the closing ) that's followed by optional whitespace and newline
  const pattern = new RegExp(`((?:@\\w+\\([^()]*(?:\\([^)]*\\)[^()]*)*\\)[\\s\\n]*)+)\\s*public async ${methodName}\\(`, 's');
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`method "${methodName}" not found in controller source`);
  }
  return match[1];
}

function hasMethodGuard(decorators: string, guard: string): boolean {
  const match = decorators.match(/@UseGuards\(([^)]*)\)/);
  if (!match) {
    return false;
  }
  return match[1].split(',').map((entry) => entry.trim()).includes(guard);
}

function methodRoles(decorators: string): string[] {
  const match = decorators.match(/@Roles\(([^)]*)\)/);
  if (!match) {
    return [];
  }
  return match[1].split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

describe('controller authentication coverage', () => {
  it('requires ClerkAuthGuard on every controller class', () => {
    const controllers = readdirSync(MODULES_ROOT, { recursive: true, encoding: 'utf8' })
      .filter((relativePath) => relativePath.endsWith('.controller.ts'));
    const unguarded = controllers.filter(
      (relativePath) => !hasClassGuard(readController(relativePath), 'ClerkAuthGuard'),
    );

    expect(unguarded).toEqual([...EXPECTED_UNGUARDED]);
  });
});

describe('common-utility controller', () => {
  const source = () => readController('common-utility/common-utility.controller.ts');

  it('requires Clerk authentication on the whole controller', () => {
    expect(hasClassGuard(source(), 'ClerkAuthGuard')).toBe(true);
  });

  it('restricts page-access updates to platform tier', () => {
    const decorators = methodDecorators(source(), 'updatePageAccess');
    expect(hasMethodGuard(decorators, 'RolesGuard')).toBe(true);
    expect(methodRoles(decorators)).toEqual(['ERole.SuperAdmin']);
  });

  it('leaves page-access reads unrestricted beyond authentication', () => {
    const decorators = methodDecorators(source(), 'getPageAccess');
    expect(hasMethodGuard(decorators, 'RolesGuard')).toBe(false);
  });
});

describe('Clerk JWT email fallback', () => {
  it('uses a verified email instead of the first attached address', () => {
    const source = readFileSync(join(__dirname, 'strategies/clerk-jwt.strategy.ts'), 'utf8');
    expect(source).toContain("verification?.status === 'verified'");
    expect(source).not.toContain('emailAddresses[0]');
  });
});

describe('rbac guard coverage checker (proving against already-guarded controllers)', () => {
  it('detects the class-level guard chain on BillsController', () => {
    const source = readController('bills/bills.controller.ts');
    expect(hasClassGuard(source, 'ClerkAuthGuard')).toBe(true);
    expect(hasClassGuard(source, 'RolesGuard')).toBe(true);
  });

  it('reports no class-level RolesGuard on AuthController itself (class only has ClerkAuthGuard)', () => {
    const source = readController('auth/auth.controller.ts');
    expect(hasClassGuard(source, 'ClerkAuthGuard')).toBe(true);
    expect(hasClassGuard(source, 'RolesGuard')).toBe(false);
  });
});

describe('user-roles controller', () => {
  const source = () => readController('user-roles/user-roles.controller.ts');

  it('requires Clerk authentication on the whole controller', () => {
    expect(hasClassGuard(source(), 'ClerkAuthGuard')).toBe(true);
  });

  it('restricts assigning a role to a user to org-admin tier', () => {
    const decorators = methodDecorators(source(), 'create');
    expect(hasMethodGuard(decorators, 'RolesGuard')).toBe(true);
    expect(methodRoles(decorators)).toEqual(['ERole.OrgAdmin', 'ERole.SuperAdmin']);
  });
});

describe('roles controller', () => {
  const source = () => readController('roles/roles.controller.ts');

  it('requires Clerk authentication on the whole controller', () => {
    expect(hasClassGuard(source(), 'ClerkAuthGuard')).toBe(true);
  });

  it('restricts defining a new role to platform tier', () => {
    const decorators = methodDecorators(source(), 'create');
    expect(hasMethodGuard(decorators, 'RolesGuard')).toBe(true);
    expect(methodRoles(decorators)).toEqual(['ERole.SuperAdmin']);
  });
});

describe('organizations controller', () => {
  const source = () => readController('organizations/organizations.controller.ts');

  it('requires Clerk authentication on the whole controller', () => {
    expect(hasClassGuard(source(), 'ClerkAuthGuard')).toBe(true);
  });

  it.each(['create', 'update', 'delete'])('restricts %s to platform tier', (method) => {
    const decorators = methodDecorators(source(), method);
    expect(hasMethodGuard(decorators, 'RolesGuard')).toBe(true);
    expect(methodRoles(decorators)).toEqual(['ERole.SuperAdmin']);
  });
});

describe('payment-transactions controller', () => {
  const source = () => readController('payment-transactions/payment-transactions.controller.ts');

  it('requires Clerk authentication on the whole controller', () => {
    expect(hasClassGuard(source(), 'ClerkAuthGuard')).toBe(true);
  });

  it.each(['update', 'delete'])('restricts %s to org-admin tier', (method) => {
    const decorators = methodDecorators(source(), method);
    expect(hasMethodGuard(decorators, 'RolesGuard')).toBe(true);
    expect(methodRoles(decorators)).toEqual(['ERole.OrgAdmin', 'ERole.SuperAdmin']);
  });

  it('leaves create unrestricted beyond authentication (routine POS write)', () => {
    const decorators = methodDecorators(source(), 'create');
    expect(hasMethodGuard(decorators, 'RolesGuard')).toBe(false);
  });
});

describe('platform-configurations controller', () => {
  const source = () => readController('platform-configurations/platform-configurations.controller.ts');

  it('requires Clerk authentication on the whole controller', () => {
    expect(hasClassGuard(source(), 'ClerkAuthGuard')).toBe(true);
  });

  it('restricts creating a platform configuration to platform tier', () => {
    const decorators = methodDecorators(source(), 'create');
    expect(hasMethodGuard(decorators, 'RolesGuard')).toBe(true);
    expect(methodRoles(decorators)).toEqual(['ERole.SuperAdmin']);
  });
});

describe('expenses controller', () => {
  const source = () => readController('expenses/expenses.controller.ts');

  it('requires Clerk authentication on the whole controller', () => {
    expect(hasClassGuard(source(), 'ClerkAuthGuard')).toBe(true);
  });

  it('restricts approving/rejecting an expense to manager tier', () => {
    const decorators = methodDecorators(source(), 'updateStatus');
    expect(hasMethodGuard(decorators, 'RolesGuard')).toBe(true);
    expect(methodRoles(decorators)).toEqual([
      'ERole.OrgAdmin',
      'ERole.SuperAdmin',
    ]);
  });

  it('leaves submitting an expense unrestricted beyond authentication', () => {
    const decorators = methodDecorators(source(), 'create');
    expect(hasMethodGuard(decorators, 'RolesGuard')).toBe(false);
  });
});

describe('credit-transactions controller', () => {
  const source = () => readController('credit-approvals/credit-transactions.controller.ts');

  it('requires ClerkAuthGuard and RolesGuard on the whole controller', () => {
    expect(hasClassGuard(source(), 'ClerkAuthGuard')).toBe(true);
    expect(hasClassGuard(source(), 'RolesGuard')).toBe(true);
  });

  it('restricts credit transaction search to manager tier', () => {
    const decorators = methodDecorators(source(), 'search');
    expect(methodRoles(decorators)).toEqual([
      'ERole.OrgAdmin',
      'ERole.SuperAdmin',
    ]);
  });
});

describe('item-returns controller', () => {
  const source = () => readController('item-returns/item-returns.controller.ts');

  it('requires Clerk authentication on the whole controller', () => {
    expect(hasClassGuard(source(), 'ClerkAuthGuard')).toBe(true);
  });

  it('restricts deleting an item return to manager tier', () => {
    const decorators = methodDecorators(source(), 'delete');
    expect(hasMethodGuard(decorators, 'RolesGuard')).toBe(true);
    expect(methodRoles(decorators)).toEqual([
      'ERole.OrgAdmin',
      'ERole.SuperAdmin',
    ]);
  });
});

describe('report-generation-logs controller', () => {
  const source = () => readController('report-generation-logs/report-generation-logs.controller.ts');

  it('requires Clerk authentication on the whole controller', () => {
    expect(hasClassGuard(source(), 'ClerkAuthGuard')).toBe(true);
  });

  it('restricts deleting a report generation log to manager tier', () => {
    const decorators = methodDecorators(source(), 'delete');
    expect(hasMethodGuard(decorators, 'RolesGuard')).toBe(true);
    expect(methodRoles(decorators)).toEqual([
      'ERole.OrgAdmin',
      'ERole.SuperAdmin',
    ]);
  });
});

describe('purchase-items controller', () => {
  const source = () => readController('purchase-items/purchase-items.controller.ts');

  it('requires Clerk authentication on the whole controller', () => {
    expect(hasClassGuard(source(), 'ClerkAuthGuard')).toBe(true);
  });
});

describe('activity-logs controller', () => {
  const source = () => readController('activity-logs/activity-logs.controller.ts');

  it('requires Clerk authentication on the whole controller', () => {
    expect(hasClassGuard(source(), 'ClerkAuthGuard')).toBe(true);
  });
});

describe('orders controller', () => {
  const source = () => readController('orders/orders.controller.ts');

  it('requires Clerk authentication on the whole controller', () => {
    expect(hasClassGuard(source(), 'ClerkAuthGuard')).toBe(true);
  });
});

describe('destructive-endpoint role elevation (already-authenticated controllers)', () => {
  const managerTier = ['ERole.OrgAdmin', 'ERole.SuperAdmin'];

  it.each([
    ['customers/customers.controller.ts', 'delete'],
    ['drivers/drivers.controller.ts', 'delete'],
    ['trips/trips.controller.ts', 'delete'],
    ['vehicle-expenses/vehicle-expenses.controller.ts', 'delete'],
    ['vehicles/vehicles.controller.ts', 'delete'],
  ])('restricts %s#%s to manager tier', (relativePath, method) => {
    const source = readController(relativePath);
    const decorators = methodDecorators(source, method);
    expect(hasMethodGuard(decorators, 'RolesGuard')).toBe(true);
    expect(methodRoles(decorators)).toEqual(managerTier);
  });

  it('leaves notifications#delete unrestricted (self-service resource, no ownership check to key off yet)', () => {
    const source = readController('notifications/notifications.controller.ts');
    const decorators = methodDecorators(source, 'delete');
    expect(hasMethodGuard(decorators, 'RolesGuard')).toBe(false);
  });
});

describe('invoices controller', () => {
  it('requires Clerk authentication and carries the RolesGuard chain', () => {
    const source = readController('invoices/invoices.controller.ts');
    expect(hasClassGuard(source, 'ClerkAuthGuard')).toBe(true);
    expect(hasClassGuard(source, 'RolesGuard')).toBe(true);
  });
});

describe('stock-transfer-requests controller', () => {
  const source = () => readController('stock-transfers/stock-transfer-requests.controller.ts');
  const storeTier = ['ERole.OrgAdmin', 'ERole.SuperAdmin', 'ERole.BranchManager'];

  it('requires ClerkAuthGuard and RolesGuard on the whole controller', () => {
    expect(hasClassGuard(source(), 'ClerkAuthGuard')).toBe(true);
    expect(hasClassGuard(source(), 'RolesGuard')).toBe(true);
  });

  it('restricts the controller to store-capable roles', () => {
    const match = source().match(/@Roles\(([^)]*)\)/);
    expect(match).not.toBeNull();
    const roles = match[1].split(',').map((entry) => entry.trim());
    expect(roles).toEqual(storeTier);
  });

  it.each(['listMine', 'listOpen', 'getById', 'raise', 'accept', 'claim', 'cancel'])(
    'exposes method %s',
    (methodName) => {
      expect(() => methodDecorators(source(), methodName)).not.toThrow();
    },
  );
});

describe('slice A auth kill-switches', () => {
  it('gates POST /auth/token behind a non-production env check', () => {
    const source = readController('auth/auth.controller.ts');
    const decorators = methodDecorators(source, 'getToken');
    expect(decorators).toContain('AllowAnonymous');
    expect(source).toMatch(/isDev\(\)/);
    expect(source).toMatch(/ForbiddenException\('Token minting is disabled outside development'\)/);
  });

  it('restricts mail send-raw and test to SuperAdmin', () => {
    const source = readController('mail-templates/mail.controller.ts');
    expect(hasClassGuard(source, 'ClerkAuthGuard')).toBe(true);
    expect(hasClassGuard(source, 'RolesGuard')).toBe(true);
    expect(source).toMatch(/@Roles\(ERole\.SuperAdmin\)/);
  });

  it('does not write FALLBACK_ORG_ID on create paths', () => {
    const files = [
      'customers/customers.controller.ts',
      'vehicles/vehicles.controller.ts',
      'drivers/drivers.controller.ts',
      'trips/trips.controller.ts',
      'vehicle-expenses/vehicle-expenses.controller.ts',
      'maintenance/maintenance.controller.ts',
      'analytics/analytics.controller.ts',
    ];
    for (const file of files) {
      expect(readController(file)).not.toContain('FALLBACK_ORG_ID');
    }
  });

  it('restricts users#create to org admin tier', () => {
    const source = readController('users/users.controller.ts');
    const decorators = methodDecorators(source, 'create');
    expect(hasMethodGuard(decorators, 'RolesGuard')).toBe(true);
    expect(methodRoles(decorators)).toEqual(['ERole.OrgAdmin', 'ERole.SuperAdmin']);
  });
});
