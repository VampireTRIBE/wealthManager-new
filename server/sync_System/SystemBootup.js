const {
  init_AppscriptMaster,
} = require("../init_Scripts/init_Appscript/AssetsData_Models_Scripts/init_masterAppscript");
const {
  init_CacheMaster,
} = require("../init_Scripts/init_Cache/AssetsData_Models_Cache/Init_masterCache");
const {
  sync_FillFutureNAVs,
} = require("../sync_Scripts/sync_Portfolio/sync_Portfolio");
const {
  get_AllUserIDs,
} = require("../utils/mongodb/aggregations/get_AlluserIds");
const {
  get_LastNavDatesByUser,
} = require("../utils/mongodb/aggregations/get_LastNavDatesByUser");
const log = require("../utils/shared/console_Loggers/consoleLoggers");

module.exports.systemBootup = async () => {
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  const runWithRetry = async (fn, label, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fn();
        if (res?.result === false) {
          throw new Error(`${label} returned false`);
        }
        return res;
      } catch (error) {
        if (attempt < maxRetries) {
          await delay(500 * attempt);
        } else {
          throw new Error(
            `${label} failed after ${maxRetries} attempts: ${error.message}`,
          );
        }
      }
    }
  };

  try {
    // =========================
    // 1. INIT CACHE
    // =========================
    await runWithRetry(() => init_CacheMaster(), "INIT CACHE");
    log.success("INIT CACHE SUCCESSFULL");

    // =========================
    // 2. INIT APPSCRIPT
    // =========================
    await runWithRetry(() => init_AppscriptMaster(), "INIT APPSCRIPT");
    log.success("INIT APPSCRIPT SUCCESSFULL");

    // =========================
    // 3. UPDATE NAV
    // =========================
    const [userIds, userNavMap] = await Promise.all([
      get_AllUserIDs(),
      get_LastNavDatesByUser(),
    ]);
    if (!userIds.length) {
      log.error("No UserId Found...");
      log.success("BOOTSTRAP COMPLETED SUCCESSFULLY");
      return;
    }
    const BATCH_SIZE = 10;
    const MAX_RETRIES = 3;
    const retryUpdate = async (userId, attempt = 1) => {
      try {
        await sync_FillFutureNAVs(
          userId,
          userNavMap[userId].lastNavDate,
          new Date(),
        );
        return { userId, success: true };
      } catch (error) {
        if (attempt < MAX_RETRIES) {
          await delay(300 * attempt);
          return retryUpdate(userId, attempt + 1);
        }
        return { userId, success: false, error };
      }
    };
    let success = 0;
    let failed = [];
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((userId) => retryUpdate(userId)),
      );
      results.forEach((r) => {
        if (r.success) success++;
        else failed.push(r);
      });
    }
    if (failed.length > 0) {
      failed.forEach((f) =>
        log.error(`Failed userId: ${f.userId}, error: ${f.error?.message}`),
      );
      throw new Error(
        `NAV UPDATE FAILED: ${failed.length} users failed, ${success} succeeded`,
      );
    }
    log.success("Past Nav Update successful for all users");

    // =========================
    // DONE
    // =========================
    log.success("BOOTSTRAP COMPLETED SUCCESSFULLY");
  } catch (err) {
    console.error("FATAL ERROR:", err.message);
  }
};
