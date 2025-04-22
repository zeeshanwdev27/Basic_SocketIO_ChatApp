import Message from "./models/Message.js";

io.on('connection', async (socket) => {

  socket.on('chat message', async (msg, clientOffset, callback) => {
    let savedMessage;

    try {
      savedMessage = await Message.create({
        content: msg,
        client_offset: clientOffset,
      });
    } catch (e) {
      // If it's a duplicate key error (client_offset already exists), just acknowledge
      if (e.code === 11000) { // MongoDB duplicate key error code
        if (callback) callback();
        return;
      } else {
        console.error('Error saving message:', e);
        return;
      }
    }

    // Emit the message and acknowledge it
    io.emit('chat message', msg, savedMessage._id);
    if (callback) callback();
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
      console.error('Error during recovery:', e);
    }
  }
  
});
