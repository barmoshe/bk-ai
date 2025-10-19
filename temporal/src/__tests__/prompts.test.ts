import { buildSystem as buildPagesSystem, buildUser as buildPagesUser } from '../lib/prompts/pages.prompt';
import { validateAgainstRules, TEXT_RULES, enforceTextToRules } from '../lib/ageRules';
import { buildSystem as buildLayoutSystem, buildUser as buildLayoutUser } from '../lib/prompts/layout.prompt';
import { BookPrefs, CharacterSpec } from '../types';

describe('Prompt templates', () => {
  const mockSpec: CharacterSpec = {
    name: 'Luna',
    age: 5,
    traits: ['curious', 'brave'],
    style: 'watercolor',
    palette: ['#FFB6C1', '#87CEEB'],
  };

  const mockPrefs: BookPrefs = {
    title: 'Luna\'s Adventure',
    topic: 'Space',
    targetAge: 5,
    pages: 8,
    tone: 'cheerful',
  };

  describe('Pages prompt', () => {
    it('should build system prompt with page count', () => {
      const system = buildPagesSystem(mockPrefs);
      expect(system).toContain('1..8');
      // System prompt should not mention age numbers directly in constraints
      expect(system).toMatch(/Age-targeted text constraints/);
    });

    it('should build user prompt with character and prefs', () => {
      const user = buildPagesUser(mockSpec, mockPrefs);
      expect(user).toContain('Luna\'s Adventure');
      expect(user).toContain('Space');
      expect(user).toContain('watercolor');
    });
  });

  describe('Age rules validator', () => {
    it('flags commas for T2', () => {
      const rules = TEXT_RULES.T2;
      const res = validateAgainstRules('Hi, mom.', rules, 'T2');
      expect(res.ok).toBe(false);
      expect(res.issues.join(' ')).toMatch(/commas not allowed/i);
    });

    it('accepts short simple sentence for F2T3', () => {
      const rules = TEXT_RULES.F2T3;
      const res = validateAgainstRules('Hi Mom!', rules, 'F2T3');
      expect(res.ok).toBe(true);
    });

    it('limits dialogue and commas for F3T5', () => {
      const rules = TEXT_RULES.F3T5;
      const res = validateAgainstRules(`"Hi!" she said, smiling, quickly.`, rules, 'F3T5');
      expect(res.ok).toBe(false);
      expect(res.issues.join(' ')).toMatch(/too many commas|too many dialogue/);
      const clamped = enforceTextToRules(`"Hi!" she said, smiling, quickly.`, rules, 'F3T5');
      const after = validateAgainstRules(clamped, rules, 'F3T5');
      expect(after.ok).toBe(true);
    });

    it('no dialogue/commas for T2', () => {
      const rules = TEXT_RULES.T2;
      const res = validateAgainstRules(`"Go!" pop, pop.`, rules, 'T2');
      expect(res.ok).toBe(false);
      const clamped = enforceTextToRules(`"Go!" pop, pop.`, rules, 'T2');
      const after = validateAgainstRules(clamped, rules, 'T2');
      expect(after.ok).toBe(true);
    });

    it('limits dialogue lines for F5T7 (max 2)', () => {
      const rules = TEXT_RULES.F5T7;
      const text = `"Hey!" "Yes!" We go now. "No!" We smile.`; // 2 sentences; 3 dialogue segments
      const res = validateAgainstRules(text, rules, 'F5T7');
      expect(res.ok).toBe(false);
      expect(res.issues.join(' ')).toMatch(/too many dialogue lines|dialogue/);
      const clamped = enforceTextToRules(text, rules, 'F5T7');
      const after = validateAgainstRules(clamped, rules, 'F5T7');
      expect(after.ok).toBe(true);
    });

    it('limits commas for F7 (max 3)', () => {
      const rules = TEXT_RULES.F7;
      const text = `We explore, learn, and laugh. "Hello!" he says, softly. New word appears, context teaches.`; // 3 sentences; 4 commas
      const res = validateAgainstRules(text, rules, 'F7');
      expect(res.ok).toBe(false);
      expect(res.issues.join(' ')).toMatch(/too many commas/);
      const clamped = enforceTextToRules(text, rules, 'F7');
      const after = validateAgainstRules(clamped, rules, 'F7');
      expect(after.ok).toBe(true);
    });
  });

  describe('Layout prompt', () => {
    it('should build system prompt', () => {
      const system = buildLayoutSystem();
      expect(system).toContain('print');
      expect(system).toContain('layouts');
    });

    it('should build user prompt with page count', () => {
      const user = buildLayoutUser(mockSpec, mockPrefs, 8);
      expect(user).toContain('Pages: 8');
      expect(user).toContain('watercolor');
    });
  });
});

