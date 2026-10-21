import type {
  CreateTeamInviteData,
  CreateTeamRoleData,
  DeleteSuppressionResponse,
  DeleteTeamRoleQuery,
  DuplicateTeamRoleData,
  GetStatsQuery,
  GetTeamQuery,
  ListSuppressionsQuery,
  ListSuppressionsResponse,
  ListTeamInvitesQuery,
  ListTeamInvitesResponse,
  ListTeamMembersQuery,
  ListTeamMembersResponse,
  MessageResponse,
  StatsData,
  StoreSuppressionData,
  SuppressedRecipientData,
  SuppressionStoreResponse,
  TeamData,
  TeamInviteData,
  TeamMemberData,
  TeamMutationResponse,
  TeamRoleData,
  TeamRoleListResponse,
  TeamUsageDetailData,
  UpdateTeamData,
  UpdateTeamInviteData,
  UpdateTeamMemberAssignmentData,
  UpdateTeamRoleData,
} from '../generated/types';
import type { NestedQuery } from '../query';
import type { RequestOptions, Transport } from '../transport';
import { ApiResource } from './base';

/** Sending statistics. Team token. */
export class Stats extends ApiResource {
  /** @internal */
  constructor(transport: Transport) {
    super(transport, 'Stats');
  }

  /** Daily statistics between `from` and `to` (Y-m-d, at most 90 days). */
  retrieve(query: NestedQuery<GetStatsQuery>, options?: RequestOptions): Promise<StatsData> {
    return this.request('GET /stats', { label: 'stats.retrieve', query, options });
  }
}

/** The suppression list. Team token. */
export class Suppressions extends ApiResource {
  /** @internal */
  constructor(transport: Transport) {
    super(transport, 'Suppressions');
  }

  /** Lists suppressions, one page at a time. */
  list(
    query?: NestedQuery<ListSuppressionsQuery>,
    options?: RequestOptions
  ): Promise<ListSuppressionsResponse> {
    return this.request('GET /suppressions', { label: 'suppressions.list', query, options });
  }

  /** Iterates over every suppression, following `next_cursor`. */
  iterate(
    query?: NestedQuery<ListSuppressionsQuery>,
    options?: RequestOptions
  ): AsyncGenerator<SuppressedRecipientData, void, undefined> {
    return this.paginate('GET /suppressions', { label: 'suppressions.iterate', query, options });
  }

  create(body: StoreSuppressionData, options?: RequestOptions): Promise<SuppressionStoreResponse> {
    return this.request('POST /suppressions', { label: 'suppressions.create', body, options });
  }

  delete(suppressionId: string, options?: RequestOptions): Promise<DeleteSuppressionResponse> {
    return this.request('DELETE /suppressions/{suppressionId}', {
      label: 'suppressions.delete',
      path: { suppressionId },
      options,
    });
  }
}

/** Team members. Team token. */
export class TeamMembers extends ApiResource {
  /** @internal */
  constructor(transport: Transport) {
    super(transport, 'TeamMembers');
  }

  /** Lists team members, one page at a time. */
  list(
    query?: NestedQuery<ListTeamMembersQuery>,
    options?: RequestOptions
  ): Promise<ListTeamMembersResponse> {
    return this.request('GET /team/members', { label: 'team.members.list', query, options });
  }

  /** Iterates over every team member, following `next_cursor`. */
  iterate(
    query?: NestedQuery<ListTeamMembersQuery>,
    options?: RequestOptions
  ): AsyncGenerator<TeamMemberData, void, undefined> {
    return this.paginate('GET /team/members', { label: 'team.members.iterate', query, options });
  }

  retrieve(userId: string, options?: RequestOptions): Promise<TeamMemberData> {
    return this.request('GET /team/members/{userId}', {
      label: 'team.members.retrieve',
      path: { userId },
      options,
    });
  }

  /** Changes a member's role and project access. */
  updateAssignment(
    userId: string,
    body: UpdateTeamMemberAssignmentData,
    options?: RequestOptions
  ): Promise<TeamMemberData> {
    return this.request('PUT /team/members/{userId}/assignment', {
      label: 'team.members.updateAssignment',
      path: { userId },
      body,
      options,
    });
  }
}

/** Pending team invitations. Team token. */
export class TeamInvites extends ApiResource {
  /** @internal */
  constructor(transport: Transport) {
    super(transport, 'TeamInvites');
  }

  /** Lists pending invitations, one page at a time. */
  list(
    query?: NestedQuery<ListTeamInvitesQuery>,
    options?: RequestOptions
  ): Promise<ListTeamInvitesResponse> {
    return this.request('GET /team/invites', { label: 'team.invites.list', query, options });
  }

  /** Iterates over every pending invitation, following `next_cursor`. */
  iterate(
    query?: NestedQuery<ListTeamInvitesQuery>,
    options?: RequestOptions
  ): AsyncGenerator<TeamInviteData, void, undefined> {
    return this.paginate('GET /team/invites', { label: 'team.invites.iterate', query, options });
  }

  retrieve(inviteId: string, options?: RequestOptions): Promise<TeamInviteData> {
    return this.request('GET /team/invites/{inviteId}', {
      label: 'team.invites.retrieve',
      path: { inviteId },
      options,
    });
  }

  /**
   * Invites a person by email with a role and project access, and sends the
   * invitation email. The team needs a free seat; the Owner role cannot be
   * assigned.
   */
  create(body: CreateTeamInviteData, options?: RequestOptions): Promise<TeamInviteData> {
    return this.request('POST /team/invites', { label: 'team.invites.create', body, options });
  }

  /**
   * Replaces a pending invitation's email, role and project access. A new
   * invitation email is sent only when the address changes.
   */
  update(
    inviteId: string,
    body: UpdateTeamInviteData,
    options?: RequestOptions
  ): Promise<TeamInviteData> {
    return this.request('PUT /team/invites/{inviteId}', {
      label: 'team.invites.update',
      path: { inviteId },
      body,
      options,
    });
  }

  /** Revokes a pending invitation. */
  revoke(inviteId: string, options?: RequestOptions): Promise<MessageResponse> {
    return this.request('DELETE /team/invites/{inviteId}', {
      label: 'team.invites.revoke',
      path: { inviteId },
      options,
    });
  }
}

/** The team of the token. Team token. */
export class Team extends ApiResource {
  /** Team members. */
  public readonly members: TeamMembers;
  /** Pending team invitations. */
  public readonly invites: TeamInvites;

  /** @internal */
  constructor(transport: Transport) {
    super(transport, 'Team');
    this.members = new TeamMembers(transport);
    this.invites = new TeamInvites(transport);
  }

  retrieve(query?: NestedQuery<GetTeamQuery>, options?: RequestOptions): Promise<TeamData> {
    return this.request('GET /team', { label: 'team.retrieve', query, options });
  }

  update(body: UpdateTeamData, options?: RequestOptions): Promise<TeamMutationResponse> {
    return this.request('PUT /team', { label: 'team.update', body, options });
  }

  /** Usage of the current and previous billing periods. */
  usage(options?: RequestOptions): Promise<TeamUsageDetailData> {
    return this.request('GET /team/usage', { label: 'team.usage', options });
  }

  /** The roles that can be assigned to members. */
  roles(options?: RequestOptions): Promise<TeamRoleListResponse> {
    return this.request('GET /team/roles', { label: 'team.roles', options });
  }

  retrieveRole(roleId: string, options?: RequestOptions): Promise<TeamRoleData> {
    return this.request('GET /team/roles/{roleId}', {
      label: 'team.retrieveRole',
      path: { roleId },
      options,
    });
  }

  /**
   * Creates a custom role. Needs a plan with custom roles. Include the
   * permissions that the chosen permissions depend on; role names are unique.
   */
  createRole(body: CreateTeamRoleData, options?: RequestOptions): Promise<TeamRoleData> {
    return this.request('POST /team/roles', { label: 'team.createRole', body, options });
  }

  /** Replaces a custom role's name, description and permissions. Built-in roles cannot be changed. */
  updateRole(
    roleId: string,
    body: UpdateTeamRoleData,
    options?: RequestOptions
  ): Promise<TeamRoleData> {
    return this.request('PUT /team/roles/{roleId}', {
      label: 'team.updateRole',
      path: { roleId },
      body,
      options,
    });
  }

  /**
   * Deletes a custom role. While the role is still assigned to members,
   * invitations or SCIM groups, pass `replacement_role_id`: the role that
   * receives those assignments. Built-in roles cannot be deleted.
   */
  deleteRole(
    roleId: string,
    query?: NestedQuery<DeleteTeamRoleQuery>,
    options?: RequestOptions
  ): Promise<MessageResponse> {
    return this.request('DELETE /team/roles/{roleId}', {
      label: 'team.deleteRole',
      path: { roleId },
      query,
      options,
    });
  }

  /**
   * Copies a role under a new name. Without a `description`, the copy keeps
   * the source role's description. The Owner role cannot be duplicated.
   */
  duplicateRole(
    roleId: string,
    body: DuplicateTeamRoleData,
    options?: RequestOptions
  ): Promise<TeamRoleData> {
    return this.request('POST /team/roles/{roleId}/duplicate', {
      label: 'team.duplicateRole',
      path: { roleId },
      body,
      options,
    });
  }
}
