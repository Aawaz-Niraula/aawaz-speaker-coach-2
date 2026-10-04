import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

describe('marketing style isolation', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/app/(site)/site.css'), 'utf8');

  it('cannot style the coach after navigating away from the homepage', () => {
    const unscoped: string[] = [];
    postcss.parse(css).walkRules((rule) => {
      for (const selector of rule.selectors) {
        if (!selector.startsWith('.site-shell') &&
            !selector.startsWith(':where(.site-shell) ') &&
            !selector.startsWith('body:has(.site-shell)') &&
            !selector.startsWith('html:has(.site-shell)')) {
          unscoped.push(selector);
        }
      }
    });
    expect(unscoped).toEqual([]);
  });

  it('does not reuse the coach card glass-surface class', () => {
    const component = readFileSync(resolve(process.cwd(), 'src/components/site/glass-surface.tsx'), 'utf8');
    expect(css).not.toMatch(/\.glass-surface\b/);
    expect(component).not.toContain('className="glass-surface"');
    expect(component).toContain('className="site-liquid-surface"');
  });
});
