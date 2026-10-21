export const createForegroundServiceLifecycle = () => {
  let registered = false;
  let activeRun = null;
  let latestRequestId = 0;

  const register = (registerCallback, runner) => {
    if (registered) {
      return;
    }
    registered = true;

    registerCallback(async notification => {
      const requestId = ++latestRequestId;
      const previousRun = activeRun;
      if (previousRun) {
        previousRun.cancel();
        await previousRun.finished;
      }

      if (requestId !== latestRequestId) {
        return;
      }

      let finishRun;
      let signalCancellation;
      let wakeTick = null;
      const cancellation = new Promise(resolve => {
        signalCancellation = resolve;
      });
      const run = {
        cancellationRequested: false,
        cancel() {
          if (!this.cancellationRequested) {
            this.cancellationRequested = true;
            signalCancellation();
            wakeTick?.();
          }
        },
        isCancellationRequested() {
          return this.cancellationRequested;
        },
        waitForCancellation() {
          return cancellation;
        },
        waitForTick(wait) {
          if (this.cancellationRequested) {
            return Promise.resolve();
          }
          return new Promise((resolve, reject) => {
            const complete = error => {
              if (wakeTick !== cancel) {
                return;
              }
              wakeTick = null;
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            };
            const cancel = () => complete();
            wakeTick = cancel;
            Promise.resolve().then(wait).then(() => complete(), complete);
          });
        },
      };
      run.finished = new Promise(resolve => {
        finishRun = resolve;
      });
      activeRun = run;

      try {
        await runner(notification, run);
      } finally {
        if (activeRun === run) {
          activeRun = null;
        }
        finishRun();
      }
    });
  };

  return { register };
};
