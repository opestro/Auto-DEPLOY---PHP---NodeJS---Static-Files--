import { ref, onMounted, onUnmounted } from 'vue';
import { io } from 'socket.io-client';

let globalSocket = null;

export function useSocket() {
  const socket = ref(null);

  onMounted(() => {
    if (!globalSocket) {
      globalSocket = io('http://localhost:3001', {
        transports: ['websocket'],
        autoConnect: true
      });

      globalSocket.on('connect', () => {
        console.log('Socket connected');
        globalSocket.removeAllListeners('log');
      });
    }
    socket.value = globalSocket;
  });

  onUnmounted(() => {
    if (socket.value) {
      socket.value.off('log');
    }
  });

  return socket;
}