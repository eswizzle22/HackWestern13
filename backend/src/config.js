module.exports = {
  // A device that sends nothing for this long is considered switched off, which ends its session.
  SESSION_TIMEOUT_MS: Number(process.env.SESSION_TIMEOUT_SECONDS || 120) * 1000,
  // The sensor script sends one averaged record per batch. Sessions are back-dated by one batch,
  // because the first record only arrives after a full batch has been collected.
  BATCH_MS: Number(process.env.BATCH_SECONDS || 30) * 1000,
  // How often the server checks for devices that have gone quiet.
  SWEEP_MS: Number(process.env.SWEEP_SECONDS || 15) * 1000,
  LIGHT_MAX: 625,
  AIR_MAX: 1023,
};
