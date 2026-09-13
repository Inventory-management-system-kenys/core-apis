import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrganizationSummary {
  @ApiProperty() public id: string;
  @ApiProperty() public name: string;
  @ApiPropertyOptional() public slug?: string;
  @ApiPropertyOptional() public logoUrl?: string;
}

export class MembershipSummary {
  @ApiProperty() public id: string;
  @ApiProperty() public roleId: string;
  @ApiProperty() public status: string;
  @ApiPropertyOptional() public joinedAt?: Date;
}

export class MeResponse {
  @ApiProperty() public id: string;
  @ApiProperty() public clerkUserId: string;
  @ApiProperty() public email: string;
  @ApiPropertyOptional() public firstName?: string;
  @ApiPropertyOptional() public lastName?: string;
  @ApiPropertyOptional() public avatarUrl?: string;
  @ApiProperty({ type: [String], description: 'DB roles assigned to this user' })
  public roles: string[];
  @ApiProperty() public isOnboarded: boolean;
  @ApiPropertyOptional({ type: OrganizationSummary }) public organization?: OrganizationSummary;
  @ApiPropertyOptional({ type: MembershipSummary }) public membership?: MembershipSummary;
  @ApiProperty({ type: [String], description: 'Store location IDs the user is scoped to (empty if org-wide)' })
  public locationIds: string[];
  @ApiProperty({ description: 'True when the user can view all branches/locations' })
  public hasOrgWideAccess: boolean;
  @ApiPropertyOptional({ description: 'Branch UUID the user belongs to (if scoped to a branch)' })
  public branchId?: string;
  @ApiPropertyOptional({ description: 'ISO 4217 currency code for display formatting' })
  public currencyCode?: string;
}

export class SyncUserResponse {
  @ApiProperty() public id: string;
  @ApiProperty() public clerkUserId: string;
  @ApiProperty() public email: string;
  @ApiPropertyOptional() public firstName?: string;
  @ApiPropertyOptional() public lastName?: string;
  @ApiProperty() public isActive: boolean;
  @ApiPropertyOptional() public organizationId?: string;
}

export class OnboardOrganizationResponse {
  @ApiProperty() public organizationId: string;
  @ApiProperty() public organizationName: string;
  @ApiProperty() public membershipId: string;
  @ApiProperty() public role: string;
}
