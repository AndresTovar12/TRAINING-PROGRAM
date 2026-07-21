/**
 * Wearables / smart-watch integration — extension point.
 *
 * This module is the *ready-but-not-wired* seam for connecting wearable
 * devices (Apple Health, Google Fit, Garmin, Whoop, …). It defines a single
 * provider contract plus a registry so a concrete provider can be dropped in
 * later without touching the rest of the app. Nothing here is imported by the
 * running UI yet — the integration is intentionally deferred ("decidir
 * después"). When a provider is implemented, register it and the rest of the
 * app can talk to it through the normalized shape below.
 *
 * Design goals:
 *  - Provider-agnostic: the app consumes a normalized metric shape, never a
 *    vendor SDK's raw payload.
 *  - No vendor lock-in at the call site: swap providers via the registry.
 *  - Async-first: every provider method returns a Promise, since real devices
 *    talk over the network / native bridges.
 */

/**
 * @typedef {Object} WearableMetrics
 * Normalized, provider-independent snapshot of a session or a moment in time.
 * All fields are optional — a provider fills in whatever it can measure.
 * @property {string}  [recordedAt]      ISO-8601 timestamp for the sample.
 * @property {number}  [heartRate]       Instantaneous / average heart rate (bpm).
 * @property {number}  [hrv]             Heart-rate variability (ms, RMSSD).
 * @property {number}  [restingHeartRate] Resting heart rate (bpm).
 * @property {number}  [sleepMinutes]    Total sleep duration (minutes).
 * @property {number}  [steps]           Step count for the period.
 * @property {number}  [calories]        Active energy burned (kcal).
 * @property {number}  [readiness]       Vendor readiness/recovery score (0–100).
 * @property {Object}  [raw]             Untouched vendor payload, for debugging.
 */

/**
 * @typedef {Object} WearableProvider
 * Contract every concrete provider must satisfy.
 * @property {string}  id                Stable slug, e.g. "apple-health".
 * @property {string}  label             Human-facing name, e.g. "Apple Health".
 * @property {() => Promise<boolean>}              isAvailable
 *   Resolves true when the device/SDK can be used in the current environment.
 * @property {() => Promise<WearableConnection>}   connect
 *   Kicks off auth/permission flow; resolves with an active connection.
 * @property {(c: WearableConnection) => Promise<void>} disconnect
 *   Tears down the connection and revokes local tokens.
 * @property {(c: WearableConnection, range?: MetricRange) => Promise<WearableMetrics[]>} fetchMetrics
 *   Pulls normalized metric samples for the given range (defaults to "today").
 */

/**
 * @typedef {Object} WearableConnection
 * Opaque handle returned by `connect` and passed back into other methods.
 * @property {string}  providerId        Which provider owns this connection.
 * @property {string}  [accountId]       Provider-side user/account id.
 * @property {number}  [connectedAt]     epoch ms when the link was established.
 */

/**
 * @typedef {Object} MetricRange
 * @property {string} from  ISO-8601 start (inclusive).
 * @property {string} to    ISO-8601 end (inclusive).
 */

/** Known provider slugs we intend to support. Wiring is deferred. */
export const WEARABLE_PROVIDERS = Object.freeze({
  APPLE_HEALTH: 'apple-health',
  GOOGLE_FIT: 'google-fit',
  GARMIN: 'garmin',
  WHOOP: 'whoop',
});

/** @type {Map<string, WearableProvider>} */
const registry = new Map();

/**
 * Register a concrete provider implementation.
 * @param {WearableProvider} provider
 * @returns {WearableProvider}
 */
export function registerWearableProvider(provider) {
  if (!provider?.id) throw new Error('Wearable provider needs a stable `id`.');
  registry.set(provider.id, provider);
  return provider;
}

/**
 * Look up a registered provider by slug.
 * @param {string} id
 * @returns {WearableProvider | undefined}
 */
export function getWearableProvider(id) {
  return registry.get(id);
}

/**
 * List every provider that has been registered so far.
 * @returns {WearableProvider[]}
 */
export function listWearableProviders() {
  return [...registry.values()];
}

/**
 * Whether any provider has been wired in. Today this is always false — the
 * UI can call this to decide whether to show a "Connect a device" entry point
 * without needing to know how the feature is implemented.
 * @returns {boolean}
 */
export function wearablesEnabled() {
  return registry.size > 0;
}
