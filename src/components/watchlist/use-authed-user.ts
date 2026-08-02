"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";

import { api } from "../../../convex/_generated/api";

/**
 * authed* functions throw "User not found" until the users row exists, so
 * dependent queries must stay skipped until the row is ensured. Returns
 * `ready` — pass `ready ? {} : "skip"` to authed queries. Anonymous visitors
 * short-circuit to false without ever calling the mutation (an unauthenticated
 * upsert throws server-side and spams the console).
 */
export function useAuthedUser(): boolean {
  const { isLoaded, isSignedIn } = useAuth();
  const upsertUser = useMutation(api.users.upsertCurrent);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoaded || isSignedIn !== true) return;
    let cancelled = false;
    upsertUser({})
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        // Signed out mid-flight or offline — queries stay skipped.
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, upsertUser]);

  return isLoaded && isSignedIn === true && ready;
}
