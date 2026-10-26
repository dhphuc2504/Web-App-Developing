import { useDishBrowser } from "../hooks/useDishBrowser.js";
import {
  DishFilters,
  DishPagination,
} from "../components/DishBrowserControls.jsx";
import React, { useEffect, useRef, useState } from "react";
import { activity } from "../api/client.js";
import { DishEditor } from "../components/DishEditor.jsx";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  categoriesApi,
  chefsApi,
  dishesApi,
  ingredientsApi,
  sessionApi,
} from "../api/resources.js";
import { useResource, useMutation } from "../hooks/useResource.js";
import { useApp } from "../components/AppContext.jsx";
import {
  ErrorNotice,
  Field,
  Food,
  Heading,
  Modal,
  ResourceState,
  money,
} from "../components/common.jsx";
export function Guard({ admin = false, children }) {
  const { user, ready } = useApp(),
    location = useLocation();
  if (!ready) return <p role="status">Checking your session…</p>;
  if (!user)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (admin && user.role !== "admin")
    return (
      <section className="empty-state">
        <h1>Administrator access required</h1>
        <Link to="/kitchen">Return to the kitchen</Link>
      </section>
    );
  return children;
}
export function Login() {
  const { user, setUser } = useApp(),
    navigate = useNavigate(),
    location = useLocation(),
    mutation = useMutation(),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  if (user) {
    const from = location.state?.from;
    return (
      <Navigate
        to={
          typeof from === "string" &&
          from.startsWith("/") &&
          !from.startsWith("//")
            ? from
            : user.role === "admin"
              ? "/admin"
              : "/kitchen"
        }
        replace
      />
    );
  }
  return (
    <section className="login-layout">
      <div>
        <p className="eyebrow">厨房 · Staff entrance</p>
        <h1>
          Welcome <em>back.</em>
        </h1>
        <p>Your place in the kitchen.</p>
      </div>
      <form
        className="form-panel login-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await mutation.run(() =>
            sessionApi.login({ email, password }),
          );
          if (result) {
            setPassword("");
            setUser(result.user);
            const from = location.state?.from;
            navigate(
              typeof from === "string" &&
                from.startsWith("/") &&
                !from.startsWith("//")
                ? from
                : result.user.role === "admin"
                  ? "/admin"
                  : "/kitchen",
              { replace: true },
            );
          }
        }}
      >
        <ErrorNotice error={mutation.error} />
        <Field
          name="email"
          label="Email address"
          type="email"
          value={email}
          onChange={setEmail}
          required
        />
        <Field
          name="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          required
        />
        <button disabled={mutation.saving}>Enter the house ↗</button>
      </form>
    </section>
  );
}
export function Kitchen() {
  const resource = useDishBrowser(dishesApi.page),
    [editing, setEditing] = useState(null),
    { confirm } = useApp(),
    mutation = useMutation();
  return (
    <>
      <Heading
        title="A little craft. A lot of care."
        kicker="厨房 · Behind the scenes"
      />
      <nav className="kitchen-subnav">
        <span>Dish board</span>
        <Link to="/kitchen/ingredients">Pantry</Link>
        <Link to="/kitchen/stock/new">Record stock</Link>
        <Link to="/kitchen/stock-history">Journal</Link>
      </nav>
      <ErrorNotice error={mutation.error} />
      {resource.data && resource.error && (
        <div className="error board-refresh-warning" role="alert">
          <p>
            The board couldn’t refresh. Displayed information may be out of
            date.
          </p>
          <button
            className="secondary"
            disabled={resource.loading}
            onClick={resource.reload}
          >
            {resource.loading ? "Refreshing…" : "Retry refresh"}
          </button>
        </div>
      )}
      <ResourceState resource={resource} keepPreviousData>
        {(data) => (
          <section data-board-workspace>
            <div className="board-toolbar">
              <DishFilters browser={resource} staff />
              <Link className="button" to="/kitchen/dishes/new">
                ＋ Add a dish
              </Link>
            </div>
            {[
              [
                "On the menu",
                (d) => !d.archivedAt && d.isPublished && d.isAvailable,
              ],
              ["In preparation", (d) => !d.archivedAt && !d.isPublished],
              [
                "Off the menu",
                (d) => !d.archivedAt && d.isPublished && !d.isAvailable,
              ],
              ["Archived", (d) => !!d.archivedAt],
            ].map(([title, filter]) => (
              <section className="board-column" key={title}>
                <h2 className="board-column-heading">{title}</h2>
                <div className="ticket-stack">
                  {data.items.filter(filter).map((d) => (
                    <article
                      className={
                        "dish-ticket" +
                        (editing?.id === d.id ? " ticket-lifted" : "")
                      }
                      key={d.id}
                      id={"dish-" + d.id}
                    >
                      <p className="eyebrow">三太子亭 / {d.category.name}</p>
                      <h3>{d.name}</h3>
                      <div className="ticket-food">
                        <Food dish={d} />
                      </div>
                      <p>{d.description}</p>
                      <strong>{money(d.priceMinor)}</strong>
                      <div className="ticket-actions" hidden={!!d.archivedAt}>
                        <Link to={"/kitchen/dishes/" + d.id + "/recipe"}>
                          Recipe & ingredients ↗
                        </Link>
                        <button
                          className="text-button"
                          onClick={(event) => {
                            const rect = event.currentTarget
                              .closest(".dish-ticket")
                              .getBoundingClientRect();
                            setEditing({
                              id: d.id,
                              x:
                                rect.left +
                                rect.width / 2 -
                                window.innerWidth / 2,
                              y:
                                rect.top +
                                rect.height / 2 -
                                window.innerHeight / 2,
                            });
                          }}
                        >
                          Edit dish
                        </button>
                        <button
                          className="danger-link"
                          onClick={async () => {
                            if (
                              await confirm(
                                "Archive " +
                                  d.name +
                                  "? Its recipe and history will remain.",
                              )
                            ) {
                              if (
                                await mutation.run(() =>
                                  dishesApi.archive(d.id),
                                )
                              )
                                resource.reload();
                            }
                          }}
                        >
                          Archive
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
            <DishPagination browser={resource} staff />
          </section>
        )}
      </ResourceState>
      {editing && (
        <DishPopup
          ticket={editing}
          onClose={(saved) => {
            setEditing(null);
            if (saved) resource.reload();
          }}
        />
      )}
    </>
  );
}
function DishPopup({ ticket, onClose }) {
  const [closing, setClosing] = useState(false),
    timer = useRef(null),
    returning = useRef(false);
  const resource = useResource(async (signal) => {
    const [record, categories] = await Promise.all([
      dishesApi.get(ticket.id, signal),
      categoriesApi.list(signal),
    ]);
    return { record, categories };
  }, ticket.id);
  useEffect(() => () => clearTimeout(timer.current), []);
  function close(saved = false) {
    if (returning.current || activity.getSnapshot() > 0) return;
    returning.current = true;
    setClosing(true);
    timer.current = setTimeout(
      () => onClose(saved),
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450,
    );
  }
  return (
    <Modal
      label="Edit dish recipe sheet"
      className={"recipe-sheet-dialog" + (closing ? " sheet-returning" : "")}
      style={{ "--ticket-x": `${ticket.x}px`, "--ticket-y": `${ticket.y}px` }}
      onClose={() => close()}
    >
      <div inert={closing}>
        <p className="eyebrow">三太子亭 · Kitchen recipe sheet</p>
        <ResourceState resource={resource}>
          {(data) => (
            <Editor
              kind="dish"
              id={ticket.id}
              {...data}
              onDone={() => close(true)}
              onCancel={() => close()}
            />
          )}
        </ResourceState>
      </div>
    </Modal>
  );
}
const apis = {
  dish: dishesApi,
  ingredient: ingredientsApi,
  category: categoriesApi,
};
const paths = {
  dish: "/kitchen",
  ingredient: "/kitchen/ingredients",
  category: "/admin/categories",
};
const defaults = {
  dish: {
    name: "",
    slug: "",
    categoryId: "",
    description: "",
    priceMinor: "0",
    preparationSummary: "",
    imagePath: "",
    imageAlt: "",
    displayOrder: 0,
    isFeatured: false,
    isPublished: false,
    isAvailable: true,
  },
  ingredient: {
    name: "",
    description: "",
    baseUnit: "g",
    lowStockThreshold: "0",
    isActive: true,
  },
  category: {
    name: "",
    slug: "",
    description: "",
    displayOrder: 0,
    isActive: true,
  },
};
const specs = {
  dish: [
    ["name", "Name"],
    ["slug", "Slug"],
    ["categoryId", "Category", "select"],
    ["description", "Description", "textarea"],
    [
      "preparationSummary",
      "Public preparation summary (visible to customers)",
      "textarea",
    ],
    ["priceMinor", "Price (VND)", "number"],
    ["imagePath", "Local image path (/images/...)"],
    ["imageAlt", "Image description"],
    ["displayOrder", "Display order", "number"],
    ["isFeatured", "Featured", "checkbox"],
    ["isPublished", "Published", "checkbox"],
    ["isAvailable", "Available", "checkbox"],
  ],
  ingredient: [
    ["name", "Name"],
    ["description", "Description", "textarea"],
    ["baseUnit", "Base unit", "select"],
    ["lowStockThreshold", "Low-stock threshold", "number"],
    ["isActive", "Active", "checkbox"],
  ],
  category: [
    ["name", "Name"],
    ["slug", "Slug"],
    ["description", "Description", "textarea"],
    ["displayOrder", "Display order", "number"],
    ["isActive", "Active", "checkbox"],
  ],
};
export function CatalogEditor({ kind }) {
  const { id } = useParams();
  const resource = useResource(
    async (signal) => {
      const [record, categories] = await Promise.all([
        id ? apis[kind].get(id, signal) : Promise.resolve(defaults[kind]),
        kind === "dish" ? categoriesApi.list(signal) : Promise.resolve([]),
      ]);
      return { record, categories };
    },
    kind + ":" + (id || "new"),
  );
  return (
    <>
      <Heading title={(id ? "Edit " : "New ") + kind} back={paths[kind]} />
      <ResourceState resource={resource}>
        {(data) => (
          <Editor key={kind + (id || "new")} kind={kind} id={id} {...data} />
        )}
      </ResourceState>
    </>
  );
}
function Editor({ kind, id, record, categories, onDone, onCancel }) {
  if (kind === "dish")
    return (
      <DishEditor
        id={id}
        record={record}
        categories={categories}
        onDone={onDone}
        onCancel={onCancel}
      />
    );
  return (
    <BasicEditor
      kind={kind}
      id={id}
      record={record}
      categories={categories}
      onDone={onDone}
      onCancel={onCancel}
    />
  );
}
function BasicEditor({ kind, id, record, categories, onDone, onCancel }) {
  const [values, setValues] = useState(
      Object.fromEntries(
        Object.keys(defaults[kind]).map((key) => [
          key,
          record[key] ?? defaults[kind][key],
        ]),
      ),
    ),
    mutation = useMutation(),
    navigate = useNavigate();
  const options =
    kind === "dish"
      ? categories.filter((c) => c.isActive).map((c) => [c.id, c.name])
      : [
          ["g", "Grams"],
          ["ml", "Millilitres"],
          ["piece", "Pieces"],
        ];
  return (
    <section className="form-panel editor-panel paper-route">
      <div className="form-intro">
        <span className="large-kanji">丁寧</span>
        <h2>Every detail matters.</h2>
        <p>
          {kind === "dish"
            ? "A new dish starts as a draft. Publish it when ready."
            : "Keep the pantry and menu accurate."}
        </p>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const body = id
            ? Object.fromEntries(
                Object.entries(values).filter(
                  ([key, value]) =>
                    String(value) !==
                    String(record[key] ?? defaults[kind][key]),
                ),
              )
            : values;
          if (id && !Object.keys(body).length) {
            if (onCancel) onCancel();
            else navigate(paths[kind]);
            return;
          }
          const result = await mutation.run(() =>
            id ? apis[kind].update(id, body) : apis[kind].create(body),
          );
          if (result) {
            if (onDone) onDone(result);
            else navigate(paths[kind]);
          }
        }}
      >
        <ErrorNotice error={mutation.error} />
        {specs[kind].map(([name, label, type = "text"]) => (
          <Field
            key={name}
            name={name}
            label={label}
            type={type}
            value={values[name]}
            onChange={(value) => setValues((v) => ({ ...v, [name]: value }))}
            options={options}
            min={type === "number" ? 0 : undefined}
            step={name === "lowStockThreshold" ? "0.001" : "1"}
            required={["name", "slug", "categoryId"].includes(name)}
          />
        ))}
        <div className="button-row">
          <button disabled={mutation.saving}>Save changes ↗</button>
          {onCancel ? (
            <button
              type="button"
              className="secondary"
              disabled={mutation.saving}
              onClick={onCancel}
            >
              Cancel
            </button>
          ) : (
            <Link to={paths[kind]}>Cancel</Link>
          )}
        </div>
      </form>
    </section>
  );
}
export function Pantry() {
  const resource = useResource(ingredientsApi.list, "ingredients"),
    [search, setSearch] = useState(""),
    [low, setLow] = useState(false),
    [list, setList] = useState(false),
    { user, confirm } = useApp(),
    mutation = useMutation();
  return (
    <>
      <Heading title="Ingredients" kicker="食材 · The pantry" back="/kitchen">
        {user.role === "admin" && (
          <Link className="button" to="/kitchen/ingredients/new">
            ＋ Add ingredient
          </Link>
        )}
      </Heading>
      <ErrorNotice error={mutation.error} />
      <ResourceState resource={resource}>
        {(rows) => (
          <section
            className={"pantry-workspace " + (list ? "pantry-list" : "")}
          >
            <div className="pantry-toolbar">
              <label>
                Find an ingredient
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={low}
                  onChange={(e) => setLow(e.target.checked)}
                />
                Low stock only
              </label>
              <button onClick={() => setList((v) => !v)}>
                {list ? "Shelf view" : "List view"}
              </button>
              <Link className="button" to="/kitchen/stock/new">
                Record stock change ↗
              </Link>
            </div>
            <div className="pantry-shelf">
              {rows
                .filter(
                  (i) =>
                    i.name.toLowerCase().includes(search.toLowerCase()) &&
                    (!low ||
                      Number(i.quantityOnHand) <= Number(i.lowStockThreshold)),
                )
                .map((i) => (
                  <article className="pantry-jar" key={i.id}>
                    <Link
                      className="jar-label"
                      to={"/kitchen/ingredients/" + i.id}
                    >
                      <span className="jar-cap" />
                      <span className="jar-body">
                        <span className="jar-paper">
                          <span className="eyebrow">
                            SANTAISHI-TEI / PANTRY
                          </span>
                          <h2>{i.name}</h2>
                          <strong>
                            {i.quantityOnHand} <small>{i.baseUnit}</small>
                          </strong>
                          <span className="status-tag">
                            {!i.isActive
                              ? "Inactive"
                              : Number(i.quantityOnHand) <=
                                  Number(i.lowStockThreshold)
                                ? "Low stock"
                                : "In stock"}
                          </span>
                        </span>
                      </span>
                    </Link>
                    <div className="jar-actions">
                      <span>
                        Reorder at {i.lowStockThreshold} {i.baseUnit}
                      </span>
                      {user.role === "admin" && (
                        <>
                          <Link to={"/kitchen/ingredients/" + i.id + "/edit"}>
                            Edit label
                          </Link>
                          <button
                            className="danger-link"
                            onClick={async () => {
                              if (
                                await confirm(
                                  "Archive " +
                                    i.name +
                                    "? Its history will remain.",
                                )
                              )
                                if (
                                  await mutation.run(() =>
                                    ingredientsApi.archive(i.id),
                                  )
                                )
                                  resource.reload();
                            }}
                          >
                            Archive
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
            </div>
            {!rows.length && (
              <p className="empty-state">The pantry is empty.</p>
            )}
          </section>
        )}
      </ResourceState>
    </>
  );
}
export function Categories() {
  const resource = useResource(categoriesApi.list, "categories"),
    { confirm } = useApp(),
    mutation = useMutation();
  return (
    <>
      <Heading title="Menu categories" back="/admin">
        <Link className="button" to="/admin/categories/new">
          ＋ Add category
        </Link>
      </Heading>
      <ErrorNotice error={mutation.error} />
      <ResourceState resource={resource}>
        {(rows) => (
          <div className="data-panel">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.isActive ? "Active" : "Inactive"}</td>
                    <td>
                      <Link to={"/admin/categories/" + c.id + "/edit"}>
                        Edit
                      </Link>{" "}
                      <button
                        className="danger-link"
                        onClick={async () => {
                          if (
                            await confirm(
                              "Archive " +
                                c.name +
                                "? Its dishes will leave the public menu.",
                            )
                          )
                            if (
                              await mutation.run(() =>
                                categoriesApi.archive(c.id),
                              )
                            )
                              resource.reload();
                        }}
                      >
                        Archive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ResourceState>
    </>
  );
}
export function Office() {
  const { user } = useApp();
  return (
    <>
      <Heading
        title="A good house starts with its people."
        kicker="管理 · The office"
      />
      <p>Welcome, {user.displayName}.</p>
      <nav className="office-links" aria-label="Office shortcuts">
        {[
          ["/admin/staff", "Chef accounts"],
          ["/admin/categories", "Menu categories"],
          ["/kitchen/ingredients", "Ingredient pantry"],
          ["/kitchen", "Kitchen board"],
        ].map(([to, label], index) => (
          <Link to={to} key={to}>
            <span aria-hidden="true">0{index + 1}</span>
            <strong>{label}</strong>
            <small>Open ↗</small>
          </Link>
        ))}
      </nav>
      <Chefs embedded />
    </>
  );
}
export function Chefs({ embedded = false }) {
  const resource = useResource(chefsApi.list, "chefs"),
    [adding, setAdding] = useState(false),
    mutation = useMutation(),
    { confirm } = useApp(),
    [values, setValues] = useState({
      displayName: "",
      email: "",
      password: "",
    });
  return (
    <>
      {embedded ? (
        <div className="section-heading">
          <h2>The people behind the plates.</h2>
          <button className="secondary" onClick={resource.reload}>
            Refresh chefs
          </button>
        </div>
      ) : (
        <Heading title="The people behind the plates." back="/admin" />
      )}
      <ErrorNotice error={mutation.error} />
      <ResourceState resource={resource}>
        {(rows) => (
          <div className="staff-grid">
            {!rows.length && (
              <p className="empty-state">
                No chef accounts yet. Add a chef below to get started.
              </p>
            )}
            {rows.map((user) => (
              <ChefCard
                key={user.id}
                user={user}
                reload={resource.reload}
                confirm={confirm}
              />
            ))}
          </div>
        )}
      </ResourceState>
      {!adding && (
        <button
          onClick={() => {
            mutation.clearError();
            setAdding(true);
          }}
        >
          ＋ Add chef
        </button>
      )}
      {adding && (
        <section className="form-panel new-chef-panel">
          <div className="form-intro">
            <p className="eyebrow">厨房 · Our team</p>
            <h2>Add a chef</h2>
            <p>Create kitchen access for a new member of the team.</p>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await mutation.run(() => chefsApi.create(values))) {
                setValues({ displayName: "", email: "", password: "" });
                setAdding(false);
                resource.reload();
              }
            }}
          >
            {[
              ["displayName", "Display name", "text"],
              ["email", "Email address", "email"],
              ["password", "Password (12+ characters)", "password"],
            ].map(([name, label, type]) => (
              <Field
                key={name}
                name={name}
                label={label}
                type={type}
                value={values[name]}
                required
                onChange={(value) =>
                  setValues((v) => ({ ...v, [name]: value }))
                }
              />
            ))}
            <button disabled={mutation.saving}>Add chef</button>
            <button
              type="button"
              className="secondary"
              disabled={mutation.saving}
              onClick={() => {
                setAdding(false);
                setValues({ displayName: "", email: "", password: "" });
                mutation.clearError();
              }}
            >
              Cancel
            </button>
          </form>
        </section>
      )}
    </>
  );
}
function ChefCard({ user, reload, confirm }) {
  const [name, setName] = useState(user.displayName),
    [editing, setEditing] = useState(false),
    [active, setActive] = useState(user.isActive),
    mutation = useMutation();
  return (
    <article className="staff-card">
      <button
        className="chef-card-summary"
        aria-expanded={editing}
        aria-label={"Edit chef " + user.displayName}
        onClick={() => {
          setName(user.displayName);
          setActive(user.isActive);
          mutation.clearError();
          setEditing((value) => !value);
        }}
      >
        <h3>{user.displayName}</h3>
        <p className="staff-email">{user.email}</p>
        <span className="status-tag">
          {user.isActive ? "Active" : "Access removed"}
        </span>
        <small>{editing ? "Close profile ↑" : "View and edit profile ↗"}</small>
      </button>
      {editing && (
        <div className="chef-card-editor">
          <ErrorNotice error={mutation.error} />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutation.run(() =>
                  chefsApi.update(user.id, {
                    displayName: name,
                    isActive: active,
                  }),
                )
              ) {
                setEditing(false);
                reload();
              }
            }}
          >
            <Field
              label="Display name"
              name="displayName"
              value={name}
              onChange={setName}
            />
            <Field
              label="Active access"
              name="isActive"
              type="checkbox"
              value={active}
              onChange={setActive}
            />
            <button>Save profile</button>
          </form>
          {user.isActive && (
            <button
              className="danger-link"
              onClick={async () => {
                if (
                  await confirm(
                    "Remove kitchen access for " + user.displayName + "?",
                  )
                )
                  if (await mutation.run(() => chefsApi.archive(user.id))) {
                    setEditing(false);
                    reload();
                  }
              }}
            >
              Remove chef access
            </button>
          )}
        </div>
      )}
    </article>
  );
}
