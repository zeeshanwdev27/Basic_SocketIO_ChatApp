import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { availableParallelism } from 'node:os';
import cluster from 'node:cluster';
import { createAdapter, setupPrimary } from '@socket.io/cluster-adapter';
import Message from './models/Message.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (cluster.isPrimary) {
  const numCPUs = availableParallelism(); // or use os.cpus().length
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork({
      PORT: 3000 + i // Assign each worker a unique port
    });
  }

  setupPrimary(); // Setup socket.io cluster adapter
} else {
  await mongoose.connect('mongodb://localhost:27017/chat')
    .then(() => console.log("Database Connected"))
    .catch((err)=>console.log("Error in Connecting DB", err.message))

  const app = express();
  const server = createServer(app);

  const io = new Server(server, {
    connectionStateRecovery: {},
    adapter: createAdapter() // Connect workers
  });

  app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
  });

  io.on('connection', async (socket) => {
    socket.on('chat message', async (msg, clientOffset, callback) => {
      try {
        const savedMessage = await Message.create({
          content: msg,
          client_offset: clientOffset,
        });

        io.emit('chat message', msg, savedMessage._id);
        callback?.('ok');
      } catch (e) {
        if (e.code === 11000) {
          callback?.('ok');
        } else {
          console.error('Error saving message:', e);
          callback?.('error');
        }
      }
    });

    if (!socket.recovered) {
      try {
        const offset = socket.handshake.auth?.serverOffset;
        const query = offset ? { _id: { $gt: offset } } : {};
        const missedMessages = await Message.find(query).sort({ _id: 1 });

        missedMessages.forEach((msg) => {
          socket.emit('chat message', msg.content, msg._id);
        });
      } catch (e) {
        console.error('Recovery error:', e);
      }
    }
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}
