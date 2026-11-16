import React, { useEffect, useId, useRef, useState } from "react";
const filterKeys = [
  "category",
  "availability",
  "status",
  "minPrice",
  "maxPrice",
];
const emptyFilters = Object.fromEntries(filterKeys.map((key) => [key, ""]));
const availabilityOptions = [
  ["", "All"],
  ["available", "Available"],
  ["unavailable", "Unavailable"],
];
const statusOptions = [
  ["", "Active dishes"],
  ["published", "Published"],
  ["draft", "Draft"],
  ["archived", "Archived"],
  ["all", "All records"],
];
function SelectField({ label, value, onChange, options }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
function PaginationSettings({ browser, staff = false, locked = false }) {
  const { params, mode, change } = browser;
  return (
    <fieldset className="dish-pagination-settings" disabled={locked}>
      <legend>Display options</legend>
      <SelectField
        label="Pagination"
        value={mode}
        onChange={(mode) => change({ mode, page: 1 })}
        options={[
          ["pages", "Page numbers"],
          ["more", "Load more"],
          ["infinite", "Infinite scroll"],
        ]}
      />
      <SelectField
        label="Dishes per batch"
        value={params.get("pageSize") || (staff ? "12" : "4")}
        onChange={(pageSize) => change({ pageSize, page: 1 })}
        options={["4", "12", "24", "48"].map((value) => [value, value])}
      />
      {mode === "infinite" && (
        <button
          type="button"
          aria-label={
            browser.autoPaused ? "Resume auto-loading" : "Pause auto-loading"
          }
          onClick={() => browser.setAutoPaused(!browser.autoPaused)}
        >
          {browser.autoPaused ? "Resume" : "Pause"}
        </button>
      )}
    </fieldset>
  );
}
export function DishFilters({ browser, staff = false }) {
  const { params, change, data, loading } = browser;
  const [q, setQ] = useState(params.get("q") || "");
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const applied = Object.fromEntries(
    filterKeys.map((key) => [key, params.get(key) || ""]),
  );
  const appliedKey = JSON.stringify(applied);
  const [draft, setDraft] = useState(applied);
  useEffect(() => setQ(params.get("q") || ""), [params.get("q")]);
  useEffect(() => setDraft(JSON.parse(appliedKey)), [appliedKey]);
  const categories = [
    ["", "All categories"],
    ...(data?.categories || []).map((c) => [c.slug, c.name]),
  ];
  const chips = [
    ...(params.get("q") ? [["q", `Search: ${params.get("q")}`]] : []),
    ...(applied.category
      ? [
          [
            "category",
            categories.find(([value]) => value === applied.category)?.[1] ||
              applied.category,
          ],
        ]
      : []),
    ...(applied.availability
      ? [
          [
            "availability",
            availabilityOptions.find(
              ([value]) => value === applied.availability,
            )?.[1] || applied.availability,
          ],
        ]
      : []),
    ...(staff && applied.status
      ? [
          [
            "status",
            statusOptions.find(([value]) => value === applied.status)?.[1] ||
              applied.status,
          ],
        ]
      : []),
    ...[
      ["minPrice", "From"],
      ["maxPrice", "Up to"],
    ]
      .filter(([key]) => applied[key] !== "")
      .map(([key, label]) => [
        key,
        `${label} ${Number(applied[key]).toLocaleString("en-US")} VND`,
      ]),
  ];
  const activeCount = filterKeys.filter(
    (key) => (staff || key !== "status") && applied[key] !== "",
  ).length;
  const selectDraft = (key, label, options) => (
    <SelectField
      label={label}
      options={options}
      value={draft[key]}
      onChange={(value) =>
        setDraft((current) => ({ ...current, [key]: value }))
      }
    />
  );
  return (
    <>
      <fieldset className="dish-query-controls" disabled={loading && !data}>
        <legend>Browse dishes</legend>
        <div className="dish-search-row">
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              change({ q: q.trim(), page: 1 });
            }}
          >
            <label>
              Search name and description
              <input
                type="search"
                value={q}
                maxLength={100}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Type a search, then press Enter"
              />
            </label>
            <button type="submit">Search</button>
          </form>
          <SelectField
            label="Sort by"
            value={params.get("sort") || "recommended"}
            onChange={(sort) => change({ sort, page: 1 })}
            options={[
              ["recommended", "Chef’s selection"],
              ["relevance", "Search relevance"],
              ["name", "Name A–Z"],
              ["name_desc", "Name Z–A"],
              ["price_asc", "Price low–high"],
              ["price_desc", "Price high–low"],
              ["newest", "Newest"],
              ["oldest", "Oldest"],
            ]}
          />
          <button
            type="button"
            className="advanced-search-toggle"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((value) => !value)}
          >
            Advanced search{activeCount ? ` (${activeCount})` : ""}
            <span aria-hidden="true">{expanded ? " −" : " +"}</span>
          </button>
        </div>
        <div id={panelId} hidden={!expanded} className="dish-advanced-panel">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              change({ ...draft, ...(staff ? {} : { status: "" }), page: 1 });
            }}
          >
            {selectDraft("category", "Category", categories)}
            {selectDraft("availability", "Availability", availabilityOptions)}
            {staff && selectDraft("status", "Status", statusOptions)}
            <label>
              Min price (VND)
              <input
                type="number"
                min="0"
                max="1000000000"
                value={draft.minPrice}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    minPrice: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Max price (VND)
              <input
                type="number"
                min={draft.minPrice || "0"}
                max="1000000000"
                value={draft.maxPrice}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    maxPrice: event.target.value,
                  }))
                }
              />
            </label>
            <div className="dish-filter-actions">
              <button type="submit">Apply filters</button>
              <button
                type="button"
                onClick={() => {
                  setDraft({ ...emptyFilters });
                  change({ ...emptyFilters, page: 1 });
                }}
              >
                Reset filters
              </button>
            </div>
          </form>
        </div>
        <div className="dish-filter-summary">
          <span role="status">
            {loading
              ? "Finding dishes…"
              : `${data?.total ?? 0} matching dishes`}
          </span>
          {chips.map(([key, label]) => (
            <button
              type="button"
              className="dish-filter-chip"
              key={key}
              aria-label={`Remove ${label}`}
              onClick={() => change({ [key]: "", page: 1 })}
            >
              {label}
              <span aria-hidden="true"> ×</span>
            </button>
          ))}
        </div>
      </fieldset>
    </>
  );
}
export function DishPagination({ browser, locked = false, staff = false }) {
  const { data, loading, error, mode, next, change } = browser,
    sentinel = useRef(null),
    [page, setPage] = useState("1");
  useEffect(() => setPage(String(data?.page || 1)), [data?.page]);
  useEffect(() => {
    if (
      mode !== "infinite" ||
      loading ||
      error ||
      locked ||
      browser.autoPaused ||
      !data?.hasNext
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Re-observe after each completed batch. If the list end is still
        // visible, load again without requiring a scroll-away gesture.
        if (entries[0].isIntersecting) next();
      },
      { rootMargin: "0px" },
    );
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [
    mode,
    loading,
    error,
    locked,
    browser.autoPaused,
    data?.page,
    data?.hasNext,
    next,
  ]);
  if (!data) return null;
  const disabled = loading || locked;
  return (
    <>
      <nav
        className="dish-pagination pagination-toolbar"
        aria-label="Dish pagination"
      >
        <PaginationSettings browser={browser} staff={staff} />
        <p className="pagination-summary" aria-live="polite">
          {data.total} dishes · {mode === "pages" ? "Page" : "Batch"}{" "}
          {data.page} / {data.pageCount}
          {loading
            ? " · Loading…"
            : mode === "infinite" && browser.autoPaused
              ? " · Paused"
              : ""}
        </p>
        {mode === "pages" ? (
          <div className="button-row">
            <button
              disabled={disabled || data.page === 1}
              onClick={() => change({ page: 1 })}
            >
              First
            </button>
            <button
              disabled={disabled || data.page === 1}
              onClick={() => change({ page: data.page - 1 })}
            >
              ← Previous
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                change({ page: Number(page) });
              }}
            >
              <label>
                Page
                <input
                  aria-label="Page number"
                  type="number"
                  min="1"
                  max={data.pageCount}
                  required
                  value={page}
                  onChange={(e) => setPage(e.target.value)}
                  disabled={disabled}
                />
              </label>
              <button disabled={disabled}>Go</button>
            </form>
            <button disabled={disabled || !data.hasNext} onClick={next}>
              Next →
            </button>
            <button
              disabled={disabled || !data.hasNext}
              onClick={() => change({ page: data.pageCount })}
            >
              Last
            </button>
          </div>
        ) : (
          <>
            <button
              disabled={disabled || !data.hasNext || !!error}
              onClick={next}
            >
              {data.hasNext ? "Load more dishes" : "All matching dishes loaded"}
            </button>
          </>
        )}
        {!data.total && <p>No dishes match these filters.</p>}
        {error && <button onClick={browser.reload}>Retry this batch</button>}
      </nav>
      {mode === "infinite" && (
        <div ref={sentinel} className="scroll-sentinel" aria-hidden="true" />
      )}
    </>
  );
}
