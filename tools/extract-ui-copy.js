#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.join(repoRoot, '.temp', 'ci', 'ui-copy.txt');

const sourceRoots = [
  path.join(repoRoot, 'apps', 'mobile', 'src'),
  path.join(repoRoot, 'apps', 'pwa', 'src'),
];

const htmlFiles = [
  path.join(repoRoot, 'apps', 'mobile', 'index.html'),
  path.join(repoRoot, 'apps', 'pwa', 'index.html'),
];

const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']);
const scannedFiles = [];
const seen = new Set();
const extracted = [];

const skipAttributeNames = new Set([
  'class',
  'classname',
  'style',
  'id',
  'src',
  'href',
  'to',
  'name',
  'type',
  'key',
  'variant',
  'size',
  'as',
  'role',
  'mode',
]);

const uiAttributeNames = new Set([
  'alt',
  'title',
  'placeholder',
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-roledescription',
  'label',
  'helpertext',
]);

const uiPropertyNames = new Set([
  'label',
  'title',
  'subtitle',
  'description',
  'message',
  'error',
  'placeholder',
  'helpertext',
  'hint',
  'summary',
  'caption',
  'cta',
  'buttontext',
  'emptytitle',
  'emptydescription',
]);

function collectSourceFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'test' || entry.name === 'tests' || entry.name === '__tests__') continue;
      collectSourceFiles(fullPath);
      continue;
    }

    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.d.ts')) continue;
    if (entry.name.includes('.spec.') || entry.name.includes('.test.')) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (codeExtensions.has(ext)) scannedFiles.push(fullPath);
  }
}

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function isCssUtilityString(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return false;
  const cssLikeToken = /^[a-z0-9:[\]/#%.(),_+-]+$/i;
  return tokens.every((token) => cssLikeToken.test(token));
}

function isLikelyTechnicalToken(text) {
  if (/^(?:https?:\/\/|wss?:\/\/|\/|\.{1,2}\/)/i.test(text)) return true;
  if (/^(?:maps|geo):/i.test(text)) return true;
  if (/^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}/i.test(text)) return true;
  if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(text)) return true;
  if (/[@][a-z0-9_.-]+/i.test(text)) return true;
  if (/^application\/[a-z0-9+.-]+/i.test(text)) return true;
  if (/^[a-z]+\/[a-z0-9+.-]+(?:;[a-z-]+=.+)?$/i.test(text)) return true;
  if (/^[a-z0-9_]+(?:,[a-z0-9_]+)+$/i.test(text)) return true;
  if (/^[a-z0-9_]+=[a-z0-9_.:-]+$/i.test(text)) return true;
  if (/\S=\S/.test(text) && !/\s=\s/.test(text)) return true;
  if (/--[a-z0-9-]+/i.test(text)) return true;
  if (text.includes('="') || text.includes("='")) return true;
  if (/\b(?:aria-|data-|class=|role=|style=|href=|src=)/i.test(text)) return true;
  if (/^\[[^\]]+\]$/.test(text)) return true;
  if (/^\([^)]+\)$/.test(text) && !text.includes(' ')) return true;
  if (text.includes(',') && !text.includes(' ')) {
    const parts = text.split(',').filter(Boolean);
    if (parts.length > 1 && parts.every((part) => /^[a-z0-9._:+/-]+$/i.test(part))) return true;
  }
  if (text.includes(';') && !text.includes(' ')) {
    const parts = text.split(';').filter(Boolean);
    if (parts.length > 1 && parts.every((part) => /^[a-z0-9._:+/-]+$/i.test(part))) return true;
  }
  if (/^[a-z0-9_.:/-]+$/i.test(text) && !text.includes(' ')) return true;
  if (/^[A-Z0-9_]+$/.test(text) && text.length > 2) return true;
  if (/^[a-z]+(?:\.[a-z0-9_-]+){1,}$/i.test(text)) return true;
  if (/^[a-z]+(?:-[a-z0-9]+){1,}$/i.test(text)) return true;
  if (isCssUtilityString(text)) return true;
  if (/(?:^|\s)(?:[a-z]+:)?(?:bg|text|px|py|pt|pb|pl|pr|mx|my|w|h|min|max|flex|grid|items|justify|rounded|border|shadow|overflow|focus|hover|space|gap)-/i.test(text)) {
    return true;
  }
  return false;
}

function isLikelyUserText(text) {
  if (text.length < 3) return false;
  if (!/[\p{L}\p{N}]/u.test(text)) return false;
  if (/[{}<>]/.test(text)) return false;
  if (isLikelyTechnicalToken(text)) return false;

  return (
    text.includes(' ') ||
    /[.,;:!?'"`]/.test(text) ||
    /[\u00C0-\u017F]/.test(text)
  );
}

function addText(rawText) {
  const normalized = normalizeText(decodeHtmlEntities(rawText));
  if (!isLikelyUserText(normalized)) return;
  if (seen.has(normalized)) return;
  seen.add(normalized);
  extracted.push(normalized);
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizedTemplateExpressionText(node) {
  const chunks = [node.head.text];
  for (const span of node.templateSpans) chunks.push(' ', span.literal.text);
  return chunks.join('');
}

function getScriptKind(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.tsx') return ts.ScriptKind.TSX;
  if (ext === '.jsx') return ts.ScriptKind.JSX;
  if (ext === '.js') return ts.ScriptKind.JS;
  if (ext === '.mjs') return ts.ScriptKind.JS;
  if (ext === '.cjs') return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function findAncestor(node, predicate) {
  let current = node.parent;
  while (current) {
    if (predicate(current)) return current;
    current = current.parent;
  }
  return null;
}

function attributeNameOf(node) {
  if (!ts.isJsxAttribute(node)) return null;
  if (ts.isIdentifier(node.name)) return node.name.text.toLowerCase();
  if (ts.isJsxNamespacedName(node.name)) return node.name.name.text.toLowerCase();
  return null;
}

function propertyNameOf(node) {
  if (!ts.isPropertyAssignment(node) && !ts.isShorthandPropertyAssignment(node)) return null;
  const nameNode = node.name;
  if (!nameNode) return null;
  if (ts.isIdentifier(nameNode)) return nameNode.text.toLowerCase();
  if (ts.isStringLiteral(nameNode)) return nameNode.text.toLowerCase();
  return null;
}

function isImportLikeLiteral(node) {
  if (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)) return true;

  const callExpr = findAncestor(node, ts.isCallExpression);
  if (!callExpr) return false;

  if (ts.isIdentifier(callExpr.expression) && callExpr.expression.text === 'require') return true;
  if (callExpr.expression.kind === ts.SyntaxKind.ImportKeyword) return true;
  return false;
}

function shouldSkipByContext(node) {
  if (isImportLikeLiteral(node)) return true;

  const jsxAttr = findAncestor(node, ts.isJsxAttribute);
  if (jsxAttr) {
    const attrName = attributeNameOf(jsxAttr);
    if (!attrName) return false;
    if (skipAttributeNames.has(attrName)) return true;
    if (attrName.includes('class')) return true;
    if (attrName.endsWith('color')) return true;
    if (attrName.endsWith('icon')) return true;
    if (attrName.endsWith('url')) return true;
    return false;
  }

  const property = findAncestor(node, (maybeNode) => ts.isPropertyAssignment(maybeNode) || ts.isShorthandPropertyAssignment(maybeNode));
  if (property) {
    const propName = propertyNameOf(property);
    if (!propName) return false;
    if (uiPropertyNames.has(propName)) return false;

    if (
      propName.includes('class') ||
      propName.endsWith('id') ||
      propName.endsWith('url') ||
      propName.endsWith('path') ||
      propName.endsWith('key') ||
      propName.endsWith('icon') ||
      propName === 'variant' ||
      propName === 'role' ||
      propName === 'status'
    ) {
      return true;
    }
  }

  return false;
}

function visitNode(node) {
  if (ts.isJsxText(node)) addText(node.getText());

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    if (!shouldSkipByContext(node)) {
      const jsxAttr = findAncestor(node, ts.isJsxAttribute);
      if (jsxAttr) {
        const attrName = attributeNameOf(jsxAttr);
        if (!attrName || uiAttributeNames.has(attrName) || !skipAttributeNames.has(attrName)) {
          addText(node.text);
        }
      } else {
        addText(node.text);
      }
    }
  }

  if (ts.isTemplateExpression(node) && !shouldSkipByContext(node)) {
    addText(normalizedTemplateExpressionText(node));
  }

  ts.forEachChild(node, visitNode);
}

function extractFromCodeFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const scriptKind = getScriptKind(filePath);
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind);
  visitNode(sourceFile);
}

function extractFromHtml(filePath) {
  if (!fs.existsSync(filePath)) return;
  const source = fs.readFileSync(filePath, 'utf8');

  const dom = new JSDOM(source);
  const document = dom.window.document;

  // Remove script and style elements before extracting text/attributes
  const removableElements = document.querySelectorAll('script, style');
  removableElements.forEach((el) => el.remove());

  // Extract text nodes
  (function traverse(node) {
    for (const child of node.childNodes) {
      if (child.nodeType === child.TEXT_NODE) {
        const text = child.textContent;
        if (text && text.trim()) {
          addText(decodeHtmlEntities(text));
        }
      } else {
        traverse(child);
      }
    }
  })(document.body || document);

  // Extract attributes similar to the previous regex-based approach
  const attrElements = document.querySelectorAll('[alt],[title],[placeholder],[aria-label],[aria-description]');
  attrElements.forEach((el) => {
    const attrs = ['alt', 'title', 'placeholder', 'aria-label', 'aria-description'];
    attrs.forEach((name) => {
      const value = el.getAttribute(name);
      if (value && value.trim()) {
        addText(decodeHtmlEntities(value));
      }
    });
  });

  // Extract meta description-like content
  const metaSelectors = [
    'meta[name="description"]',
    'meta[name="og:title"]',
    'meta[name="og:description"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
    'meta[property="description"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[property="twitter:title"]',
    'meta[property="twitter:description"]',
  ];
  const metaElements = document.querySelectorAll(metaSelectors.join(','));
  metaElements.forEach((meta) => {
    const content = meta.getAttribute('content');
    if (content && content.trim()) {
      addText(decodeHtmlEntities(content));
    }
  });
}

function main() {
  for (const root of sourceRoots) collectSourceFiles(root);
  scannedFiles.sort();

  for (const filePath of scannedFiles) extractFromCodeFile(filePath);
  for (const filePath of htmlFiles) extractFromHtml(filePath);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${extracted.join('\n')}\n`, 'utf8');

  process.stdout.write(
    `Extracted ${extracted.length} UI strings from ${scannedFiles.length + htmlFiles.length} files to ${path.relative(repoRoot, outputPath)}\n`
  );
}

main();
