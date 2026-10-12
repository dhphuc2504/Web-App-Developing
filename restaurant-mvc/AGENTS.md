# Project rules

- Use JavaScript, Express, EJS, Prisma, and MVC.
- Customers are public visitors; only admins and chefs authenticate. Chefs may manage dishes and recipes; category, ingredient metadata, and chef-account management remain admin-only. No ordering, bookings, or customer accounts.
- Use POST/Redirect/GET with HTTP 303 for successful HTML form mutations.
- Define database changes in versioned Prisma migrations. Do not apply remote migrations unless requested.
- Never read, print, inspect, copy, or transmit `.env` or other real environment files. The user maintains their credentials.
- Use `.env.example` for variable names and documentation. Do not overwrite an existing `.env`.
- Application configuration may load credentials at runtime, but never log their values.
- Never include credentials in source, command arguments, test output, or version control.

- Archive/delete forms use a hidden `_method=DELETE` field and DELETE resource routes. Never mutate through GET; retain CSRF, admin authorization, and 303 redirects.
