import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dishesApi, photosApi } from "../api/resources.js";
import { useMutation } from "../hooks/useResource.js";
import { ErrorNotice, Field, Food } from "./common.jsx";
const editable = [
  "name",
  "categoryId",
  "description",
  "priceMinor",
  "preparationSummary",
  "imagePath",
  "imageAlt",
  "isFeatured",
  "isAvailable",
];
export function DishEditor({ id, record, categories, onDone, onCancel }) {
  const [values, setValues] = useState(() => ({
    name: record.name || "",
    categoryId: record.categoryId || "",
    description: record.description || "",
    priceMinor: String(record.priceMinor ?? ""),
    preparationSummary: record.preparationSummary || "",
    imagePath: record.imagePath || "",
    imageAlt: record.imageAlt || "",
    isFeatured: record.isFeatured || false,
    isAvailable: record.isAvailable ?? true,
  }));
  const [photo, setPhoto] = useState(null),
    [preview, setPreview] = useState(null),
    [photoError, setPhotoError] = useState(null),
    [stage, setStage] = useState("");
  const input = useRef(null),
    uploaded = useRef(null),
    mutation = useMutation(),
    navigate = useNavigate();
  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const set = (key) => (value) => setValues((v) => ({ ...v, [key]: value }));
  function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setPhotoError("Choose a JPEG, PNG or WebP photo smaller than 5 MB.");
      return;
    }
    setPhotoError(null);
    mutation.clearError();
    setPhoto(file);
    uploaded.current = null;
  }
  function cancel() {
    if (!mutation.saving) {
      if (onCancel) onCancel();
      else navigate("/kitchen");
    }
  }
  async function save(event) {
    event.preventDefault();
    if (photoError) return;
    const publish = event.nativeEvent.submitter?.value === "publish";
    const result = await mutation.run(async () => {
      let imagePath = values.imagePath;
      if (photo) {
        setStage("Uploading photo…");
        if (uploaded.current?.file === photo) imagePath = uploaded.current.path;
        else {
          const data = await photosApi.upload(photo);
          imagePath = data.imagePath;
          uploaded.current = { file: photo, path: imagePath };
        }
      }
      setStage("Saving dish…");
      const next = {
        ...values,
        imagePath,
        isPublished: publish,
        imageAlt: values.imageAlt || values.name,
      };
      const body = id
        ? Object.fromEntries(
            [...editable, "isPublished"]
              .filter(
                (key) => String(next[key] ?? "") !== String(record[key] ?? ""),
              )
              .map((key) => [key, next[key]]),
          )
        : next;
      if (id && !Object.keys(body).length) return record;
      return id ? dishesApi.update(id, body) : dishesApi.create(body);
    });
    setStage("");
    if (result) {
      if (onDone) onDone(result);
      else navigate("/kitchen");
    }
  }
  const categoryOptions = categories
    .filter((c) => c.isActive || c.id === values.categoryId)
    .map((c) => [c.id, c.name + (c.isActive ? "" : " (inactive)")]);
  return (
    <section className="form-panel editor-panel paper-route friendly-dish-editor">
      <div className="form-intro">
        <span className="large-kanji">丁寧</span>
        <h2>{id ? "Refine your dish." : "Create something delicious."}</h2>
        <p>
          Add the details your guests will see. Save a draft to finish later, or
          publish when it is ready.
        </p>
        <p className="status-tag">
          {record.isPublished
            ? "Currently published"
            : "Draft · hidden from guests"}
        </p>
      </div>
      <form onSubmit={save}>
        <ErrorNotice error={mutation.error} />
        <section className="dish-form-section">
          <h3>Dish details</h3>
          <Field
            name="name"
            label="Dish name"
            value={values.name}
            onChange={set("name")}
            required
          />
          <Field
            name="categoryId"
            label="Category"
            type="select"
            value={values.categoryId}
            options={categoryOptions}
            onChange={set("categoryId")}
            required
          />
          <Field
            name="priceMinor"
            label="Price (VND)"
            type="number"
            min="0"
            step="1"
            value={values.priceMinor}
            onChange={set("priceMinor")}
            required
          />
          <Field
            name="description"
            label="Menu description"
            type="textarea"
            value={values.description}
            onChange={set("description")}
          />
        </section>
        <section className="dish-form-section">
          <h3>Dish photo</h3>
          <p>
            JPEG, PNG or WebP · up to 5 MB. Photos are resized automatically.
          </p>
          <div className="dish-photo-preview">
            {preview ? (
              <img src={preview} alt="Selected dish photo preview" />
            ) : values.imagePath ? (
              <Food dish={{ ...record, ...values }} />
            ) : (
              <span>No photo yet</span>
            )}
          </div>
          <input
            ref={input}
            type="file"
            name="photo"
            aria-label="Choose dish photo"
            accept="image/jpeg,image/png,image/webp"
            onChange={choose}
            className="photo-file-input"
            disabled={mutation.saving}
          />
          {photo && <p className="photo-filename">Selected: {photo.name}</p>}
          {photoError && (
            <p className="error" role="alert">
              {photoError}
            </p>
          )}
          <div className="button-row">
            <button
              type="button"
              className="secondary"
              disabled={mutation.saving}
              onClick={() => input.current.click()}
            >
              {photo || values.imagePath ? "Replace photo" : "Upload photo"}
            </button>
            {(photo || values.imagePath) && (
              <button
                type="button"
                className="secondary"
                disabled={mutation.saving}
                onClick={() => {
                  setPhoto(null);
                  setPreview(null);
                  uploaded.current = null;
                  set("imagePath")("");
                  setPhotoError(null);
                }}
              >
                Remove photo
              </button>
            )}
            {photoError && (
              <button
                type="button"
                className="secondary"
                onClick={() => setPhotoError(null)}
              >
                Keep current photo
              </button>
            )}
          </div>
        </section>
        <section className="dish-form-section">
          <h3>How it’s prepared</h3>
          <p>
            A short story for customers. Keep exact quantities and kitchen
            instructions in the recipe editor.
          </p>
          <Field
            name="preparationSummary"
            label="Public preparation summary"
            type="textarea"
            value={values.preparationSummary}
            onChange={set("preparationSummary")}
          />
        </section>
        <details className="dish-optional">
          <summary>Optional details</summary>
          <Field
            name="imageAlt"
            label="Photo description (defaults to dish name)"
            value={values.imageAlt}
            onChange={set("imageAlt")}
          />
          <Field
            name="isFeatured"
            label="Feature this dish"
            type="checkbox"
            value={values.isFeatured}
            onChange={set("isFeatured")}
          />
          <Field
            name="isAvailable"
            label="Currently available"
            type="checkbox"
            value={values.isAvailable}
            onChange={set("isAvailable")}
          />
        </details>
        <section className="dish-form-section">
          <h3>Ready for the menu?</h3>
          <p>
            Drafts are visible only to staff.{" "}
            {record.isPublished
              ? "Saving as a draft removes this dish from the public menu."
              : "Publish to show this dish to customers."}
          </p>
          {stage && <p role="status">{stage}</p>}
          <div className="button-row dish-save-actions">
            <button
              name="publication"
              value="publish"
              disabled={mutation.saving || !!photoError}
            >
              {record.isPublished ? "Save & keep published" : "Publish dish"} ↗
            </button>
            <button
              name="publication"
              value="draft"
              className="secondary"
              disabled={mutation.saving || !!photoError}
            >
              Save draft
            </button>
            <button
              type="button"
              className="text-button"
              disabled={mutation.saving}
              onClick={cancel}
            >
              Cancel
            </button>
          </div>
        </section>
      </form>
    </section>
  );
}
