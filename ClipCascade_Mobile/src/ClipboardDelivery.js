import { sha3_256 } from 'js-sha3';

const fingerprint = (content, type) => sha3_256(`${type}\0${content}`);
const trim = states => {
  while (states.size > 128) {
    states.delete(states.keys().next().value);
  }
};

export const hasClipboardDelivery = metadata =>
  typeof metadata?.deliveryId === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(metadata.deliveryId) &&
  typeof metadata?.sourceSessionId === 'string' && metadata.sourceSessionId.length > 0 && metadata.sourceSessionId.length <= 128;

export const createClipboardDelivery = ({ now = Date.now } = {}) => {
  const pending = new Map();
  const applied = new Map();
  const applying = new Map();
  let latestId;
  let preparing;
  let generation = 0;
  return {
    resetOutbound() { pending.clear(); latestId = undefined; preparing = undefined; generation += 1; },
    prepare(content, type, build, force = false) {
      const hash = fingerprint(content, type);
      const state = pending.get(latestId);
      if (!force && preparing?.hash === hash &&
          (!preparing.id || (preparing.id === latestId && state && !state.complete))) {
        return preparing.promise;
      }
      const reservation = { hash, generation };
      preparing = reservation;
      reservation.promise = Promise.resolve().then(build).then(message => {
        if (reservation.generation !== generation) { throw new Error('Clipboard send superseded by connection change'); }
        // Retain the exact ciphertext: the server binds an ID to its wire bytes.
        pending.set(message.id, { hash, at: now(), complete: false, type });
        if (preparing === reservation) { latestId = message.id; }
        reservation.id = message.id;
        trim(pending);
        return message;
      }).catch(error => {
        if (preparing === reservation) { preparing = undefined; }
        throw error;
      });
      return reservation.promise;
    },
    begin(id, content, type) {
      pending.set(id, { hash: fingerprint(content, type), at: now(), complete: false, type });
      latestId = id;
      trim(pending);
    },
    shouldSuppress(content, type) {
      const state = pending.get(latestId);
      return Boolean(state?.complete && state.hash === fingerprint(content, type) && now() - state.at < 5000);
    },
    acknowledge(message) {
      if (message?.protocol === 1 && message.kind === 'clipboard_delivery_reset') {
        pending.clear(); latestId = undefined; preparing = undefined; generation += 1; return null;
      }
      if (message?.protocol !== 1 || message.kind !== 'clipboard_delivery') { return null; }
      const state = pending.get(message.deliveryId);
      if (!state || state.complete || message.complete !== true || !Number.isInteger(message.expected) ||
          message.expected <= 0 || message.applied !== message.expected) { return null; }
      state.complete = true;
      return state.type;
    },
    async applyOnce(metadata, content, type, apply) {
      if (!hasClipboardDelivery(metadata)) { return apply(); }
      const key = `${metadata.sourceSessionId}:${metadata.deliveryId}`;
      const hash = fingerprint(content, type);
      if (applied.has(key)) {
        if (applied.get(key) !== hash) { throw new Error('Clipboard delivery ID reused for different content'); }
        return true;
      }
      if (applying.has(key)) {
        const active = applying.get(key);
        if (active.hash !== hash) { throw new Error('Clipboard delivery ID reused for different content'); }
        return active.promise;
      }
      if (applying.size >= 128) { throw new Error('Too many clipboard applications in progress'); }
      const promise = Promise.resolve().then(apply).then(success => {
        if (success === true) { applied.set(key, hash); trim(applied); }
        return success === true;
      }).finally(() => applying.delete(key));
      applying.set(key, { hash, promise });
      return promise;
    },
  };
};
