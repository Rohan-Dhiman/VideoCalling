import React, { useEffect, useCallback, useState } from "react";
import ReactPlayer from "react-player";
import peer from "../service/peer";
import { useSocket } from "../context/SocketProvider";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faMicrophoneSlash,
  faVideo,
  faVideoSlash,
  faDesktop,
  faStop,
} from "@fortawesome/free-solid-svg-icons";

const RoomPage = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [myScreen, setMyScreen] = useState();
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteStream, setRemoteStream] = useState();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoStopped, setIsVideoStopped] = useState(false);
  const [addedTracks, setAddedTracks] = useState(new Set());
  const [userCount, setUserCount] = useState(0);

  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room`);
    setRemoteSocketId(id);
    setUserCount((prevCount) => prevCount + 1);
  }, []);

  const handleUserLeft = useCallback(
    ({ email, id }) => {
      console.log(`Email ${email} left room`);
      setUserCount((prevCount) => prevCount - 1);
      if (id === remoteSocketId) {
        setRemoteSocketId(null);
      }
    },
    [remoteSocketId]
  );

  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
    setMyStream(stream);
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      setRemoteSocketId(from);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
      console.log(`Incoming Call`, from, offer);
      const ans = await peer.getAnswer(offer);
      socket.emit("call:accepted", { to: from, ans });
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    if (myStream) {
      for (const track of myStream.getTracks()) {
        if (!addedTracks.has(track.id)) {
          peer.peer.addTrack(track, myStream);
          setAddedTracks((prev) => new Set(prev).add(track.id));
        }
      }
    }
  }, [myStream, addedTracks]);

  const sendScreen = useCallback(async () => {
    try {
      // If already sharing, stop sharing
      if (isScreenSharing && myScreen) {
        myScreen.getTracks().forEach((track) => {
          track.stop();

          // Find and remove this track from the peer connection
          peer.peer.getSenders().forEach((sender) => {
            if (sender.track === track) {
              peer.peer.removeTrack(sender);
            }
          });

          // Remove from addedTracks
          setAddedTracks((prev) => {
            const newSet = new Set(prev);
            newSet.delete(track.id);
            return newSet;
          });
        });

        setMyScreen(null);
        setIsScreenSharing(false);

        // Notify the user on UI
        console.log("Screen sharing stopped");
        return;
      }

      // Start sharing
      const screen = await navigator.mediaDevices.getDisplayMedia({
        cursor: true,
        video: true,
        audio: true,
      });

      // Handle the case when user cancels the screen share dialog
      screen.getVideoTracks()[0].addEventListener("ended", () => {
        console.log("User ended screen sharing");
        setMyScreen(null);
        setIsScreenSharing(false);

        // Remove tracks from peer connection
        screen.getTracks().forEach((track) => {
          peer.peer.getSenders().forEach((sender) => {
            if (sender.track === track) {
              peer.peer.removeTrack(sender);
            }
          });
        });
      });

      setMyScreen(screen);
      setIsScreenSharing(true);

      // Add tracks to peer connection
      if (screen) {
        for (const track of screen.getTracks()) {
          if (!addedTracks.has(track.id)) {
            peer.peer.addTrack(track, screen);
            setAddedTracks((prev) => new Set(prev).add(track.id));
          }
        }
        console.log("Screen sharing started");
      }
    } catch (error) {
      console.error("Error sharing screen:", error);
    }
  }, [addedTracks, isScreenSharing, myScreen]);

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      peer.setLocalDescription(ans);
      console.log("Call Accepted!");
      sendStreams();
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.setLocalDescription(ans);
  }, []);

  useEffect(() => {
    peer.peer.addEventListener("track", async (ev) => {
      const remoteStream = ev.streams;
      console.log("GOT TRACKS!!");
      setRemoteStream(remoteStream[0]);
    });
  }, []);

  //chat segment
  const sendMessage = () => {
    if (message.trim() !== "") {
      socket.emit("message", { to: remoteSocketId, message });
      setMessages((prevMessages) => [
        ...prevMessages,
        { from: "me", text: message },
      ]);
      setMessage("");
    }
  };

  const handleReceiveMessage = useCallback((data) => {
    if (!data || typeof data.message !== "string") {
      console.warn("Received invalid message:", data);
      return;
    }

    setMessages((prevMessages) => [
      ...prevMessages,
      { from: "remote", text: data.message },
    ]);
  }, []);

  const handleEndCall = useCallback(() => {
    socket.emit("user:leave", { room: remoteSocketId });
    socket.emit("call:end", { to: remoteSocketId });
    socket.off("user:joined", handleUserJoined);
    socket.off("user:left", handleUserLeft);
    socket.off("incomming:call", handleIncommingCall);
    socket.off("call:accepted", handleCallAccepted);
    socket.off("peer:nego:needed", handleNegoNeedIncomming);
    socket.off("peer:nego:final", handleNegoNeedFinal);
    socket.off("message", handleReceiveMessage);

    if (myStream) {
      myStream.getTracks().forEach((track) => track.stop());
      setMyStream(null);
    }

    if (myScreen) {
      myScreen.getTracks().forEach((track) => track.stop());
      setMyScreen(null);
      setIsScreenSharing(false);
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      setRemoteStream(null);
    }

    setRemoteSocketId(null);
    setAddedTracks(new Set());
  }, [
    socket,
    handleUserJoined,
    handleUserLeft,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
    handleReceiveMessage,
    myStream,
    myScreen,
    remoteStream,
    remoteSocketId,
  ]);

  const handleCallEnded = useCallback(() => {
    if (myStream) {
      myStream.getTracks().forEach((track) => track.stop());
      setMyStream(null);
    }

    if (myScreen) {
      myScreen.getTracks().forEach((track) => track.stop());
      setMyScreen(null);
      setIsScreenSharing(false);
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      setRemoteStream(null);
    }

    setRemoteSocketId(null);
    setAddedTracks(new Set());
  }, [myStream, myScreen, remoteStream]);

  const toggleAudio = () => {
    if (myStream) {
      myStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = () => {
    if (myStream) {
      myStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoStopped(!isVideoStopped);
    }
  };

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("user:left", handleUserLeft);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);
    socket.on("message", handleReceiveMessage);
    socket.on("call:end", handleCallEnded);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("user:left", handleUserLeft);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
      socket.off("message", handleReceiveMessage);
      socket.off("call:end", handleCallEnded);
    };
  }, [
    socket,
    handleUserJoined,
    handleUserLeft,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
    handleReceiveMessage,
    handleCallEnded,
  ]);

  return (
    <div className="flex flex-col items-center justify-between min-h-screen w-screen bg-gray-100">
      <h1 className="text-3xl font-bold my-4">Video Call Room</h1>

      <div className="relative w-11/12 h-[70vh] bg-black">
        {/* Remote Stream - takes most of the screen */}
        {remoteStream && (
          <ReactPlayer
            playing
            url={remoteStream}
            width="100%"
            height="100%"
            className="absolute top-0 left-0 object-cover"
          />
        )}

        {/* My Stream - bottom right corner */}
        {myStream && (
          <div className="absolute bottom-4 right-4 w-48 h-32 shadow-lg border-2 border-white z-10">
            <ReactPlayer
              playing
              muted
              url={myStream}
              width="100%"
              height="100%"
              className="rounded"
            />
            <div className="absolute top-1 right-1 flex space-x-1">
              <button
                onClick={toggleAudio}
                className="bg-gray-800 text-white p-1 rounded-full text-xs"
              >
                <FontAwesomeIcon
                  icon={isAudioMuted ? faMicrophoneSlash : faMicrophone}
                />
              </button>
              <button
                onClick={toggleVideo}
                className="bg-gray-800 text-white p-1 rounded-full text-xs"
              >
                <FontAwesomeIcon
                  icon={isVideoStopped ? faVideoSlash : faVideo}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Button bar */}
      <div className="w-full bg-white py-3 px-4 flex flex-wrap justify-center gap-2 shadow-md">
        {userCount > 0 && !myStream && (
          <button
            onClick={handleCallUser}
            className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
          >
            Start Call
          </button>
        )}
        {userCount === 0 && !myStream && (
          <h4 className="text-red-500">No one in the room</h4>
        )}
        {myStream && (
          <>
            <button
              onClick={sendStreams}
              className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600"
            >
              Share My Stream
            </button>
            <button
              onClick={handleEndCall}
              className="bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600"
            >
              End Call
            </button>
            <button
              onClick={sendScreen}
              className="bg-purple-500 text-white py-2 px-4 rounded-md hover:bg-purple-600"
            >
              {isScreenSharing ? (
                <>
                  <FontAwesomeIcon icon={faStop} className="mr-2" />
                  Stop Sharing
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faDesktop} className="mr-2" />
                  Share Screen
                </>
              )}
            </button>
          </>
        )}
        {remoteSocketId && (
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="bg-yellow-500 text-white py-2 px-4 rounded-md hover:bg-yellow-600"
          >
            Chat
          </button>
        )}
      </div>

      {/* Connection status */}
      {!remoteSocketId && (
        <div className="flex items-center mb-4">
          <span
            className={`w-4 h-4 rounded-full mr-2 ${
              remoteSocketId ? "bg-green-500" : "bg-red-500"
            }`}
          ></span>
          <h4 className={remoteSocketId ? "text-green-500" : "text-red-500"}>
            {remoteSocketId ? "Connected" : "Waiting for someone to join..."}
          </h4>
        </div>
      )}

      {isChatOpen && (
        <div className="fixed bottom-4 right-4 w-[95%] md:w-[400px] h-[300px] bg-white shadow-2xl rounded-xl z-50 animate-slideUp flex flex-col">
          <h2 className="text-xl font-bold p-4 pb-2 border-b">Chat</h2>

          <ul
            id="messages"
            className="flex-1 overflow-y-auto px-4 py-2 space-y-2"
          >
            {messages.map((msg, index) => (
              <li
                key={index}
                className={`p-2 rounded-md max-w-[80%] break-words ${
                  msg.from === "me"
                    ? "bg-blue-100 text-right self-end ml-auto"
                    : "bg-gray-200 text-left self-start mr-auto"
                }`}
              >
                {msg.text}
              </li>
            ))}
          </ul>

          <div className="p-4 pt-2 border-t">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="flex-grow px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Type a message"
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              />
              <button
                onClick={sendMessage}
                className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomPage;
