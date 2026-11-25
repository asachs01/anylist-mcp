import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installUserDataCache } from '../src/userdata-cache.js';

function fakeClient() {
  const c = {
    downloads: 0,
    _userData: null,
    async _getUserData(refresh) {
      if (!this._userData || refresh) {
        this.downloads++;
        await new Promise((r) => setTimeout(r, 5));
        this._userData = { n: this.downloads };
      }
      return this._userData;
    },
  };
  return c;
}

test('repeated refreshCache=true reads hit the network once within TTL', async () => {
  let t = 0;
  const c = fakeClient();
  installUserDataCache(c, { ttlMs: 1000, now: () => t });
  for (let i = 0; i < 20; i++) await c._getUserData(true);
  assert.equal(c.downloads, 1);
});

test('re-downloads after TTL expires', async () => {
  let t = 0;
  const c = fakeClient();
  installUserDataCache(c, { ttlMs: 1000, now: () => t });
  await c._getUserData(true);
  t = 999;
  await c._getUserData(true);
  assert.equal(c.downloads, 1);
  t = 1000;
  await c._getUserData(true);
  assert.equal(c.downloads, 2);
});

test('invalidate forces exactly one re-download', async () => {
  let t = 0;
  const c = fakeClient();
  const cache = installUserDataCache(c, { ttlMs: 1000, now: () => t });
  await c._getUserData(true);
  cache.invalidate();
  await c._getUserData(true);
  await c._getUserData(true);
  assert.equal(c.downloads, 2);
});

test('concurrent callers share one download', async () => {
  const c = fakeClient();
  installUserDataCache(c, { ttlMs: 1000 });
  await Promise.all(Array.from({ length: 10 }, () => c._getUserData(true)));
  assert.equal(c.downloads, 1);
});

test('failed download is not cached', async () => {
  let fail = true;
  const c = fakeClient();
  const orig = c._getUserData;
  c._getUserData = async function (r) {
    if (fail) throw new Error('429');
    return orig.call(this, r);
  };
  installUserDataCache(c, { ttlMs: 1000 });
  await assert.rejects(() => c._getUserData(true));
  fail = false;
  await c._getUserData(true);
  assert.equal(c.downloads, 1);
});
