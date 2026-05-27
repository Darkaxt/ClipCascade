const toNumericSegments = version =>
  String(version ?? '')
    .split('.')
    .map(segment => Number(segment))
    .map(segment => (Number.isFinite(segment) ? segment : 0));

export const compareVersions = (leftVersion, rightVersion) => {
  const left = toNumericSegments(leftVersion);
  const right = toNumericSegments(rightVersion);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index++) {
    const leftSegment = left[index] ?? 0;
    const rightSegment = right[index] ?? 0;

    if (leftSegment > rightSegment) {
      return 1;
    }
    if (leftSegment < rightSegment) {
      return -1;
    }
  }

  return 0;
};

export const shouldShowNewVersion = (currentVersion, remoteVersion) =>
  compareVersions(remoteVersion, currentVersion) > 0;
