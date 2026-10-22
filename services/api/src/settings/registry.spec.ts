import { describe, expect, it } from 'vitest';
import { SETTING_DEFINITIONS, settingDefinition, settingKeys } from './registry.js';

/**
 * The registry is the definition of every setting, so its own rules are
 * pinned here rather than trusted.
 */
describe('the settings registry', () => {
  it('every key is namespaced, unique and shaped like `area.thing-name`', () => {
    const keys = settingKeys();

    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key, `key "${key}" must be a lowercase namespaced name`).toMatch(
        /^[a-z0-9][a-z0-9]*\.[a-z0-9][a-z0-9-]*$/,
      );
    }
  });

  it('every default satisfies the schema that guards it', () => {
    // The module already refuses to load when this fails, so a failure here
    // means the check was removed rather than the default being wrong.
    for (const definition of SETTING_DEFINITIONS) {
      const parsed = definition.schema.safeParse(definition.default);
      expect(
        parsed.success,
        `the default for "${definition.key}" does not satisfy its own schema`,
      ).toBe(true);
    }
  });

  it('every declaration says what the console needs to render it', () => {
    for (const definition of SETTING_DEFINITIONS) {
      expect(definition.label.length, `"${definition.key}" needs a label`).toBeGreaterThan(0);
      expect(definition.description.length, `"${definition.key}" needs a description`).toBeGreaterThan(0);
      expect(definition.category.length, `"${definition.key}" needs a category`).toBeGreaterThan(0);
      expect(['boolean', 'number', 'string']).toContain(definition.type);
    }
  });

  it('a number declares the bounds its schema enforces', () => {
    // The console renders the input from these, so a number without them
    // would be a field the operator can type any value into.
    for (const definition of SETTING_DEFINITIONS) {
      if (definition.type !== 'number') continue;
      expect(definition.min, `"${definition.key}" needs a lower bound`).toBeDefined();
      expect(definition.max, `"${definition.key}" needs an upper bound`).toBeDefined();
      expect(definition.min!).toBeLessThan(definition.max!);
    }
  });

  it('a key nobody declared is not found', () => {
    expect(settingDefinition('nope.not-a-key')).toBeUndefined();
    expect(settingDefinition('platform.maintenance-mode')).toBeDefined();
  });
});
