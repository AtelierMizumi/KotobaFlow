"use client";
import { useState, useCallback, useRef } from "react";
import DictionaryPopup from "./DictionaryPopup";
import type { Segment, NLPToken, DictionaryEntry, StudyMode } from "@/lib/types";

interface KaraokeSubtitleProps {
  segments: Segment[];
  activeIndex: number;
  studyMode: StudyMode;
  onAddFlashcard?: (token: NLPToken, dict: DictionaryEntry, segment: Segment) => void;
}

/** Renders a single interactive word token */
function TokenWord({
  token,
  isActive,
  studyMode,
  onTokenClick,
}: {
  token: NLPToken;
  isActive: boolean;
  studyMode: StudyMode;
  onTokenClick: (token: NLPToken, el: HTMLElement) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  const handleClick = useCallback(() => {
    if (ref.current) onTokenClick(token, ref.current);
  }, [token, onTokenClick]);

  const isDictation = studyMode === "dictation";

  return (
    <span
      ref={ref}
      className={`token-word${isActive ? " active" : ""}${token.dictionary ? " has-dict" : ""}`}
      onClick={handleClick}
      title={token.pos}
      lang="ja"
    >
      {token.has_kanji ? (
        <ruby>
          {/* In dictation mode, blur the kanji text */}
          <span style={isDictation ? { filter: "blur(5px)", userSelect: "none" } : {}}>
            {token.surface}
          </span>
          <rt>{token.reading}</rt>
        </ruby>
      ) : (
        <span style={isDictation ? { filter: "blur(5px)", userSelect: "none" } : {}}>
          {token.surface}
        </span>
      )}
    </span>
  );
}

/** Fallback plain text when NLP data is not yet available */
function PlainText({ text, isActive }: { text: string; isActive: boolean }) {
  return (
    <span
      lang="ja"
      style={{
        color: isActive ? "var(--accent-amber)" : "inherit",
        textShadow: isActive ? "0 0 20px rgba(251,191,36,0.4)" : "none",
        transition: "all 0.3s ease",
      }}
    >
      {text}
    </span>
  );
}

export default function KaraokeSubtitle({
  segments,
  activeIndex,
  studyMode,
  onAddFlashcard,
}: KaraokeSubtitleProps) {
  const [popup, setPopup] = useState<{
    token: NLPToken;
    anchor: HTMLElement;
    segment: Segment;
  } | null>(null);

  const handleTokenClick = useCallback(
    (token: NLPToken, el: HTMLElement, segment: Segment) => {
      setPopup((prev) =>
        prev?.token.surface === token.surface && prev.anchor === el
          ? null
          : { token, anchor: el, segment }
      );
    },
    []
  );

  const handleAddFlashcard = useCallback(
    (token: NLPToken, dict: DictionaryEntry) => {
      if (popup) onAddFlashcard?.(token, dict, popup.segment);
    },
    [popup, onAddFlashcard]
  );

  const activeSegment = activeIndex >= 0 ? segments[activeIndex] : null;
  const displaySegment = activeSegment ?? (segments.length > 0 ? segments[segments.length - 1] : null);

  return (
    <div className="karaoke-bar" id="karaoke-subtitle">
      {displaySegment ? (
        displaySegment.nlp ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 0", alignItems: "baseline" }}>
            {displaySegment.nlp.tokens.map((token, i) => (
              <TokenWord
                key={`${displaySegment.id}-${i}`}
                token={token}
                isActive={activeIndex === segments.indexOf(displaySegment)}
                studyMode={studyMode}
                onTokenClick={(t, el) => handleTokenClick(t, el, displaySegment)}
              />
            ))}
          </div>
        ) : (
          <PlainText
            text={displaySegment.text}
            isActive={activeIndex >= 0}
          />
        )
      ) : (
        <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Phụ đề sẽ hiển thị ở đây...
        </span>
      )}

      {/* Dictionary Popup */}
      {popup && (
        <DictionaryPopup
          token={popup.token}
          anchorEl={popup.anchor}
          onClose={() => setPopup(null)}
          onAddFlashcard={handleAddFlashcard}
        />
      )}
    </div>
  );
}
