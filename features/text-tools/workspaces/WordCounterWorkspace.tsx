"use client";

/** Word & Character Counter workspace â€” live statistics dashboard. */

import { useMemo, useState } from "react";
import Icon from "@/components/common/Icon";
import CodeEditor from "@/components/tools/CodeEditor";
import CopyButton from "@/components/tools/CopyButton";
import { RIBBON_BTN, RIBBON_BTN_CLEAR, RIBBON_ROW } from "@/components/tools/ribbonStyles";
import { computeTextStats, keywordDensity, type KeywordStat, type TextStats } from "../engines/textEngines";
import { useRibbonPortal } from "@/hooks/useRibbonPortal";

interface StatCard {
  icon: string;
  label: string;
  value: string | number;
  tone: string;
}

const TONES = ["text-primary", "text-secondary", "text-tertiary"];

export default function WordCounterWorkspace() {
  const [input, setInput] = useState("");

  const stats = useMemo<TextStats>(() => computeTextStats(input), [input]);
  const keywords = useMemo<KeywordStat[]>(() => keywordDensity(input), [input]);

  const ribbon = (
    <div className={RIBBON_ROW}>
      <div className="flex flex-wrap items-center gap-space-xs">
        <button
          type="button"
          onClick={() =>
            setInput(
              "Paste an essay, blog post or product description here. The counter updates every stat instantly â€” characters, words, sentences, reading time and keyword density."
            )
          }
          className={RIBBON_BTN}
        >
          <Icon name="terminal" size={16} />
          <span>Sample Text</span>
        </button>
        <button type="button" onClick={() => setInput("")} className={RIBBON_BTN_CLEAR}>
          <Icon name="delete_sweep" size={16} />
          <span>Clear</span>
        </button>
      </div>
      <span className="inline-flex items-center gap-1 px-space-sm py-1.5 rounded-lg bg-secondary/10 text-secondary text-label-mono-md font-label-mono-md">
        <Icon name="bolt" size={16} />
        <span>Live â€” updates as you type</span>
      </span>
    </div>
  );
  const ribbonNode = useRibbonPortal(ribbon);

  const cards: StatCard[] = [
    { icon: "text_fields", label: "Characters", value: stats.characters, tone: TONES[0] },
    { icon: "space_bar", label: "No Spaces", value: stats.charactersNoSpaces, tone: TONES[1] },
    { icon: "notes", label: "Words", value: stats.words, tone: TONES[2] },
    { icon: "star", label: "Unique Words", value: stats.uniqueWords, tone: TONES[0] },
    { icon: "rainbow", label: "Sentences", value: stats.sentences, tone: TONES[1] },
    { icon: "segment", label: "Paragraphs", value: stats.paragraphs, tone: TONES[2] },
    { icon: "format_line_spacing", label: "Lines", value: stats.lines, tone: TONES[0] },
  ];

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        <CodeEditor
          value={input}
          onChange={setInput}
          title="Your Text"
          chip="LIVE STATS"
          placeholder="Type or paste text â€” every stat updates instantly"
        />

        {/* Stats dashboard */}
        <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-2xl relative">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Live Statistics</span>
            </div>
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">100% Client Memory</span>
          </div>
          <div className="bg-surface-container-lowest p-space-md flex-1 overflow-auto" style={{ height: 420, maxHeight: 560 }}>
            {input.trim().length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <Icon name="analytics" size={36} className="text-outline-variant" />
                <p className="text-on-surface-variant font-body-sm text-body-sm">Statistics appear here as soon as you start typing.</p>
              </div>
            ) : (
              <div className="space-y-space-md">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-xs">
                  {cards.map((c) => (
                    <div key={c.label} className="bg-surface-container-low rounded-lg p-space-sm text-center">
                      <Icon name={c.icon} size={16} className={`${c.tone} mx-auto mb-1`} />
                      <div className="font-headline-sm text-headline-sm text-on-surface font-bold">{c.value}</div>
                      <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant">{c.label}</div>
                    </div>
                  ))}
                </div>

                {/* time estimates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-xs">
                  <div className="bg-surface-container-low rounded-lg p-space-sm flex items-center gap-2">
                    <Icon name="menu_book" size={18} className="text-secondary flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-body-md text-body-md text-on-surface font-semibold">{stats.readingTime}</div>
                      <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant">Silent reading (225 wpm)</div>
                    </div>
                  </div>
                  <div className="bg-surface-container-low rounded-lg p-space-sm flex items-center gap-2">
                    <Icon name="record_voice_over" size={18} className="text-tertiary flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-body-md text-body-md text-on-surface font-semibold">{stats.speakingTime}</div>
                      <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant">Speaking (130 wpm)</div>
                    </div>
                  </div>
                </div>

                {/* averages */}
                <div className="flex flex-wrap gap-space-sm text-label-mono-md font-label-mono-md text-on-surface-variant">
                  <span>
                    Avg word length: <span className="text-on-surface font-semibold">{stats.avgWordLength}</span>
                  </span>
                  <span>
                    Avg sentence length: <span className="text-on-surface font-semibold">{stats.avgSentenceLength} words</span>
                  </span>
                </div>

                {/* keyword density */}
                <div>
                  <div className="font-headline-sm text-headline-sm text-on-surface mb-space-xs flex items-center gap-1.5">
                    <Icon name="query_stats" size={16} className="text-primary" />
                    Keyword Density
                  </div>
                  {keywords.length === 0 ? (
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Not enough text for a keyword breakdown yet.</p>
                  ) : (
                    <div className="space-y-1">
                      {keywords.map((k) => (
                        <div key={k.word} className="flex items-center gap-2">
                          <span className="font-label-mono-md font-label-mono-md text-on-surface w-28 truncate" title={k.word}>
                            {k.word}
                          </span>
                          <div className="flex-1 h-2 rounded-full bg-surface-container-high overflow-hidden min-w-16">
                            <div className="h-full rounded-full bg-secondary/70" style={{ width: `${Math.min(100, k.density * 8)}%` }} />
                          </div>
                          <span className="font-label-mono-xs font-label-mono-xs text-on-surface-variant whitespace-nowrap">
                            {k.count}Ã— Â· {k.density}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="bg-surface-container-low px-space-md py-2 flex items-center justify-between flex-wrap gap-1 text-label-mono-xs font-label-mono-xs">
            <div className="flex items-center gap-2 min-w-0 text-secondary">
              <Icon name="verified" size={16} className="flex-shrink-0" />
              <span className="font-semibold truncate">{input ? "Computed locally â€¢ nothing is transmitted" : "Awaiting input"}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <CopyButton
                value={
                  input
                    ? `Characters: ${stats.characters} (${stats.charactersNoSpaces} without spaces)\nWords: ${stats.words} (${stats.uniqueWords} unique)\nSentences: ${stats.sentences}\nParagraphs: ${stats.paragraphs}\nLines: ${stats.lines}\nReading time: ${stats.readingTime}\nSpeaking time: ${stats.speakingTime}`
                    : ""
                }
                label="Copy report"
              />
            </div>
          </div>
        </div>
      </div>

      {ribbonNode}
    </>
  );
}
