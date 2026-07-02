export type ConnectionState =
  'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export type PlayerRole = 'host' | 'client';

export type NetworkMessageType =
  | 'join'
  | 'leave'
  | 'player_update'
  | 'game_state'
  | 'chat'
  | 'ping'
  | 'pong'
  | 'sync_request'
  | 'sync_response'
  | 'event';

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  health?: number;
  score?: number;
  isReady?: boolean;
  color?: string;
  lastUpdate?: number;
}

export interface NetworkMessage {
  type: NetworkMessageType;
  senderId: string;
  timestamp: number;
  payload: unknown;
  sequenceNumber?: number;
}

export interface JoinPayload {
  playerName: string;
  playerId: string;
  roomId: string;
  version: string;
}

export interface LeavePayload {
  playerId: string;
  reason: 'left' | 'kicked' | 'disconnected';
}

export interface PlayerUpdatePayload {
  playerId: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  velocity?: { x: number; y: number; z: number };
  state: 'idle' | 'moving' | 'attacking' | 'dead';
  health?: number;
  timestamp: number;
}

export interface GameStatePayload {
  wave: number;
  score: number;
  gameTime: number;
  isPaused: boolean;
  hostId: string;
}

export interface ChatPayload {
  playerId: string;
  playerName: string;
  message: string;
}

export interface SyncRequestPayload {
  requestingPlayerId: string;
  lastKnownState: GameStatePayload;
}

export interface SyncResponsePayload {
  currentState: GameStatePayload;
  currentPlayers: Player[];
}

export interface EventPayload {
  eventType: string;
  eventData: unknown;
  sourcePlayerId: string;
}

export interface RoomInfo {
  roomId: string;
  hostId: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  gameMode: string;
  isPrivate: boolean;
  createdAt: number;
}

export interface ConnectionConfig {
  signalingServer: string;
  stunServers: string[];
  turnServers?: { url: string; username: string; credential: string }[];
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  timeout: number;
}

export interface MultiplayerStats {
  packetsSent: number;
  packetsReceived: number;
  bytesSent: number;
  bytesReceived: number;
  latency: number;
  packetLoss: number;
  jitter: number;
}

type ConnectionCallback = (state: ConnectionState) => void;
type PlayerCallback = (player: Player) => void;
type MessageCallback = (message: NetworkMessage) => void;
type GameStateCallback = (state: GameStatePayload) => void;
type ChatCallback = (chat: ChatPayload) => void;
type RoomCallback = (room: RoomInfo) => void;

export class MultiplayerSystem {
  private connectionState: ConnectionState = 'disconnected';
  private playerRole: PlayerRole = 'client';
  private localPlayerId: string = '';
  private localPlayerName: string = '';
  private roomId: string = '';
  private players: Map<string, Player> = new Map();
  private hostId: string = '';

  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private webSocket: WebSocket | null = null;

  private config: ConnectionConfig;
  private stats: MultiplayerStats = {
    packetsSent: 0,
    packetsReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
    latency: 0,
    packetLoss: 0,
    jitter: 0,
  };

  private sequenceNumber: number = 0;
  private messageQueue: NetworkMessage[] = [];
  private pendingReliableMessages: Map<number, { message: NetworkMessage; ack: boolean }> =
    new Map();

  private reconnectAttempts: number = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private pingTimestamp: number = 0;

  private callbacks: {
    connectionStateChange: ConnectionCallback[];
    playerJoin: PlayerCallback[];
    playerLeave: PlayerCallback[];
    playerUpdate: PlayerCallback[];
    messageReceived: MessageCallback[];
    gameStateChange: GameStateCallback[];
    chatReceived: ChatCallback[];
    roomUpdate: RoomCallback[];
    statsUpdate: ((stats: MultiplayerStats) => void)[];
  } = {
    connectionStateChange: [],
    playerJoin: [],
    playerLeave: [],
    playerUpdate: [],
    messageReceived: [],
    gameStateChange: [],
    chatReceived: [],
    roomUpdate: [],
    statsUpdate: [],
  };

  private isEnabled: boolean = true;
  private isDestroyed: boolean = false;

  constructor(config?: Partial<ConnectionConfig>) {
    this.config = {
      signalingServer: config?.signalingServer || 'wss://signaling.example.com',
      stunServers: config?.stunServers || ['stun:stun.l.google.com:19302'],
      turnServers: config?.turnServers,
      reconnectInterval: config?.reconnectInterval || 3000,
      maxReconnectAttempts: config?.maxReconnectAttempts || 5,
      heartbeatInterval: config?.heartbeatInterval || 2000,
      timeout: config?.timeout || 10000,
    };

    this.localPlayerId = this.generatePlayerId();
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public getLocalPlayerId(): string {
    return this.localPlayerId;
  }

  public getLocalPlayerName(): string {
    return this.localPlayerName;
  }

  public getPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  public getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  public getRoomId(): string {
    return this.roomId;
  }

  public getStats(): MultiplayerStats {
    return { ...this.stats };
  }

  public async createRoom(
    playerName: string,
    maxPlayers: number = 4,
    isPrivate: boolean = false,
  ): Promise<string> {
    if (this.connectionState !== 'disconnected') {
      throw new Error('Already connected');
    }

    this.localPlayerName = playerName;
    this.playerRole = 'host';
    this.roomId = this.generateRoomId();

    this.setConnectionState('connecting');

    try {
      await this.connectToSignaling();

      const roomInfo: RoomInfo = {
        roomId: this.roomId,
        hostId: this.localPlayerId,
        hostName: playerName,
        playerCount: 1,
        maxPlayers,
        gameMode: 'deathmatch',
        isPrivate,
        createdAt: Date.now(),
      };

      this.sendSignalingMessage({
        type: 'create_room',
        room: roomInfo,
      });

      const hostPlayer: Player = {
        id: this.localPlayerId,
        name: playerName,
        role: 'host',
        isReady: true,
        color: this.generatePlayerColor(),
      };

      this.players.set(this.localPlayerId, hostPlayer);
      this.hostId = this.localPlayerId;

      this.setConnectionState('connected');
      this.startHeartbeat();
      this.notifyPlayerJoin(hostPlayer);
      this.notifyRoomUpdate(roomInfo);

      return this.roomId;
    } catch (error) {
      this.setConnectionState('failed');
      throw error;
    }
  }

  public async joinRoom(roomId: string, playerName: string): Promise<void> {
    if (this.connectionState !== 'disconnected') {
      throw new Error('Already connected');
    }

    this.localPlayerName = playerName;
    this.playerRole = 'client';
    this.roomId = roomId;

    this.setConnectionState('connecting');

    try {
      await this.connectToSignaling();

      this.sendSignalingMessage({
        type: 'join_room',
        roomId,
        player: {
          id: this.localPlayerId,
          name: playerName,
        },
      });
    } catch (error) {
      this.setConnectionState('failed');
      throw error;
    }
  }

  public leaveRoom(): void {
    if (this.connectionState === 'disconnected') return;

    this.sendMessage({
      type: 'leave',
      senderId: this.localPlayerId,
      timestamp: Date.now(),
      payload: {
        playerId: this.localPlayerId,
        reason: 'left',
      } as LeavePayload,
    });

    this.cleanup();
    this.setConnectionState('disconnected');
  }

  private async connectToSignaling(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.timeout);

      this.webSocket = new WebSocket(this.config.signalingServer);

      this.webSocket.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };

      this.webSocket.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket error'));
      };

      this.webSocket.onmessage = (event) => {
        this.handleSignalingMessage(JSON.parse(event.data));
      };

      this.webSocket.onclose = () => {
        this.handleDisconnect();
      };
    });
  }

  private handleSignalingMessage(message: Record<string, unknown>): void {
    switch (message.type) {
      case 'room_created':
        break;

      case 'room_joined':
        this.hostId = message.hostId as string;
        this.roomId = message.roomId as string;
        (message.players as Player[] | undefined)?.forEach((p: Player) => {
          this.players.set(p.id, p);
          if (p.id !== this.localPlayerId) {
            this.notifyPlayerJoin(p);
            this.createPeerConnection(p.id);
          }
        });
        this.setConnectionState('connected');
        this.startHeartbeat();
        break;

      case 'player_joined':
        const player = message.player as { id: string; name: string };
        const newPlayer: Player = {
          id: player.id,
          name: player.name,
          role: 'client',
          color: this.generatePlayerColor(),
        };
        this.players.set(newPlayer.id, newPlayer);
        this.notifyPlayerJoin(newPlayer);

        if (this.playerRole === 'host') {
          this.createPeerConnection(newPlayer.id);
        }
        break;

      case 'player_left':
        this.handlePlayerLeave(message.playerId as string, message.reason as string);
        break;

      case 'offer':
        this.handleOffer(message.senderId as string, message.offer as RTCSessionDescriptionInit);
        break;

      case 'answer':
        this.handleAnswer(message.senderId as string, message.answer as RTCSessionDescriptionInit);
        break;

      case 'ice_candidate':
        this.handleIceCandidate(
          message.senderId as string,
          message.candidate as RTCIceCandidateInit,
        );
        break;

      case 'error':
        console.error('Signaling error:', message.error);
        break;
    }
  }

  private async createPeerConnection(peerId: string): Promise<RTCPeerConnection> {
    const config: RTCConfiguration = {
      iceServers: [
        ...this.config.stunServers.map((url) => ({ urls: url })),
        ...(this.config.turnServers || []).map((server) => ({
          urls: server.url,
          username: server.username,
          credential: server.credential,
        })),
      ],
    };

    const pc = new RTCPeerConnection(config);
    this.peerConnections.set(peerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'ice_candidate',
          targetId: peerId,
          candidate: event.candidate,
        });
      }
    };

    pc.ondatachannel = (event) => {
      this.handleDataChannel(peerId, event.channel);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        this.reconnectPeer(peerId);
      }
    };

    if (this.playerRole === 'host') {
      const dataChannel = pc.createDataChannel('game', {
        ordered: true,
      });
      this.setupDataChannel(peerId, dataChannel);
    }

    return pc;
  }

  private setupDataChannel(peerId: string, channel: RTCDataChannel): void {
    channel.onopen = () => {
      this.dataChannels.set(peerId, channel);
      if (this.playerRole === 'client') {
        this.requestSync();
      }
    };

    channel.onmessage = (event) => {
      this.handleDataMessage(peerId, event.data);
    };

    channel.onclose = () => {
      this.dataChannels.delete(peerId);
    };
  }

  private handleDataChannel(peerId: string, channel: RTCDataChannel): void {
    this.setupDataChannel(peerId, channel);
  }

  private async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const pc = await this.createPeerConnection(peerId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignalingMessage({
      type: 'answer',
      targetId: peerId,
      answer,
    });
  }

  private async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  private async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private async reconnectPeer(peerId: string): Promise<void> {
    const oldPc = this.peerConnections.get(peerId);
    if (oldPc) {
      oldPc.close();
    }

    await this.createPeerConnection(peerId);

    if (this.playerRole === 'host') {
      const pc = this.peerConnections.get(peerId);
      if (pc) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.sendSignalingMessage({
          type: 'offer',
          targetId: peerId,
          offer,
        });
      }
    }
  }

  private handleDataMessage(senderId: string, data: unknown): void {
    this.stats.packetsReceived++;
    const dataObj = data as { byteLength?: number; length?: number };
    this.stats.bytesReceived += dataObj.byteLength || dataObj.length;

    let message: NetworkMessage;
    try {
      message = typeof data === 'string' ? JSON.parse(data) : (data as NetworkMessage);
    } catch {
      console.error('Failed to parse message');
      return;
    }

    this.callbacks.messageReceived.forEach((cb) => cb(message));

    switch (message.type) {
      case 'join':
        this.handleJoin(message.payload as JoinPayload);
        break;
      case 'leave':
        this.handleLeave(message.payload as LeavePayload);
        break;
      case 'player_update':
        this.handlePlayerUpdate(message.payload as PlayerUpdatePayload);
        break;
      case 'game_state':
        this.handleGameState(message.payload as GameStatePayload);
        break;
      case 'chat':
        this.handleChat(message.payload as ChatPayload);
        break;
      case 'ping':
        this.sendMessage({
          type: 'pong',
          senderId: this.localPlayerId,
          timestamp: Date.now(),
          payload: {},
        });
        break;
      case 'pong':
        this.stats.latency = Date.now() - this.pingTimestamp;
        break;
      case 'sync_request':
        this.handleSyncRequest(message.payload as SyncRequestPayload);
        break;
      case 'sync_response':
        this.handleSyncResponse(message.payload as SyncResponsePayload);
        break;
      case 'event':
        this.handleEvent(message.payload as EventPayload);
        break;
    }
  }

  private handleJoin(payload: JoinPayload): void {
    const player = this.players.get(payload.playerId);
    if (player) {
      player.isReady = true;
      this.notifyPlayerUpdate(player);
    }
  }

  private handleLeave(payload: LeavePayload): void {
    this.handlePlayerLeave(payload.playerId, payload.reason);
  }

  private handlePlayerUpdate(payload: PlayerUpdatePayload): void {
    const player = this.players.get(payload.playerId);
    if (player) {
      player.position = payload.position;
      player.rotation = payload.rotation;
      player.health = payload.health;
      player.lastUpdate = Date.now();
      this.notifyPlayerUpdate(player);
    }
  }

  private handleGameState(payload: GameStatePayload): void {
    this.notifyGameStateChange(payload);
  }

  private handleChat(payload: ChatPayload): void {
    this.notifyChatReceived(payload);
  }

  private handleSyncRequest(_payload: SyncRequestPayload): void {
    if (this.playerRole !== 'host') return;
  }

  private handleSyncResponse(payload: SyncResponsePayload): void {
    payload.currentPlayers?.forEach((p) => {
      this.players.set(p.id, p);
    });
    if (payload.currentState) {
      this.notifyGameStateChange(payload.currentState);
    }
  }

  private handleEvent(_payload: EventPayload): void {}

  private handlePlayerLeave(playerId: string, _reason: string): void {
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);
      this.notifyPlayerLeave(player);
    }

    const pc = this.peerConnections.get(playerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(playerId);
    }

    const channel = this.dataChannels.get(playerId);
    if (channel) {
      channel.close();
      this.dataChannels.delete(playerId);
    }
  }

  private handleDisconnect(): void {
    if (this.isDestroyed) return;

    this.setConnectionState('reconnecting');

    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.reconnectTimer = window.setTimeout(() => {
        this.attemptReconnect();
      }, this.config.reconnectInterval);
    } else {
      this.setConnectionState('failed');
    }
  }

  private async attemptReconnect(): Promise<void> {
    try {
      await this.connectToSignaling();
      this.reconnectAttempts = 0;
      this.setConnectionState('connected');
      this.startHeartbeat();
    } catch {
      this.handleDisconnect();
    }
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();

    this.dataChannels.clear();

    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }

    this.players.clear();
    this.pendingReliableMessages.clear();
    this.messageQueue = [];
  }

  public sendMessage(message: NetworkMessage): void {
    if (this.connectionState !== 'connected') return;

    message.senderId = this.localPlayerId;
    message.timestamp = Date.now();
    message.sequenceNumber = this.sequenceNumber++;

    const data = JSON.stringify(message);

    if (this.playerRole === 'host') {
      this.dataChannels.forEach((channel) => {
        if (channel.readyState === 'open') {
          channel.send(data);
          this.stats.packetsSent++;
          this.stats.bytesSent += data.length;
        }
      });
    } else {
      this.dataChannels.forEach((channel) => {
        if (channel.readyState === 'open') {
          channel.send(data);
          this.stats.packetsSent++;
          this.stats.bytesSent += data.length;
        }
      });
    }
  }

  public broadcastPlayerUpdate(
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number },
    state: string,
    health?: number,
  ): void {
    this.sendMessage({
      type: 'player_update',
      senderId: this.localPlayerId,
      timestamp: Date.now(),
      payload: {
        playerId: this.localPlayerId,
        position,
        rotation,
        state,
        health,
        timestamp: Date.now(),
      } as PlayerUpdatePayload,
    });
  }

  public broadcastGameState(state: GameStatePayload): void {
    if (this.playerRole !== 'host') return;

    this.sendMessage({
      type: 'game_state',
      senderId: this.localPlayerId,
      timestamp: Date.now(),
      payload: state,
    });
  }

  public sendChat(message: string): void {
    this.sendMessage({
      type: 'chat',
      senderId: this.localPlayerId,
      timestamp: Date.now(),
      payload: {
        playerId: this.localPlayerId,
        playerName: this.localPlayerName,
        message,
      } as ChatPayload,
    });
  }

  public broadcastEvent(eventType: string, eventData: unknown): void {
    this.sendMessage({
      type: 'event',
      senderId: this.localPlayerId,
      timestamp: Date.now(),
      payload: {
        eventType,
        eventData,
        sourcePlayerId: this.localPlayerId,
      } as EventPayload,
    });
  }

  public requestSync(): void {
    this.sendMessage({
      type: 'sync_request',
      senderId: this.localPlayerId,
      timestamp: Date.now(),
      payload: {
        requestingPlayerId: this.localPlayerId,
        lastKnownState: {},
      } as SyncRequestPayload,
    });
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = window.setInterval(() => {
      this.pingTimestamp = Date.now();
      this.sendMessage({
        type: 'ping',
        senderId: this.localPlayerId,
        timestamp: Date.now(),
        payload: {},
      });
    }, this.config.heartbeatInterval);
  }

  private sendSignalingMessage(message: unknown): void {
    if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
      this.webSocket.send(JSON.stringify(message));
    }
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) return;

    this.connectionState = state;
    this.callbacks.connectionStateChange.forEach((cb) => cb(state));
  }

  private generatePlayerId(): string {
    return 'player_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }

  private generateRoomId(): string {
    return 'room_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }

  private generatePlayerColor(): string {
    const colors = [
      '#ff6b6b',
      '#4ecdc4',
      '#45b7d1',
      '#96ceb4',
      '#ffeaa7',
      '#dfe6e9',
      '#a29bfe',
      '#fd79a8',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  public onConnectionStateChange(callback: ConnectionCallback): () => void {
    this.callbacks.connectionStateChange.push(callback);
    return () => {
      const index = this.callbacks.connectionStateChange.indexOf(callback);
      if (index > -1) this.callbacks.connectionStateChange.splice(index, 1);
    };
  }

  public onPlayerJoin(callback: PlayerCallback): () => void {
    this.callbacks.playerJoin.push(callback);
    return () => {
      const index = this.callbacks.playerJoin.indexOf(callback);
      if (index > -1) this.callbacks.playerJoin.splice(index, 1);
    };
  }

  public onPlayerLeave(callback: PlayerCallback): () => void {
    this.callbacks.playerLeave.push(callback);
    return () => {
      const index = this.callbacks.playerLeave.indexOf(callback);
      if (index > -1) this.callbacks.playerLeave.splice(index, 1);
    };
  }

  public onPlayerUpdate(callback: PlayerCallback): () => void {
    this.callbacks.playerUpdate.push(callback);
    return () => {
      const index = this.callbacks.playerUpdate.indexOf(callback);
      if (index > -1) this.callbacks.playerUpdate.splice(index, 1);
    };
  }

  public onMessageReceived(callback: MessageCallback): () => void {
    this.callbacks.messageReceived.push(callback);
    return () => {
      const index = this.callbacks.messageReceived.indexOf(callback);
      if (index > -1) this.callbacks.messageReceived.splice(index, 1);
    };
  }

  public onGameStateChange(callback: GameStateCallback): () => void {
    this.callbacks.gameStateChange.push(callback);
    return () => {
      const index = this.callbacks.gameStateChange.indexOf(callback);
      if (index > -1) this.callbacks.gameStateChange.splice(index, 1);
    };
  }

  public onChatReceived(callback: ChatCallback): () => void {
    this.callbacks.chatReceived.push(callback);
    return () => {
      const index = this.callbacks.chatReceived.indexOf(callback);
      if (index > -1) this.callbacks.chatReceived.splice(index, 1);
    };
  }

  public onRoomUpdate(callback: RoomCallback): () => void {
    this.callbacks.roomUpdate.push(callback);
    return () => {
      const index = this.callbacks.roomUpdate.indexOf(callback);
      if (index > -1) this.callbacks.roomUpdate.splice(index, 1);
    };
  }

  private notifyPlayerJoin(player: Player): void {
    this.callbacks.playerJoin.forEach((cb) => cb(player));
  }

  private notifyPlayerLeave(player: Player): void {
    this.callbacks.playerLeave.forEach((cb) => cb(player));
  }

  private notifyPlayerUpdate(player: Player): void {
    this.callbacks.playerUpdate.forEach((cb) => cb(player));
  }

  private notifyGameStateChange(state: GameStatePayload): void {
    this.callbacks.gameStateChange.forEach((cb) => cb(state));
  }

  private notifyChatReceived(chat: ChatPayload): void {
    this.callbacks.chatReceived.forEach((cb) => cb(chat));
  }

  private notifyRoomUpdate(room: RoomInfo): void {
    this.callbacks.roomUpdate.forEach((cb) => cb(room));
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.cleanup();
    this.callbacks = {
      connectionStateChange: [],
      playerJoin: [],
      playerLeave: [],
      playerUpdate: [],
      messageReceived: [],
      gameStateChange: [],
      chatReceived: [],
      roomUpdate: [],
      statsUpdate: [],
    };
  }
}
