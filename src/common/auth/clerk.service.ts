import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { ICoreApiConfig } from '../../configuration';
import { EInvitationStatus } from '../../infrastructure/e-invitation-status';
import { ClerkInvitationData, ClerkOrganizationData, ClerkUserData, ClerkUserListData, IClerkService, InviteMetadata } from './i-clerk.service';
import { parseInviteMetadata } from './invite-metadata';

@Injectable()
export class ClerkService implements IClerkService {
  private readonly client: ReturnType<typeof createClerkClient>;

  constructor(config: ConfigService<ICoreApiConfig>) {
    const clerkCfg = config.get<ICoreApiConfig['clerk']>('clerk');
    this.client = createClerkClient({ secretKey: clerkCfg.secretKey });
  }

  public async createUserAsync(params: { email: string; password: string; firstName: string; lastName: string }): Promise<string> {
    const user = await this.client.users.createUser({
      emailAddress: [params.email],
      password: params.password,
      firstName: params.firstName,
      lastName: params.lastName,
    });
    return user.id;
  }

  public async signInWithEmailPasswordAsync(email: string, password: string): Promise<string> {
    const users = await this.client.users.getUserList({ emailAddress: [email] });
    if (!users.data.length) throw new NotFoundException(`No user found with email ${email}`);
    const user = users.data[0];
    await this.client.users.verifyPassword({ userId: user.id, password });
    const session = await this.client.sessions.createSession({ userId: user.id });
    const tokenResult = await this.client.sessions.getToken(session.id);
    return tokenResult.jwt;
  }

  public async getTokenForUser(userId: string): Promise<string> {
    const result = await this.client.sessions.getSessionList({ userId, status: 'active' });
    if (!result.data.length) {
      throw new NotFoundException(`No active session found for user ${userId}`);
    }
    const tokenResult = await this.client.sessions.getToken(result.data[0].id);
    return tokenResult.jwt;
  }

  public async listUsersAsync(params?: { limit?: number; offset?: number; organizationId?: string }): Promise<ClerkUserListData> {
    const result = await this.client.users.getUserList({
      limit:          params?.limit  ?? 20,
      offset:         params?.offset ?? 0,
      organizationId: params?.organizationId ? [params.organizationId] : undefined,
    });
    return {
      data:       result.data.map((u) => this.mapUser(u)),
      totalCount: result.totalCount,
    };
  }

  public async searchUsersAsync(params: { query: string; limit?: number; offset?: number }): Promise<ClerkUserListData> {
    const result = await this.client.users.getUserList({
      query:  params.query,
      limit:  params.limit  ?? 20,
      offset: params.offset ?? 0,
    });
    return {
      data:       result.data.map((u) => this.mapUser(u)),
      totalCount: result.totalCount,
    };
  }

  public async getClerkUserAsync(clerkUserId: string): Promise<ClerkUserData> {
    const user = await this.client.users.getUser(clerkUserId);
    return this.mapUser(user);
  }

  public async getUserRolesAsync(clerkUserId: string): Promise<string[]> {
    const user = await this.client.users.getUser(clerkUserId);
    const meta = user.publicMetadata as Record<string, unknown>;
    return Array.isArray(meta['roles']) ? (meta['roles'] as string[]) : [];
  }

  public async updateUserRolesAsync(clerkUserId: string, roles: string[]): Promise<void> {
    await this.client.users.updateUserMetadata(clerkUserId, {
      publicMetadata: { roles },
    });
  }

  public async inviteUserAsync(params: { email: string; roles?: string[]; redirectUrl?: string; organizationId?: string; roleId?: string; locationId?: string }): Promise<void> {
    const publicMetadata: Record<string, unknown> = {};
    if (params.roles?.length) publicMetadata['roles'] = params.roles;
    if (params.organizationId && params.roleId) {
      publicMetadata['invite'] = {
        organizationId: params.organizationId,
        roleId:         params.roleId,
        locationId:     params.locationId,
      };
    }
    await this.client.invitations.createInvitation({
      emailAddress:   params.email,
      redirectUrl:    params.redirectUrl,
      publicMetadata: Object.keys(publicMetadata).length ? publicMetadata : undefined,
      ignoreExisting: true,
    });
  }

  public async listInvitationsAsync(params?: { status?: EInvitationStatus }): Promise<ClerkInvitationData[]> {
    const result = await this.client.invitations.getInvitationList({
      status: params?.status,
    });
    return result.data.map((inv) => {
      const meta  = inv.publicMetadata;
      const roles = Array.isArray(meta['roles']) ? (meta['roles'] as string[]) : undefined;
      return {
        id:           inv.id,
        emailAddress: inv.emailAddress,
        status:       inv.status as EInvitationStatus,
        roles,
        createdAt:    inv.createdAt,
        updatedAt:    inv.updatedAt,
      };
    });
  }

  public async revokeInvitationAsync(invitationId: string): Promise<void> {
    await this.client.invitations.revokeInvitation(invitationId);
  }

  public async deleteClerkUserAsync(clerkUserId: string): Promise<void> {
    await this.client.users.deleteUser(clerkUserId);
  }

  public async banClerkUserAsync(clerkUserId: string): Promise<void> {
    await this.client.users.banUser(clerkUserId);
  }

  public async unbanClerkUserAsync(clerkUserId: string): Promise<void> {
    await this.client.users.unbanUser(clerkUserId);
  }

  public async assignToOrganizationAsync(params: { clerkUserId: string; organizationId: string; role: string }): Promise<void> {
    await this.client.organizations.createOrganizationMembership({
      organizationId: params.organizationId,
      userId:         params.clerkUserId,
      role:           params.role,
    });
  }

  public async removeFromOrganizationAsync(params: { clerkUserId: string; organizationId: string }): Promise<void> {
    await this.client.organizations.deleteOrganizationMembership({
      organizationId: params.organizationId,
      userId:         params.clerkUserId,
    });
  }

  public async listOrganizationsAsync(): Promise<ClerkOrganizationData[]> {
    const result = await this.client.organizations.getOrganizationList({ limit: 100 });
    return result.data.map((org) => ({
      organizationId: org.id,
      name:           org.name,
      slug:           org.slug,
    }));
  }

  public async getInviteMetadataAsync(clerkUserId: string): Promise<InviteMetadata | undefined> {
    const user = await this.client.users.getUser(clerkUserId);
    const fromUser = parseInviteMetadata(user.publicMetadata);
    if (fromUser) return fromUser;

    const email =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
      user.emailAddresses[0]?.emailAddress;
    if (!email) return undefined;

    for (const status of [EInvitationStatus.Accepted, EInvitationStatus.Pending]) {
      const result = await this.client.invitations.getInvitationList({ status, limit: 100 });
      const matches = result.data
        .filter((inv) => inv.emailAddress.toLowerCase() === email.toLowerCase())
        .sort((a, b) => b.createdAt - a.createdAt);
      for (const match of matches) {
        const parsed = parseInviteMetadata(match.publicMetadata);
        if (parsed) return parsed;
      }
    }
    return undefined;
  }

  private mapUser(user: Awaited<ReturnType<(typeof this.client.users)['getUser']>>): ClerkUserData {
    const meta       = user.publicMetadata as Record<string, unknown>;
    let roles        = Array.isArray(meta['roles']) ? (meta['roles'] as string[]) : [];
    if (roles.length === 0 && Array.isArray((user as unknown as Record<string, unknown>).organizationMemberships)) {
      const memberships = (user as unknown as Record<string, unknown>).organizationMemberships as Array<{ role?: string }>;
      for (const m of memberships) {
        if (m.role === 'org:admin' || m.role === 'admin') {
          roles.push('org_admin');
        }
      }
    }
    const primaryEmail = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);

    return {
      clerkUserId:  user.id,
      email:        primaryEmail?.emailAddress ?? '',
      firstName:    user.firstName,
      lastName:     user.lastName,
      imageUrl:     user.imageUrl,
      banned:       user.banned,
      roles,
      createdAt:    user.createdAt,
      lastSignInAt: user.lastSignInAt ?? null,
    };
  }
}
