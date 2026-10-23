/** Prevent concurrent issuance from the same creator view before React state renders. */
export function createCustomNineCreatorIssueGate() {
  let inFlight = false;
  return {
    async run(operation: () => Promise<void>): Promise<boolean> {
      if (inFlight) return false;
      inFlight = true;
      try {
        await operation();
        return true;
      } finally {
        inFlight = false;
      }
    },
  };
}
