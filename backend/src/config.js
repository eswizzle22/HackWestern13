module.exports = {
  // A device that has sent nothing for this long is shown as offline. It no longer affects sessions.
  OFFLINE_AFTER_MS: Number(process.env.OFFLINE_AFTER_SECONDS || 120) * 1000,
  // A running session asks "still working?" this long after it started or was last confirmed...
  CHECKIN_MS: Number(process.env.CHECKIN_MINUTES || 60) * 60 * 1000,
  // ...and ends by itself if there is no answer within this long.
  CHECKIN_GRACE_MS: Number(process.env.CHECKIN_GRACE_MINUTES || 5) * 60 * 1000,
  // How often the server looks for sessions whose check-in went unanswered.
  SWEEP_MS: Number(process.env.SWEEP_SECONDS || 15) * 1000,
  LIGHT_MAX: 625,
  AIR_MAX: 1023,
};
