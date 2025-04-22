import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import Message from './models/Message.js';

await mongoose.connect('mongodb://localhost:27017/chat').then(()=>console.log("Database is Connected"))

const app = express();
const server = createServer(app);
const io = new Server(server, {
  connectionStateRecovery: {}
});

const __dirname = dirname(fileURLToPath(import.meta.url));

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

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
