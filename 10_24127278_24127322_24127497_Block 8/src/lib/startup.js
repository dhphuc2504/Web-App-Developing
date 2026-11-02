export function listenForStartup(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1');
    const failed = error => {
      server.removeListener('listening', ready);
      reject(error);
    };
    const ready = () => {
      server.removeListener('error', failed);
      resolve(server);
    };
    server.once('error', failed);
    server.once('listening', ready);
  });
}

export function startupFailureMessage(error, port) {
  if (error?.code === 'EADDRINUSE') {
    return `Port ${port} is already in use. Stop the other server, or run PORT=3002 APP_ORIGIN=http://localhost:3002 npm run dev from restaurant-mvc.`;
  }
  return 'Startup failed. Check PostgreSQL connectivity and migration status. Detailed errors are suppressed to protect credentials.';
}
