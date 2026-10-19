export function listenForStartup(app, port, host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host);
    const failed = (error) => {
      server.removeListener("listening", ready);
      reject(error);
    };
    const ready = () => {
      server.removeListener("error", failed);
      resolve(server);
    };
    server.once("error", failed);
    server.once("listening", ready);
  });
}

export function startupFailureMessage(error, port) {
  if (error?.code === "EADDRINUSE") {
    return `Port ${port} is already in use. Stop the other service. Development uses API port 3001 and frontend port 3000.`;
  }
  return "Startup failed. Check PostgreSQL connectivity and migration status. Detailed errors are suppressed to protect credentials.";
}
