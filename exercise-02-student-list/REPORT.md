# Student List Report — React Client-Side Rendering

**Course:** WebApp Developing

## 1. Technical stack

We chose React, Node.js, Express, and JSON storage because the application is small, the JavaScript ecosystem is familiar to us, and this stack is lightweight enough for the exercise. Fast feedback during development lets us focus on client-side rendering instead of database configuration. React introduces components and state management for the form, table, classroom, and feedback.

| Technology | Purpose and reason |
| --- | --- |
| React and React DOM | Render the UI in the browser; reusable components and state make dynamic updates easier to organize. |
| Vite | Transforms JSX during development and builds static frontend assets. |
| Node.js and Express | Run the backend, serve the frontend, and expose simple JSON endpoints. |
| JSON file | Stores students and positions without database installation. |
| HTML/CSS | Provide accessible forms, responsive layouts, and theme colors. |
| Fetch API | Sends data requests without navigating or reloading the page. |
| Node.js test runner | Verifies API and persistence behavior using temporary files. |

Express and the frontend run on the same origin. We do not need an API gateway or separate service deployment. The original Block 3 SSR version is archived in the repository ZIP.

## 2. Architecture and the MVC separation

We retain the separation of concerns from MVC, with the view moved into React:

- **Model:** `models/studentRepository.js` handles storage, uniqueness, moves, and swaps. `models/classroom.js` defines seat rules and revision checks.
- **Controller:** `controllers/studentController.js` receives requests, invokes validation and model operations, and returns JSON. `routes/students.js` maps API URLs to controller methods.
- **View:** React components in `client/src/components/` render the form, table, classroom, and header. `App.jsx` coordinates client state, navigation, and feedback.
- **Supporting modules:** `validation/student.js` supplies a shared pure validator; `api.js` handles browser requests; `app.js` configures Express middleware.

This makes responsibilities easy to locate and test. Display components do not directly read or write files; only the server can persist data. Unlike the SSR version, controllers return JSON rather than calling `res.render()`. React owns the generated student markup.

## 3. Data flow

### Opening a page

```text
Browser requests /Student or /Classroom
  → server.js sends static HTML and JavaScript
  → client/src/main.jsx mounts React
  → App.jsx calls api.list()
  → GET /api/students
  → app.js → routes/students.js → controllers/studentController.js
  → models/studentRepository.js reads data/Students.JSON
  → controller returns students, revision, and classroom dimensions as JSON
  → App.jsx stores the snapshot in React state
  → StudentTable or Classroom renders the records in the browser
```

### Adding a student

```text
StudentForm.jsx collects input and prevents default form navigation
  → HTML constraints and validation/student.js check browser input
  → App.jsx locks duplicate submissions
  → api.js sends POST /api/students with JSON
  → Express parses JSON
  → studentController.js repeats server validation
  → studentRepository.js checks ID/email uniqueness
  → classroom.js assigns the first vacant seat
  → repository atomically writes data/Students.JSON
  → controller returns 201 with the updated snapshot
  → App.jsx replaces React state
  → StudentTable updates; StudentForm resets after success
```

Invalid input returns 422 with field errors; duplicate records return 409. The form retains entered values and displays feedback. Requests are not redirected, and the document is not reloaded.

### Moving a classroom student

```text
Classroom.jsx handles dragging, click selection, or the movement form
  → api.js sends PATCH /api/students/:id/position
  → controller checks numeric fields and revision type
  → repository checks bounds, revision, and student existence
  → move to an empty seat or swap an occupied seat
  → atomically save JSON
  → return the updated snapshot
  → React redraws cards at their confirmed positions
```

Moves use the revision from the last snapshot. Stale changes return 409; the client reloads the current data so the teacher can review it before retrying. Other tabs do not receive live push updates; they refresh or request data on navigation.

## 4. Validation

Validation runs in both the browser and server. The server is authoritative because browser checks can be bypassed.

| Field | Rules |
| --- | --- |
| ID | String, trimmed, normalized to uppercase; ST001–ST999 only; unique ignoring case. |
| Name | String, trimmed with collapsed whitespace; 2–100 characters; no remaining control characters. |
| Email | String, trimmed and lowercased; basic email syntax, maximum 254 characters; unique ignoring case. |
| Position | Integer row 1–50 and column 1–6; student must exist; revision must match current records. |

`StudentForm.jsx` uses HTML `required`, length limits, ID pattern, and email input type. It also calls the same pure validator that the server uses. The movement form constrains row and seat input. The backend repeats checks and performs data-dependent uniqueness and conflict validation.

Storage reads verify the JSON array structure and valid, distinct saved positions. Legacy records without positions are assigned vacant seats and persisted on the next write. Corrupted existing storage is not overwritten. Format validation does not verify mailbox existence.

## 5. Error handling and verification

Requests show loading/saving states and disable repeated submission while pending. Uniqueness checks protect additions that are retried. Network failures preserve input and instruct the user to refresh before retrying because a save may have succeeded even if its response was lost. Server validation failures display field errors; storage failures show a general error. React escapes displayed text so student names are not interpreted as HTML.

The previous SSR session feedback, EJS templates, form tokens, and Post/Redirect/Get are replaced by JSON responses and React state. This local exercise has no authentication; write requests require JSON and use same-origin endpoints. File writes are serialized within one Node process and use atomic replacement.

API integration tests exercise persistence, normalization, invalid input, duplicate/retried additions, legacy records, classroom swaps, conflicts, concurrent writes, request errors, and corrupted storage. A production build checks JSX and frontend bundling. Browser checks verify that additions and moves update the interface without a page reload.
