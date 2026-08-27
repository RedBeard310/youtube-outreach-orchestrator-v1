import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifiablePitchableFormula } from '../src/airtable.ts';

test('verify pool excludes failed leads with an email verdict', () => {
  const formula = verifiablePitchableFormula();

  assert.match(formula, /\{outreach_status\}='email_found'/);
  assert.doesNotMatch(formula, /\{outreach_status\}='failed'/);
});
