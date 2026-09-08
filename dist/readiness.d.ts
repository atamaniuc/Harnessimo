/** Phrasing that describes activity rather than an outcome someone could observe. */
import type { QueueItem, Violation } from "./types.ts";
/** Terminal states a dependency must have reached before an item can start. */
export declare const SATISFIED: Set<string>;
/**
 * Definition of Ready. Checked before an item may be activated.
 *
 */
export declare function readiness(item: QueueItem, all: QueueItem[]): Violation[];
/**
 * Definition of Done. The verification passing is necessary and not
 * sufficient: evidence has to exist and be tied to this item, or "done" is an
 * assertion again — and re-verification in CI has nothing to re-check.
 *
 */
export declare function doneness(item: QueueItem, verificationPassed: boolean): Violation[];
export declare function formatViolations(id: string, violations: Violation[]): string;
//# sourceMappingURL=readiness.d.ts.map