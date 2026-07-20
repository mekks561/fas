import { Server } from 'socket.io';
export interface RoomPlayer {
 socketId: string;
 userId: string;
 username: string;
 avatar: string;
 ready: boolean;
 score: number;
 kills: number;
 wave: number;
}
export interface Room {
 id: string;
 name: string;
 maxPlayers: number;
 players: Map<string, RoomPlayer>;
 status: 'waiting' | 'starting' | 'playing' | 'finished';
 gameMode: 'deathmatch' | 'team_deathmatch' | 'coop';
 map: string;
 countdown: number;
 startTime?: number;
 endTime?: number;
}
export interface MatchmakingQueue {
 userId: string;
 socketId: string;
 username: string;
 avatar: string;
 gameMode: string;
 joinedAt: number;
}
export class RoomService {
 private rooms: Map<string, Room> = new Map();
 private matchmakingQueues: Map<string, MatchmakingQueue[]> = new Map();
 private queueInterval: NodeJS.Timeout | null = null;
 private io: Server;
 constructor(io: Server) {
 this.io = io;
 this.startQueueProcessor();
 }
 public createRoom(options: {
 id?: string;
 name?: string;
 maxPlayers?: number;
 gameMode?: 'deathmatch' | 'team_deathmatch' | 'coop';
 map?: string;
 }): Room {
 const roomId = options.id || `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
 const room: Room = {
 id: roomId,
 name: options.name || `房间 ${roomId.slice(-8)}`,
 maxPlayers: options.maxPlayers || 4,
 players: new Map(),
 status: 'waiting',
 gameMode: options.gameMode || 'deathmatch',
 map: options.map || 'space_arena',
 countdown: 0,
 };
 this.rooms.set(roomId, room);
 return room;
 }
 public joinRoom(roomId: string, player: Omit<RoomPlayer, 'ready' | 'score' | 'kills' | 'wave'>): boolean {
 const room = this.rooms.get(roomId);
 if (!room)
 return false;
 if (room.status !== 'waiting')
 return false;
 if (room.players.size >= room.maxPlayers)
 return false;
 const roomPlayer: RoomPlayer = {
 ...player,
 ready: false,
 score: 0,
 kills: 0,
 wave: 1,
 };
 room.players.set(player.socketId, roomPlayer);
 this.io.to(roomId).emit('room:player_joined', roomPlayer);
 return true;
 }
 public leaveRoom(roomId: string, socketId: string): boolean {
 const room = this.rooms.get(roomId);
 if (!room)
 return false;
 const player = room.players.get(socketId);
 if (!player)
 return false;
 room.players.delete(socketId);
 this.io.to(roomId).emit('room:player_left', { socketId, userId: player.userId });
 if (room.players.size === 0) {
 this.destroyRoom(roomId);
 }
 return true;
 }
 public destroyRoom(roomId: string): void {
 const room = this.rooms.get(roomId);
 if (!room)
 return;
 this.io.to(roomId).emit('room:destroyed');
 this.rooms.delete(roomId);
 }
 public setPlayerReady(roomId: string, socketId: string, ready: boolean): boolean {
 const room = this.rooms.get(roomId);
 if (!room)
 return false;
 const player = room.players.get(socketId);
 if (!player)
 return false;
 player.ready = ready;
 this.io.to(roomId).emit('room:player_ready', { socketId, ready });
 this.checkAllReady(room);
 return true;
 }
 private checkAllReady(room: Room): void {
 if (room.status !== 'waiting')
 return;
 const players = Array.from(room.players.values());
 if (players.length < 2)
 return;
 const allReady = players.every(p => p.ready);
 if (allReady) {
 this.startGame(room);
 }
 }
 public startGame(room: Room): void {
 if (room.status !== 'waiting')
 return;
 room.status = 'starting';
 room.countdown = 3;
 this.io.to(room.id).emit('room:starting', { countdown: 3 });
 const countdownInterval = setInterval(() => {
 room.countdown--;
 if (room.countdown > 0) {
 this.io.to(room.id).emit('room:countdown', room.countdown);
 }
 else {
 clearInterval(countdownInterval);
 room.status = 'playing';
 room.startTime = Date.now();
 this.io.to(room.id).emit('room:started', {
 startTime: room.startTime,
 gameMode: room.gameMode,
 map: room.map,
 });
 }
 }, 1000);
 }
 public endGame(roomId: string): void {
 const room = this.rooms.get(roomId);
 if (!room)
 return;
 room.status = 'finished';
 room.endTime = Date.now();
 const results = Array.from(room.players.values())
 .map(p => ({
 userId: p.userId,
 username: p.username,
 score: p.score,
 kills: p.kills,
 wave: p.wave,
 }))
 .sort((a, b) => b.score - a.score);
 this.io.to(roomId).emit('room:finished', {
 endTime: room.endTime,
 duration: room.startTime ? (room.endTime - room.startTime) / 1000 : 0,
 results,
 });
 }
 public updatePlayerScore(roomId: string, socketId: string, update: {
 score?: number;
 kills?: number;
 wave?: number;
 }): void {
 const room = this.rooms.get(roomId);
 if (!room)
 return;
 const player = room.players.get(socketId);
 if (!player)
 return;
 if (update.score !== undefined)
 player.score = update.score;
 if (update.kills !== undefined)
 player.kills = update.kills;
 if (update.wave !== undefined)
 player.wave = update.wave;
 this.io.to(roomId).emit('room:player_score_update', {
 socketId,
 updates: update,
 });
 }
 public joinMatchmaking(gameMode: string, player: {
 userId: string;
 socketId: string;
 username: string;
 avatar: string;
 }): void {
 if (!this.matchmakingQueues.has(gameMode)) {
 this.matchmakingQueues.set(gameMode, []);
 }
 const queue = this.matchmakingQueues.get(gameMode);
    if (!queue) return;
    queue.push({
      ...player,
      gameMode,
      joinedAt: Date.now(),
    });
 this.io.to(player.socketId).emit('matchmaking:queued', {
 gameMode,
 position: queue.length,
 });
 }
 public leaveMatchmaking(gameMode: string, socketId: string): void {
 const queue = this.matchmakingQueues.get(gameMode);
 if (!queue)
 return;
 const index = queue.findIndex(q => q.socketId === socketId);
 if (index >= 0) {
 queue.splice(index, 1);
 }
 }
 private startQueueProcessor(): void {
 this.queueInterval = setInterval(() => {
 this.matchmakingQueues.forEach((queue, gameMode) => {
 if (queue.length >= 2) {
 this.matchPlayers(gameMode, queue);
 }
 });
 }, 1000);
 }
 private matchPlayers(gameMode: string, queue: MatchmakingQueue[]): void {
 const maxPlayers = gameMode === 'team_deathmatch' ? 4 : 2;
 const playersToMatch = queue.splice(0, maxPlayers);
 if (playersToMatch.length < 2) {
 queue.unshift(...playersToMatch);
 return;
 }
 const room = this.createRoom({
 gameMode: gameMode as 'deathmatch' | 'team_deathmatch' | 'coop',
 maxPlayers,
 });
 playersToMatch.forEach((queuePlayer) => {
 this.joinRoom(room.id, {
 socketId: queuePlayer.socketId,
 userId: queuePlayer.userId,
 username: queuePlayer.username,
 avatar: queuePlayer.avatar,
 });
 this.io.to(queuePlayer.socketId).emit('matchmaking:matched', {
 roomId: room.id,
 roomName: room.name,
 players: playersToMatch.map(p => ({
 userId: p.userId,
 username: p.username,
 avatar: p.avatar,
 })),
 });
 });
 }
 public getRoom(roomId: string): Room | undefined {
 return this.rooms.get(roomId);
 }
 public getRooms(gameMode?: string): Room[] {
 return Array.from(this.rooms.values()).filter(room => !gameMode || room.gameMode === gameMode);
 }
 public getWaitingRooms(gameMode?: string): Room[] {
 return this.getRooms(gameMode).filter(room => room.status === 'waiting');
 }
 public getQueueSize(gameMode: string): number {
 return this.matchmakingQueues.get(gameMode)?.length || 0;
 }
 public getStats(): {
 totalRooms: number;
 waitingRooms: number;
 playingRooms: number;
 totalPlayers: number;
 queueSizes: Record<string, number>;
 } {
 let totalPlayers = 0;
 let waitingRooms = 0;
 let playingRooms = 0;
 this.rooms.forEach((room) => {
 totalPlayers += room.players.size;
 if (room.status === 'waiting')
 waitingRooms++;
 if (room.status === 'playing')
 playingRooms++;
 });
 const queueSizes: Record<string, number> = {};
 this.matchmakingQueues.forEach((queue, gameMode) => {
 queueSizes[gameMode] = queue.length;
 });
 return {
 totalRooms: this.rooms.size,
 waitingRooms,
 playingRooms,
 totalPlayers,
 queueSizes,
 };
 }
 public cleanup(): void {
 if (this.queueInterval) {
 clearInterval(this.queueInterval);
 }
 this.rooms.clear();
 this.matchmakingQueues.clear();
 }
}
