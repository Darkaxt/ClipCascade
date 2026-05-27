export const getConnectedServiceActions = wsIsRunning => {
  const isRunning = wsIsRunning === 'true';

  return {
    primaryLabel: isRunning ? 'Stop' : 'Start',
    showRestart: isRunning,
  };
};

export const getConnectedHeaderActions = () => ({
  showLogout: true,
  showSettings: true,
});
