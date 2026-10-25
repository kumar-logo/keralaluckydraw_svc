import { Injectable, Logger } from '@nestjs/common';
import { resolveOddsClass } from './bet-vocabulary';

export type OddsSource = 'config' | 'alias' | 'stored' | 'missing';
export type MissingOddsPolicy = 'use_stored' | 'void_bet' | 'error';

export interface OddsResolution {
  odds: number;
  source: OddsSource;
  void: boolean;
}

export interface ResolveOddsInput {
  oddsMap: Record<string, number>;
  betCode: string;
  oddsKey?: string;
  storedOdds: number;
  aliasMap?: Record<string, string>;
  missingPolicy?: MissingOddsPolicy;
}

@Injectable()
export class OddsService {
  private readonly logger = new Logger(OddsService.name);

  resolve(input: ResolveOddsInput): OddsResolution {
    const {
      oddsMap,
      betCode,
      oddsKey,
      storedOdds,
      aliasMap = {},
      missingPolicy = 'use_stored',
    } = input;

    const candidates = [
      oddsKey,
      betCode,
      oddsKey ? aliasMap[oddsKey] : undefined,
      aliasMap[betCode],
      oddsKey ? resolveOddsClass(oddsKey, aliasMap) : undefined,
      resolveOddsClass(betCode, aliasMap),
    ].filter((k): k is string => !!k);

    for (const key of candidates) {
      const v = oddsMap[key];
      if (typeof v === 'number' && v > 0) {
        return { odds: v, source: 'config', void: false };
      }
    }

    if (missingPolicy === 'use_stored' && storedOdds > 0) {
      return { odds: storedOdds, source: 'stored', void: false };
    }
    if (missingPolicy === 'error') {
      throw new Error(
        `No odds resolved for betCode='${betCode}' oddsKey='${oddsKey ?? ''}'`,
      );
    }
    if (missingPolicy === 'void_bet') {
      this.logger.warn(
        `Odds missing for betCode='${betCode}' oddsKey='${oddsKey ?? ''}' — voiding bet`,
      );
      return { odds: 0, source: 'missing', void: true };
    }
    if (storedOdds > 0)
      return { odds: storedOdds, source: 'stored', void: false };
    this.logger.warn(
      `Unresolved odds for betCode='${betCode}' oddsKey='${oddsKey ?? ''}' (stored=0)`,
    );
    return { odds: 0, source: 'missing', void: false };
  }
}
