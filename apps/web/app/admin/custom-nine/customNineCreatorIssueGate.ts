/** Prevent duplicate immutable issuance before React can commit creator state. */
export function createCustomNineCreatorIssueGate() {
  let inFlight = false;
  let issued = false;
  return {
    async run(operation: () => Promise<boolean>): Promise<boolean> {
      if (inFlight || issued) return false;
      inFlight = true;
      try {
        issued = await operation();
        return true;
      } finally {
        inFlight = false;
      }
    },
    reset(): void {
      if (!inFlight) issued = false;
    },
  };
}
