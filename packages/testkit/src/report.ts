/** Rendering a run summary for a terminal, for CI, and for machines. */

import { CATEGORY_LABELS, SEVERITY_ORDER, type CaseResult, type RunSummary } from "./types.js";

const NO_COLOR = process.env["NO_COLOR"] !== undefined || process.env["TERM"] === "dumb";

const colors = {
  reset: "[0m",
  bold: "[1m",
  dim: "[2m",
  red: "[31m",
  green: "[32m",
  yellow: "[33m",
  cyan: "[36m",
};

function paint(text: string, color: keyof typeof colors, enabled: boolean): string {
  if (!enabled || NO_COLOR) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Make invisible and ambiguous characters visible.
 *
 * Most of this corpus is about characters you cannot see. Printing a failure as
 * `expected "田中太郎", got "田中太郎"` helps nobody, so zero-width, ideographic
 * spaces, variation selectors, and combining marks are shown as code points.
 */
export function visualize(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value !== "string") {
    // The replacer returns the *unquoted* body so that JSON.stringify supplies
    // exactly one pair of quotes rather than two.
    return JSON.stringify(value, (_k, v: unknown) =>
      typeof v === "string" ? reveal(v) : v,
    );
  }
  return `"${reveal(value)}"`;
}

/** The body of {@link visualize}, without the surrounding quotes. */
function reveal(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    const hex = `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
    if (ch === "　") out += "␣̲"; // ideographic space, marked
    else if (code === 0x200b || code === 0xfeff || code === 0x200c || code === 0x200d) {
      out += `⟨${hex}⟩`;
    } else if (code >= 0xfe00 && code <= 0xfe0f) out += `⟨VS${code - 0xfe00 + 1}⟩`;
    else if (code >= 0xe0100 && code <= 0xe01ef) out += `⟨IVS${code - 0xe0100 + 17}⟩`;
    else if (code === 0x3099 || code === 0x309a) out += `⟨${hex}⟩`;
    else if (code < 0x20 || code === 0x7f) out += `⟨${hex}⟩`;
    else out += ch;
  }
  return out;
}

/**
 * Wrap prose to the terminal width, indenting continuation lines.
 *
 * Counts CJK characters as two columns wide, or Japanese explanations wrap to
 * roughly half the intended width.
 */
function wrap(text: string, indent: string, width = 78): string[] {
  const usable = Math.max(20, width - indent.length);
  const lines: string[] = [];
  let current = "";
  let currentWidth = 0;

  const charWidth = (ch: string) => {
    const code = ch.codePointAt(0)!;
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6);
    return wide ? 2 : 1;
  };
  const widthOf = (s: string) => [...s].reduce((n, ch) => n + charWidth(ch), 0);

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = widthOf(word);
    if (current !== "" && currentWidth + 1 + w > usable) {
      lines.push(indent + current);
      current = word;
      currentWidth = w;
    } else {
      current = current === "" ? word : `${current} ${word}`;
      currentWidth = current === word ? w : currentWidth + 1 + w;
    }
  }
  if (current !== "") lines.push(indent + current);
  return lines;
}

function bar(percentage: number | null, width = 20): string {
  if (percentage === null) return "—".padEnd(width, " ");
  const filled = Math.round((percentage / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function percentColor(percentage: number | null): keyof typeof colors {
  if (percentage === null) return "dim";
  if (percentage === 100) return "green";
  if (percentage >= 90) return "cyan";
  if (percentage >= 70) return "yellow";
  return "red";
}

export interface RenderOptions {
  /** ANSI colour. Defaults to whether stdout is a TTY. */
  color?: boolean;
  /** How many failing cases to detail. Default 10. `0` shows none. */
  maxFailures?: number;
  /** Include the per-category bar chart. Default `true`. */
  bars?: boolean;
}

/** The headline report, in the shape the product spec defines. */
export function renderReport(summary: RunSummary, options: RenderOptions = {}): string {
  const { color = process.stdout.isTTY === true, maxFailures = 10, bars = true } = options;
  const c = (text: string, col: keyof typeof colors) => paint(text, col, color);

  const lines: string[] = [];
  lines.push("");
  lines.push(c("JapanReady Compatibility Report", "bold"));
  lines.push(c(`  adapter: ${summary.adapterName}`, "dim"));
  lines.push("");

  const labelWidth = Math.max(...Object.values(CATEGORY_LABELS).map((l) => l.length)) + 2;
  for (const score of summary.scores) {
    const label = CATEGORY_LABELS[score.category].padEnd(labelWidth);
    const pct = score.percentage === null ? "—" : `${score.percentage}%`;
    const value = pct.padStart(5);
    const detail =
      score.total === 0
        ? c("  (no cases)", "dim")
        : score.skipped === score.total
          ? c(`  (${score.skipped} skipped — operation not implemented)`, "dim")
          : c(
              `  ${score.passed}/${score.total - score.skipped}` +
                (score.skipped > 0 ? ` (+${score.skipped} skipped)` : ""),
              "dim",
            );
    const chart = bars ? ` ${c(bar(score.percentage), percentColor(score.percentage))}` : "";
    lines.push(`  ${label}${c(value, percentColor(score.percentage))}${chart}${detail}`);
  }

  lines.push("");
  const t = summary.totals;
  const num = (n: number) => String(n).padStart(6);
  lines.push(
    `  Critical Issues: ${c(num(t.criticalIssues), t.criticalIssues > 0 ? "red" : "green")}`,
  );
  lines.push(`  Warnings:        ${c(num(t.warnings), t.warnings > 0 ? "yellow" : "green")}`);
  lines.push(`  Passed Tests:    ${c(num(t.passed), "green")}`);
  lines.push(`  Failed Tests:    ${c(num(t.failed), t.failed > 0 ? "red" : "green")}`);
  if (t.skipped > 0) lines.push(`  Skipped Tests:   ${c(num(t.skipped), "dim")}`);
  lines.push("");

  if (summary.uncoveredOperations.length > 0) {
    lines.push(c("  Not implemented by this adapter:", "dim"));
    lines.push(c(`    ${summary.uncoveredOperations.join(", ")}`, "dim"));
    lines.push("");
  }

  const failures = summary.results
    .filter((r) => r.status !== "passed" && r.status !== "skipped")
    .sort((a, b) => SEVERITY_ORDER[a.case.severity] - SEVERITY_ORDER[b.case.severity]);

  if (failures.length > 0 && maxFailures > 0) {
    lines.push(c(`Failures (${Math.min(failures.length, maxFailures)} of ${failures.length})`, "bold"));
    lines.push("");
    for (const failure of failures.slice(0, maxFailures)) {
      lines.push(...renderFailure(failure, color));
    }
    if (failures.length > maxFailures) {
      lines.push(c(`  … and ${failures.length - maxFailures} more. Re-run with --max-failures.`, "dim"));
      lines.push("");
    }
  }

  lines.push(
    c(
      `  ${summary.totals.cases} cases in ${summary.durationMs}ms` +
        (summary.percentage === null ? "" : ` — overall ${summary.percentage}%`),
      "dim",
    ),
  );
  lines.push("");
  return lines.join("\n");
}

function renderFailure(result: CaseResult, color: boolean): string[] {
  const c = (text: string, col: keyof typeof colors) => paint(text, col, color);
  const { case: testCase } = result;
  const sev = testCase.severity.toUpperCase();
  const sevColor: keyof typeof colors =
    testCase.severity === "critical" || testCase.severity === "high" ? "red" : "yellow";

  const lines: string[] = [];
  lines.push(`  ${c(`[${sev}]`, sevColor)} ${c(testCase.id, "bold")}  ${c(testCase.op + "()", "cyan")}`);
  lines.push(...wrap(testCase.reason, "    "));
  lines.push(`    input:    ${visualize(testCase.input)}`);

  if (testCase.shouldAccept !== undefined) {
    lines.push(`    expected: ${testCase.shouldAccept ? "accepted" : "rejected"}`);
    lines.push(`    actual:   ${result.actual === true ? "accepted" : result.actual === false ? "rejected" : visualize(result.actual)}`);
  } else {
    lines.push(`    expected: ${visualize(testCase.expectedOutput)}`);
    lines.push(`    actual:   ${visualize(result.actual)}`);
  }

  if (result.message) lines.push(...wrap(result.message, "    ").map((l) => c(l, "red")));
  if (testCase.fix) {
    const wrapped = wrap(testCase.fix, "              ");
    const first = wrapped[0]?.trimStart() ?? "";
    lines.push(`    ${c("fix:", "green")}      ${first}`);
    lines.push(...wrapped.slice(1));
  }
  if (testCase.source) lines.push(`    ${c(`source:   ${testCase.source}`, "dim")}`);
  lines.push("");
  return lines;
}

/** A compact Markdown report, for a CI job summary or a PR comment. */
export function renderMarkdown(summary: RunSummary): string {
  const lines: string[] = [];
  lines.push("## JapanReady Compatibility Report");
  lines.push("");
  lines.push("| Category | Score | Passed | Failed | Skipped |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const score of summary.scores) {
    const pct = score.percentage === null ? "—" : `${score.percentage}%`;
    lines.push(
      `| ${CATEGORY_LABELS[score.category]} | ${pct} | ${score.passed} | ${score.failed} | ${score.skipped} |`,
    );
  }
  lines.push("");
  const t = summary.totals;
  lines.push(`**Critical issues:** ${t.criticalIssues} · **Warnings:** ${t.warnings}`);
  lines.push("");
  lines.push(`${t.passed} passed, ${t.failed} failed, ${t.skipped} skipped of ${t.cases} cases.`);

  const failures = summary.results
    .filter((r) => r.status !== "passed" && r.status !== "skipped")
    .sort((a, b) => SEVERITY_ORDER[a.case.severity] - SEVERITY_ORDER[b.case.severity])
    .slice(0, 25);

  if (failures.length > 0) {
    lines.push("");
    lines.push("<details><summary>Failures</summary>");
    lines.push("");
    lines.push("| Severity | Case | Input | Expected | Actual |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const f of failures) {
      const expected =
        f.case.shouldAccept !== undefined
          ? f.case.shouldAccept
            ? "accepted"
            : "rejected"
          : visualize(f.case.expectedOutput);
      const actual =
        f.case.shouldAccept !== undefined
          ? f.actual === true
            ? "accepted"
            : "rejected"
          : visualize(f.actual);
      lines.push(
        `| ${f.case.severity} | \`${f.case.id}\` | \`${visualize(f.case.input)}\` | \`${expected}\` | \`${actual}\` |`,
      );
    }
    lines.push("");
    lines.push("</details>");
  }
  lines.push("");
  return lines.join("\n");
}

/** The machine-readable form, for storing a score over time. */
export function renderJson(summary: RunSummary): string {
  return JSON.stringify(
    {
      adapter: summary.adapterName,
      percentage: summary.percentage,
      totals: summary.totals,
      durationMs: summary.durationMs,
      categories: summary.scores,
      uncoveredOperations: summary.uncoveredOperations,
      failures: summary.results
        .filter((r) => r.status !== "passed" && r.status !== "skipped")
        .map((r) => ({
          id: r.case.id,
          category: r.case.category,
          op: r.case.op,
          severity: r.case.severity,
          status: r.status,
          reason: r.case.reason,
          fix: r.case.fix,
          source: r.case.source,
          input: r.case.input,
          expected: r.case.shouldAccept !== undefined ? r.case.shouldAccept : r.case.expectedOutput,
          actual: r.actual,
          message: r.message,
        })),
    },
    null,
    2,
  );
}
