import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Auth rollout switches (see CLAUDE.md "Accounts"):
// - No NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY  -> auth fully dormant; every route
//   passes through untouched (the app behaves exactly as before Clerk).
// - Key present, AUTH_ENFORCED unset      -> sessions work (sign-up/sign-in
//   pages live) but nothing is gated: the production soft-launch state.
// - Key present, AUTH_ENFORCED=1          -> app pages require a signed-in
//   user; signed-out visitors are redirected to /sign-in.
const authConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const authEnforced = process.env.AUTH_ENFORCED === "1";

// Gate the application, not the funnel: the landing page, methodology, and
// the auth pages themselves stay public.
const isProtectedRoute = createRouteMatcher([
  "/overview(.*)",
  "/setup(.*)",
  "/prospect(.*)",
  "/defend(.*)",
  "/my-carriers(.*)",
  "/compliance(.*)",
  "/positioning(.*)",
  "/api/profile(.*)",
]);

export default authConfigured
  ? clerkMiddleware(async (auth, req) => {
      if (authEnforced && isProtectedRoute(req)) {
        await auth.protect();
      }
    })
  : () => NextResponse.next();

export const config = {
  // Clerk's recommended matcher: everything except static assets and _next
  // internals, plus all API routes.
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
