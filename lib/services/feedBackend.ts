import { FEATURE_FLAGS } from '@/lib/config/featureFlags';
import { feedApi } from './feedApi';
import { feedSupabase } from './feedSupabase';

/**
 * The feed transport FeedService talks to. Mapped over the self-hosted client
 * so its public methods define the contract (private members drop out).
 */
export type FeedBackend = { [K in keyof typeof feedApi]: (typeof feedApi)[K] };

/** Supabase by default; the self-hosted server when the flag is off. */
export function getFeedBackend(): FeedBackend {
  return FEATURE_FLAGS.supabaseFeed ? feedSupabase : feedApi;
}
