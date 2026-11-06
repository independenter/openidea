/**
 * IDEA-style "Application" run configurations for Java / Kotlin main classes
 * (Spring Boot applications get their own kind), the module a source file
 * belongs to, and test configurations scoped to one class or method.
 */
import type { RunConfig } from "@/platform/ipc";
import { CLASSPATH, TEST_CLASSPATH, jvmModuleDir } from "@/platform/javaLaunch";
import { isTestPath, rootFor } from "@/platform/languageSettings";
import { currentRoots } from "@/platform/projectRoots";
import { simpleClassName } from "./jvmTargets";

export { jvmModuleDir } from "@/platform/javaLaunch";

/**
 * In a test source root, as IDEA's `getClasspathType` decides: the root holding the file
 * (synced from Gradle, detected or marked in Project Structure) wins; `src/test` only
 * while no root is known for the file.
 */
const isTestSource = (relPath: string) => {
  const roots = currentRoots();
  return rootFor(roots, relPath) ? isTestPath(roots, relPath) : /(^|\/)src\/test\//.test(relPath);
};

/** Temporary "Application" configuration that runs `className` (a binary name). */
export function applicationConfig(
  target: { className: string; spring?: boolean },
  relPath: string,
  configs: readonly RunConfig[] = [],
): RunConfig {
  const module = jvmModuleDir(relPath, configs);
  return {
    id: `application:${module ? `${module}:` : ""}${target.className}`,
    name: simpleClassName(target.className),
    kind: target.spring ? "spring-boot" : "application",
    command: "java",
    args: ["-cp", isTestSource(relPath) ? TEST_CLASSPATH : CLASSPATH, target.className],
    cwd: null,
    module,
    env: {},
    detected: true,
    isTest: false,
    debugAdapter: relPath.endsWith(".kt") ? "kotlin-debug-adapter" : "java-debug",
  };
}

/**
 * Narrows a Maven / Gradle test configuration to a class (`method` unset) or
 * one method: Surefire `-Dtest=Class#method`, Gradle `--tests Class.method`.
 * `fileConfig` is the file-level configuration whose last argument is the file filter.
 */
export function jvmTestConfig(fileConfig: RunConfig, className: string, method: string | undefined): RunConfig | null {
  const simple = simpleClassName(className);
  const name = method ? `${simple}.${method}` : simple;
  const id = `context:target:${fileConfig.id}:${className}${method ? `#${method}` : ""}`;
  switch (fileConfig.kind) {
    case "maven": {
      // Maven: replace or append `-Dtest=Class#method`
      const args = fileConfig.args.filter((a) => !a.startsWith("-Dtest="));
      return {
        ...fileConfig,
        id,
        name,
        env: { ...fileConfig.env },
        args: [...args, `-Dtest=${className}${method ? `#${method}` : ""}`, "-Dsurefire.failIfNoSpecifiedTests=false"],
      };
    }
    case "gradle": {
      // Gradle: replace or append `--tests Class.method`, dropping every old filter pair.
      const baseArgs: string[] = [];
      for (let i = 0; i < fileConfig.args.length; i++) {
        if (fileConfig.args[i] === "--tests") i++;
        else baseArgs.push(fileConfig.args[i]!);
      }
      return {
        ...fileConfig,
        id,
        name,
        env: { ...fileConfig.env },
        args: [...baseArgs, "--tests", method ? `${className}.${method}` : className],
      };
    }
  }
  return null;
}
