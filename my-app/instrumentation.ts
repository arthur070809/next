import { logLoginTestModeStartup } from "@/lib/login-test-mode";
import { logLoginDemoModeStartup } from "@/lib/demo-mode";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    logLoginTestModeStartup();
    logLoginDemoModeStartup();
  }
}
