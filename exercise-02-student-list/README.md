# Exercise 02 — Student List

A Node.js / Express application that renders HTML on the server with EJS. Student records and seat positions are stored in `data/Students.JSON`. Both pages render on the server. Small browser scripts enhance classroom gestures and the theme toggle; adding students and the move form work without JavaScript.

## Run

Requires Node.js 20 or newer. From the repository root:

```sh
cd exercise-02-student-list
npm install
npm start
```

Open **http://localhost:3000/Student** or **http://localhost:3000/Classroom**. Both `npm start` and `npm run dev` restart the server when source files change. After upgrading from a running older version, stop that server once and start it again with `npm start`. Set `PORT` to use another port. Run `npm test` for the automated integration tests.

## Routes and SSR flow

| Route | Behavior |
| --- | --- |
| `GET /Student` | Reads the JSON file and renders the student directory and add form. |
| `POST /AddStudent` | Validates the form, saves a valid new student, and redirects with HTTP 303 to `/Student`. |
| `GET /Classroom` | Renders students at their saved classroom seats, with information popups and movement controls. |
| `POST /Classroom/Move` | Validates and saves a move or swap, then redirects with HTTP 303 to `/Classroom`. |

1. Express receives a form submission containing `id`, `name`, `email`, and the hidden form token.
2. The controller calls the validator; the repository checks uniqueness and writes the JSON file.
3. The server stores feedback in the session and redirects to `GET /Student` (Post/Redirect/Get).
4. The GET reads the updated file and renders a complete new HTML page. The browser immediately displays the updated list. Existing pages in other browsers update on their next request; there is no live push or client-side rendering.

Both successful and rejected submissions redirect, so refreshing the resulting page does not re-post the form. Invalid input is preserved with field errors. A session form token rejects stale or replayed successful submissions. Duplicate IDs and emails are also rejected, including simultaneous submissions.

## Validation

- **ID:** `ST001`–`ST999` (ST followed by exactly three digits; ST000 is rejected); stored in uppercase; unique ignoring case.
- **Name:** 2–100 characters after trimming and collapsing whitespace; supports Unicode names; rejects remaining control characters.
- **Email:** basic email format, up to 254 characters; trimmed, stored in lowercase, and unique ignoring case. Format validation does not verify that a mailbox exists.
- HTML input constraints assist users; server validation also applies when those constraints are bypassed. EJS escapes displayed values.

## Code organization

```text
app.js                         Express setup and error handling
server.js                      Starts the HTTP server
routes/students.js             Student and classroom routes
controllers/studentController.js  Student request handling and view data
controllers/classroomController.js Classroom request handling and feedback
validation/student.js          Input normalization and validation
models/studentRepository.js    JSON reads, uniqueness checks, moves, and writes
models/classroom.js            Seat rules, automatic placement, and classroom view data
views/                         EJS markup and presentation-only loops/conditions
public/styles.css              Responsive styles and theme colors
public/classroom.js            Pointer dragging, click selection, and popups
public/theme.js                Light/dark preference, saved in localStorage
data/Students.JSON             Persisted students and classroom positions
tests/students.test.js          Integration tests using temporary data
```

The template only displays prepared values. It does not validate, modify records, or access storage. Writes are serialized within one Node process and replace the JSON file atomically. Malformed existing data produces an error instead of being overwritten.

This is a local course exercise: run one server process. Sessions use Express's in-memory session store and expire after one hour; restarting clears sessions but preserves students. `SESSION_SECRET` can supply a stable session signing secret. A deployed service would require a persistent session store and coordination for storage writes across processes.

Reference documentation: [Express](https://expressjs.com/en/5x/api/) and [EJS](https://ejs.co/).

## Classroom positions

Open **http://localhost:3000/Classroom** or use the navigation links. The student management page retains the form and table, with a position column added.

Each record has a one-based position:

```json
{
  "id": "ST001",
  "name": "Example Student",
  "email": "student@example.com",
  "position": { "row": 1, "column": 1 }
}
```

The classroom has six columns and up to 50 rows (300 seats). At least four rows are shown, with an additional row after the last occupied row as space allows. New students get the first vacant seat, scanning rows from the front. Legacy records without positions get deterministic vacant seats; these positions are persisted on the next successful write. The two existing students have explicit starting positions.

- Drag a card to an empty seat to move it, or onto an occupied seat to swap students. Pointer gestures support a mouse and touch.
- Alternatively, click a student and then a destination seat. Keyboard users can activate the same buttons or use the student/row/seat form below the classroom; the form also works without JavaScript.
- Hover or focus a card to show the student's ID, name, email, and seat. Escape dismisses the popup and clears selection.
- Moves submit a normal HTML form. The server checks the session token, seat bounds, student existence, and a revision of the displayed layout, then saves and redirects to a new server-rendered page. Replayed or conflicting changes show feedback without overwriting the newer layout.
- Positions remain in the JSON file after restarting. Existing pages in other browsers refresh on their next request.
- The theme toggle appears on both pages. Its preference persists in browser localStorage and follows the system preference until the user chooses a theme.

Run `npm test` to cover student validation and persistence, legacy seat assignment, moves, swaps, invalid requests, concurrent updates, and corrupted data. Tests use temporary JSON files and leave the exercise's student data intact.
