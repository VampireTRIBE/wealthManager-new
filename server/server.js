const dotenv = require("dotenv");
dotenv.config({ quiet: true });

// ! IMPORTANT IMPORTS

const express = require("express");
const { corAuth } = require("./middlewares/cors");
const { DB_connect } = require("./config/connectDB");
const { passportAuthentication } = require("./middlewares/authentication");
const { sessionConfig } = require("./middlewares/seasson");
const { bodyParser } = require("./middlewares/dataParser");
const log = require("./utils/shared/console_Loggers/consoleLoggers");
const { systemBootup } = require("./sync_System/SystemBootup");
const { sync_CurrentPrices } = require("./sync_System/sync_CurrentPrices");
const {
  sync_AllUsersPortfolio,
} = require("./sync_System/sync_AllusersPortfolio");

const app = express();

corAuth(app);
DB_connect();
sessionConfig(app);
passportAuthentication(app);
bodyParser(app);

// !import routes
const publicRoute = require("./routes/publicRoutes/publicRoutes");
const userRoute = require("./routes/userRoutes/userRoute");
const adminRoute = require("./routes/adminRoutes/adminRoutes");
const portfolioRoute = require("./routes/portfolioRoutes/portfolioRoutes");
const testRoutes = require("./routes/testRoutes/testRoutes");

// ! for listning all requests
app.listen(process.env.PORT, async (req, res) => {
  log.running(`SERVER PORT : ${process.env.PORT}`);
});

// ! System Bootup

(async function () {
  await systemBootup();
})();

// ! Update Live Price

(async function () {
  await sync_CurrentPrices();
})();

// ! Update for all users
(async function () {
  await sync_AllUsersPortfolio();
})();

// ! Only for Testing purpouse In Devlopment
app.use("/test", testRoutes);

// ! Diffrent Routes

// ! login/signup Routes
app.use("/", userRoute);

// ! Public Data View
app.use("/", publicRoute);

// ! Admin Routes
app.use("/admin/dataseeders", adminRoute);

// ! Portfolio Routes
app.use("/portfolio", portfolioRoute);

// ! error handling middleware
app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Some Error" } = err;
  console.log(`Status Code : ${statusCode}\nMessage : ${message}`);
  res.status(statusCode).json({ statusCode, error: message });
});
