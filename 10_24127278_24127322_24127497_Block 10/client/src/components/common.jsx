import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
export const money = (value) =>
  new Intl.NumberFormat("vi-VN").format(BigInt(value || "0")) + " ₫";
export function Food({ dish }) {
  if (dish.imagePath === "/images/japan/food-atlas.png") {
    const slug = dish.slug || "",
      index = /nigiri|sushi/i.test(slug)
        ? 0
        : /tempura/i.test(slug)
          ? 1
          : /ramen|miso/i.test(slug)
            ? 2
            : /teriyaki|grilled-salmon/i.test(slug)
              ? 4
              : /mochi|matcha/i.test(slug)
                ? 5
                : 3;
    return (
      <span
        className={"food-image food-atlas food-" + index}
        role="img"
        aria-label={dish.imageAlt || dish.name}
      />
    );
  }
  return dish.imagePath ? (
    <img
      className="food-image"
      src={dish.imagePath}
      alt={dish.imageAlt || dish.name}
    />
  ) : (
    <span className="food-image food-placeholder">
      <span lang="ja">食</span>
      <small>Photograph coming soon</small>
    </span>
  );
}
export function ErrorNotice({ error }) {
  return error ? (
    <div className="error" role="alert">
      <strong>
        {error.code === "RECIPE_VERSION_CONFLICT"
          ? "Recipe changed. "
          : error.code === "INSUFFICIENT_STOCK"
            ? "Not enough stock. "
            : ""}
      </strong>
      {error.message}
      {error.fields &&
        Object.entries(error.fields).map(([key, value]) => (
          <p key={key}>
            {key}: {value}
          </p>
        ))}
    </div>
  ) : null;
}
export function ResourceState({
  resource,
  children,
  keepPreviousData = false,
}) {
  if (resource.loading && !(keepPreviousData && resource.data))
    return (
      <p className="empty-state" role="status">
        Preparing your room…
      </p>
    );
  if (resource.error && !(keepPreviousData && resource.data))
    return (
      <section className="empty-state">
        <ErrorNotice error={resource.error} />
        <button onClick={resource.reload}>Try again</button>
      </section>
    );
  return children(resource.data);
}
export function Heading({
  title,
  kicker = "三太子亭 · Santaishi-tei",
  back = "/directory",
  children,
}) {
  return (
    <div className="room-heading compact-heading">
      <div>
        <Link className="breadcrumb" to={back}>
          ← Back
        </Link>
        <p className="eyebrow">{kicker}</p>
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
export function Modal({
  children,
  onClose,
  label = "Details",
  className = "dish-dialog",
  style,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={className}
      style={style}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <button
        className="dialog-close"
        aria-label="Close dialog"
        onClick={onClose}
      >
        ×
      </button>
      {children}
    </dialog>
  );
}
export function Field({
  name,
  label,
  type = "text",
  value,
  onChange,
  options,
  required = false,
  min,
  step,
}) {
  return (
    <label className={type === "checkbox" ? "check-label" : ""}>
      {type === "checkbox" ? (
        <>
          <input
            name={name}
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          {label}
        </>
      ) : (
        <>
          {label}
          {type === "textarea" ? (
            <textarea
              name={name}
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value)}
              rows={4}
            />
          ) : type === "select" ? (
            <select
              aria-label={label}
              name={name}
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value)}
              required={required}
            >
              <option value="">Choose…</option>
              {options?.map(([key, text]) => (
                <option key={key} value={key}>
                  {text}
                </option>
              ))}
            </select>
          ) : (
            <input
              name={name}
              type={type}
              value={value ?? ""}
              required={required}
              min={min}
              step={step}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        </>
      )}
    </label>
  );
}
