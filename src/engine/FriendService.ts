export interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline' | 'playing';
  lastOnline?: number;
  level?: number;
  highScore?: number;
  isFriend: boolean;
  requestStatus?: 'pending' | 'sent' | null;
}

export interface FriendRequest {
  id: string;
  fromId: string;
  fromName: string;
  fromAvatar: string;
  timestamp: number;
}

export interface FriendStats {
  totalFriends: number;
  onlineFriends: number;
  playingFriends: number;
  pendingRequests: number;
  sentRequests: number;
}

export class FriendService {
  private friends: Friend[] = [];
  private incomingRequests: FriendRequest[] = [];
  private outgoingRequests: FriendRequest[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFriends();
  }

  private loadFriends(): void {
    try {
      const saved = localStorage.getItem('friends');
      if (saved) {
        this.friends = JSON.parse(saved);
      } else {
        this.generateMockFriends();
        this.saveFriends();
      }

      const incoming = localStorage.getItem('friendRequests_incoming');
      if (incoming) {
        this.incomingRequests = JSON.parse(incoming);
      }

      const outgoing = localStorage.getItem('friendRequests_outgoing');
      if (outgoing) {
        this.outgoingRequests = JSON.parse(outgoing);
      }
    } catch {
      this.generateMockFriends();
    }
  }

  private saveFriends(): void {
    localStorage.setItem('friends', JSON.stringify(this.friends));
    localStorage.setItem('friendRequests_incoming', JSON.stringify(this.incomingRequests));
    localStorage.setItem('friendRequests_outgoing', JSON.stringify(this.outgoingRequests));
  }

  private generateMockFriends(): void {
    const mockPlayers = [
      { name: '星际猎人', avatar: '👤', level: 15, highScore: 125000 },
      { name: '银河守护者', avatar: '👽', level: 22, highScore: 230000 },
      { name: '宇宙先锋', avatar: '🚀', level: 8, highScore: 65000 },
      { name: '太空骑士', avatar: '🛡️', level: 30, highScore: 450000 },
      { name: '流星追猎者', avatar: '⭐', level: 12, highScore: 89000 },
      { name: '暗物质行者', avatar: '🌑', level: 18, highScore: 167000 },
      { name: '极光战士', avatar: '🌈', level: 25, highScore: 312000 },
      { name: '星尘漫游者', avatar: '✨', level: 6, highScore: 45000 },
    ];

    this.friends = mockPlayers.map((player, index) => ({
      id: `friend_${index + 1}`,
      ...player,
      status: this.getRandomStatus(),
      lastOnline: this.getRandomLastOnline(),
      isFriend: true,
    }));
  }

  private getRandomStatus(): Friend['status'] {
    const rand = Math.random();
    if (rand < 0.4) return 'online';
    if (rand < 0.6) return 'playing';
    return 'offline';
  }

  private getRandomLastOnline(): number {
    const now = Date.now();
    const hours = Math.floor(Math.random() * 24);
    return now - hours * 60 * 60 * 1000;
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    this.listeners.forEach((callback) => callback());
  }

  getFriends(filter: 'all' | 'online' | 'playing' | 'offline' = 'all'): Friend[] {
    let result = [...this.friends];
    switch (filter) {
      case 'online':
        result = result.filter((f) => f.status === 'online');
        break;
      case 'playing':
        result = result.filter((f) => f.status === 'playing');
        break;
      case 'offline':
        result = result.filter((f) => f.status === 'offline');
        break;
    }
    return result.sort((a, b) => {
      const statusOrder = { playing: 0, online: 1, offline: 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }

  getIncomingRequests(): FriendRequest[] {
    return [...this.incomingRequests].sort((a, b) => b.timestamp - a.timestamp);
  }

  getOutgoingRequests(): FriendRequest[] {
    return [...this.outgoingRequests].sort((a, b) => b.timestamp - a.timestamp);
  }

  getStats(): FriendStats {
    return {
      totalFriends: this.friends.length,
      onlineFriends: this.friends.filter((f) => f.status === 'online').length,
      playingFriends: this.friends.filter((f) => f.status === 'playing').length,
      pendingRequests: this.incomingRequests.length,
      sentRequests: this.outgoingRequests.length,
    };
  }

  async sendFriendRequest(playerId: string, playerName: string): Promise<boolean> {
    const existing = this.outgoingRequests.find((r) => r.fromId === playerId);
    if (existing) return false;

    const request: FriendRequest = {
      id: `req_${Date.now()}`,
      fromId: playerId,
      fromName: playerName,
      fromAvatar: '👤',
      timestamp: Date.now(),
    };

    this.outgoingRequests.push(request);
    this.saveFriends();
    this.notify();
    return true;
  }

  async acceptFriendRequest(requestId: string): Promise<boolean> {
    const request = this.incomingRequests.find((r) => r.id === requestId);
    if (!request) return false;

    const newFriend: Friend = {
      id: request.fromId,
      name: request.fromName,
      avatar: request.fromAvatar,
      status: 'online',
      isFriend: true,
    };

    this.friends.push(newFriend);
    this.incomingRequests = this.incomingRequests.filter((r) => r.id !== requestId);
    this.saveFriends();
    this.notify();
    return true;
  }

  async rejectFriendRequest(requestId: string): Promise<boolean> {
    const index = this.incomingRequests.findIndex((r) => r.id === requestId);
    if (index === -1) return false;

    this.incomingRequests.splice(index, 1);
    this.saveFriends();
    this.notify();
    return true;
  }

  async removeFriend(friendId: string): Promise<boolean> {
    const index = this.friends.findIndex((f) => f.id === friendId);
    if (index === -1) return false;

    this.friends.splice(index, 1);
    this.saveFriends();
    this.notify();
    return true;
  }

  async cancelFriendRequest(requestId: string): Promise<boolean> {
    const index = this.outgoingRequests.findIndex((r) => r.id === requestId);
    if (index === -1) return false;

    this.outgoingRequests.splice(index, 1);
    this.saveFriends();
    this.notify();
    return true;
  }

  async searchFriends(query: string): Promise<Friend[]> {
    const mockResults = [
      { id: 'search_1', name: '星际猎人', avatar: '👤', status: 'online' as const, isFriend: false },
      { id: 'search_2', name: '银河守护者', avatar: '👽', status: 'playing' as const, isFriend: false },
      { id: 'search_3', name: '宇宙探险家', avatar: '🔭', status: 'offline' as const, isFriend: false },
    ];

    return mockResults.filter((f) =>
      f.name.toLowerCase().includes(query.toLowerCase()),
    );
  }

  formatLastOnline(timestamp?: number): string {
    if (!timestamp) return '未知';

    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return new Date(timestamp).toLocaleDateString();
  }

  getStatusLabel(status: Friend['status']): string {
    const labels: Record<Friend['status'], string> = {
      online: '在线',
      offline: '离线',
      playing: '游戏中',
    };
    return labels[status];
  }

  getStatusColor(status: Friend['status']): string {
    const colors: Record<Friend['status'], string> = {
      online: '#4aff8a',
      offline: '#6b7280',
      playing: '#4a9eff',
    };
    return colors[status];
  }
}
