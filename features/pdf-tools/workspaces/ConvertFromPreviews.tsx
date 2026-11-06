"use client";

import { useMemo } from "react";
import Icon from "@/components/common/Icon";
import type {
  ExtractedTable,
  HtmlPreviewData,
  ImagePreviewData,
  TablePreviewData,
} from "../engines/convertFrom/convertFromTypes";
import { truncateMiddle } from "../engines/convertFrom/convertFromUtils";

/* -------------------------------------------------------------------------- */
/* Output previews shared by the Convert-from-PDF workspaces. They mirror the */
/* original i love pdf previews (image grid, selectable tables, sandboxed     */
/* HTML frame, text panel) restyled for the Stitch design system.             */
/* -------------------------------------------------------------------------- */

/** Thumbnail grid for PDF→JPG/PNG results (first 8 pages, data-URL previews). */
export function ConvertImagePreviewGrid({ data }: { data: ImagePreviewData }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
          Page Previews
        </span>
        <span className="font-label-mono-xs text-label-sm text-outline">
          {data.totalPages} page{data.totalPages === 1 ? "" : "s"}
          {data.zipped ? " • zipped" : ""}
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {data.images.map((image) => (
          <figure
            key={image.name}
            className="bg-surface-container-low rounded-lg overflow-hidden flex flex-col"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.dataUrl}
              alt={`Preview of ${image.name}`}
              className="w-full h-20 object-cover object-top"
              loading="lazy"
            />
            <figcaption className="px-1.5 py-1 font-label-mono-xs text-[10px] text-on-surface-variant truncate">
              {truncateMiddle(image.name, 24)}
            </figcaption>
          </figure>
        ))}
      </div>
      {data.totalPages > data.images.length && (
        <p className="font-label-sm text-label-sm text-outline">
          Showing the first {data.images.length} previews — the ZIP contains all{" "}
          {data.totalPages} images.
        </p>
      )}
    </div>
  );
}

const TABLE_PREVIEW_ROWS = 12;
const TABLE_PREVIEW_COLUMNS = 8;

function TableGrid({ table }: { table: ExtractedTable }) {
  const rows = table.rows.slice(0, TABLE_PREVIEW_ROWS);
  const widest = Math.max(
    table.headers?.length ?? 0,
    ...table.rows.map((row) => row.length)
  );
  const columnCount = Math.min(TABLE_PREVIEW_COLUMNS, widest);
  const hiddenRows = Math.max(0, table.rows.length - rows.length);
  const hiddenColumns = Math.max(0, widest - columnCount);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="overflow-x-auto rounded-lg border border-outline-variant/40">
        <table className="w-full border-collapse text-left">
          {table.headers && table.headers.length > 0 && (
            <thead className="bg-surface-container-high">
              <tr>
                {table.headers.slice(0, columnCount).map((header, index) => (
                  <th
                    key={index}
                    scope="col"
                    className="max-w-64 whitespace-nowrap border-b border-outline-variant/40 px-2.5 py-2 font-body-sm text-body-sm font-semibold text-on-surface"
                  >
                    {header || "—"}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 1 ? "bg-surface-container-low/50" : ""}>
                {row.slice(0, columnCount).map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="max-w-64 border-b border-outline-variant/30 px-2.5 py-1.5 align-top font-body-sm text-body-sm text-on-surface-variant"
                  >
                    <span className="line-clamp-3 whitespace-pre-wrap break-words">{cell || "—"}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(hiddenRows > 0 || hiddenColumns > 0) && (
        <p className="font-label-mono-xs text-label-sm text-outline">
          Preview truncated
          {hiddenRows > 0 ? ` · ${hiddenRows} more row(s)` : ""}
          {hiddenColumns > 0 ? ` · ${hiddenColumns} more column(s)` : ""}. The export includes the full table.
        </p>
      )}
    </div>
  );
}

/** Selectable per-table preview for the PDF→Excel workspace. */
export function ConvertTablePreview({
  data,
  selectedIds,
  onSelectionChange,
}: {
  data: TablePreviewData;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}) {
  const allSelected = useMemo(
    () => data.tables.length > 0 && selectedIds.size === data.tables.length,
    [data.tables.length, selectedIds.size]
  );

  const toggleAll = (checked: boolean) => {
    onSelectionChange(checked ? new Set(data.tables.map((table) => table.id)) : new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectionChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-body-sm text-body-sm text-on-surface flex items-center gap-1.5">
          <Icon name="table_chart" size={16} className="text-secondary" />
          <strong>{data.tables.length}</strong> table{data.tables.length === 1 ? "" : "s"} found
          {data.pageCount ? ` across ${data.pageCount} pages` : ""}
        </span>
        <label className="flex items-center gap-2 cursor-pointer font-body-sm text-body-sm text-on-surface">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) => toggleAll(event.target.checked)}
            className="w-4 h-4 text-primary rounded focus:ring-primary accent-primary"
          />
          Select all
        </label>
      </div>

      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Choose which tables to include in the workbook. Each selected table becomes its own sheet.
      </p>

      <div className="flex flex-col gap-3">
        {data.tables.map((table, index) => {
          const checked = selectedIds.has(table.id);
          return (
            <div key={table.id} className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer font-body-sm text-body-sm font-medium text-on-surface">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => toggleOne(table.id, event.target.checked)}
                    className="w-4 h-4 text-primary rounded focus:ring-primary accent-primary"
                  />
                  Table {index + 1}
                  {table.pageNumber ? ` · page ${table.pageNumber}` : ""}
                </label>
                <span className="font-label-mono-xs text-label-sm text-on-surface-variant">
                  {table.rows.length} row{table.rows.length === 1 ? "" : "s"}
                  {table.headers?.length ? ` · ${table.headers.length} column${table.headers.length === 1 ? "" : "s"}` : ""}
                </span>
              </div>
              <TableGrid table={table} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Sandboxed live preview for the PDF→HTML workspace. Scripts/forms blocked. */
export function ConvertHtmlPreview({ data }: { data: HtmlPreviewData }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
          Live Preview (sandboxed)
        </span>
        <span className="inline-flex items-center gap-1 font-label-mono-xs text-label-sm text-outline">
          <Icon name="shield" size={12} /> scripts blocked
        </span>
      </div>
      <iframe
        title="Converted HTML preview"
        sandbox=""
        srcDoc={data.html}
        className="w-full h-80 rounded-lg border border-outline-variant/40 bg-white"
      />
    </div>
  );
}

/** Monospace text panel for PDF→Text / PDF→Markdown results. */
export function ConvertTextPreview({ text, limit = 12_000 }: { text: string; limit?: number }) {
  const shown = text.length > limit ? `${text.slice(0, limit)}\n… (preview truncated)` : text;
  return (
    <div className="flex flex-col gap-2">
      <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
        Extracted Content
      </span>
      <pre className="max-h-72 overflow-auto rounded-lg bg-surface-container-low p-3 whitespace-pre-wrap break-words font-label-mono-xs text-label-sm text-on-surface">
        {shown}
      </pre>
    </div>
  );
}
