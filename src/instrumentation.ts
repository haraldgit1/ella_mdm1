export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWorkflowLoop } = await import("./instrumentation.node");
    startWorkflowLoop();
  }
}
