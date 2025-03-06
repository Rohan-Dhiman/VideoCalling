import React, { createContext, useContext, useMemo } from 'react';
import {io} from 'socket.io-client';
const SocketContext = createContext(null);

export const useSocket = () =>{
    const Socket = useContext(SocketContext);
    return Socket;
}

export const SocketProvider = (props) => {
    const Socket = useMemo(()=>io('localhost:8000'), [])
  return (
    <SocketContext.Provider value={Socket}>
        {props.children}
    </SocketContext.Provider>
  )
}
