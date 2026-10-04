import type {
  GetProjectQuery,
  GetReportForwardingResponse,
  ListProjectsQuery,
  ListProjectsResponse,
  MessageResponse,
  ProjectCreatedData,
  ProjectData,
  ProjectListData,
  ProjectMutationResponse,
  ReportForwardingRequest,
  ResendReportForwardingCodeResponse,
  RotateProjectTokenResponse,
  StoreProjectData,
  UpdateProjectData,
  UpdateReportForwardingResponse,
  VerifyReportForwardingRequest,
  VerifyReportForwardingResponse,
} from '../generated/types';
import type { NestedQuery } from '../query';
import type { RequestOptions, Transport } from '../transport';
import { ApiResource } from './base';

/** DMARC and complaint report forwarding of a project. Team token. */
export class ReportForwarding extends ApiResource {
  /** @internal */
  constructor(transport: Transport) {
    super(transport, 'ReportForwarding');
  }

  retrieve(projectId: string, options?: RequestOptions): Promise<GetReportForwardingResponse> {
    return this.request('GET /projects/{projectId}/report-forwarding', {
      label: 'projects.reportForwarding.retrieve',
      path: { projectId },
      options,
    });
  }

  update(
    projectId: string,
    body: ReportForwardingRequest,
    options?: RequestOptions
  ): Promise<UpdateReportForwardingResponse> {
    return this.request('PUT /projects/{projectId}/report-forwarding', {
      label: 'projects.reportForwarding.update',
      path: { projectId },
      body,
      options,
    });
  }

  /** Disables report forwarding. Resolves with `undefined` (HTTP 204). */
  delete(projectId: string, options?: RequestOptions): Promise<undefined> {
    return this.request('DELETE /projects/{projectId}/report-forwarding', {
      label: 'projects.reportForwarding.delete',
      path: { projectId },
      options,
    });
  }

  verify(
    projectId: string,
    body: VerifyReportForwardingRequest,
    options?: RequestOptions
  ): Promise<VerifyReportForwardingResponse> {
    return this.request('POST /projects/{projectId}/report-forwarding/verify', {
      label: 'projects.reportForwarding.verify',
      path: { projectId },
      body,
      options,
    });
  }

  resendCode(
    projectId: string,
    options?: RequestOptions
  ): Promise<ResendReportForwardingCodeResponse> {
    return this.request('POST /projects/{projectId}/report-forwarding/resend-code', {
      label: 'projects.reportForwarding.resendCode',
      path: { projectId },
      options,
    });
  }
}

/** Projects. Team token. */
export class Projects extends ApiResource {
  /** Report forwarding of a project. */
  public readonly reportForwarding: ReportForwarding;

  /** @internal */
  constructor(transport: Transport) {
    super(transport, 'Projects');
    this.reportForwarding = new ReportForwarding(transport);
  }

  /** Lists projects, one page at a time. */
  list(
    query?: NestedQuery<ListProjectsQuery>,
    options?: RequestOptions
  ): Promise<ListProjectsResponse> {
    return this.request('GET /projects', { label: 'projects.list', query, options });
  }

  /** Iterates over every project, following `next_cursor`. */
  iterate(
    query?: NestedQuery<ListProjectsQuery>,
    options?: RequestOptions
  ): AsyncGenerator<ProjectListData, void, undefined> {
    return this.paginate('GET /projects', { label: 'projects.iterate', query, options });
  }

  /** Creates a project. The response holds its sending token once (`api_token`). */
  create(body: StoreProjectData, options?: RequestOptions): Promise<ProjectCreatedData> {
    return this.request('POST /projects', { label: 'projects.create', body, options });
  }

  retrieve(
    projectId: string,
    query?: NestedQuery<GetProjectQuery>,
    options?: RequestOptions
  ): Promise<ProjectData> {
    return this.request('GET /projects/{projectId}', {
      label: 'projects.retrieve',
      path: { projectId },
      query,
      options,
    });
  }

  update(
    projectId: string,
    body: UpdateProjectData,
    options?: RequestOptions
  ): Promise<ProjectMutationResponse> {
    return this.request('PUT /projects/{projectId}', {
      label: 'projects.update',
      path: { projectId },
      body,
      options,
    });
  }

  delete(projectId: string, options?: RequestOptions): Promise<MessageResponse> {
    return this.request('DELETE /projects/{projectId}', {
      label: 'projects.delete',
      path: { projectId },
      options,
    });
  }

  /**
   * Rotates the project's legacy sending token.
   * @deprecated The API marks this endpoint as legacy.
   */
  rotateToken(projectId: string, options?: RequestOptions): Promise<RotateProjectTokenResponse> {
    return this.request('POST /projects/{projectId}/rotate-token', {
      label: 'projects.rotateToken',
      path: { projectId },
      options,
    });
  }
}
