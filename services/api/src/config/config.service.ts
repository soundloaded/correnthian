import { Injectable } from '@nestjs/common';
import { loadConfig, type CorrenthianConfig } from '@correnthian/config';

@Injectable()
export class ConfigService {
  readonly value: CorrenthianConfig;

  constructor() {
    // Throws with actionable guidance if the environment is incomplete.
    this.value = loadConfig();
  }

  get http() { return this.value.http; }
  get database() { return this.value.database; }
  get redis() { return this.value.redis; }
  get auth() { return this.value.auth; }
  get persona() { return this.value.persona; }
  get log() { return this.value.log; }
  get rateLimit() { return this.value.rateLimit; }
  get isProduction() { return this.value.env === 'production'; }
  get isTest() { return this.value.env === 'test'; }
}
