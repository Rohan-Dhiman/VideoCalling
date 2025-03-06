import React, { useEffect } from "react";
import { useState, useCallback } from "react";
import { useSocket } from "../context/SocketProvider";
import { useNavigate } from "react-router-dom";

function LobbyScreen() {
  const [email, setEmail] = useState("");
  const [room, setRoom] = useState("");

  const Socket = useSocket();
  const navigate = useNavigate();

  const handleSubmitForm = useCallback((e) => {
    e.preventDefault();
    Socket.emit("room:join", { email, room });
    console.log({
      email,
      room,
    });
  }, [email, room, Socket]);

  const handleJoinRoom = useCallback((data) => {
    navigate(`/room/${data.room}`);
  }, [navigate]);

  useEffect(() => {
    Socket.on("room:join", handleJoinRoom);
  }, [Socket, handleJoinRoom]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">Join Video Call</h1>

      <form className="bg-white p-6 rounded-lg shadow-md w-full max-w-md" onSubmit={handleSubmitForm}>
        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-700 font-bold mb-2">Email Address</label>
          <input
            type="email"
            id="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="roomNumber" className="block text-gray-700 font-bold mb-2">Room Number</label>
          <input
            type="number"
            id="roomNumber"
            placeholder="Enter room number"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600">Join Room</button>
      </form>
    </div>
  );
}

export default LobbyScreen;