"use client";

import { useState } from "react";
import Icon from "@/components/common/Icon";
import type { ToolFaq } from "@/data/pdfToolTypes";

/** Stitch FAQ accordion: expand_more → expand_less, bordered answer panel. */
export default function PdfFaqAccordion({ faqs }: { faqs: ToolFaq[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-2.5">
      {faqs.map((faq, index) => {
        const open = openIndex === index;
        return (
          <div
            key={faq.q}
            className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-2 cursor-pointer transition-colors"
            onClick={() => setOpenIndex(open ? null : index)}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">{faq.q}</h3>
              <Icon
                name={open ? "expand_less" : "expand_more"}
                size={20}
                className="text-on-surface-variant transition-transform shrink-0"
              />
            </div>
            {open && (
              <p className="font-body-md text-body-md text-on-surface-variant pt-1 border-t border-outline-variant/30">
                {faq.a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
