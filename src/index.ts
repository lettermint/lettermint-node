import { Lettermint } from './lettermint';

export { Lettermint };
export type { LettermintOptions, LettermintShorthandOptions } from './lettermint';
export type {
  EmailAttachment,
  EmailBuilder,
  EmailMessage,
  EmailMessageAttachment,
  Emails,
  SendOptions,
} from './emails';
export type { Domains } from './resources/domains';
export type { Messages } from './resources/messages';
export type { Projects, ReportForwarding } from './resources/projects';
export type { Routes } from './resources/routes';
export type { Stats, Suppressions, Team, TeamMembers } from './resources/team';
export type { WebhookDeliveries, Webhooks } from './resources/webhooks';
export type { FetchFunction, IdempotentRequestOptions, RequestOptions } from './transport';
export type { NestedQuery } from './query';
export type { BinaryInput } from './encoding';
export { Webhook } from './webhook';
export type { WebhookBody, WebhookHeaders, WebhookOptions, WebhookPayload } from './webhook';
export {
  ApiError,
  AuthenticationError,
  ConflictError,
  ConnectionError,
  LettermintConfigError,
  LettermintError,
  LettermintValidationError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  RedirectError,
  ServerError,
  TimeoutError,
  UnexpectedResponseError,
  ValidationError,
  WebhookVerificationError,
} from './errors';
export type { ApiErrorInit, WebhookVerificationReason } from './errors';

// Generated API types. `ApiError` and `ValidationError` are error classes in the
// SDK, so their body types are exported as `ApiErrorBody` and `ValidationErrorBody`.
export type * from './generated/types';
export type {
  ApiError as ApiErrorBody,
  ValidationError as ValidationErrorBody,
} from './generated/types';
export type {
  AuthSurface,
  OperationDefinition,
  OperationError,
  OperationErrorStatus,
  OperationKey,
  OperationPathParams,
  OperationQuery,
  OperationRequest,
  OperationResponse,
  OperationTypes,
  Operations,
} from './generated/operations';

export default Lettermint;
