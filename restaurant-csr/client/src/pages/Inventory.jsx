import React, { useState, useRef } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ingredientsApi, recipesApi, stockApi } from "../api/resources.js";
import { useResource, useMutation } from "../hooks/useResource.js";
import { useApp } from "../components/AppContext.jsx";
import {
  ErrorNotice,
  Field,
  Heading,
  ResourceState,
} from "../components/common.jsx";
function useRequestKey(payload) {
  const ref = useRef({ signature: "", key: "" });
  const signature = JSON.stringify(payload);
  if (ref.current.signature !== signature) {
    ref.current = { signature, key: crypto.randomUUID() };
  }
  return ref.current.key;
}
export function StockForm() {
  const { user } = useApp(),
    [params] = useSearchParams(),
    resource = useResource(ingredientsApi.list, "stock-ingredients");
  return (
    <>
      <Heading
        title="Record stock change."
        kicker="食材 · Every ingredient counts"
        back="/kitchen"
      />
      <ResourceState resource={resource}>
        {(ingredients) => (
          <StockFields
            ingredients={ingredients.filter((i) => i.isActive)}
            initial={params.get("ingredientId") || ""}
            admin={user.role === "admin"}
          />
        )}
      </ResourceState>
    </>
  );
}
function StockFields({ ingredients, initial, admin }) {
  const [values, setValues] = useState({
      type: "usage",
      ingredientId: initial || ingredients[0]?.id || "",
      quantity: "",
      reason: "",
    }),
    mutation = useMutation(),
    navigate = useNavigate(),
    requestKey = useRequestKey(values),
    selected = ingredients.find((i) => i.id === values.ingredientId);
  return (
    <section className="stock-panel">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const body = {
            type: values.type,
            reason: values.reason,
            requestKey,
            lines: [
              { ingredientId: values.ingredientId, quantity: values.quantity },
            ],
          };
          if (await mutation.run(() => stockApi.record(body)))
            navigate("/kitchen/stock-history");
        }}
      >
        <ErrorNotice error={mutation.error} />
        <Field
          name="type"
          label="Operation"
          type="select"
          value={values.type}
          options={[
            ["usage", "Usage"],
            ["waste", "Waste"],
            ...(admin
              ? [
                  ["receipt", "Receipt (restock)"],
                  ["correction", "Correction"],
                ]
              : []),
          ]}
          onChange={(value) => setValues((v) => ({ ...v, type: value }))}
        />
        <p>
          {
            {
              usage: "Ingredients consumed during preparation.",
              waste: "Spoilage, spills or discarded ingredients.",
              receipt: "Add newly received ingredients.",
              correction:
                "Enter a signed difference (+/-), not a target balance.",
            }[values.type]
          }
        </p>
        <Field
          name="ingredientId"
          label="Ingredient"
          type="select"
          value={values.ingredientId}
          options={ingredients.map((i) => [
            i.id,
            i.name + " — " + i.quantityOnHand + " " + i.baseUnit,
          ])}
          onChange={(value) =>
            setValues((v) => ({ ...v, ingredientId: value }))
          }
          required
        />
        <Field
          name="quantity"
          label={"Quantity · " + (selected?.baseUnit || "base unit")}
          type={values.type === "correction" ? "text" : "number"}
          min="0.001"
          step="0.001"
          value={values.quantity}
          onChange={(value) => setValues((v) => ({ ...v, quantity: value }))}
          required
        />
        <Field
          name="reason"
          label="Reason"
          value={values.reason}
          onChange={(value) => setValues((v) => ({ ...v, reason: value }))}
          required
        />
        <button disabled={mutation.saving || !ingredients.length}>
          Record {values.type} ↗
        </button>
      </form>
    </section>
  );
}
export function Journal() {
  const resource = useResource(stockApi.list, "stock-history");
  return (
    <>
      <Heading
        title="Every change, remembered."
        kicker="記録 · The pantry journal"
        back="/kitchen"
      >
        <Link className="button" to="/kitchen/stock/new">
          ＋ Record stock change
        </Link>
      </Heading>
      <ResourceState resource={resource}>
        {(rows) => (
          <>
            <p>The latest 100 operations. History stays intact.</p>
            {rows.map((op) => (
              <article className="journal-entry" key={op.id}>
                <div className="journal-top">
                  <h2>{op.type}</h2>
                  <time>{new Date(op.createdAt).toLocaleString()}</time>
                </div>
                <p>
                  {op.reason} · {op.actor.displayName}
                  {op.servings ? " · " + op.servings + " servings" : ""}
                </p>
                <Movements rows={op.movements} />
              </article>
            ))}
            {!rows.length && (
              <p className="empty-state">
                A clean page. Stock changes will appear here.
              </p>
            )}
          </>
        )}
      </ResourceState>
    </>
  );
}
function Movements({ rows }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Ingredient</th>
            <th>Change</th>
            <th>Before</th>
            <th>After</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td>{m.ingredient?.name}</td>
              <td>
                {m.quantityDelta} {m.ingredient?.baseUnit}
              </td>
              <td>{m.quantityBefore}</td>
              <td>{m.quantityAfter}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Ledger() {
  const { id } = useParams(),
    resource = useResource((signal) => stockApi.ledger(id, signal), id);
  return (
    <ResourceState resource={resource}>
      {({ ingredient, movements }) => (
        <>
          <Heading title={ingredient.name} back="/kitchen/ingredients">
            <Link
              className="button"
              to={"/kitchen/stock/new?ingredientId=" + id}
            >
              Record stock change ↗
            </Link>
          </Heading>
          <section className="ingredient-ledger">
            <div>
              <h2>
                {ingredient.quantityOnHand} {ingredient.baseUnit}
              </h2>
              <p>
                On hand · Reorder at {ingredient.lowStockThreshold}{" "}
                {ingredient.baseUnit}
              </p>
              <p>{ingredient.description}</p>
            </div>
            <div>
              {movements.map((m) => (
                <article className="ledger-entry" key={m.id}>
                  <strong>
                    {m.operation.type} · {m.quantityDelta} {ingredient.baseUnit}
                  </strong>
                  <p>{m.operation.reason}</p>
                  <small>
                    {m.operation.actor.displayName} ·{" "}
                    {new Date(m.createdAt).toLocaleString()} ·{" "}
                    {m.quantityBefore} → {m.quantityAfter}
                  </small>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </ResourceState>
  );
}
export function Recipe() {
  const { id } = useParams(),
    resource = useResource((signal) => recipesApi.get(id, signal), id);
  return (
    <ResourceState resource={resource}>
      {(data) => (
        <RecipeFields
          key={data.recipe?.version || 0}
          data={data}
          reload={resource.reload}
        />
      )}
    </ResourceState>
  );
}
function RecipeFields({ data, reload }) {
  const { dish, recipe } = data,
    ingredients = [
      ...new Map(
        [
          ...data.ingredients,
          ...(recipe?.items || []).map((i) => i.ingredient),
        ].map((i) => [i.id, i]),
      ).values(),
    ];
  const [values, setValues] = useState({
      version: recipe?.version || 0,
      instructions: recipe?.instructions || "",
      preparationMinutes: recipe?.preparationMinutes ?? "",
      cookingMinutes: recipe?.cookingMinutes ?? "",
      items: ingredients.map((i) => ({
        ingredientId: i.id,
        quantity:
          recipe?.items.find((item) => item.ingredientId === i.id)?.quantity ||
          "",
        notes:
          recipe?.items.find((item) => item.ingredientId === i.id)?.notes || "",
      })),
    }),
    mutation = useMutation();
  return (
    <>
      <Heading
        title={dish.name + " · Recipe"}
        kicker="レシピ · Per serving"
        back="/kitchen"
      />
      <div className="recipe-layout">
        <section className="recipe-panel paper-route">
          <p className="eyebrow">三太子亭 / Recipe sheet</p>
          <ErrorNotice error={mutation.error} />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const body = {
                ...values,
                items: values.items.filter(
                  (i) => i.quantity !== "" && Number(i.quantity) !== 0,
                ),
              };
              if (await mutation.run(() => recipesApi.save(dish.id, body)))
                reload();
            }}
          >
            <Field
              name="instructions"
              label="Preparation notes"
              type="textarea"
              value={values.instructions}
              onChange={(value) =>
                setValues((v) => ({ ...v, instructions: value }))
              }
            />
            <div className="minute-fields">
              {[
                ["preparationMinutes", "Preparation · minutes"],
                ["cookingMinutes", "Cooking · minutes"],
              ].map(([key, label]) => (
                <Field
                  key={key}
                  name={key}
                  label={label}
                  type="number"
                  min="0"
                  step="1"
                  value={values[key]}
                  onChange={(value) =>
                    setValues((v) => ({ ...v, [key]: value }))
                  }
                />
              ))}
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Per serving</th>
                    <th>Note</th>
                    <th>Include</th>
                  </tr>
                </thead>
                <tbody>
                  {values.items.map((item, index) => {
                    const ingredient = ingredients.find(
                        (i) => i.id === item.ingredientId,
                      ),
                      setItem = (patch) =>
                        setValues((v) => ({
                          ...v,
                          items: v.items.map((row, i) =>
                            i === index ? { ...row, ...patch } : row,
                          ),
                        }));
                    return (
                      <tr key={item.ingredientId}>
                        <td>
                          {ingredient.name}
                          <small>
                            {ingredient.baseUnit} · {ingredient.quantityOnHand}{" "}
                            on shelf{!ingredient.isActive ? " · inactive" : ""}
                          </small>
                        </td>
                        <td>
                          <input
                            aria-label={"Quantity for " + ingredient.name}
                            type="number"
                            min="0"
                            step="0.001"
                            value={item.quantity}
                            onChange={(e) =>
                              setItem({ quantity: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={"Notes for " + ingredient.name}
                            value={item.notes}
                            onChange={(e) => setItem({ notes: e.target.value })}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() =>
                              setItem({
                                quantity: Number(item.quantity) > 0 ? "0" : "1",
                              })
                            }
                          >
                            {Number(item.quantity) > 0 ? "Remove" : "Add"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p>
              Blank or zero excludes an ingredient. Saving a recipe does not
              deduct stock.
            </p>
            <button disabled={mutation.saving}>Save recipe ↗</button>
          </form>
        </section>
        <RecipeUsage recipe={recipe} />
      </div>
    </>
  );
}
function RecipeUsage({ recipe }) {
  const [servings, setServings] = useState("1"),
    [reason, setReason] = useState(""),
    mutation = useMutation(),
    navigate = useNavigate(),
    body = {
      type: "usage",
      recipeId: recipe?.id,
      recipeVersion: recipe?.version,
      servings: Number(servings),
      reason,
    },
    requestKey = useRequestKey(body);
  return (
    <aside className="usage-panel">
      <h2>Record kitchen usage.</h2>
      <p>Uses the saved recipe. Save edits before recording preparation.</p>
      {recipe?.items.length ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await mutation.run(() => stockApi.record({ ...body, requestKey }))
            )
              navigate("/kitchen/stock-history");
          }}
        >
          <ErrorNotice error={mutation.error} />
          <Field
            name="servings"
            label="Servings"
            type="number"
            min="1"
            step="1"
            value={servings}
            onChange={setServings}
            required
          />
          <ul className="usage-preview">
            {recipe.items.map((i) => (
              <li key={i.ingredientId}>
                {i.ingredient.name}
                <strong>
                  {(Number(i.quantity) * Number(servings)).toFixed(3)}{" "}
                  {i.ingredient.baseUnit}
                </strong>
              </li>
            ))}
          </ul>
          <Field
            name="reason"
            label="Reason"
            value={reason}
            onChange={setReason}
            required
          />
          <button disabled={mutation.saving}>Record usage ↗</button>
        </form>
      ) : (
        <p>Add and save ingredients before recording usage.</p>
      )}
    </aside>
  );
}
