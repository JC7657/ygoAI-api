import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cardRoutes from "./routes/cards.js";
import aiRoutes from "./routes/ai.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

app.use("/cards", cardRoutes);
app.use("/ai", aiRoutes);

const PORT = process.env.PORT || 3000

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;