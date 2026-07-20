var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-MhD6rX/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// node_modules/itty-router/index.mjs
var e = /* @__PURE__ */ __name(({ base: e2 = "", routes: t = [], ...o2 } = {}) => ({ __proto__: new Proxy({}, { get: (o3, s2, r, n) => "handle" == s2 ? r.fetch : (o4, ...a) => t.push([s2.toUpperCase?.(), RegExp(`^${(n = (e2 + o4).replace(/\/+(\/|$)/g, "$1")).replace(/(\/?\.?):(\w+)\+/g, "($1(?<$2>*))").replace(/(\/?\.?):(\w+)/g, "($1(?<$2>[^$1/]+?))").replace(/\./g, "\\.").replace(/(\/?)\*/g, "($1.*)?")}/*$`), a, n]) && r }), routes: t, ...o2, async fetch(e3, ...o3) {
  let s2, r, n = new URL(e3.url), a = e3.query = { __proto__: null };
  for (let [e4, t2] of n.searchParams)
    a[e4] = a[e4] ? [].concat(a[e4], t2) : t2;
  for (let [a2, c2, i2, l2] of t)
    if ((a2 == e3.method || "ALL" == a2) && (r = n.pathname.match(c2))) {
      e3.params = r.groups || {}, e3.route = l2;
      for (let t2 of i2)
        if (null != (s2 = await t2(e3.proxy ?? e3, ...o3)))
          return s2;
    }
} }), "e");
var o = /* @__PURE__ */ __name((e2 = "text/plain; charset=utf-8", t) => (o2, { headers: s2 = {}, ...r } = {}) => void 0 === o2 || "Response" === o2?.constructor.name ? o2 : new Response(t ? t(o2) : o2, { headers: { "content-type": e2, ...s2.entries ? Object.fromEntries(s2) : s2 }, ...r }), "o");
var s = o("application/json; charset=utf-8", JSON.stringify);
var c = o("text/plain; charset=utf-8", String);
var i = o("text/html");
var l = o("image/jpeg");
var p = o("image/png");
var d = o("image/webp");

// src/game-room.ts
var GameRoom = class {
  state;
  players = /* @__PURE__ */ new Map();
  gameState = {
    status: "waiting",
    startTime: null,
    players: [],
    scores: {}
  };
  constructor(state) {
    this.state = state;
  }
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/status") {
      return this.getStatus();
    }
    if (path === "/join") {
      return this.joinGame(request);
    }
    if (path === "/leave") {
      return this.leaveGame(request);
    }
    if (path === "/move") {
      return this.handleMove(request);
    }
    if (path === "/chat") {
      return this.handleChat(request);
    }
    return new Response("Not found", { status: 404 });
  }
  getStatus() {
    return new Response(JSON.stringify({
      success: true,
      data: {
        roomId: this.state.id.toString(),
        status: this.gameState.status,
        playerCount: this.players.size,
        players: Array.from(this.players.values()).map((p2) => ({
          id: p2.id,
          username: p2.username,
          ready: p2.ready
        })),
        startTime: this.gameState.startTime
      }
    }), { headers: { "Content-Type": "application/json" } });
  }
  async joinGame(request) {
    try {
      const body = await request.json();
      const { userId, username } = body;
      if (this.players.has(userId)) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: "ALREADY_IN_ROOM", message: "\u5DF2\u5728\u623F\u95F4\u4E2D" }
        }), { status: 400 });
      }
      this.players.set(userId, {
        id: userId,
        username,
        ready: false,
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        score: 0
      });
      this.gameState.players.push(userId);
      if (this.players.size >= 4) {
        this.startGame();
      }
      this.broadcast("player_join", { userId, username });
      return new Response(JSON.stringify({
        success: true,
        data: { roomId: this.state.id.toString(), playerCount: this.players.size }
      }), { headers: { "Content-Type": "application/json" } });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: "JOIN_ERROR", message: "\u52A0\u5165\u623F\u95F4\u5931\u8D25" }
      }), { status: 500 });
    }
  }
  async leaveGame(request) {
    try {
      const body = await request.json();
      const { userId } = body;
      if (!this.players.has(userId)) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: "NOT_IN_ROOM", message: "\u4E0D\u5728\u623F\u95F4\u4E2D" }
        }), { status: 400 });
      }
      this.players.delete(userId);
      this.gameState.players = this.gameState.players.filter((id) => id !== userId);
      if (this.players.size === 0) {
        this.gameState.status = "waiting";
        this.gameState.startTime = null;
      }
      this.broadcast("player_leave", { userId });
      return new Response(JSON.stringify({
        success: true,
        data: { playerCount: this.players.size }
      }), { headers: { "Content-Type": "application/json" } });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: "LEAVE_ERROR", message: "\u79BB\u5F00\u623F\u95F4\u5931\u8D25" }
      }), { status: 500 });
    }
  }
  async handleMove(request) {
    try {
      const body = await request.json();
      const { userId, position, rotation } = body;
      const player = this.players.get(userId);
      if (!player) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: "PLAYER_NOT_FOUND", message: "\u73A9\u5BB6\u4E0D\u5B58\u5728" }
        }), { status: 404 });
      }
      player.position = position;
      player.rotation = rotation;
      this.broadcast("player_move", { userId, position, rotation });
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: "MOVE_ERROR", message: "\u79FB\u52A8\u5904\u7406\u5931\u8D25" }
      }), { status: 500 });
    }
  }
  async handleChat(request) {
    try {
      const body = await request.json();
      const { userId, message } = body;
      const player = this.players.get(userId);
      if (!player) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: "PLAYER_NOT_FOUND", message: "\u73A9\u5BB6\u4E0D\u5B58\u5728" }
        }), { status: 404 });
      }
      if (!message || message.length > 200) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: "INVALID_MESSAGE", message: "\u6D88\u606F\u65E0\u6548" }
        }), { status: 400 });
      }
      this.broadcast("chat_message", { userId, username: player.username, message });
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: "CHAT_ERROR", message: "\u804A\u5929\u5931\u8D25" }
      }), { status: 500 });
    }
  }
  startGame() {
    this.gameState.status = "playing";
    this.gameState.startTime = Date.now();
    this.players.forEach((player) => {
      player.score = 0;
      player.ready = true;
    });
    this.broadcast("game_start", { startTime: this.gameState.startTime });
  }
  endGame() {
    this.gameState.status = "ended";
    this.broadcast("game_end", { scores: this.gameState.scores });
  }
  broadcast(event, data) {
    const message = JSON.stringify({ event, data });
    console.log(`[GameRoom] Broadcasting: ${event} to ${this.players.size} players`);
  }
};
__name(GameRoom, "GameRoom");

// src/index.ts
var router = e();
var apiProxy = /* @__PURE__ */ __name(async (request, env) => {
  const url = new URL(request.url);
  const apiPath = url.pathname.replace("/api", "");
  const apiUrl = `${env.API_URL}${apiPath}${url.search}`;
  try {
    const response = await fetch(apiUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });
    return new Response(response.body, {
      status: response.status,
      headers: response.headers
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: { code: "PROXY_ERROR", message: "API\u4EE3\u7406\u5931\u8D25" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}, "apiProxy");
router.all("/api/*", apiProxy);
router.get("/health", () => new Response(JSON.stringify({ success: true, message: "Edge worker healthy" }), {
  headers: { "Content-Type": "application/json" }
}));
router.get("/ping", () => new Response(JSON.stringify({ success: true, timestamp: Date.now() }), {
  headers: { "Content-Type": "application/json" }
}));
router.get("/regions", () => {
  const regions = [
    { id: "asia-east", name: "\u4E9A\u592A\u4E1C\u90E8", latency: "<50ms" },
    { id: "asia-south", name: "\u4E9A\u592A\u5357\u90E8", latency: "<80ms" },
    { id: "europe-west", name: "\u6B27\u6D32\u897F\u90E8", latency: "<100ms" },
    { id: "us-east", name: "\u7F8E\u56FD\u4E1C\u90E8", latency: "<150ms" },
    { id: "us-west", name: "\u7F8E\u56FD\u897F\u90E8", latency: "<180ms" }
  ];
  return new Response(JSON.stringify({ success: true, data: regions }), {
    headers: { "Content-Type": "application/json" }
  });
});
router.post("/matchmaking/find", async (request, env) => {
  try {
    const body = await request.json();
    const { userId, skillLevel, gameMode } = body;
    if (!userId || !skillLevel || !gameMode) {
      return new Response(JSON.stringify({ success: false, error: { code: "VALIDATION_ERROR", message: "\u53C2\u6570\u4E0D\u5B8C\u6574" } }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const roomId = await findOrCreateRoom(env, userId, skillLevel, gameMode);
    return new Response(JSON.stringify({
      success: true,
      data: {
        roomId,
        region: "asia-east",
        latency: 35,
        players: 1,
        maxPlayers: 4
      }
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: { code: "MATCHMAKING_ERROR", message: "\u5339\u914D\u5931\u8D25" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
router.get("/matchmaking/status/:roomId", async (request, env) => {
  const { roomId } = request.params;
  try {
    const room = env.GameRoom.get(env.GameRoom.idFromString(roomId));
    const status = await room.fetch(`https://api.fighter-game.dev/room/${roomId}/status`);
    return status;
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: { code: "ROOM_NOT_FOUND", message: "\u623F\u95F4\u4E0D\u5B58\u5728" } }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
});
async function findOrCreateRoom(env, userId, skillLevel, gameMode) {
  const roomId = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return roomId;
}
__name(findOrCreateRoom, "findOrCreateRoom");
router.all("*", () => new Response("Not found", { status: 404 }));
var src_default = {
  async fetch(request, env) {
    return router.handle(request, env);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e2) {
      console.error("Failed to drain the unused request body.", e2);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e2) {
  return {
    name: e2?.name,
    message: e2?.message ?? String(e2),
    stack: e2?.stack,
    cause: e2?.cause === void 0 ? void 0 : reduceError(e2.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e2) {
    const error = reduceError(e2);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-MhD6rX/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-MhD6rX/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  GameRoom,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
