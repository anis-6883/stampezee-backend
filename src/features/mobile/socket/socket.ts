const { Server, Socket } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const Redis = require("ioredis");
const pubClient = new Redis(process.env.REDIS_URL);
const subClient = pubClient.duplicate();

pubClient.on("error", (err: Error) => {
  console.error(err);
});

subClient.on("error", (err: Error) => {
  console.error(err);
});

subClient.subscribe("stampCollected", (err: Error) => {
  if (err) {
    console.error("Failed to subscribe: %s", err.message);
  }
});

export const stampCollected = (data: Object) => {
  pubClient.publish("stampCollected", JSON.stringify(data));
};

export const socket = (server: any) => {
  const io = new Server(
    server,
    {
      connectionStateRecovery: {},
    },
    { cors: { origin: "*" } }
  );

  subClient.on("message", async (channel: string, message: string) => {
    if (channel == "stampCollected") {
      const data = JSON.parse(message);
      io.to(data.collectStampId).emit("status", data.response);
      io.socketsLeave(data.collectStampId);
    }
  });

  io.use((socket: typeof Socket, next: (err?: Error) => void) => {
    const token = socket.handshake.headers.token as string | undefined;

    if (!token || token !== process.env.SOCKET_TOKEN) {
      console.error("Invalid token");
      return next(new Error("Authentication error"));
    }
    next();
  });

  io.on("connection", (socket: typeof Socket) => {
    socket.on("join", async (data: { collectStampId: string }) => {
      const { collectStampId } = data;
      if (!collectStampId) {
        socket.emit("error", "collectStampId must be a valid ObjectId");
        return;
      }
      socket.join(collectStampId);
    });

    socket.on("disconnect", () => {
      console.log("Socket Disconnected");
    });
  });
};
