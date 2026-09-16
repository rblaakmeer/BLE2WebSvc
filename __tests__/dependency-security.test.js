const { spawnSync } = require('node:child_process');
const path = require('node:path');
const qs = require('qs');
const yaml = require('js-yaml');
const browserslist = require('browserslist');

describe('September 2026 dependency security regressions', () => {
  test('qs enforces array limits on bracket-key comma input (#50)', () => {
    const options = { comma: true, arrayLimit: 3, throwOnLimitExceeded: true };
    expect(() => qs.parse('a[]=1,2,3,4', options)).toThrow(RangeError);
    expect(qs.parse('a=1,2,3', options)).toEqual({ a: ['1', '2', '3'] });
  });

  test('qs safely round-trips an attacker-controlled isBuffer property (#53)', () => {
    const parsed = qs.parse('x[constructor][isBuffer]=y', { plainObjects: true });
    expect(qs.stringify(parsed)).toBe('x%5Bconstructor%5D%5BisBuffer%5D=y');
    expect(qs.stringify({ value: Buffer.from('ok') })).toBe('value=ok');
  });

  test('Browserslist handles inherited-object names in untrusted stats (#52)', () => {
    const expected = browserslist('chrome 100');
    const stats = JSON.parse('{"__proto__":{"onekey":5},"toString":{"onekey":5},"constructor":{"onekey":5},"chrome":{"100":50}}');
    expect(browserslist('chrome 100', { stats })).toEqual(expected);
    expect(Object.prototype.onekey).toBeUndefined();
  });

  test('js-yaml charges empty merge sources against the work budget (#55)', () => {
    const source = 'arr: &arr [{}, {}, {}, {}]\ntarget: {<<: *arr}\n';
    expect(() => yaml.load(source, { maxTotalMergeKeys: 3 })).toThrow(/maxTotalMergeKeys/);
    expect(yaml.load('base: &base {ok: true}\ntarget: {<<: *base}\n').target).toEqual({ ok: true });
  });

  test('baseline-browser-mapping throws on conflicting options without exiting (#54)', () => {
    // Isolate this check so a regression to process.exit cannot terminate Jest.
    const result = spawnSync(process.execPath, ['-e', `
      const assert = require('node:assert/strict');
      const { getCompatibleVersions } = require('baseline-browser-mapping');
      assert.throws(() => getCompatibleVersions({
        targetYear: 2020, widelyAvailableOnDate: '2024-01-01'
      }));
      assert.ok(getCompatibleVersions({ targetYear: 2020 }).length > 0);
      console.log('survived');
    `], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 5000 });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('survived');
  });
});
