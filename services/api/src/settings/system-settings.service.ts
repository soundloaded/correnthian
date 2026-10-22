import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError, ValidationError } from '../common/errors.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  settingDefinition,
  settingDefinitions,
  type SettingKey,
  type SettingShape,
  type SettingValue,
} from './registry.js';

/** The operator behind a change. From the session, never from the body. */
export interface SettingActor {
  id: string;
  role: string;
}

/** Where the value the API is serving came from. */
export type SettingSource = 'default' | 'override';

/**
 * One setting, as the console renders it.
 *
 * The payload describes itself — type, bounds, label, description — because
 * the console must not hold a second list of settings that can drift from
 * this one. A setting the registry declares and the console has never heard
 * of still renders; a setting the console knows and the registry does not
 * cannot be written at all.
 */
export interface SystemSettingView {
  key: string;
  /** The value in effect: the override if there is one, otherwise the default. */
  value: unknown;
  source: SettingSource;
  category: string;
  label: string;
  description: string;
  type: 'boolean' | 'number' | 'string';
  min?: number;
  max?: number;
  clientVisible: boolean;
  /** When the override was last written. Null while the default is in force. */
  updatedAt: string | null;
}

const OVERRIDE_SELECT = {
  key: true,
  value: true,
  updatedAt: true,
} as const;

type OverrideRow = {
  key: string;
  value: Prisma.JsonValue;
  updatedAt: Date;
};

/**
 * The system-settings store.
 *
 * Reads resolve to `override ?? default`, and the default is the value the
 * code was already using, so an empty table means the platform behaves
 * exactly as it did before this table existed.
 *
 * **The only service that may read or write `prisma.systemSetting`.** The
 * value column is `Json`, so the database enforces nothing: a read that
 * bypassed this service would skip the validation and the fallback, and
 * would reintroduce the exact defect this table exists to remove.
 */
@Injectable()
export class SystemSettingsService {
  private readonly logger = new Logger(SystemSettingsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /**
   * The effective value of one setting.
   *
   * No cache, deliberately. A cached value is wrong in the direction that
   * matters: a sanctions window that reads stale lets an unscreened person
   * move fiat, and a price window that reads stale prices a fee from a price
   * an operator had just rejected. One primary-key read beside the queries
   * each caller already runs is cheaper than a cache that can be wrong.
   */
  async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
    const definition = settingDefinition(key);
    if (!definition) throw AppError.notFound(`Unknown setting: ${key}`);

    const row = await this.overrideFor(key);
    return this.resolve(definition, row) as SettingValue<K>;
  }

  /**
   * Every setting the code declares, with the value in force.
   *
   * The registry is the list; the table only says which of them have been
   * overridden. A row whose key is not in the registry is invisible here —
   * and `settings-system.spec.ts` fails the build if one exists, because an
   * unread row is a setting that looks live and is not.
   */
  async list(): Promise<SystemSettingView[]> {
    const rows = await this.prisma.systemSetting.findMany({ select: OVERRIDE_SELECT });
    const byKey = new Map(rows.map((row) => [row.key, row]));
    return settingDefinitions().map((definition) =>
      this.view(definition, byKey.get(definition.key) ?? null),
    );
  }

  /**
   * Replace a setting's value.
   *
   * The write is the override; the default stays where it is, in code. Clearing
   * the override is a separate call, and it is recorded as its own act — an
   * operator who puts a setting back to its default has done something, and
   * the trail should say so.
   */
  async set(key: string, value: unknown, actor: SettingActor): Promise<SystemSettingView> {
    const definition = settingDefinition(key);
    if (!definition) throw AppError.notFound(`Unknown setting: ${key}`);

    const parsed = definition.schema.safeParse(value);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }

    const before = await this.overrideFor(key);
    const beforeValue = before ? this.resolve(definition, before) : definition.default;

    const row = await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: parsed.data as Prisma.InputJsonValue },
      update: { value: parsed.data as Prisma.InputJsonValue },
      select: OVERRIDE_SELECT,
    });

    await this.audit.recordChange({
      action: 'setting.changed',
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'SystemSetting',
      targetId: key,
      // A setting changes what every account sees, so it opts in by name
      // rather than by verb — the same treatment a feature flag gets.
      destructive: true,
      before: { value: beforeValue, source: before ? 'override' : 'default' },
      after: { value: parsed.data, source: 'override' },
    });

    return this.view(definition, row);
  }

  /**
   * Drop an override, putting the declared default back in force.
   *
   * A key with no override has nothing to clear, and saying so is more honest
   * than writing an audit line about a change that did not happen.
   */
  async clear(key: string, actor: SettingActor): Promise<void> {
    const definition = settingDefinition(key);
    if (!definition) throw AppError.notFound(`Unknown setting: ${key}`);

    const before = await this.overrideFor(key);
    if (!before) throw AppError.notFound(`"${key}" is already at its default`);

    await this.prisma.systemSetting.delete({ where: { key } });

    await this.audit.recordChange({
      action: 'setting.reset',
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'SystemSetting',
      targetId: key,
      destructive: true,
      // Both halves are recorded: the override that was removed, and the
      // default that is now in force.
      before: { value: this.resolve(definition, before), source: 'override' },
      after: { value: definition.default, source: 'default' },
    });
  }

  private async overrideFor(key: string): Promise<OverrideRow | null> {
    return this.prisma.systemSetting.findUnique({ where: { key }, select: OVERRIDE_SELECT });
  }

  /**
   * The value in force, with the fallback that keeps the platform up.
   *
   * A stored value that no longer satisfies its key's schema — because a
   * later change tightened the bounds — falls back to the declared default
   * and says so loudly. The alternative, refusing to serve, turns a
   * configuration mistake into an outage.
   */
  private resolve(definition: SettingShape, row: OverrideRow | null): unknown {
    if (!row) return definition.default;
    const parsed = definition.schema.safeParse(row.value);
    if (!parsed.success) {
      this.logger.error(
        `The stored value for "${definition.key}" no longer satisfies its schema; ` +
          `serving the declared default instead. Re-save the setting to replace it.`,
      );
      return definition.default;
    }
    return parsed.data;
  }

  private view(definition: SettingShape, row: OverrideRow | null): SystemSettingView {
    return {
      key: definition.key,
      value: this.resolve(definition, row),
      source: row ? 'override' : 'default',
      category: definition.category,
      label: definition.label,
      description: definition.description,
      type: definition.type,
      ...(definition.min !== undefined ? { min: definition.min } : {}),
      ...(definition.max !== undefined ? { max: definition.max } : {}),
      clientVisible: definition.clientVisible,
      updatedAt: row ? row.updatedAt.toISOString() : null,
    };
  }
}
