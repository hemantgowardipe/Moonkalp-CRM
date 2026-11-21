"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useLinkStatus } from "next/link";
import NProgress from "nprogress";
import { createNavigationPendingStore, isSamePageHashLink } from "@/lib/navigationPending.mjs";

// The top bar is NProgress (https://github.com/rstacruz/nprogress, MIT). Its
// stylesheet is adapted to the design tokens in globals.css.
NProgress.configure({ minimum: 0.12, showSpinner: false, speed: 260, trickleSpeed: 180 });

const pendingNavigation = createNavigationPendingStore();

function subscribe(listener) {
  return pendingNavigation.subscribe(listener);
}

const isIdleOnServer = () => false;
const noTargetOnServer = () => null;

/**
 * Runs the NProgress bar while any tracked navigation is pending. Rendered
 * once in the root layout, which persists across client navigations.
 */
export function NavigationProgressBar() {
  const pending = useSyncExternalStore(subscribe, pendingNavigation.isPending, isIdleOnServer);

  useEffect(() => {
    if (!pending) return undefined;
    NProgress.start();
    return () => {
      NProgress.done();
    };
  }, [pending]);

  return null;
}

/**
 * Place inside a <Link>. Uses Next's own pending signal (useLinkStatus), which
 * turns on when the click starts a server round trip and off the moment the
 * new page commits or another click supersedes it, so the feedback can never
 * get stuck. It feeds the progress bar and any <PendingRegion> in `scope`, and
 * exposes `data-pending` so CSS can mark the clicked item as current at once.
 */
export function LinkPendingIndicator({ scope = "app", target = null }) {
  const { pending } = useLinkStatus();
  const markerRef = useRef(null);

  useEffect(() => {
    if (!pending) return undefined;
    const href = markerRef.current?.closest("a")?.getAttribute("href");
    // Anchor jumps on the current page never reach the server.
    if (isSamePageHashLink(href, `${window.location.pathname}${window.location.search}`)) return undefined;
    return pendingNavigation.begin(scope, target);
  }, [pending, scope, target]);

  return <span aria-hidden="true" className="link-pending" data-pending={pending ? "" : undefined} ref={markerRef} />;
}

/**
 * Swaps `children` for the skeleton of the destination the moment a link in
 * `scope` starts navigating somewhere other than `current`. The stale content
 * stays mounted (just hidden), so nothing is lost if the navigation is
 * superseded. Both wrappers use `display: contents`, so the parent's grid or
 * flow layout is unchanged.
 */
export function PendingRegion({ scope, current, fallbacks = {}, fallback = null, children }) {
  const getTarget = () => pendingNavigation.getTarget(scope);
  const target = useSyncExternalStore(subscribe, getTarget, noTargetOnServer);
  const placeholder = target !== null && target !== current ? (fallbacks[target] ?? fallback) : null;
  const placeholderRef = useRef(null);

  useEffect(() => {
    const first = placeholderRef.current?.firstElementChild;
    // The navigation will scroll to the new content; bring its placeholder into view now.
    if (first && first.getBoundingClientRect().top < 0) first.scrollIntoView({ block: "start" });
  }, [placeholder]);

  return (
    <>
      {placeholder ? (
        <div className="pending-placeholder" ref={placeholderRef}>
          {placeholder}
        </div>
      ) : null}
      <div className="pending-content" hidden={placeholder ? true : undefined}>
        {children}
      </div>
    </>
  );
}
