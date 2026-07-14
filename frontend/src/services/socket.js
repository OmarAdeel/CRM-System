/**
 * Socket.io Client Service
 * Manages real-time WebSocket connection to the backend.
 * - Connects on login, disconnects on logout
 * - Joins a user-specific room for targeted notifications
 * - Exposes a subscribe() method for components to listen to events
 *
 * Events emitted by the server:
 *   - deal:created    { id, title }
 *   - deal:updated    { id }
 *   - deal:moved      { id, stage_id }
 *   - activity:created { id, activity_type, contact_id, deal_id }
 *   - notification    { title, message, type }
 */

import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

let socket = null;
let listeners = new Map(); // event -> Set of callbacks

function connect(token, userId) {
  if (socket && socket.connected) return;

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    auth: { token },
  });

  socket.on('connect', () => {
    console.log('⚡ Socket.io connected:', socket.id);
    if (userId) {
      socket.emit('join', userId);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket.io disconnected');
  });

  socket.on('connect_error', (err) => {
    console.error('Socket.io connection error:', err.message);
  });

  // Forward all known events to registered listeners
  const knownEvents = [
    'deal:created',
    'deal:updated',
    'deal:moved',
    'activity:created',
    'notification',
  ];

  knownEvents.forEach((event) => {
    socket.on(event, (data) => {
      // Call all registered callbacks for this event
      const callbacks = listeners.get(event);
      if (callbacks) {
        callbacks.forEach((cb) => cb(data));
      }
    });
  });

  // Show toast notifications for key events
  socket.on('deal:created', (data) => {
    toast.success(`New deal: ${data.title || 'Untitled'}`, { icon: '💼' });
  });

  socket.on('notification', (data) => {
    if (data.type === 'success') {
      toast.success(data.message || data.title);
    } else if (data.type === 'warning') {
      toast(data.message || data.title, { icon: '⚠️' });
    } else {
      toast(data.message || data.title, { icon: '🔔' });
    }
  });
}

function disconnect() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  listeners.clear();
}

/**
 * Subscribe to a socket event.
 * @param {string} event - Event name (e.g., 'deal:created')
 * @param {function} callback - Called with the event payload
 * @returns {function} Unsubscribe function
 */
function subscribe(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);

  return () => {
    const callbacks = listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) listeners.delete(event);
    }
  };
}

/**
 * Emit an event to the server.
 */
function emit(event, data) {
  if (socket && socket.connected) {
    socket.emit(event, data);
  }
}

function isConnected() {
  return socket && socket.connected;
}

export default {
  connect,
  disconnect,
  subscribe,
  emit,
  isConnected,
};
