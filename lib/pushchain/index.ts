/**
 * DreamTeam Backend — Entry Points
 *
 * This file shows how all services connect. In production, each service
 * runs as a separate process for isolation and independent scaling.
 */

// ──────────────────────────────────────────────────────────
//  Scoring Engine (pure functions, no dependencies)
// ──────────────────────────────────────────────────────────
export { computeCricketPoints, computeCricketMatchScores } from './engine/cricket.engine';
export { computeFootballPoints, computeFootballMatchScores } from './engine/football.engine';

// Scoring configs
export { CRICKET_CONFIGS } from './engine/configs/cricket.config';
export { FOOTBALL_CONFIG } from './engine/configs/football.config';

// Types
export type {
  SportmonksCricketPlayer,
  SportmonksCricketBatting,
  SportmonksCricketBowling,
  SportmonksCricketFielding,
  SportmonksFootballPlayerStats,
  SportmonksFootballGoalEvent,
  SportmonksFootballSubEvent,
  CricketFormat,
  FootballFormat,
  MatchFormat,
  CricketScoringConfig,
  FootballScoringConfig,
  PlayerPointBreakdown,
  PointLineItem,
  MatchScoringResult,
} from './types/scoring.types';

// ──────────────────────────────────────────────────────────
//  Services
// ──────────────────────────────────────────────────────────
export { OracleService } from './services/oracle.service';
export { MatchSchedulerService } from './services/scheduler.service';

// ──────────────────────────────────────────────────────────
//  Service Startup (example)
// ──────────────────────────────────────────────────────────

/*
// Oracle Settlement Worker
import { OracleService } from './services/oracle.service';

const oracle = new OracleService({
  oraclePrivateKey: process.env.ORACLE_PRIVATE_KEY!,
  rpcUrl: process.env.ARBITRUM_RPC_URL!,
  scoringRegistryAddress: process.env.SCORING_REGISTRY_ADDRESS!,
  sportmonksApiToken: process.env.SPORTMONKS_API_TOKEN!,
  sportmonksCricketBaseUrl: 'https://cricket.sportmonks.com/api/v2.0',
  sportmonksFootballBaseUrl: 'https://soccer.sportmonks.com/api/v2.0',
  chainId: 42161, // Arbitrum One
});

// Settle a completed match
await oracle.settleMatch(98765, 'T20', 'cricket');

// ─────────────────────────────────────

// Match Scheduler Worker (cron)
import { MatchSchedulerService } from './services/scheduler.service';

const scheduler = new MatchSchedulerService({
  sportmonksCricketBaseUrl: 'https://cricket.sportmonks.com/api/v2.0',
  sportmonksFootballBaseUrl: 'https://soccer.sportmonks.com/api/v2.0',
  sportmonksApiToken: process.env.SPORTMONKS_API_TOKEN!,
  rpcUrl: process.env.ARBITRUM_RPC_URL!,
  contestFactoryAddress: process.env.CONTEST_FACTORY_ADDRESS!,
  adminPrivateKey: process.env.ADMIN_PRIVATE_KEY!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_KEY!,
});

// Run every 6 hours via cron
await scheduler.run();
*/
