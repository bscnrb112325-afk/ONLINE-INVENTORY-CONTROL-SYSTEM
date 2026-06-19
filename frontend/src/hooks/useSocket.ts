import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

// Create a single shared socket instance
// @ts-ignore
const socket: Socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
  transports: ['websocket'],
  withCredentials: true,
});

/**
 * Hook to listen to a Socket.IO event.
 * @param eventName Name of the socket event.
 * @param handler Callback invoked with the event payload.
 */
export const useSocket = (eventName: string, handler: (...args: any[]) => void) => {
  useEffect(() => {
    socket.on(eventName, handler);
    return () => {
      socket.off(eventName, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName, handler]);
};

export default useSocket;
