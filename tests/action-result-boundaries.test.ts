import { readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  EditDraftAnswerActionState,
  OwnerSetupActionState,
  PersistenceMode,
} from "@/application/owner-setup/action-result";
import type { StaffTaskActionState } from "@/application/tasks/action-result";
import type { Id } from "@/domain/models";
import type { Task, TaskEvent } from "@/domain/tasks";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceRoot = resolve(repositoryRoot, "src");
const appRoot = resolve(sourceRoot, "app");
const componentsRoot = resolve(sourceRoot, "components");
const infrastructureRoot = resolve(sourceRoot, "infrastructure");
const serverRoot = resolve(sourceRoot, "server");
const ownerContractFile = resolve(
  sourceRoot,
  "application/owner-setup/action-result.ts",
);
const taskContractFile = resolve(sourceRoot, "application/tasks/action-result.ts");
const ownerActionsFile = resolve(appRoot, "owner/actions.ts");
const staffActionsFile = resolve(appRoot, "staff/tasks/actions.ts");

interface ModuleReference {
  kind:
    | "dynamic-import"
    | "import"
    | "import-equals"
    | "import-type"
    | "require"
    | "re-export";
  specifier: string;
}

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return sourceFilesUnder(path);
    }

    return entry.isFile() && /\.tsx?$/u.test(entry.name) ? [path] : [];
  });
}

function moduleReferences(source: string, fileName: string): ModuleReference[] {
  const sourceFile = parsedSourceFile(source, fileName);
  const references: ModuleReference[] = [];

  function addReference(
    kind: ModuleReference["kind"],
    expression: ts.Expression | undefined,
  ) {
    if (expression && ts.isStringLiteralLike(expression)) {
      references.push({ kind, specifier: expression.text });
    }
  }

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      addReference("import", node.moduleSpecifier);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument)
    ) {
      addReference("import-type", node.argument.literal);
    } else if (ts.isExportDeclaration(node)) {
      addReference("re-export", node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      addReference("import-equals", node.moduleReference.expression);
    } else if (ts.isCallExpression(node) && node.arguments.length > 0) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        addReference("dynamic-import", node.arguments[0]);
      } else if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require"
      ) {
        addReference("require", node.arguments[0]);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return references;
}

function parsedSourceFile(source: string, fileName: string) {
  return ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function resolvedRepositoryModule(fromFile: string, specifier: string) {
  if (specifier === "@") {
    return sourceRoot;
  }

  if (specifier.startsWith("@/")) {
    return resolve(sourceRoot, specifier.slice(2));
  }

  if (specifier.startsWith(".")) {
    return resolve(dirname(fromFile), specifier);
  }

  return undefined;
}

function isWithin(path: string, directory: string) {
  const pathFromDirectory = relative(directory, path);
  return (
    pathFromDirectory === "" ||
    (!pathFromDirectory.startsWith(`..${sep}`) &&
      pathFromDirectory !== ".." &&
      !isAbsolute(pathFromDirectory))
  );
}

function appBoundaryOffenders(source: string, fileName: string) {
  return moduleReferences(source, fileName).filter((reference) => {
    const resolved = resolvedRepositoryModule(fileName, reference.specifier);
    return resolved ? isWithin(resolved, appRoot) : false;
  });
}

function neutralBoundaryOffenders(source: string, fileName: string) {
  return moduleReferences(source, fileName).filter((reference) => {
    if (
      reference.specifier === "react" ||
      reference.specifier.startsWith("react/") ||
      reference.specifier === "next" ||
      reference.specifier.startsWith("next/") ||
      reference.specifier === "server-only"
    ) {
      return true;
    }

    const resolved = resolvedRepositoryModule(fileName, reference.specifier);
    return resolved
      ? [appRoot, componentsRoot, infrastructureRoot, serverRoot].some((root) =>
          isWithin(resolved, root),
        )
      : false;
  });
}

function isTypeOnlyImportDeclaration(statement: ts.ImportDeclaration) {
  return (
    statement.importClause?.isTypeOnly === true ||
    (statement.importClause?.name === undefined &&
      statement.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.every(
        (element) => element.isTypeOnly,
      ))
  );
}

function isTypeOnlyExportDeclaration(statement: ts.ExportDeclaration) {
  return (
    statement.isTypeOnly ||
    (statement.exportClause !== undefined &&
      ts.isNamedExports(statement.exportClause) &&
      statement.exportClause.elements.every((element) => element.isTypeOnly))
  );
}

function importDeclarations(source: string, fileName: string) {
  return parsedSourceFile(source, fileName).statements.flatMap((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier)
    ) {
      return [];
    }

    return [
      {
        specifier: statement.moduleSpecifier.text,
        typeOnly: isTypeOnlyImportDeclaration(statement),
      },
    ];
  });
}

function runtimeModuleReferences(source: string, fileName: string) {
  const sourceFile = parsedSourceFile(source, fileName);
  const staticReferences = sourceFile.statements.flatMap<ModuleReference>(
    (statement) => {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteralLike(statement.moduleSpecifier) &&
        !isTypeOnlyImportDeclaration(statement)
      ) {
        return [
          {
            kind: "import" as const,
            specifier: statement.moduleSpecifier.text,
          },
        ];
      }

      if (
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier &&
        ts.isStringLiteralLike(statement.moduleSpecifier) &&
        !isTypeOnlyExportDeclaration(statement)
      ) {
        return [
          {
            kind: "re-export" as const,
            specifier: statement.moduleSpecifier.text,
          },
        ];
      }

      return [];
    },
  );
  const expressionReferences = moduleReferences(source, fileName).filter(
    (reference) =>
      ["dynamic-import", "import-equals", "require"].includes(reference.kind),
  );

  return [...staticReferences, ...expressionReferences];
}

function runtimeContractReferences(
  source: string,
  fileName: string,
  contractSpecifiers: ReadonlySet<string>,
) {
  const runtimeReferences = runtimeModuleReferences(source, fileName).filter(
    (reference) => contractSpecifiers.has(reference.specifier),
  );

  return runtimeReferences;
}

function locallyReexportedContractBindings(
  source: string,
  fileName: string,
  contractSpecifiers: ReadonlySet<string>,
) {
  const sourceFile = parsedSourceFile(source, fileName);
  const importedBindings = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier) ||
      !contractSpecifiers.has(statement.moduleSpecifier.text) ||
      !statement.importClause
    ) {
      continue;
    }

    if (statement.importClause.name) {
      importedBindings.add(statement.importClause.name.text);
    }

    const bindings = statement.importClause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      importedBindings.add(bindings.name.text);
    } else if (bindings) {
      for (const element of bindings.elements) {
        importedBindings.add(element.name.text);
      }
    }
  }

  return sourceFile.statements.flatMap((statement) => {
    if (
      !ts.isExportDeclaration(statement) ||
      statement.moduleSpecifier ||
      !statement.exportClause ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      return [];
    }

    return statement.exportClause.elements.flatMap((element) => {
      const localName = element.propertyName?.text ?? element.name.text;
      return importedBindings.has(localName) ? [element.name.text] : [];
    });
  });
}

function exportedActionResultDeclarations(source: string, fileName: string) {
  const sourceFile = parsedSourceFile(source, fileName);
  const typeDeclarationNames = new Set(
    sourceFile.statements.flatMap((statement) =>
      ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)
        ? [statement.name.text]
        : [],
    ),
  );

  return sourceFile.statements.flatMap((statement) => {
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      const isExported = statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      );
      return isExported ? [statement.name.text] : [];
    }

    if (
      !ts.isExportDeclaration(statement) ||
      statement.moduleSpecifier ||
      !statement.exportClause ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      return [];
    }

    return statement.exportClause.elements.flatMap((element) => {
      const localName = element.propertyName?.text ?? element.name.text;
      return typeDeclarationNames.has(localName) ? [element.name.text] : [];
    });
  });
}

describe("action-result boundaries", () => {
  it.each([
    ["alias import", 'import type { State } from "@/app/owner/actions";'],
    ["relative import", 'import type { State } from "../../app/owner/actions";'],
    [
      "import type expression",
      'type State = import("@/app/owner/actions").OwnerSetupActionState;',
    ],
    ["re-export", 'export type { State } from "@/app/owner/actions";'],
    ["dynamic import", 'const actions = import("@/app/staff/tasks/actions");'],
    ["require", 'const actions = require("@/app/staff/tasks/actions");'],
  ])("detects a component %s", (_label, source) => {
    const fixture = resolve(componentsRoot, "owner", "Fixture.tsx");
    expect(appBoundaryOffenders(source, fixture)).toHaveLength(1);
  });

  it("allows a neutral application contract import", () => {
    const fixture = resolve(componentsRoot, "owner", "Fixture.tsx");
    expect(
      appBoundaryOffenders(
        'import type { OwnerSetupActionState } from "@/application/owner-setup/action-result";',
        fixture,
      ),
    ).toEqual([]);
  });

  it.each([
    ["React", 'import type { ReactNode } from "react";'],
    ["Next", 'import type { Metadata } from "next";'],
    ["server-only", 'import "server-only";'],
    ["app alias", 'import type { State } from "@/app/owner/actions";'],
    ["server alias", 'import type { Client } from "@/server/neon/server-client";'],
    [
      "infrastructure alias",
      'import type { Repository } from "@/infrastructure/neon/task-repository";',
    ],
    ["relative server import", 'import type { Client } from "../../server/client";'],
    [
      "server import type expression",
      'type Client = import("@/server/neon/server-client").OutpostNeonClient;',
    ],
  ])("detects a forbidden neutral-contract %s dependency", (_label, source) => {
    expect(neutralBoundaryOffenders(source, ownerContractFile)).toHaveLength(1);
  });

  it("keeps every component independent of Next app modules", () => {
    const offenders = sourceFilesUnder(componentsRoot).flatMap((file) =>
      appBoundaryOffenders(readFileSync(file, "utf8"), file).map((reference) => ({
        file: relative(repositoryRoot, file),
        ...reference,
      })),
    );

    expect(offenders).toEqual([]);
  });

  it("keeps owner and staff result contracts neutral and type-only", () => {
    const ownerSource = readFileSync(ownerContractFile, "utf8");
    const taskSource = readFileSync(taskContractFile, "utf8");

    expect(neutralBoundaryOffenders(ownerSource, ownerContractFile)).toEqual([]);
    expect(runtimeModuleReferences(ownerSource, ownerContractFile)).toEqual([]);
    expect(neutralBoundaryOffenders(taskSource, taskContractFile)).toEqual([]);
    expect(runtimeModuleReferences(taskSource, taskContractFile)).toEqual([]);
  });

  it.each([
    ["value import", 'import { Task } from "@/domain/tasks";'],
    ["export star", 'export * from "@/domain/tasks";'],
    ["dynamic import", 'void import("@/domain/tasks");'],
    ["require", 'require("@/domain/tasks");'],
  ])("detects a neutral-contract runtime %s", (_label, source) => {
    expect(runtimeModuleReferences(source, ownerContractFile)).toHaveLength(1);
  });

  it("keeps every contract consumer on type-only neutral imports", () => {
    const neutralSpecifiers = new Set([
      "@/application/owner-setup/action-result",
      "@/application/tasks/action-result",
    ]);
    const offenders = sourceFilesUnder(componentsRoot).flatMap((file) =>
      runtimeContractReferences(
        readFileSync(file, "utf8"),
        file,
        neutralSpecifiers,
      ).map((reference) => ({
        file: relative(repositoryRoot, file),
        ...reference,
      })),
    );

    expect(offenders).toEqual([]);
  });

  it.each([
    [
      "value import",
      'import { OwnerSetupActionState } from "@/application/owner-setup/action-result";',
    ],
    [
      "dynamic import",
      'void import("@/application/owner-setup/action-result");',
    ],
    [
      "require",
      'require("@/application/tasks/action-result");',
    ],
    [
      "export star",
      'export * from "@/application/owner-setup/action-result";',
    ],
  ])("detects a component contract %s", (_label, source) => {
    const fixture = resolve(componentsRoot, "owner", "Fixture.tsx");
    expect(
      runtimeContractReferences(
        source,
        fixture,
        new Set([
          "@/application/owner-setup/action-result",
          "@/application/tasks/action-result",
        ]),
      ),
    ).toHaveLength(1);
  });

  it("detects a local compatibility re-export of an imported contract", () => {
    const source = [
      'import type { OwnerSetupActionState } from "@/application/owner-setup/action-result";',
      "export type { OwnerSetupActionState };",
    ].join("\n");

    expect(
      locallyReexportedContractBindings(
        source,
        ownerActionsFile,
        new Set(["@/application/owner-setup/action-result"]),
      ),
    ).toEqual(["OwnerSetupActionState"]);
  });

  it("detects an exported compatibility alias under a different name", () => {
    const source = [
      'import type { OwnerSetupActionState } from "@/application/owner-setup/action-result";',
      "export type LegacyOwnerState = OwnerSetupActionState;",
    ].join("\n");

    expect(exportedActionResultDeclarations(source, ownerActionsFile)).toEqual([
      "LegacyOwnerState",
    ]);
  });

  it("detects a separately exported compatibility alias", () => {
    const source = [
      'import type { OwnerSetupActionState } from "@/application/owner-setup/action-result";',
      "type LegacyOwnerState = OwnerSetupActionState;",
      "export type { LegacyOwnerState };",
    ].join("\n");

    expect(exportedActionResultDeclarations(source, ownerActionsFile)).toEqual([
      "LegacyOwnerState",
    ]);
  });

  it("makes Next actions consume, not own or re-export, the neutral contracts", () => {
    const ownerSource = readFileSync(ownerActionsFile, "utf8");
    const staffSource = readFileSync(staffActionsFile, "utf8");

    expect(
      importDeclarations(ownerSource, ownerActionsFile).filter((declaration) =>
        declaration.specifier.endsWith("/action-result"),
      ),
    ).toEqual([
      {
        specifier: "@/application/owner-setup/action-result",
        typeOnly: true,
      },
    ]);
    expect(
      importDeclarations(staffSource, staffActionsFile).filter((declaration) =>
        declaration.specifier.endsWith("/action-result"),
      ),
    ).toEqual([
      {
        specifier: "@/application/tasks/action-result",
        typeOnly: true,
      },
    ]);
    expect(exportedActionResultDeclarations(ownerSource, ownerActionsFile)).toEqual([]);
    expect(exportedActionResultDeclarations(staffSource, staffActionsFile)).toEqual([]);
    expect(
      moduleReferences(ownerSource, ownerActionsFile).filter(
        (reference) =>
          reference.kind === "re-export" &&
          reference.specifier.endsWith("/action-result"),
      ),
    ).toEqual([]);
    expect(
      moduleReferences(staffSource, staffActionsFile).filter(
        (reference) =>
          reference.kind === "re-export" &&
          reference.specifier.endsWith("/action-result"),
      ),
    ).toEqual([]);
    expect(
      locallyReexportedContractBindings(
        ownerSource,
        ownerActionsFile,
        new Set(["@/application/owner-setup/action-result"]),
      ),
    ).toEqual([]);
    expect(
      locallyReexportedContractBindings(
        staffSource,
        staffActionsFile,
        new Set(["@/application/tasks/action-result"]),
      ),
    ).toEqual([]);
  });

  it("preserves the exact owner and staff action-result shapes", () => {
    expectTypeOf<OwnerSetupActionState>().toEqualTypeOf<{
      ok: boolean;
      message: string;
      targetId?: string;
    }>();
    expectTypeOf<EditDraftAnswerActionState>().toEqualTypeOf<OwnerSetupActionState>();
    expectTypeOf<PersistenceMode>().toEqualTypeOf<
      | "backend"
      | "tenant_access_required"
      | "sign_in_required"
      | "backend_unavailable"
      | "setup_required"
    >();
    expectTypeOf<StaffTaskActionState>().toEqualTypeOf<{
      ok: boolean;
      message: string;
      task?: Task;
      taskEvent?: TaskEvent;
      taskId?: Id;
    }>();
  });
});
