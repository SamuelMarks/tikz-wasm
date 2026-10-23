/**
 * Unit tests for `scripts/check_docs.ts`.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditFile, collectTypeScriptFiles, runDocCheck } from '../scripts/check_docs.js';

describe('Script: check_docs.ts', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tikz-doc-check-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should pass on the actual repository codebase', () => {
    const logs: string[] = [];
    const ok = runDocCheck(undefined, (msg: string): void => {
      logs.push(msg);
    });
    expect(logs).toEqual([]);
    expect(ok).toBe(true);
  });

  it('should detect all categories of missing JSDoc and forbidden TS constructs', () => {
    const srcDir = path.join(tempDir, 'src');
    const subDir = path.join(srcDir, 'nested');
    fs.mkdirSync(subDir, { recursive: true });

    // Ignore .d.ts files
    fs.writeFileSync(path.join(srcDir, 'ignored.d.ts'), 'export type X = any;');

    const badFile = path.join(subDir, 'bad.ts');
    const tsSuppress = '@' + 'ts-ignore';
    fs.writeFileSync(
      badFile,
      [
        `// No package documentation header here`,
        `// ${tsSuppress}`,
        `export class UndocumentedClass {`,
        `  public prop: any;`,
        `  constructor(x: number) {}`,
        `  get val(): number { return 1; }`,
        `  method(a: string): number { return 1; }`,
        `}`,
        `/**`,
        ` * Documented function missing tags.`,
        ` * @deprecated`,
        ` */`,
        `export function fnMissingTags(p: number): string { return String(p); }`,
        `export default class {}`,
        `export default function (a: number): void {}`,
        `export function fnVoid(): void {}`,
        `export async function fnPromiseVoid(): Promise<void> {}`,
        `export function fnImplicitReturn( { a }: { a: number } ) {}`,
        `export const arrowNoDocs = (x: number): number => x;`,
        `export const constNoDocs = 123;`,
        `/**`,
        ` * Fully documented function.`,
        ` * @param x - Input number.`,
        ` * @returns Output number.`,
        ` */`,
        `export function goodFn(x: number): number { return x; }`,
      ].join(String.fromCharCode(10))
    );

    const violations = auditFile(badFile, tempDir);
    const messages = violations.map((v) => v.message);

    expect(messages).toContain('Missing file-level @packageDocumentation comment.');
    expect(messages).toContain('Forbidden TypeScript directive: @ts-ignore.');
    expect(messages).toContain('Forbidden use of explicit `any` type.');
    expect(messages).toContain("Missing JSDoc description on declaration 'UndocumentedClass'.");
    expect(messages).toContain("Missing JSDoc description on property 'prop'.");
    expect(messages).toContain("Missing JSDoc description on 'constructor'.");
    expect(messages).toContain("Missing JSDoc description on getter 'val'.");
    expect(messages).toContain("Missing JSDoc description on 'method'.");
    expect(messages).toContain("Missing @param documentation for 'p' in 'fnMissingTags'.");
    expect(messages).toContain("Missing @returns documentation on 'fnMissingTags'.");
    expect(messages).toContain("Missing JSDoc description on 'arrowNoDocs'.");
    expect(messages).toContain("Missing JSDoc description on exported variable 'constNoDocs'.");

    const defaultLogs: string[] = [];
    const ok = runDocCheck(tempDir, (msg: string): void => {
      defaultLogs.push(msg);
    });
    expect(ok).toBe(false);
    expect(defaultLogs.length).toBeGreaterThan(0);

    // Also test default logger parameter on runDocCheck
    const errSpy = (console.error = (): void => {});
    expect(runDocCheck(tempDir)).toBe(false);
    void errSpy;
  });

  it('should handle non-existent directories in collectTypeScriptFiles', () => {
    expect(collectTypeScriptFiles([path.join(tempDir, 'does-not-exist')])).toEqual([]);
  });
});
