/** Hook Next.js: berjalan sekali saat server start → menyalakan worker email & pengingat. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackgroundJobs } = await import("./lib/jobs");
    startBackgroundJobs();
  }
}
