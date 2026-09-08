// The shapes the rules pass around.
//
// They live in one file because more than one module speaks each of them, and
// because this is the package's published contract: what a TypeScript consumer
// compiles against. When these and the code disagreed — and they did, while the
// contract was a hand-written .d.ts alongside JSDoc — the consumer believed the
// wrong one. There is now a single source, and `tsc` is what keeps it true.
export {};
//# sourceMappingURL=types.js.map