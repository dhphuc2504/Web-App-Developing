import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { menuApi } from "../api/resources.js";
import { useResource } from "../hooks/useResource.js";
import {
  Food,
  ErrorNotice,
  Heading,
  Modal,
  ResourceState,
  money,
} from "../components/common.jsx";
export function Home() {
  return (
    <section className="entrance-scene">
      <div className="scene-canvas">
        <img
          className="scene-background"
          src="/images/japan/exterior.jpg"
          alt="Santaishi-tei restaurant exterior"
        />
        <Link
          className="entrance-door"
          to="/directory"
          aria-label="Slide open the Japanese door and enter the restaurant"
        >
          <span className="shoji-panel shoji-left" />
          <span className="shoji-panel shoji-right" />
          <span className="door-invitation">
            <span lang="ja">三太子亭</span>
            <small>CLICK TO ENTER ↗</small>
          </span>
        </Link>
      </div>
      <div className="entrance-copy">
        <p className="eyebrow">A little pause. A warm welcome.</p>
        <h1>
          An evening at <em>Santaishi-tei.</em>
        </h1>
      </div>
      <div className="entrance-bottom">
        <p>Your table is waiting.</p>
        <Link to="/menu">Go straight to the menu ↗</Link>
        <span>三太子亭 — Japanese kitchen</span>
      </div>
    </section>
  );
}
export function Directory() {
  return (
    <section className="directory-scene">
      <img
        className="scene-background"
        src="/images/japan/foyer.jpg"
        alt="Japanese restaurant foyer with dining room, kitchen and office"
      />
      <div className="directory-copy">
        <p className="eyebrow">Welcome to the house</p>
        <h1>
          Make yourself <em>at home.</em>
        </h1>
        <p>Follow the light. Find your place.</p>
      </div>
      {[
        ["dining", "/menu", "食堂", "Dining room", "Explore the menu"],
        ["office", "/admin", "管理", "Office", "Administrator access"],
        ["kitchen", "/kitchen", "厨房", "Kitchen", "Staff access"],
      ].map(([cls, to, kanji, title, desc]) => (
        <Link
          key={to}
          to={to}
          className={"room-door room-" + cls}
          aria-label={title + " — " + desc}
        >
          <span className="floor-arrow" aria-hidden="true">
            <svg viewBox="0 0 200 130">
              <path
                className="arrow-halo"
                d="M100 108 V24 M62 62 L100 24 L138 62"
              />
              <path
                className="arrow-core"
                d="M100 108 V24 M62 62 L100 24 L138 62"
              />
            </svg>
          </span>
          <span className="room-label">
            <span lang="ja">{kanji}</span>
            <strong>{title}</strong>
            <small>{desc}</small>
          </span>
        </Link>
      ))}
      <div className="directory-bottom">
        <Link to="/">← Step outside</Link>
        <p>
          Dining is open to everyone. Staff sign in for the kitchen and office.
        </p>
      </div>
    </section>
  );
}
function MenuPage({ items, side, page, onSelect }) {
  return (
    <div className={"book-page page-" + (side ? "right" : "left")}>
      <header className="book-page-heading">
        <span lang="ja">三太子亭</span>
        <span>{side ? "THE SELECTION" : "SANTAISHI-TEI / MENU"}</span>
      </header>
      {items.map((d) => (
        <article className="menu-entry" key={d.id}>
          <button
            className="photo-trigger"
            onClick={() => onSelect(d)}
            aria-label={"View " + d.name + " details"}
          >
            <Food dish={d} />
          </button>
          <div className="menu-entry-copy">
            <span className="eyebrow">{d.category.name}</span>
            <h2>
              <button className="text-button" onClick={() => onSelect(d)}>
                {d.name}
              </button>
            </h2>
            <p>{d.description || "Made with care in our kitchen."}</p>
            <strong>{money(d.priceMinor)}</strong>
            {!d.isAvailable && <small>Currently unavailable</small>}
          </div>
        </article>
      ))}
      {!items.length && (
        <div className="book-empty">
          <span lang="ja">食</span>
          <p>A quiet page, for now.</p>
        </div>
      )}
      <footer className="book-page-footer">
        <span>Made with care.</span>
        <span>{(page - 1) * 2 + side + 1}</span>
      </footer>
    </div>
  );
}

export function Menu() {
  const [params, setParams] = useSearchParams(),
    [selected, setSelected] = useState(null),
    [search, setSearch] = useState(params.get("q") || "");
  const resource = useResource(
      (signal) => menuApi.list(params.toString(), signal),
      params.toString(),
      { keepPreviousData: true },
    ),
    [turn, setTurn] = useState(null),
    last = useRef(null),
    timer = useRef(null);
  useLayoutEffect(() => {
    if (resource.data) {
      const previous = last.current;
      if (
        previous &&
        previous.page !== resource.data.page &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        setTurn({ old: previous, back: resource.data.page < previous.page });
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setTurn(null), 800);
      }
      last.current = resource.data;
    }
  }, [resource.data]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => setSearch(params.get("q") || ""), [params.toString()]);
  const change = (values) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values))
      value ? next.set(key, String(value)) : next.delete(key);
    setParams(next);
  };
  return (
    <>
      <Heading title="Something delicious." kicker="食堂 · The dining room" />
      <ResourceState resource={resource} keepPreviousData>
        {(data) => (
          <>
            <div className="menu-controls">
              <nav className="category-tabs">
                <button onClick={() => change({ category: "", page: 1 })}>
                  All dishes
                </button>
                {data.categories.map((c) => (
                  <button
                    key={c.id}
                    aria-pressed={params.get("category") === c.slug}
                    onClick={() => change({ category: c.slug, page: 1 })}
                  >
                    {c.name}
                  </button>
                ))}
              </nav>
              <form
                className="sort-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  change({ q: search, page: 1 });
                }}
              >
                <input
                  aria-label="Find a dish"
                  placeholder="Find a dish…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <label htmlFor="menu-sort">Sort by</label>
                <select
                  id="menu-sort"
                  value={params.get("sort") || "recommended"}
                  onChange={(e) => change({ sort: e.target.value, page: 1 })}
                >
                  <option value="recommended">Chef’s selection</option>
                  <option value="name">Name A–Z</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                </select>
                <button>Apply</button>
              </form>
            </div>
            <section
              className={
                "menu-book " +
                (turn
                  ? "book-flipping " + (turn.back ? "flip-back" : "flip-next")
                  : "")
              }
              aria-label={"Menu page " + data.page}
            >
              <div className="book-spread">
                {[0, 1].map((side) => (
                  <MenuPage
                    onSelect={setSelected}
                    key={side}
                    items={data.items.slice(side * 2, side * 2 + 2)}
                    side={side}
                    page={data.page}
                  />
                ))}
              </div>
              <span className="book-ribbon" />
              {turn && (
                <div className="book-turn-sheet" aria-hidden="true" inert>
                  <div className="book-turn-face turn-front">
                    <MenuPage
                      onSelect={setSelected}
                      items={turn.old.items.slice(
                        turn.back ? 0 : 2,
                        turn.back ? 2 : 4,
                      )}
                      side={turn.back ? 0 : 1}
                      page={turn.old.page}
                    />
                  </div>
                  <div className="book-turn-face turn-back">
                    <MenuPage
                      onSelect={setSelected}
                      items={data.items.slice(
                        turn.back ? 2 : 0,
                        turn.back ? 4 : 2,
                      )}
                      side={turn.back ? 1 : 0}
                      page={data.page}
                    />
                  </div>
                </div>
              )}
            </section>
            <nav className="book-pagination">
              <button
                disabled={resource.loading || !!turn || data.page === 1}
                onClick={() => change({ page: data.page - 1 })}
              >
                ← Previous page
              </button>
              <span aria-live="polite">
                PAGE {data.page} / {data.pageCount}
                {resource.loading && (
                  <small className="menu-loading">Loading menu…</small>
                )}
              </span>
              <button
                disabled={
                  resource.loading || !!turn || data.page === data.pageCount
                }
                onClick={() => change({ page: data.page + 1 })}
              >
                Next page →
              </button>
            </nav>
            {resource.error && (
              <div className="menu-load-error">
                <ErrorNotice error={resource.error} />
                <p>The current menu is still displayed.</p>
                <button onClick={resource.reload}>Try again</button>
              </div>
            )}
          </>
        )}
      </ResourceState>
      {selected && (
        <Modal label={selected.name} onClose={() => setSelected(null)}>
          <Food dish={selected} />
          <p className="eyebrow">{selected.category.name}</p>
          <h2>{selected.name}</h2>
          <p>{selected.description}</p>
          <p className="dish-price">{money(selected.priceMinor)}</p>
          <Link to={"/menu/" + selected.slug}>Full dish page ↗</Link>
        </Modal>
      )}
    </>
  );
}
export function DishDetail() {
  const { slug } = useParams(),
    resource = useResource((signal) => menuApi.get(slug, signal), slug);
  return (
    <ResourceState resource={resource}>
      {(dish) => (
        <>
          <Heading
            title={dish.name}
            kicker={dish.category.name + " · From our kitchen"}
            back="/menu"
          />
          <article className="dish-story">
            <div className="dish-story-photo">
              <span className="eyebrow">三太子亭 · Made with care</span>
              <Food dish={dish} />
              <span className="dish-story-seal" lang="ja" aria-hidden="true">
                食
              </span>
            </div>
            <div className="dish-story-copy">
              <p className="eyebrow">A place at our table</p>
              <p className="dish-story-description">
                {dish.description ||
                  "Prepared with care in the Santaishi-tei kitchen."}
              </p>
              <div className="dish-story-meta">
                <strong>{money(dish.priceMinor)}</strong>
                <span className="status-tag">
                  {dish.isAvailable ? "Available" : "Currently unavailable"}
                </span>
              </div>
              <section>
                <h2>How it’s prepared</h2>
                <p>
                  {dish.preparationSummary ||
                    "Our kitchen is preparing the story behind this dish. Ask our team for more details."}
                </p>
              </section>
              {dish.estimatedMinutes !== null && (
                <p className="dish-time">
                  <strong>About {dish.estimatedMinutes} minutes</strong>
                  <small>
                    Estimated preparation and cooking time, not a serving-time
                    guarantee.
                  </small>
                </p>
              )}
              <section>
                <h2>Ingredients</h2>
                {dish.ingredients.length ? (
                  <ul className="dish-ingredient-tags">
                    {dish.ingredients.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    Ingredient details are being prepared. Please ask our team.
                  </p>
                )}
              </section>
              <Link className="button secondary" to="/menu">
                Explore the menu ↗
              </Link>
            </div>
          </article>
          {dish.relatedDishes.length > 0 && (
            <section className="dish-related">
              <p className="eyebrow">Another little discovery</p>
              <h2>You may also enjoy</h2>
              <div className="dish-related-grid">
                {dish.relatedDishes.map((other) => (
                  <Link
                    className="dish-related-card"
                    key={other.id}
                    to={"/menu/" + other.slug}
                  >
                    <Food dish={other} />
                    <span>
                      <small>{other.category.name}</small>
                      <h3>{other.name}</h3>
                      <strong>{money(other.priceMinor)}</strong>
                      {!other.isAvailable && (
                        <small>Currently unavailable</small>
                      )}
                      <small>Discover this dish ↗</small>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </ResourceState>
  );
}
