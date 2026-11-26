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

  /**
   * Starts the upgrade of a `legacy_txt` domain to managed DKIM (HTTP 202).
   * The response lists two new DKIM CNAME records (`verification_scope`
   * `migration`) to add to your DNS; the current DKIM TXT record keeps signing
   * until the upgrade completes. Calling it again returns the upgrade in
   * progress. A domain that already uses managed DKIM returns HTTP 200 and
   * nothing changes. Throws a `ValidationError` (`DKIM_UPGRADE_UNAVAILABLE`)
   * when the domain cannot be upgraded.
   */
  startDkimUpgrade(domainId: string, options?: RequestOptions): Promise<DomainMutationResponse> {
    return this.request('POST /domains/{domainId}/dkim/upgrade', {
      label: 'domains.startDkimUpgrade',
      path: { domainId },
      options,
    });
  }

  /**
   * Cancels the managed DKIM upgrade and removes its DKIM CNAME records. The
   * domain keeps its DKIM TXT record. Without an upgrade in progress, nothing
   * changes; a key rotation is never cancelled. Throws a `ValidationError`
   * (`DKIM_UPGRADE_IN_GRACE_PERIOD`) once the grace period has started.
   */
  cancelDkimUpgrade(domainId: string, options?: RequestOptions): Promise<DomainMutationResponse> {
    return this.request('DELETE /domains/{domainId}/dkim/upgrade', {
      label: 'domains.cancelDkimUpgrade',
      path: { domainId },
      options,
    });
  }

  /**
   * Activates the managed DKIM upgrade once `dkim_transition.state` is
   * `ready_to_activate`. Lettermint checks both DKIM CNAME records again and
   * starts a grace period in which both keys are published. At
   * `dkim_transition.completes_after`, `dkim_mode` changes to `managed_cname`
   * and the old DKIM TXT record can be removed. Calling it again during the
   * grace period or after completion changes nothing. Throws a
   * `ValidationError` (`NO_DKIM_UPGRADE`, `DKIM_UPGRADE_NOT_READY`) when there
   * is no upgrade or it is not ready.
   */
  activateDkimUpgrade(domainId: string, options?: RequestOptions): Promise<DomainMutationResponse> {
    return this.request('POST /domains/{domainId}/dkim/upgrade/activate', {
      label: 'domains.activateDkimUpgrade',
      path: { domainId },
      options,
    });
  }

  /**
   * Starts a DKIM key rotation for a domain with managed DKIM (HTTP 202). The
   * DKIM CNAME records stay the same, so no DNS change is needed. Lettermint
   * also rotates keys on a schedule; use this to replace a key early. Calling
   * it again during a rotation returns the rotation in progress. Throws a
   * `ValidationError` (`DKIM_ROTATION_UNAVAILABLE`) when the domain cannot be
   * rotated.
   */
  rotateDkimKey(domainId: string, options?: RequestOptions): Promise<DomainMutationResponse> {
    return this.request('POST /domains/{domainId}/dkim/rotate', {
      label: 'domains.rotateDkimKey',
      path: { domainId },
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
