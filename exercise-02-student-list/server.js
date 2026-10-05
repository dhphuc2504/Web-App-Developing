import { createApp } from './app.js';

const port = process.env.PORT || 3000;
createApp().listen(port, () => {
  console.log(`Student List is running at http://localhost:${port}/Student`);
});
