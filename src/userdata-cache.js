/**
 * TTL cache for AnyList's `data/user-data/get` endpoint.
 *
 * anylist-js downloads the ENTIRE account (every list, recipe, meal plan event)
 * whenever getLists(), getRecipes() or getMealPlanningCalendarEvents() is called
 * (refreshCache defaults to true), and again on every websocket
 * "refresh-shopping-lists" push. AnyList throttles accounts that do this too
 * often, so we serve reads from memory and only re-download when the cached copy
 * is older than the TTL (default 10 minutes) or has been explicitly invalidated
 * (after recipe / meal plan / collection / store writes).
 */

export const DEFAULT_USERDATA_TTL_MS =
  (parseInt(process.env.ANYLIST_USERDATA_TTL_SECONDS, 10) || 600) * 1000;

/**
 * @param {object} client an anylist-js AnyList instance
 * @param {{ ttlMs?: number, now?: () => number }} [opts]
 * @returns {{ isStale: () => boolean, invalidate: () => void, stats: () => object }}
 */
export function installUserDataCache(client, { ttlMs = DEFAULT_USERDATA_TTL_MS, now = Date.now } = {}) {
  const fetchUserData = client._getUserData.bind(client);
  let fetchedAt = -Infinity;
  let inflight = null;
  let downloads = 0;
  let served = 0;

  const isStale = () => !client._userData || now() - fetchedAt >= ttlMs;

  client._getUserData = async function cachedGetUserData(/* refreshCache ignored on purpose */) {
    if (!isStale()) {
      served++;
      return client._userData;
    }
    // Coalesce concurrent callers into a single download
    if (!inflight) {
      inflight = fetchUserData(true)
        .then((data) => {
          fetchedAt = now();
          downloads++;
          return data;
        })
        .finally(() => {
          inflight = null;
        });
    }
    return inflight;
  };

  return {
    isStale,
    invalidate: () => {
      fetchedAt = -Infinity;
    },
    stats: () => ({ downloads, served, ttlMs }),
  };
}
