export function installShutdown({ server, db, cleanup, processRef = process, logger = console, timeoutMs = 5000 }) {
  let shutdownPromise;

  const shutdown = () => {
    if (shutdownPromise) return shutdownPromise;
    clearInterval(cleanup);
    logger.log('Stopping Santaishi-tei...');

    // Establish the guard before starting any asynchronous cleanup.
    shutdownPromise = Promise.resolve().then(async () => {
      let deadline;
      const timeout = new Promise(resolve => {
        deadline = setTimeout(() => resolve('timeout'), timeoutMs);
      });
      const graceful = (async () => {
        await new Promise((resolve, reject) => {
          server.close(error => {
            if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
            else resolve();
          });
          server.closeIdleConnections?.();
        });
        await db.$disconnect();
        return 'complete';
      })();

      let result;
      try {
        result = await Promise.race([graceful, timeout]);
      } catch {
        result = 'failed';
      }
      clearTimeout(deadline);
      processRef.removeListener('SIGINT', shutdown);
      processRef.removeListener('SIGTERM', shutdown);

      if (result !== 'complete') {
        // Never print raw database exceptions during shutdown.
        logger.error(result === 'timeout'
          ? 'Shutdown timed out. Forcing the server to stop.'
          : 'Shutdown could not complete cleanly. Forcing the server to stop.');
        try { server.closeAllConnections?.(); } catch {}
      }
      processRef.exit(result === 'complete' ? 0 : 1);
    });
    return shutdownPromise;
  };

  processRef.on('SIGINT', shutdown);
  processRef.on('SIGTERM', shutdown);
  return shutdown;
}
