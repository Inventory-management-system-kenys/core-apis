jest.mock('@automapper/classes', () => ({
  AutoMap: () => () => undefined,
}));

jest.mock('./should-allow-anonymous', () => ({
  shouldAllowAnonymous: jest.fn(),
}));

jest.mock('../types', () => ({
  AuthenticatedUser: class AuthenticatedUser {
    clerkUserId: string;
    dbUserId?: string;
    roles: string[] = [];
    locationIds: string[] = [];
    hasOrgWideAccess = false;
    get isOnboarded(): boolean {
      return !!this.dbUserId;
    }
  },
}));

jest.mock('../../../infrastructure/persistence/entities/role.entity', () => ({
  ERole: {
    OrgAdmin: 'org_admin',
    SuperAdmin: 'super_admin',
    BranchManager: 'branch_manager',
    Driver: 'driver',
    Packer: 'packer',
  },
}));

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_META_KEY } from '../constants';
import { AuthenticatedUser } from '../types';
import { shouldAllowAnonymous } from './should-allow-anonymous';
import { RolesGuard } from './roles.guard';

const ERole = {
  OrgAdmin: 'org_admin',
  SuperAdmin: 'super_admin',
  BranchManager: 'branch_manager',
  Driver: 'driver',
  Packer: 'packer',
} as const;

function makeContext(user?: Partial<AuthenticatedUser> | null): ExecutionContext {
  const authUser =
    user === null || user === undefined
      ? user
      : Object.assign(new AuthenticatedUser(), {
          clerkUserId: 'user_test',
          roles: [],
          locationIds: [],
          hasOrgWideAccess: false,
          ...user,
        });

  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: authUser }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
    (shouldAllowAnonymous as jest.Mock).mockReturnValue(false);
  });

  it('allows anonymous handlers', () => {
    (shouldAllowAnonymous as jest.Mock).mockReturnValue(true);
    expect(guard.canActivate(makeContext(null))).toBe(true);
  });

  it('allows when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(
      guard.canActivate(makeContext({ dbUserId: 'u1', roles: [ERole.Driver as never] })),
    ).toBe(true);
  });

  it('rejects users who are not onboarded', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([ERole.Driver]);
    expect(() =>
      guard.canActivate(makeContext({ roles: [ERole.Driver as never] })),
    ).toThrow(ForbiddenException);
  });

  it('rejects onboarded users missing a required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([ERole.OrgAdmin, ERole.SuperAdmin]);
    expect(() =>
      guard.canActivate(makeContext({ dbUserId: 'u1', roles: [ERole.Driver as never] })),
    ).toThrow(/Access denied/);
  });

  it('allows onboarded users with one of the required roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      ERole.OrgAdmin,
      ERole.SuperAdmin,
      ERole.BranchManager,
      ERole.Driver,
    ]);
    expect(
      guard.canActivate(makeContext({ dbUserId: 'u1', roles: [ERole.BranchManager as never] })),
    ).toBe(true);
  });

  it('reads required roles from handler/class metadata key', () => {
    const spy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([ERole.Driver]);
    const handler = jest.fn();
    const klass = jest.fn();
    const ctx = {
      getHandler: () => handler,
      getClass: () => klass,
      switchToHttp: () => ({
        getRequest: () => ({
          user: Object.assign(new AuthenticatedUser(), {
            clerkUserId: 'user_test',
            dbUserId: 'u1',
            roles: [ERole.Driver],
            locationIds: [],
            hasOrgWideAccess: false,
          }),
        }),
      }),
    } as unknown as ExecutionContext;
    guard.canActivate(ctx);
    expect(spy).toHaveBeenCalledWith(ROLES_META_KEY, [handler, klass]);
  });
});
