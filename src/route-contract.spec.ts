import { Lettermint } from './lettermint';
import type { RouteData } from './types';

const base: RouteData = {
  id: 'route_1',
  project_id: 'project_1',
  slug: 'incoming',
  name: 'Incoming',
  route_type: 'inbound',
  is_default: false,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
};

describe('inbound route domain contract', () => {
  it.each(['incoming.example.com', null, undefined])(
    'keeps a %s domain on the route client',
    async (domain) => {
      const payload: RouteData = {
        ...base,
        ...(domain === undefined ? {} : { inbound_route_domain: domain }),
      };
      global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: true, json: async () => payload } as Response);
      const result = await Lettermint.api('team-token').routes.retrieve('route_1');
      const typedDomain: string | null | undefined = result.inbound_route_domain;
      expect(typedDomain).toBe(domain);
      expect(JSON.parse(JSON.stringify(result))).toEqual(payload);
    }
  );
});
