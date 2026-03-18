import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cardRoutes from "./routes/cards.js";
import aiRoutes from "./routes/ai.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/cards", cardRoutes);
app.use("/ai", aiRoutes);

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});