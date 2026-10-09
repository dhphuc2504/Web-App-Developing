# Student List — React CSR

This folder was converted from the Block 3 SSR exercise to React client-side rendering. The original SSR submission remains in the ZIP at the repository root. All existing student records and positions are preserved.

## Run

Requires Node.js 22.12 or newer.

```sh
cd exercise-02-student-list
npm install
npm run dev
```

Open **http://localhost:3000/Student** or **http://localhost:3000/Classroom**. Express hosts both the API and Vite development middleware on one port. Vite updates React components during development; a small Node watcher monitors only backend source files, avoiding restart loops from Vite cache updates. The default port is 3000; set `PORT` to use another port.

For a production build:

```sh
npm start
```

The `prestart` script builds React into `dist/`, then Express serves those static files. `npm run build` builds separately. Set `PORT` to change the port. `STUDENTS_FILE` can point to an alternate JSON file for isolated manual testing; the default is `data/Students.JSON`.

## Features

- Student table and form with IDs `ST001`–`ST999`, normalized names and emails, and duplicate checks.
- Classroom cards arranged from saved positions. Drag to a vacant seat or onto another student to swap; click selection and a keyboard-accessible move form provide alternatives.
- Student details on hover or focus; Escape dismisses details and clears selection.
- Light/dark toggle with browser-local preference.
- Loading, saving, empty, success, and error states; Refresh list retrieves current server records.
- JSON storage, serialized writes, and atomic file replacement within one server process.

## Architecture

```text
server.js                      HTTP server, Vite integration, static React shell
app.js                         Express JSON middleware and error handling
routes/students.js             JSON endpoint definitions
controllers/studentController.js Validation orchestration and JSON responses
models/studentRepository.js    JSON storage, uniqueness checks, moves and swaps
models/classroom.js            Seat limits, vacant-seat assignment, revisions
validation/student.js          Shared browser/server input normalization and validation
client/index.html              Empty React shell, initial theme
client/src/main.jsx            Mounts React in the browser
client/src/App.jsx             Navigation, data state, loading, requests and feedback
client/src/api.js              Fetch wrapper and API errors
client/src/components/         Header, StudentForm, StudentTable, Classroom
client/src/styles.css          Responsive layouts and theme tokens
vite.config.js                 React build configuration
data/Students.JSON            Student records and positions
tests/students.test.js         API integration tests with temporary storage
```

There are no EJS templates or server-rendered student markup. Initial HTML contains the React root; React fetches data and builds the table and classroom in the browser. Navigation uses browser history, and direct page links serve the same shell. Creating or moving a student sends JSON and updates React state from the confirmed response without a document reload.

## API

| Method | URL | Behavior |
| --- | --- | --- |
| GET | `/api/students` | Returns students, layout revision, and classroom dimensions. |
| POST | `/api/students` | Validates and creates a student; returns 201 and the updated snapshot. |
| PATCH | `/api/students/:id/position` | Moves/swaps a student and returns the updated snapshot. |

Create body: `{ "id": "ST007", "name": "Example Student", "email": "student@example.com" }`.

Move body: `{ "row": 2, "column": 3, "revision": "<revision from GET>" }`.

Responses include `students`, `revision`, and `classroom: { columns: 6, maxRows: 50 }`. Mutation responses also include `message`. Errors return `message` and optional field `errors`: 422 for invalid input, 409 for duplicates/stale revisions/full room, 404 for missing students/routes, and 500 for storage failures. Write endpoints require JSON; malformed JSON returns 400 and oversized bodies return 413.

## Validation and persistence

Browser HTML constraints and the shared validator provide immediate feedback. The server repeats validation and checks uniqueness before saving. IDs normalize to uppercase and exclude ST000; names trim and collapse whitespace to 2–100 characters; emails normalize to lowercase with basic format checks and a maximum of 254 characters. The server accepts only integer seats within rows 1–50 and columns 1–6.

New students receive the first vacant seat. Older records without positions are assigned deterministic vacant seats and persisted on the next write. Malformed JSON or invalid/overlapping saved positions produce an error instead of being overwritten.

Buttons lock while requests are pending. Retried additions are protected by uniqueness checks. Classroom updates include a revision to reject conflicting changes; the browser refreshes records on a 409 conflict. Network errors retain form values and recommend refreshing before retrying. React escapes displayed text. No Post/Redirect/Get or session flash messages are needed in this CSR version.

This course app has no authentication, database, or API gateway. Run one server process; sharing JSON storage between processes would require coordination. Other open tabs retrieve changes when refreshed or when navigating between pages.

## Verification

```sh
npm test
npm run build
```

Integration tests cover JSON responses, validation, duplicates, persistence, legacy positions, swaps, stale revisions, concurrent requests, invalid content, and corrupted storage. They use temporary files and do not modify the exercise records.

Reference documentation: [React](https://react.dev/learn/build-a-react-app-from-scratch), [Vite](https://vite.dev/guide/), and [Express](https://expressjs.com/en/5x/api/).
