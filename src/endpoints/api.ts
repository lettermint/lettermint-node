import type * as Types from '../types';
import { Endpoint } from './endpoint';

export type QueryParams = Record<string, string>;

export class DomainsEndpoint extends Endpoint {
  public list(params?: QueryParams): Promise<Types.DomainIndexResponse> {
    return this.httpClient.get('/domains', { params });
  }

  public create(payload: Types.DomainStoreRequest): Promise<Types.DomainStoreResponse> {
    return this.httpClient.post('/domains', payload);
  }

  public retrieve(domainId: string): Promise<Types.DomainShowResponse> {
    return this.httpClient.get(`/domains/${this.pathSegment(domainId)}`);
  }

  public delete(domainId: string): Promise<Types.DomainDestroyResponse> {
    return this.httpClient.delete(`/domains/${this.pathSegment(domainId)}`);
  }

  public verifyDnsRecords(domainId: string): Promise<Types.DomainVerifyDnsRecordsResponse> {
    return this.httpClient.post(`/domains/${this.pathSegment(domainId)}/dns-records/verify`);
  }

  public verifyDnsRecord(
    domainId: string,
    recordId: string
  ): Promise<Types.DomainVerifySpecificDnsRecordResponse> {
    return this.httpClient.post(
      `/domains/${this.pathSegment(domainId)}/dns-records/${this.pathSegment(recordId)}/verify`
    );
  }

  public updateProjects(
    domainId: string,
    payload: Types.DomainUpdateProjectsRequest
  ): Promise<Types.DomainUpdateProjectsResponse> {
    return this.httpClient.put(`/domains/${this.pathSegment(domainId)}/projects`, payload);
  }
}

export class MessagesEndpoint extends Endpoint {
  public list(params?: QueryParams): Promise<Types.MessageIndexResponse> {
    return this.httpClient.get('/messages', { params });
  }

  public retrieve(messageId: string): Promise<Types.MessageShowResponse> {
    return this.httpClient.get(`/messages/${this.pathSegment(messageId)}`);
  }

  public events(messageId: string): Promise<Types.MessageEventsResponse> {
    return this.httpClient.get(`/messages/${this.pathSegment(messageId)}/events`);
  }

  public source(messageId: string): Promise<string> {
    return this.httpClient.getRaw(`/messages/${this.pathSegment(messageId)}/source`);
  }

  public html(messageId: string): Promise<string> {
    return this.httpClient.getRaw(`/messages/${this.pathSegment(messageId)}/html`);
  }

  public text(messageId: string): Promise<string> {
    return this.httpClient.getRaw(`/messages/${this.pathSegment(messageId)}/text`);
  }
}

export class ProjectsEndpoint extends Endpoint {
  public list(params?: QueryParams): Promise<Types.ProjectIndexResponse> {
    return this.httpClient.get('/projects', { params });
  }

  public create(payload: Types.ProjectStoreRequest): Promise<Types.ProjectStoreResponse> {
    return this.httpClient.post('/projects', payload);
  }

  public retrieve(projectId: string): Promise<Types.ProjectShowResponse> {
    return this.httpClient.get(`/projects/${this.pathSegment(projectId)}`);
  }

  public update(
    projectId: string,
    payload: Types.ProjectUpdateRequest
  ): Promise<Types.ProjectUpdateResponse> {
    return this.httpClient.put(`/projects/${this.pathSegment(projectId)}`, payload);
  }

  public delete(projectId: string): Promise<Types.ProjectDestroyResponse> {
    return this.httpClient.delete(`/projects/${this.pathSegment(projectId)}`);
  }

  public rotateToken(projectId: string): Promise<Types.ProjectRotateTokenResponse> {
    return this.httpClient.post(`/projects/${this.pathSegment(projectId)}/rotate-token`);
  }

  public updateMembers(
    projectId: string,
    payload: Types.ProjectUpdateMembersRequest
  ): Promise<Types.ProjectUpdateMembersResponse> {
    return this.httpClient.put(`/projects/${this.pathSegment(projectId)}/members`, payload);
  }

  public addMember(
    projectId: string,
    teamMemberId: string
  ): Promise<Types.ProjectAddMemberResponse> {
    return this.httpClient.post(
      `/projects/${this.pathSegment(projectId)}/members/${this.pathSegment(teamMemberId)}`
    );
  }

  public removeMember(
    projectId: string,
    teamMemberId: string
  ): Promise<Types.ProjectRemoveMemberResponse> {
    return this.httpClient.delete(
      `/projects/${this.pathSegment(projectId)}/members/${this.pathSegment(teamMemberId)}`
    );
  }

  public routes(projectId: string, params?: QueryParams): Promise<Types.RouteIndexResponse> {
    return this.httpClient.get(`/projects/${this.pathSegment(projectId)}/routes`, { params });
  }

  public createRoute(
    projectId: string,
    payload: Types.RouteStoreRequest
  ): Promise<Types.RouteStoreResponse> {
    return this.httpClient.post(`/projects/${this.pathSegment(projectId)}/routes`, payload);
  }
}

export class RoutesEndpoint extends Endpoint {
  public retrieve(routeId: string): Promise<Types.RouteShowResponse> {
    return this.httpClient.get(`/routes/${this.pathSegment(routeId)}`);
  }

  public update(
    routeId: string,
    payload: Types.RouteUpdateRequest
  ): Promise<Types.RouteUpdateResponse> {
    return this.httpClient.put(`/routes/${this.pathSegment(routeId)}`, payload);
  }

  public delete(routeId: string): Promise<Types.RouteDestroyResponse> {
    return this.httpClient.delete(`/routes/${this.pathSegment(routeId)}`);
  }

  public verifyInboundDomain(routeId: string): Promise<Types.RouteVerifyInboundDomainResponse> {
    return this.httpClient.post(`/routes/${this.pathSegment(routeId)}/verify-inbound-domain`);
  }
}

export class StatsEndpoint extends Endpoint {
  public retrieve(params?: QueryParams): Promise<Types.StatsIndexResponse> {
    return this.httpClient.get('/stats', { params });
  }
}

export class SuppressionsEndpoint extends Endpoint {
  public list(params?: QueryParams): Promise<Types.SuppressionIndexResponse> {
    return this.httpClient.get('/suppressions', { params });
  }

  public create(payload: Types.SuppressionStoreRequest): Promise<Types.SuppressionStoreResponse> {
    return this.httpClient.post('/suppressions', payload);
  }

  public delete(suppressionId: string): Promise<Types.SuppressionDestroyResponse> {
    return this.httpClient.delete(`/suppressions/${this.pathSegment(suppressionId)}`);
  }
}

export class TeamEndpoint extends Endpoint {
  public retrieve(): Promise<Types.TeamShowResponse> {
    return this.httpClient.get('/team');
  }

  public update(payload: Types.TeamUpdateRequest): Promise<Types.TeamUpdateResponse> {
    return this.httpClient.put('/team', payload);
  }

  public usage(params?: QueryParams): Promise<Types.TeamUsageResponse> {
    return this.httpClient.get('/team/usage', { params });
  }

  public members(params?: QueryParams): Promise<Types.TeamMembersResponse> {
    return this.httpClient.get('/team/members', { params });
  }
}

export class WebhooksEndpoint extends Endpoint {
  public list(params?: QueryParams): Promise<Types.WebhookIndexResponse> {
    return this.httpClient.get('/webhooks', { params });
  }

  public create(payload: Types.WebhookStoreRequest): Promise<Types.WebhookStoreResponse> {
    return this.httpClient.post('/webhooks', payload);
  }

  public retrieve(webhookId: string): Promise<Types.WebhookShowResponse> {
    return this.httpClient.get(`/webhooks/${this.pathSegment(webhookId)}`);
  }

  public update(
    webhookId: string,
    payload: Types.WebhookUpdateRequest
  ): Promise<Types.WebhookUpdateResponse> {
    return this.httpClient.put(`/webhooks/${this.pathSegment(webhookId)}`, payload);
  }

  public delete(webhookId: string): Promise<Types.WebhookDestroyResponse> {
    return this.httpClient.delete(`/webhooks/${this.pathSegment(webhookId)}`);
  }

  public test(webhookId: string): Promise<Types.WebhookTestResponse> {
    return this.httpClient.post(`/webhooks/${this.pathSegment(webhookId)}/test`);
  }

  public regenerateSecret(webhookId: string): Promise<Types.WebhookRegenerateSecretResponse> {
    return this.httpClient.post(`/webhooks/${this.pathSegment(webhookId)}/regenerate-secret`);
  }

  public deliveries(
    webhookId: string,
    params?: QueryParams
  ): Promise<Types.WebhookDeliveriesResponse> {
    return this.httpClient.get(`/webhooks/${this.pathSegment(webhookId)}/deliveries`, { params });
  }

  public delivery(
    webhookId: string,
    deliveryId: string
  ): Promise<Types.WebhookShowDeliveryResponse> {
    return this.httpClient.get(
      `/webhooks/${this.pathSegment(webhookId)}/deliveries/${this.pathSegment(deliveryId)}`
    );
  }
}
