/**
 * Automated documentation and type-safety verification script (`scripts/check_docs.ts`).
 *
 * Uses the TypeScript Compiler API to verify 100% JSDoc/TSDoc coverage across all
 * files, classes, interfaces, type aliases, enums, functions, methods, properties,
 * parameters (`@param`), and return types (`@returns`), as well as zero `any` usage
 * and zero TS suppression directives.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/**
 * Represents a single documentation or type-safety violation discovered by the AST auditor.
 */
export interface AuditViolation {
  /**
   * Relative path to the offending file.
   */
  readonly file: string;
  /**
   * 1-based line number of the violation.
   */
  readonly line: number;
  /**
   * Human-readable description of the violation.
   */
  readonly message: string;
}

/**
 * Extracts raw JSDoc comments attached to a TypeScript AST node.
 *
 * @param node - The AST node to inspect.
 * @param sourceFile - The containing TypeScript source file.
 * @returns An array of JSDoc nodes attached to the AST node.
 */
export function getJSDocs(node: ts.Node, sourceFile: ts.SourceFile): readonly ts.JSDoc[] {
  const children = node.getChildren(sourceFile);
  const docs: ts.JSDoc[] = [];
  for (const child of children) {
    if (ts.isJSDoc(child)) {
      docs.push(child);
    }
  }
  return docs;
}

/**
 * Checks whether a function-like declaration has a non-void return type requiring `@returns`.
 *
 * @param node - The function or method declaration.
 * @returns `true` if the declaration requires a `@returns` tag.
 */
export function requiresReturnsTag(
  node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.MethodSignature | ts.ArrowFunction | ts.FunctionExpression
): boolean {
  if (!node.type || node.type.kind === ts.SyntaxKind.VoidKeyword) {
    return false;
  }
  if (
    ts.isTypeReferenceNode(node.type) &&
    ts.isIdentifier(node.type.typeName) &&
    node.type.typeName.text === 'Promise' &&
    node.type.typeArguments?.[0]?.kind === ts.SyntaxKind.VoidKeyword
  ) {
    return false;
  }
  return true;
}

/**
 * Audits a single TypeScript file for 100% documentation coverage and strict type hygiene.
 *
 * @param filePath - Absolute path to the TypeScript file.
 * @param rootDir - Workspace root directory for relative path reporting.
 * @returns An array of discovered {@link AuditViolation} items.
 */
export function auditFile(filePath: string, rootDir: string): AuditViolation[] {
  const relPath = path.relative(rootDir, filePath).replaceAll(String.fromCharCode(92), '/');
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.ESNext, true);
  const violations: AuditViolation[] = [];

  const getLine = (pos: number): number =>
    sourceFile.getLineAndCharacterOfPosition(pos).line + 1;

  // 1. Check for @packageDocumentation at top of file
  if (!content.includes('@packageDocumentation')) {
    violations.push({
      file: relPath,
      line: 1,
      message: 'Missing file-level @packageDocumentation comment.'
    });
  }

  // 2. Check for forbidden TS suppression comments
  const tsDirectiveRegex = new RegExp('@ts-' + '(ignore|expect-error|nocheck)');
  const tsIgnoreMatch = tsDirectiveRegex.exec(content);
  if (tsIgnoreMatch && tsIgnoreMatch.index !== undefined) {
    violations.push({
      file: relPath,
      line: getLine(tsIgnoreMatch.index),
      message: `Forbidden TypeScript directive: @ts-${tsIgnoreMatch[1]}.`
    });
  }

  const checkFunctionDocs = (
    docTarget: ts.Node,
    fnNode: ts.FunctionDeclaration | ts.MethodDeclaration | ts.MethodSignature | ts.ConstructorDeclaration | ts.ArrowFunction | ts.FunctionExpression,
    name: string
  ): void => {
    const docs = getJSDocs(docTarget, sourceFile);
    const lastDoc = docs[docs.length - 1];
    if (!lastDoc || !lastDoc.comment) {
      violations.push({
        file: relPath,
        line: getLine(docTarget.getStart(sourceFile)),
        message: `Missing JSDoc description on '${name}'.`
      });
      return;
    }

    const tags = lastDoc.tags ?? [];
    const documentedParams = new Set<string>();
    let hasReturns = false;

    for (const tag of tags) {
      if (ts.isJSDocParameterTag(tag)) {
        documentedParams.add(tag.name.getText(sourceFile));
      } else if (ts.isJSDocReturnTag(tag)) {
        hasReturns = true;
      }
    }

    for (const param of fnNode.parameters) {
      const paramName = param.name.getText(sourceFile);
      if (!documentedParams.has(paramName)) {
        violations.push({
          file: relPath,
          line: getLine(param.getStart(sourceFile)),
          message: `Missing @param documentation for '${paramName}' in '${name}'.`
        });
      }
    }

    if (!ts.isConstructorDeclaration(fnNode) && requiresReturnsTag(fnNode) && !hasReturns) {
      violations.push({
        file: relPath,
        line: getLine(docTarget.getStart(sourceFile)),
        message: `Missing @returns documentation on '${name}'.`
      });
    }
  };

  const hasDescription = (node: ts.Node): boolean => {
    const docs = getJSDocs(node, sourceFile);
    const lastDoc = docs[docs.length - 1];
    return Boolean(lastDoc && lastDoc.comment);
  };

  const visit = (node: ts.Node): void => {
    // Disallow explicit `any` keyword
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      violations.push({
        file: relPath,
        line: getLine(node.getStart(sourceFile)),
        message: 'Forbidden use of explicit `any` type.'
      });
    }

    if (
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node)
    ) {
      const name = node.name ? node.name.text : '<anonymous>';
      if (!hasDescription(node)) {
        violations.push({
          file: relPath,
          line: getLine(node.getStart(sourceFile)),
          message: `Missing JSDoc description on declaration '${name}'.`
        });
      }
    } else if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
      const name = node.name.getText(sourceFile);
      if (!hasDescription(node)) {
        violations.push({
          file: relPath,
          line: getLine(node.getStart(sourceFile)),
          message: `Missing JSDoc description on property '${name}'.`
        });
      }
    } else if (ts.isFunctionDeclaration(node)) {
      const name = node.name ? node.name.text : '<anonymous>';
      checkFunctionDocs(node, node, name);
    } else if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
      const name = node.name.getText(sourceFile);
      checkFunctionDocs(node, node, name);
    } else if (ts.isConstructorDeclaration(node)) {
      checkFunctionDocs(node, node, 'constructor');
    } else if (ts.isGetAccessorDeclaration(node)) {
      const name = node.name.getText(sourceFile);
      if (!hasDescription(node)) {
        violations.push({
          file: relPath,
          line: getLine(node.getStart(sourceFile)),
          message: `Missing JSDoc description on getter '${name}'.`
        });
      }
    } else if (ts.isVariableStatement(node)) {
      const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      if (isExported) {
        for (const decl of node.declarationList.declarations) {
          const name = decl.name.getText(sourceFile);
          if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
            checkFunctionDocs(node, decl.initializer, name);
          } else if (!hasDescription(node)) {
            violations.push({
              file: relPath,
              line: getLine(node.getStart(sourceFile)),
              message: `Missing JSDoc description on exported variable '${name}'.`
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
}

/**
 * Recursively collects all `.ts` files (excluding `.d.ts`) in the specified directories.
 *
 * @param dirs - Directories to scan.
 * @returns Sorted list of absolute `.ts` file paths.
 */
export function collectTypeScriptFiles(dirs: readonly string[]): string[] {
  const results: string[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      continue;
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectTypeScriptFiles([fullPath]));
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        results.push(fullPath);
      }
    }
  }
  return results.sort();
}

/**
 * Executes the documentation and type-safety audit across `src/`, `scripts/`, and `build/`.
 *
 * @param rootDir - Workspace root directory.
 * @param logger - Output logger for violation reporting.
 * @returns `true` if 0 violations were found, `false` otherwise.
 */
export function runDocCheck(
  rootDir: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  logger: (msg: string) => void = (msg: string): void => { console.error(msg); }
): boolean {
  const targetDirs = [
    path.join(rootDir, 'src'),
    path.join(rootDir, 'scripts'),
    path.join(rootDir, 'build'),
  ];
  const files = collectTypeScriptFiles(targetDirs);
  const allViolations: AuditViolation[] = [];

  for (const file of files) {
    allViolations.push(...auditFile(file, rootDir));
  }

  if (allViolations.length > 0) {
    for (const v of allViolations) {
      logger(`${v.file}:${v.line} - ${v.message}`);
    }
    return false;
  }

  return true;
}

/* v8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!runDocCheck()) {
    process.exit(1);
  }
}
/* v8 ignore stop */
