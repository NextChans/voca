import { describe, expect, it } from 'vitest';
import { safeInternalPath } from '@/lib/domain/safePath';

describe('safeInternalPath', () => {
  it('내부 경로는 그대로', () => {
    expect(safeInternalPath('/words?tab=new')).toBe('/words?tab=new');
    expect(safeInternalPath('/auth/reset')).toBe('/auth/reset');
  });
  it('외부로 해석되는 값은 fallback', () => {
    for (const v of ['//evil.com', '/\\evil.com', '/\t/evil.com', '/%09/evil.com'.replace('%09', '\t'), 'https://evil.com', 'evil.com', '', null, 3]) {
      expect(safeInternalPath(v, '/settings')).toBe('/settings');
    }
  });
});
