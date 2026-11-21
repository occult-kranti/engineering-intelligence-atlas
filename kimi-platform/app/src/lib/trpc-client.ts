import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../api/router";

/**
 * Shared tRPC client handle. Lives outside the provider component module so
 * the provider file only exports components (react-refresh rule).
 */
export const trpc = createTRPCReact<AppRouter>();
