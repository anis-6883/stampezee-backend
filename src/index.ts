import "dotenv/config";
import { createServer } from "http";
import config from "./configs/config";
import connectToDatabase from "./configs/database";
import app from "./configs/server";
import { socket } from "./features/mobile/socket/socket";
const server = createServer(app);
socket(server);

const startServer = async () => {
  try {
    const PORT = process.env.PORT || 8080;
    const env = process.env.NODE_ENV || "development";
    await connectToDatabase(config[env].databaseURI);

    server.listen(PORT);
    console.log(`Server is running on port ${PORT}`);
  } catch (error) {
    console.error("Error starting the server:", error.message);
    process.exit(1);
  }
};

startServer();
