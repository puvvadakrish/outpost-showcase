import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

const actionResultFiles = [
  ["src/app/owner/sign-in/SignInForm.tsx", 2],
  ["src/components/owner/OwnerOnboardingBootstrapForm.tsx", 1],
  ["src/components/owner/AnswerBankReviewClient.tsx", 4],
  ["src/components/owner/StaffAccessPanel.tsx", 2],
] as const;

function descendantsMatching<T extends ts.Node>(
  root: ts.Node,
  predicate: (node: ts.Node) => node is T,
) {
  const matches: T[] = [];

  function visit(node: ts.Node) {
    if (predicate(node)) {
      matches.push(node);
    }
    ts.forEachChild(node, visit);
  }

  visit(root);
  return matches;
}

function parsedSourceFile(path: string) {
  const absolutePath = resolve(repositoryRoot, path);
  return ts.createSourceFile(
    absolutePath,
    readFileSync(absolutePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  return ts.isParenthesizedExpression(expression)
    ? unwrapExpression(expression.expression)
    : expression;
}

function isStateProperty(
  node: ts.Node,
  stateName: string,
  propertyName: "message" | "ok",
): node is ts.PropertyAccessExpression {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === stateName &&
    node.name.text === propertyName
  );
}

function jsxAttributeValue(element: ts.JsxElement, attributeName: string) {
  const attribute = element.openingElement.attributes.properties.find(
    (candidate): candidate is ts.JsxAttribute =>
      ts.isJsxAttribute(candidate) && candidate.name.getText() === attributeName,
  );

  return attribute?.initializer && ts.isStringLiteral(attribute.initializer)
    ? attribute.initializer.text
    : undefined;
}

function statusElements(root: ts.Node) {
  return descendantsMatching(root, ts.isJsxElement).filter(
    (element) => jsxAttributeValue(element, "role") === "status",
  );
}

function useActionStateNames(sourceFile: ts.SourceFile) {
  return descendantsMatching(sourceFile, ts.isVariableDeclaration).flatMap(
    (declaration) => {
      if (
        !ts.isArrayBindingPattern(declaration.name) ||
        !declaration.initializer ||
        !ts.isCallExpression(declaration.initializer) ||
        !ts.isIdentifier(declaration.initializer.expression) ||
        declaration.initializer.expression.text !== "useActionState"
      ) {
        return [];
      }

      const stateBinding = declaration.name.elements[0];
      return stateBinding &&
        ts.isBindingElement(stateBinding) &&
        ts.isIdentifier(stateBinding.name)
        ? [stateBinding.name.text]
        : [];
    },
  );
}

function nodeContains(ancestor: ts.Node, descendant: ts.Node) {
  return ancestor.pos <= descendant.pos && ancestor.end >= descendant.end;
}

describe("action-result live-region contract", () => {
  it("binds every asynchronous owner/auth status to its exact action result", () => {
    let accountedStatusCount = 0;

    for (const [path, expectedStateCount] of actionResultFiles) {
      const sourceFile = parsedSourceFile(path);
      const stateNames = useActionStateNames(sourceFile);
      const allStatusElements = statusElements(sourceFile);
      const accountedStatusElements = new Set<ts.JsxElement>();

      expect(stateNames, path).toHaveLength(expectedStateCount);

      for (const stateName of stateNames) {
        const conditionals = descendantsMatching(
          sourceFile,
          ts.isConditionalExpression,
        ).filter(
          (conditional) =>
            isStateProperty(
              unwrapExpression(conditional.condition),
              stateName,
              "message",
            ) && conditional.whenFalse.kind === ts.SyntaxKind.NullKeyword,
        );
        expect(conditionals, `${path}: ${stateName}.message branch`).toHaveLength(1);

        const [conditional] = conditionals;
        const boundStatusElements = statusElements(conditional.whenTrue);
        expect(boundStatusElements, `${path}: ${stateName} status`).toHaveLength(1);

        const [statusElement] = boundStatusElements;
        const messageReferences = descendantsMatching(
          statusElement,
          ts.isPropertyAccessExpression,
        ).filter((node) => isStateProperty(node, stateName, "message"));
        expect(messageReferences, `${path}: ${stateName}.message copy`).toHaveLength(1);

        const classNameAttribute = statusElement.openingElement.attributes.properties.find(
          (candidate): candidate is ts.JsxAttribute =>
            ts.isJsxAttribute(candidate) && candidate.name.getText() === "className",
        );
        expect(classNameAttribute, `${path}: ${stateName} className`).toBeDefined();
        const okReferences = descendantsMatching(
          classNameAttribute!,
          ts.isPropertyAccessExpression,
        ).filter((node) => isStateProperty(node, stateName, "ok"));
        expect(okReferences, `${path}: ${stateName}.ok class`).toHaveLength(1);
        const classLiterals = descendantsMatching(
          classNameAttribute!,
          ts.isStringLiteralLike,
        ).map((literal) => literal.text);
        expect(classLiterals.some((literal) => literal.includes("success")), path).toBe(true);
        expect(classLiterals.some((literal) => literal.includes("error")), path).toBe(true);

        accountedStatusElements.add(statusElement);
      }

      expect(
        allStatusElements.every((statusElement) =>
          [...accountedStatusElements].some((accounted) => nodeContains(accounted, statusElement)),
        ),
        `${path}: unbound role=status`,
      ).toBe(true);
      expect(accountedStatusElements.size, path).toBe(allStatusElements.length);

      if (path.endsWith("AnswerBankReviewClient.tsx")) {
        for (const statusElement of allStatusElements) {
          expect(
            descendantsMatching(statusElement, ts.isIdentifier).some(
              (identifier) => identifier.text === "persistenceMessage",
            ),
            `${path}: static persistence copy must remain non-live`,
          ).toBe(false);
        }
      }

      if (path.endsWith("StaffAccessPanel.tsx")) {
        const clipboardLiveRegions = descendantsMatching(sourceFile, ts.isJsxElement).filter(
          (element) => jsxAttributeValue(element, "aria-live") === "polite",
        );
        expect(clipboardLiveRegions, `${path}: clipboard feedback`).toHaveLength(1);
        expect(statusElements(clipboardLiveRegions[0])).toHaveLength(0);
      }

      accountedStatusCount += accountedStatusElements.size;
    }

    expect(accountedStatusCount).toBe(9);
  });
});
