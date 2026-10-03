// Packs the built package, installs the tarball into a temporary project and
// checks that ESM import, CJS require and the type declarations work there.
// Run `npm run build` first.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(join(tmpdir(), 'lettermint-smoke-'));
const run = (command, args, cwd = work) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

try {
  const [pack] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', work], root));
  const files = pack.files.map((file) => file.path).sort();
  const allowed =
    /^(dist\/index\.(js|mjs|d\.ts|d\.mts)|README\.md|UPGRADE\.md|CHANGELOG\.md|LICENSE(\.md)?|package\.json)$/;
  const unexpected = files.filter((file) => !allowed.test(file));
  if (unexpected.length)
    throw new Error(`Unexpected files in the package: ${unexpected.join(', ')}`);
  console.log(`packed ${pack.filename}: ${files.join(', ')}`);

  writeFileSync(join(work, 'package.json'), '{"name":"smoke","private":true}\n');
  run('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts', join(work, pack.filename)]);

  const checks = `
    const token = 'lm_smokeSecret0123456789abcdefABCD';
    if (Default !== Lettermint) throw new Error('default export differs from the named export');
    const client = new Lettermint({ sendingToken: token });
    const rendered = [inspect(client), inspect(client, { depth: Infinity }), JSON.stringify(client),
      inspect(client.emails.compose().from('a@example.test'))].join('\\n');
    if (rendered.includes(token)) throw new Error('the token is visible in debug output');
    if (new Lettermint(token).toJSON().sendingToken !== '[redacted]') throw new Error('shorthand failed');
    if (new TimeoutError(1).name !== 'TimeoutError') throw new Error('error names are mangled');
    try { new Lettermint('lm_sso_abc'); throw new Error('no error'); }
    catch (error) { if (!(error instanceof LettermintConfigError)) throw error; }
    const hook = new Webhook('whsec_smoke');
    const reason = await hook.verify('{}', {}).catch((error) => error.reason);
    if (reason !== 'signature_header_missing') throw new Error('webhook verification failed: ' + reason);
  `;
  writeFileSync(
    join(work, 'esm.mjs'),
    `import Default, { Lettermint, LettermintConfigError, TimeoutError, Webhook } from 'lettermint';
     import { inspect } from 'node:util';
     ${checks}
     console.log('ESM import ok');`
  );
  writeFileSync(
    join(work, 'cjs.cjs'),
    `const { Lettermint, LettermintConfigError, TimeoutError, Webhook } = require('lettermint');
     const Default = require('lettermint').default;
     const { inspect } = require('node:util');
     (async () => { ${checks} console.log('CJS require ok'); })().catch((error) => { console.error(error); process.exit(1); });`
  );
  process.stdout.write(run('node', ['esm.mjs']));
  process.stdout.write(run('node', ['cjs.cjs']));

  const typed = `
    const lettermint = new Lettermint({ sendingToken: 'lm_x', teamToken: 'lm_team_x' });
    async function main(): Promise<void> {
      const sent: SendMailResponse = await lettermint.emails.send({ from: 'a@b.c', to: ['d@e.f'], subject: 's' });
      const page: ListDomainsResponse = await lettermint.domains.list({ page: { size: 30 } });
      for await (const domain of lettermint.domains.iterate()) domain.id.toUpperCase();
      const error: ApiError = new NotFoundError({ status: 404, message: 'x' });
      void sent; void page; void error; void Default;
    }
    void main;`;
  writeFileSync(
    join(work, 'types.mts'),
    `import Default, { Lettermint, NotFoundError, type ApiError, type ListDomainsResponse, type SendMailResponse } from 'lettermint';\n${typed}`
  );
  writeFileSync(
    join(work, 'types.cts'),
    `import Default = require('lettermint');\nimport { Lettermint, NotFoundError, type ApiError, type ListDomainsResponse, type SendMailResponse } from 'lettermint';\n${typed}`
  );
  writeFileSync(
    join(work, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        noEmit: true,
        strict: true,
        module: 'nodenext',
        moduleResolution: 'nodenext',
        target: 'es2022',
        lib: ['es2022', 'dom'],
        types: [],
      },
      files: ['types.mts', 'types.cts'],
    })
  );
  run(join(root, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.json']);
  console.log('Type declarations ok (ESM and CJS, moduleResolution nodenext)');
} finally {
  rmSync(work, { recursive: true, force: true });
}
