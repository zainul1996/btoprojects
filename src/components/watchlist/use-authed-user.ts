"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";

import { api } from "../../../convex/_generated/api";

/**
 * authed* functions throw "User not found" until the users row exists, so
 * dependent queries must stay skipped until the row is ensured. Returns
 * `ready` — pass `ready ? {} : "skip"` to authed queries.
 */
export function useAuthedUser(): boolean {
  const upsertUser = useMutation(api.users.upsertCurrent);
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
  }, [upsertUser]);

  return ready;
}
