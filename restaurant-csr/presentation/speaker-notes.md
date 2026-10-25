# Santaishi-tei — Presentation script

Block 6 · Tam Thái Tử

Approximately 12–15 minutes, including the live demonstration. Keep this file on a separate device or printed copy while projecting the slides.

## 01 · 三太子亭

Welcome. We are Tam Thái Tử, and our restaurant is Santaishi-tei. In Block 5, we developed a server-rendered restaurant website. In Block 6, we kept its Japanese atmosphere and business rules while moving the interface to React and exposing an Express REST API. We will first show the product, then explain the architecture, development decisions and verification.

## 02 · The final product

The house connects three areas: dining, kitchen and office. Customers browse without an account. Staff sign in for their assigned responsibilities. The room navigation expresses the restaurant theme, but the backend still enforces access. Ordering, customer accounts and reservations were deliberately excluded to keep the exercise focused. The image here is the project’s directory background artwork, not a screenshot of the running interface.

## 03 · The customer experience

Customers browse a menu styled as a book on a dining table. Sorting and pagination request only the relevant data. During pagination, the room remains visible while the menu changes and the page-flip animation plays. Clicking a dish opens a popup, and the full page provides ingredient names, an estimated time and related dishes. We show public preparation copy rather than exposing internal instructions or quantities.

## 04 · The staff experience

Staff should not need to edit source code to maintain a dish. The editor offers device photo selection, a preview, replacement and removal. Slugs are generated from names, with suffixes for duplicates, while renaming an existing dish preserves its URL. Drafts stay hidden from customers. The administrator office shows chef information and opens editing only when needed. Existing screenshot evidence illustrates the implemented interface; it does not represent a new live database session.

## 05 · Our development process

We worked in stages instead of replacing the whole application at once. We preserved the SSR exercise in restaurant-mvc and created restaurant-csr beside it. We reused the schema and moved request handling into a JSON API, then built React views. Feedback revealed interaction problems, including full-room loading during pagination and dish editing leaving the board. We corrected these before enriching dish content and simplifying photo and publication controls. Demo inventory was designed to preserve existing records and avoid duplicates on repeated runs.

## 06 · SSR and CSR request cycles

In Block 5, the server returned rendered pages. After a successful form submission, Post/Redirect/Get used a 303 redirect to avoid resubmitting the form on refresh. In Block 6, React owns the view and Express returns JSON. React updates the interface after a successful mutation, so API writes do not need the old PRG redirect. Block 5 used method override for HTML DELETE forms; Block 6 sends actual DELETE requests. Direct page visits still load the SPA shell, and React Router manages internal navigation.

## 07 · Technical architecture

React handles presentation and navigation, while pages call resource helpers rather than fetch directly. The shared client centralizes URLs, headers, credentials, loading and error interpretation. Express middleware checks sessions, roles and CSRF, and controllers coordinate services. Prisma maps our models to Supabase PostgreSQL. Photos take a separate path through the server to Supabase Storage. Secret keys stay on the server. We retained JavaScript as requested and kept the MVC separation while replacing server templates with React views.

## 08 · Workflow: save a dish

This is the complete save workflow. A new photo uploads first, followed by the dish mutation. The API checks the staff session, role, CSRF token and permitted input fields. Prisma saves the dish, and the response contains the saved record. React closes the editor and refreshes the board. Upload and database save are separate operations, so an unused uploaded image can remain after a failed save followed by cancellation. Cleanup is a future reviewed operation; we do not delete old photos automatically.

## 09 · REST API contract

HTTP methods and resource URLs describe the requested operation. PATCH only changes supplied allowed fields, and DELETE archives rather than physically deleting dish records. Central handlers format success and error envelopes. The frontend branches on a stable code, while message is human-readable and fields contains input-specific errors. BigInt prices are serialized safely as strings. Credentials and private fields are not included in public records. Photo upload is the explicit exception to JSON content type.

## 10 · Errors, loading and recovery

The API conventions follow the exercise requirements. Expected validation or missing-record cases return HTTP 200 with an error envelope; this is a deliberate course convention rather than a claim that every REST API should do the same. Authentication and authorization use 401 and 403. Unexpected failures return a safe 500 response. Invalid IDs are rejected before a database lookup. The shared client distinguishes network, HTTP and application failures. During menu pagination we retain existing content, and a failed board refresh allows retrying the read without repeating a completed write.

## 11 · Data relationships and permissions

The main relationships connect categories to dishes, dishes to optional recipes, and recipes to ingredients through quantities in recipe items. Stock operations group movement records, each storing the balance before, the signed change and the balance after. Staff attribution and unique request keys support accountability and safe retries. Receipt adds stock, usage consumes recipe ingredients, waste records a loss, and correction reconciles a count. Chefs may record usage and waste; administrators also handle receipts and corrections. The permission matrix describes server-enforced access, not only visible buttons.

## 12 · Decision log

These decisions came from the project requirements and feedback. The introduction stays in code because it does not need a content-management system. We extended the schema only when the public preparation summary needed to persist independently. Local assets remain valid, while new photos use Storage. Stable slugs prevent a simple rename from breaking a dish link. We kept draft and publish actions explicit and used archival operations to preserve relationships. Room transitions remain a visual layer; same-room navigation does not need repeated door transitions.

## 13 · Verification and live demonstration

At the last completed implementation verification on 19 October, all 38 automated tests passed. This is a historical verification result, not a claim of a new test run today. Browser checks covered selecting a photo, saving a draft, reopening the popup and publishing. A temporary live Storage image confirmed upload and public delivery, and was removed afterward without changing dish records. For the demonstration, we follow the customer journey first, then show staff workflows. Prepare credentials privately and avoid displaying configuration files. If the network fails, the local screenshot slides provide a fallback.

## 14 · What we delivered

We delivered a client-rendered restaurant website with a structured REST API while preserving the visual identity and existing management rules. The main lesson is that CSR changes rendering and navigation, but does not remove the need for authorization, validation and transactional data handling. Our next improvements would be reviewed cleanup of unused uploaded files, broader browser regression coverage and deployment monitoring. Thank you. We are ready for questions.
