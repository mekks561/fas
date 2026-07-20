import React, { useState, useEffect, useMemo } from 'react';
import { Users, UserPlus, Search, Check, X, Send, RefreshCw, MessageCircle } from 'lucide-react';
import { FriendService, Friend, FriendRequest } from '../engine/FriendService';
import './FriendPanel.css';

interface FriendPanelProps {
  onBack: () => void;
  service: FriendService;
}

type TabType = 'friends' | 'requests' | 'search';

const filterLabels: Record<string, string> = {
  all: '全部',
  online: '在线',
  playing: '游戏中',
  offline: '离线',
};

export const FriendPanel: React.FC<FriendPanelProps> = React.memo(({ onBack, service }) => {
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [_updateTrigger, setUpdateTrigger] = useState({});

  useEffect(() => {
    const unsub = service.subscribe(() => setUpdateTrigger({}));
    return unsub;
  }, [service]);

  const friends = useMemo(() => service.getFriends(filter as 'all' | 'online' | 'playing' | 'offline'), [service, filter]);
  const incomingRequests = useMemo(() => service.getIncomingRequests(), [service]);
  const outgoingRequests = useMemo(() => service.getOutgoingRequests(), [service]);
  const stats = useMemo(() => service.getStats(), [service]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const results = await service.searchFriends(searchQuery);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleAcceptRequest = async (requestId: string) => {
    await service.acceptFriendRequest(requestId);
  };

  const handleRejectRequest = async (requestId: string) => {
    await service.rejectFriendRequest(requestId);
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (confirm('确定要删除这位好友吗？')) {
      await service.removeFriend(friendId);
    }
  };

  const handleSendRequest = async (friend: Friend) => {
    await service.sendFriendRequest(friend.id, friend.name);
    setSearchResults(searchResults.filter((f) => f.id !== friend.id));
  };

  const renderFriendCard = (friend: Friend) => {
    const statusColor = service.getStatusColor(friend.status);
    const statusLabel = service.getStatusLabel(friend.status);

    return (
      <div key={friend.id} className="friend-card">
        <div className="friend-avatar">{friend.avatar}</div>
        <div className="friend-info">
          <div className="friend-name">{friend.name}</div>
          <div className="friend-status" style={{ color: statusColor }}>
            {friend.status === 'offline' ? service.formatLastOnline(friend.lastOnline) : statusLabel}
          </div>
          {friend.level && (
            <div className="friend-meta">
              <span>Lv.{friend.level}</span>
              {friend.highScore && (
                <span>{service.formatLastOnline(friend.highScore)}分</span>
              )}
            </div>
          )}
        </div>
        <div className="friend-actions">
          <button className="friend-action-btn" title="聊天">
            <MessageCircle size={16} />
          </button>
          <button className="friend-action-btn danger" onClick={() => handleRemoveFriend(friend.id)} title="删除好友">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  };

  const renderRequestCard = (request: FriendRequest, type: 'incoming' | 'outgoing') => {
    return (
      <div key={request.id} className="request-card">
        <div className="request-avatar">{request.fromAvatar}</div>
        <div className="request-info">
          <div className="request-name">{request.fromName}</div>
          <div className="request-time">{service.formatLastOnline(request.timestamp)}</div>
        </div>
        <div className="request-actions">
          {type === 'incoming' ? (
            <>
              <button className="request-btn accept" onClick={() => handleAcceptRequest(request.id)}>
                <Check size={16} />
                <span>接受</span>
              </button>
              <button className="request-btn reject" onClick={() => handleRejectRequest(request.id)}>
                <X size={16} />
                <span>拒绝</span>
              </button>
            </>
          ) : (
            <button className="request-btn cancel" onClick={() => service.cancelFriendRequest(request.id)}>
              <X size={16} />
              <span>取消</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSearchCard = (friend: Friend) => {
    const statusColor = service.getStatusColor(friend.status);

    return (
      <div key={friend.id} className="search-card">
        <div className="search-avatar">{friend.avatar}</div>
        <div className="search-info">
          <div className="search-name">{friend.name}</div>
          <div className="search-status" style={{ color: statusColor }}>
            {service.getStatusLabel(friend.status)}
          </div>
        </div>
        <button className="search-add-btn" onClick={() => handleSendRequest(friend)}>
          <Send size={14} />
          <span>加好友</span>
        </button>
      </div>
    );
  };

  return (
    <div className="friend-panel">
      <div className="friend-header">
        <button className="friend-back-btn" onClick={onBack}>← 返回</button>
        <h1 className="friend-title">好友</h1>
        <button className="friend-refresh-btn" onClick={() => setUpdateTrigger({})}>
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="friend-stats">
        <div className="stat-card">
          <Users className="stat-icon" />
          <div className="stat-info">
            <span className="stat-value">{stats.totalFriends}</span>
            <span className="stat-label">好友数</span>
          </div>
        </div>
        <div className="stat-card online">
          <span className="stat-dot" />
          <div className="stat-info">
            <span className="stat-value">{stats.onlineFriends}</span>
            <span className="stat-label">在线</span>
          </div>
        </div>
        <div className="stat-card playing">
          <span className="stat-dot" />
          <div className="stat-info">
            <span className="stat-value">{stats.playingFriends}</span>
            <span className="stat-label">游戏中</span>
          </div>
        </div>
      </div>

      <div className="friend-tabs">
        <button
          className={`friend-tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          <Users size={18} />
          <span>好友列表</span>
        </button>
        <button
          className={`friend-tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          <UserPlus size={18} />
          <span>好友请求</span>
          {stats.pendingRequests > 0 && (
            <span className="friend-tab-badge">{stats.pendingRequests}</span>
          )}
        </button>
        <button
          className={`friend-tab-btn ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <Search size={18} />
          <span>搜索好友</span>
        </button>
      </div>

      <div className="friend-content">
        {activeTab === 'friends' && (
          <>
            <div className="friend-filters">
              {Object.entries(filterLabels).map(([key, label]) => (
                <button
                  key={key}
                  className={`friend-filter-btn ${filter === key ? 'active' : ''}`}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {friends.length === 0 ? (
              <div className="friend-empty">暂无好友</div>
            ) : (
              <div className="friend-list">
                {friends.map(renderFriendCard)}
              </div>
            )}
          </>
        )}

        {activeTab === 'requests' && (
          <div className="request-container">
            {incomingRequests.length > 0 && (
              <div className="request-section">
                <h3 className="request-section-title">收到的请求 ({incomingRequests.length})</h3>
                {incomingRequests.map((req) => renderRequestCard(req, 'incoming'))}
              </div>
            )}
            {outgoingRequests.length > 0 && (
              <div className="request-section">
                <h3 className="request-section-title">发出的请求 ({outgoingRequests.length})</h3>
                {outgoingRequests.map((req) => renderRequestCard(req, 'outgoing'))}
              </div>
            )}
            {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
              <div className="friend-empty">暂无好友请求</div>
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <>
            <div className="search-box">
              <Search size={18} />
              <input
                type="text"
                placeholder="搜索玩家名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button className="search-btn" onClick={handleSearch}>
                搜索
              </button>
            </div>
            {isSearching ? (
              <div className="friend-loading">搜索中...</div>
            ) : searchResults.length === 0 && searchQuery ? (
              <div className="friend-empty">未找到匹配的玩家</div>
            ) : searchQuery ? (
              <div className="search-list">
                {searchResults.map(renderSearchCard)}
              </div>
            ) : (
              <div className="friend-empty">输入玩家名称进行搜索</div>
            )}
          </>
        )}
      </div>
    </div>
  );
});
