import { describe, expect, it } from 'vitest';
import { newId } from './ids';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newId', () => {
  it('uses randomUUID when the browser has it', () => {
    expect(newId({ randomUUID: () => '11111111-2222-4333-8444-555555555555', getRandomValues: crypto.getRandomValues.bind(crypto) })).toBe(
      '11111111-2222-4333-8444-555555555555',
    );
  });

  it('builds a random UUID v4 without randomUUID (plain http)', () => {
    const plainHttp = { getRandomValues: crypto.getRandomValues.bind(crypto) };
    const ids = Array.from({ length: 200 }, () => newId(plainHttp));
    for (const id of ids) expect(id).toMatch(UUID_V4);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
