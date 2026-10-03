import type {
  DnsVerificationSuccessResponse,
  DomainData,
  DomainListData,
  DomainMutationResponse,
  GetDomainQuery,
  ListDomainsQuery,
  ListDomainsResponse,
  MessageResponse,
  StoreDomainData,
  UpdateDomainProjectsData,
} from '../generated/types';
import type { NestedQuery } from '../query';
import type { RequestOptions, Transport } from '../transport';
import { ApiResource } from './base';

/** Sending domains. Team token. */
export class Domains extends ApiResource {
  /** @internal */
  constructor(transport: Transport) {
    super(transport, 'Domains');
  }

  /** Lists domains, one page at a time. */
  list(
    query?: NestedQuery<ListDomainsQuery>,
    options?: RequestOptions
  ): Promise<ListDomainsResponse> {
    return this.request('GET /domains', { label: 'domains.list', query, options });
  }

  /** Iterates over every domain, following `next_cursor`. */
  iterate(
    query?: NestedQuery<ListDomainsQuery>,
    options?: RequestOptions
  ): AsyncGenerator<DomainListData, void, undefined> {
    return this.paginate('GET /domains', { label: 'domains.iterate', query, options });
  }

  create(body: StoreDomainData, options?: RequestOptions): Promise<DomainData> {
    return this.request('POST /domains', { label: 'domains.create', body, options });
  }

  retrieve(
    domainId: string,
    query?: NestedQuery<GetDomainQuery>,
    options?: RequestOptions
  ): Promise<DomainData> {
    return this.request('GET /domains/{domainId}', {
      label: 'domains.retrieve',
      path: { domainId },
      query,
      options,
    });
  }

  delete(domainId: string, options?: RequestOptions): Promise<MessageResponse> {
    return this.request('DELETE /domains/{domainId}', {
      label: 'domains.delete',
      path: { domainId },
      options,
    });
  }

  /** Checks every DNS record of the domain. */
  verifyDnsRecords(
    domainId: string,
    options?: RequestOptions
  ): Promise<DnsVerificationSuccessResponse> {
    return this.request('POST /domains/{domainId}/dns-records/verify', {
      label: 'domains.verifyDnsRecords',
      path: { domainId },
      options,
    });
  }

  /** Checks one DNS record of the domain. */
  verifyDnsRecord(
    domainId: string,
    recordId: string,
    options?: RequestOptions
  ): Promise<MessageResponse> {
    return this.request('POST /domains/{domainId}/dns-records/{recordId}/verify', {
      label: 'domains.verifyDnsRecord',
      path: { domainId, recordId },
      options,
    });
  }

  /** Replaces the projects that may send from the domain. */
  updateProjects(
    domainId: string,
    body: UpdateDomainProjectsData,
    options?: RequestOptions
  ): Promise<DomainMutationResponse> {
    return this.request('PUT /domains/{domainId}/projects', {
      label: 'domains.updateProjects',
      path: { domainId },
      body,
      options,
    });
  }
}
