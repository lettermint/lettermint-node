import type {
  DeleteSuppressionResponse,
  GetStatsQuery,
  GetTeamQuery,
  ListSuppressionsQuery,
  ListSuppressionsResponse,
  ListTeamMembersQuery,
  ListTeamMembersResponse,
  StatsData,
  StoreSuppressionData,
  SuppressedRecipientData,
  SuppressionStoreResponse,
  TeamData,
  TeamMemberData,
  TeamMutationResponse,
  TeamRoleListResponse,
  TeamUsageDetailData,
  UpdateTeamData,
  UpdateTeamMemberAssignmentData,
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

/** The team of the token. Team token. */
export class Team extends ApiResource {
  /** Team members. */
  public readonly members: TeamMembers;

  /** @internal */
  constructor(transport: Transport) {
    super(transport, 'Team');
    this.members = new TeamMembers(transport);
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
}
