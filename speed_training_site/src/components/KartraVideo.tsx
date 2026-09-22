"use client";

import { useEffect, useRef, useState } from "react";
import { links, video } from "@/content";
import { IconExternal } from "./Icons";

// Kartra's hosted player is injected by its own script. We reproduce the
// container the original page used (same id, class, and 16:9 padding box)
// and append the script inside it after mount, which is how the Kartra page
// builder emits it. If the player never renders (ad blockers, an origin
// Kartra refuses), the On Demand link remains so the visitor is never stuck.
export default function KartraVideo() {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el || el.dataset.loaded) return;
    el.dataset.loaded = "1";
    const s = document.createElement("script");
    s.src = video.scriptSrc;
    s.async = true;
    s.onerror = () => setFailed(true);
    el.appendChild(s);
    const t = window.setTimeout(() => {
      // Nothing but our own script inside after 8s: treat as not rendered.
      if (el.children.length <= 1) setFailed(true);
    }, 8000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="sleeve">
      <div className="sleeve__inner">
        <div
          ref={host}
          className={`kartra_video kartra_video--player_4 kartra_video_container${video.id} js_kartra_trackable_object`}
          style={{ paddingBottom: "56.25%" }}
          data-kt-type="video"
          data-kt-value={video.id}
          data-kt-owner="Brll6JAr"
          id={`${video.id}/zfbbd/?autoplay=false&mute_on_start=false&show_controls=true&skin=10&sticky=false&resume_playback=false`}
          data-random_str="zfbbd"
        />
        {failed && (
          <p className="px-4 py-3 text-sm text-ink-2 border-t border-rule">
            The workshop preview didn&apos;t load here.{" "}
            <a href={links.onDemand} className="font-bold text-ink inline-flex items-center gap-1">
              Open the On Demand page <IconExternal className="w-4 h-4" />
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
