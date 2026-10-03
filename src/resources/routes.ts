import type {
  GetRouteQuery,
  InboundDomainVerificationResponse,
  ListRoutesQuery,
  ListRoutesResponse,
  MessageResponse,
  RouteData,
  RouteListData,
  RouteMutationResponse,
  StoreRouteData,
  UpdateRouteData,
} from '../generated/types';
import type { NestedQuery } from '../query';
import type { RequestOptions, Transport } from '../transport';
import { ApiResource } from './base';

/** Routes of a project. Team token. */
export class Routes extends ApiResource {
  /** @internal */
  constructor(transport: Transport) {
    super(transport, 'Routes');
  }

  /** Lists the routes of a project, one page at a time. */
  list(
    projectId: string,
    query?: NestedQuery<ListRoutesQuery>,
    options?: RequestOptions
  ): Promise<ListRoutesResponse> {
    return this.request('GET /projects/{projectId}/routes', {
      label: 'routes.list',
      path: { projectId },
      query,
      options,
    });
  }

  /** Iterates over every route of a project, following `next_cursor`. */
  iterate(
    projectId: string,
    query?: NestedQuery<ListRoutesQuery>,
    options?: RequestOptions
  ): AsyncGenerator<RouteListData, void, undefined> {
    return this.paginate('GET /projects/{projectId}/routes', {
      label: 'routes.iterate',
      path: { projectId },
      query,
      options,
    });
  }

  create(
    projectId: string,
    body: StoreRouteData,
    options?: RequestOptions
  ): Promise<RouteMutationResponse> {
    return this.request('POST /projects/{projectId}/routes', {
      label: 'routes.create',
      path: { projectId },
      body,
      options,
    });
  }

  retrieve(
    routeId: string,
    query?: NestedQuery<GetRouteQuery>,
    options?: RequestOptions
  ): Promise<RouteData> {
    return this.request('GET /routes/{routeId}', {
      label: 'routes.retrieve',
      path: { routeId },
      query,
      options,
    });
  }

  update(
    routeId: string,
    body: UpdateRouteData,
    options?: RequestOptions
  ): Promise<RouteMutationResponse> {
    return this.request('PUT /routes/{routeId}', {
      label: 'routes.update',
      path: { routeId },
      body,
      options,
    });
  }

  delete(routeId: string, options?: RequestOptions): Promise<MessageResponse> {
    return this.request('DELETE /routes/{routeId}', {
      label: 'routes.delete',
      path: { routeId },
      options,
    });
  }

  verifyInboundDomain(
    routeId: string,
    options?: RequestOptions
  ): Promise<InboundDomainVerificationResponse> {
    return this.request('POST /routes/{routeId}/verify-inbound-domain', {
      label: 'routes.verifyInboundDomain',
      path: { routeId },
      options,
    });
  }
}
