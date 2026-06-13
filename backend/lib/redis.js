import {Redis} from '@upstash/redis';

// Lê UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN do ambiente.
// O leaderboard é um SORTED SET: cada membro = nome do jogador, score = dinheiro.
export const redis = Redis.fromEnv();
