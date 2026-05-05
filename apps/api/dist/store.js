import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
const DEFAULT_MAP_DATA = {
    spawn: { x: 0, y: 2, z: 0 },
    checkpoints: [],
    objects: [],
};
const OFFICIAL_MARKETPLACE_ITEMS = [
    { id: "builder-cap", name: "Builder Cap", category: "Hat", price: 120, accent: "linear-gradient(135deg, #f59e0b, #f97316)", modelKind: "cap", emoji: "🧢", creator: "FairbloxStudio", description: "Classic creator cap for Fairblox studio builders.", createdAt: 1, source: "official", creatorUserId: null },
    { id: "neon-blade", name: "Neon Blade", category: "Gear", price: 280, accent: "linear-gradient(135deg, #0ea5e9, #6366f1)", modelKind: "blade", emoji: "⚔️", creator: "NorthStarDev", description: "Glowing showcase item for profile and action games.", limited: true, supply: 320, createdAt: 2, source: "official", creatorUserId: null },
    { id: "cloud-wings", name: "Cloud Wings", category: "Back", price: 340, accent: "linear-gradient(135deg, #818cf8, #c4b5fd)", modelKind: "wings", emoji: "🪽", creator: "SkyForge", description: "Soft floating wings for fantasy and obby avatars.", limited: true, supply: 150, createdAt: 3, source: "official", creatorUserId: null },
    { id: "pixel-boombox", name: "Pixel Boombox", category: "Accessory", price: 180, accent: "linear-gradient(135deg, #ec4899, #f59e0b)", modelKind: "boombox", emoji: "📻", creator: "PlutoBuilds", description: "Retro shoulder gear for hangout spaces and music worlds.", createdAt: 4, source: "official", creatorUserId: null },
    { id: "frost-crown", name: "Frost Crown", category: "Hat", price: 450, accent: "linear-gradient(135deg, #22d3ee, #a5f3fc)", modelKind: "crown", emoji: "👑", creator: "IceCastleUGC", description: "Shimmering crown worn by legendary frost wizards.", limited: true, supply: 90, createdAt: 5, source: "official", creatorUserId: null },
    { id: "shades-cool", name: "Galaxy Shades", category: "Face", price: 95, accent: "linear-gradient(135deg, #1e1b4b, #4f46e5)", modelKind: "glasses", emoji: "🕶️", creator: "StyleDrops", description: "Deep space lenses. Very cool.", createdAt: 6, source: "official", creatorUserId: null },
    { id: "fire-wings", name: "Blaze Wings", category: "Back", price: 390, accent: "linear-gradient(135deg, #dc2626, #f97316)", modelKind: "wings", emoji: "🔥", creator: "InfernoUGC", description: "Flames that trail behind you in every world.", limited: true, supply: 75, createdAt: 7, source: "official", creatorUserId: null },
    { id: "pixel-sword", name: "Pixel Sword", category: "Gear", price: 85, accent: "linear-gradient(135deg, #64748b, #94a3b8)", modelKind: "blade", emoji: "🗡️", creator: "RetroForge", description: "Classic 8-bit styled blade for retro world builders.", sale: true, createdAt: 8, source: "official", creatorUserId: null },
    { id: "space-helmet", name: "Space Helmet", category: "Hat", price: 220, accent: "linear-gradient(135deg, #1d4ed8, #06b6d4)", modelKind: "helmet", emoji: "🪐", creator: "CosmicUGC", description: "Pressurized helmet for galaxy explorers.", createdAt: 9, source: "official", creatorUserId: null },
    { id: "rainbow-halo", name: "Rainbow Halo", category: "Hat", price: 500, accent: "linear-gradient(135deg, #f43f5e, #a855f7, #3b82f6)", modelKind: "halo", emoji: "✨", creator: "FairbloxStudio", description: "Prismatic halo that cycles through every color.", limited: true, supply: 60, createdAt: 10, source: "official", creatorUserId: null },
    { id: "golden-chain", name: "Golden Chain", category: "Accessory", price: 140, accent: "linear-gradient(135deg, #ca8a04, #fbbf24)", modelKind: "chain", emoji: "⛓️", creator: "SwaggerDrops", description: "Heavy-link chain worn by the boldest builders.", sale: true, createdAt: 11, source: "official", creatorUserId: null },
    { id: "dino-hat", name: "Dino Top", category: "Hat", price: 65, accent: "linear-gradient(135deg, #16a34a, #84cc16)", modelKind: "dino", emoji: "🦕", creator: "JungleUGC", description: "Iconic dinosaur hat that never goes out of style.", createdAt: 12, source: "official", creatorUserId: null },
];
const MARKET_ITEM_CATEGORIES = new Set(["Hat", "Gear", "Back", "Accessory", "Face"]);
const MODEL_KINDS = new Set(["cap", "blade", "wings", "boombox", "crown", "glasses", "helmet", "halo", "chain", "dino", "custom"]);
function normalizeMarketplaceCreateInput(input) {
    const name = input.name?.trim();
    const category = input.category?.trim();
    const description = input.description?.trim();
    const accent = input.accent?.trim();
    const emoji = input.emoji?.trim();
    const modelKind = input.modelKind;
    const price = Math.max(1, Math.floor(Number(input.price || 0)));
    const limited = Boolean(input.limited);
    const supply = limited ? Math.max(1, Math.floor(Number(input.supply || 0))) : undefined;
    if (!name || name.length < 3) {
        throw new Error("Item name must be at least 3 characters.");
    }
    if (!description) {
        throw new Error("Item description is required.");
    }
    if (!MARKET_ITEM_CATEGORIES.has(category)) {
        throw new Error("Invalid marketplace category.");
    }
    if (!MODEL_KINDS.has(modelKind)) {
        throw new Error("Invalid model type.");
    }
    if (!accent) {
        throw new Error("Card gradient is required.");
    }
    return {
        name: name.slice(0, 64),
        category,
        price,
        accent: accent.slice(0, 120),
        modelKind,
        emoji: emoji ? emoji.slice(0, 4) : "🎁",
        description: description.slice(0, 240),
        limited,
        supply,
    };
}
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function normalizeVector3(value, label) {
    if (!value || typeof value !== "object") {
        throw new Error(`${label} must be a position object.`);
    }
    const vector = value;
    if (!isFiniteNumber(vector.x) || !isFiniteNumber(vector.y) || !isFiniteNumber(vector.z)) {
        throw new Error(`${label} must use numeric x, y, z coordinates.`);
    }
    return {
        x: vector.x,
        y: vector.y,
        z: vector.z,
    };
}
function normalizeRotation3(value, label) {
    if (!value || typeof value !== "object") {
        return { x: 0, y: 0, z: 0 };
    }
    const rotation = value;
    if (!isFiniteNumber(rotation.x) || !isFiniteNumber(rotation.y) || !isFiniteNumber(rotation.z)) {
        throw new Error(`${label} must use numeric x, y, z coordinates.`);
    }
    return {
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
    };
}
function createMapEntityId(prefix, index) {
    return `${prefix}-${index + 1}`;
}
function normalizeMapData(value) {
    if (!value || typeof value !== "object") {
        throw new Error("Map data is required.");
    }
    const mapData = value;
    if (!Array.isArray(mapData.checkpoints) || !Array.isArray(mapData.objects)) {
        throw new Error("Map data must include checkpoint and object arrays.");
    }
    return {
        spawn: normalizeVector3(mapData.spawn, "Spawn"),
        checkpoints: mapData.checkpoints.map((checkpoint, index) => {
            if (!checkpoint || typeof checkpoint !== "object") {
                throw new Error(`Checkpoint ${index + 1} must be an object.`);
            }
            const item = checkpoint;
            const position = item.position && typeof item.position === "object"
                ? normalizeVector3(item.position, `Checkpoint ${index + 1} position`)
                : normalizeVector3(item, `Checkpoint ${index + 1}`);
            const radius = item.radius === undefined
                ? undefined
                : isFiniteNumber(item.radius) && item.radius > 0
                    ? item.radius
                    : (() => {
                        throw new Error(`Checkpoint ${index + 1} radius must be greater than zero.`);
                    })();
            return {
                id: typeof item.id === "string" && item.id.trim().length > 0
                    ? item.id.trim().slice(0, 48)
                    : createMapEntityId("checkpoint", index),
                position,
                radius,
                label: typeof item.label === "string" && item.label.trim().length > 0
                    ? item.label.trim().slice(0, 64)
                    : undefined,
            };
        }),
        objects: mapData.objects.map((object, index) => {
            if (!object || typeof object !== "object") {
                throw new Error(`Object ${index + 1} must be an object.`);
            }
            const item = object;
            if (typeof item.type !== "string" || item.type.trim().length === 0) {
                throw new Error(`Object ${index + 1} needs a type.`);
            }
            const position = item.position && typeof item.position === "object"
                ? normalizeVector3(item.position, `Object ${index + 1} position`)
                : normalizeVector3(item, `Object ${index + 1}`);
            const size = item.size && typeof item.size === "object"
                ? normalizeVector3(item.size, `Object ${index + 1} size`)
                : normalizeVector3({ x: item.sx, y: item.sy, z: item.sz }, `Object ${index + 1} size`);
            if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
                throw new Error(`Object ${index + 1} sizes must be greater than zero.`);
            }
            if (typeof item.color !== "string" || item.color.trim().length === 0) {
                throw new Error(`Object ${index + 1} needs a color.`);
            }
            return {
                id: typeof item.id === "string" && item.id.trim().length > 0
                    ? item.id.trim().slice(0, 48)
                    : createMapEntityId("object", index),
                type: item.type.trim().slice(0, 24),
                position,
                rotation: normalizeRotation3(item.rotation, `Object ${index + 1} rotation`),
                size,
                color: item.color.trim().slice(0, 24),
                material: typeof item.material === "string" && item.material.trim().length > 0
                    ? item.material.trim().slice(0, 16)
                    : undefined,
                tags: Array.isArray(item.tags)
                    ? item.tags
                        .filter((tag) => typeof tag === "string" && tag.trim().length > 0)
                        .map((tag) => tag.trim().slice(0, 24))
                        .slice(0, 16)
                    : undefined,
                config: item.config && typeof item.config === "object" && !Array.isArray(item.config)
                    ? Object.fromEntries(Object.entries(item.config).filter(([key, entry]) => key.trim().length > 0 &&
                        (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean")))
                    : undefined,
            };
        }),
    };
}
function normalizeUnityWebglUrl(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }
    if (trimmed.length > 500) {
        throw new Error("Unity WebGL URL is too long.");
    }
    if (!/^https?:\/\//i.test(trimmed)) {
        throw new Error("Unity WebGL URL must start with http:// or https://");
    }
    return trimmed;
}
const DEFAULT_ACCOUNT_THREADS = [
    {
        id: "thread-nova",
        name: "Nova",
        status: "Playing Test Tower",
        messages: [
            { from: "friend", body: "You should publish that obby update tonight.", at: "7:12 PM" },
            { from: "me", body: "I just pushed a new world preview for it.", at: "7:14 PM" },
        ],
    },
    {
        id: "thread-bytefox",
        name: "ByteFox",
        status: "In Studio",
        messages: [{ from: "friend", body: "Want feedback on your avatar editor?", at: "6:44 PM" }],
    },
    {
        id: "thread-sora",
        name: "Sora",
        status: "Browsing Marketplace",
        messages: [{ from: "friend", body: "Gift cards should connect into wallet coins.", at: "5:33 PM" }],
    },
];
const DEFAULT_AVATAR_DRAFT = {
    skinTone: "#f6c8a2",
    shirtColor: "#f97316",
    pantsColor: "#1d4ed8",
    face: "Classic Smile",
    accessory: "Builder Cap",
};
function createDefaultAvatarSlots() {
    return [
        {
            id: "slot-1",
            name: "Main Fit",
            draft: { ...DEFAULT_AVATAR_DRAFT },
        },
        {
            id: "slot-2",
            name: "Neon",
            draft: {
                skinTone: "#e5b48d",
                shirtColor: "#fb7185",
                pantsColor: "#a78bfa",
                face: "Focused",
                accessory: "Neon Blade",
            },
        },
        {
            id: "slot-3",
            name: "Sky",
            draft: {
                skinTone: "#f6c8a2",
                shirtColor: "#60a5fa",
                pantsColor: "#1d4ed8",
                face: "Wink",
                accessory: "Cloud Wings",
            },
        },
    ];
}
function createDefaultAccountState(coins) {
    const avatarSlots = createDefaultAvatarSlots();
    return {
        walletCoins: coins,
        ownedItemIds: ["builder-cap"],
        selectedThreadId: DEFAULT_ACCOUNT_THREADS[0].id,
        avatarDraft: { ...avatarSlots[0].draft },
        activeAvatarSlotId: avatarSlots[0].id,
        avatarSlots,
        messageThreads: structuredClone(DEFAULT_ACCOUNT_THREADS),
    };
}
function normalizeAccountState(value, fallbackCoins) {
    if (!value || typeof value !== "object") {
        throw new Error("Account state payload is required.");
    }
    const walletCoins = Number.isFinite(value.walletCoins) ? Math.max(0, Math.floor(value.walletCoins)) : fallbackCoins;
    const ownedItemIds = Array.isArray(value.ownedItemIds)
        ? value.ownedItemIds.filter((item) => typeof item === "string" && item.trim().length > 0).slice(0, 120)
        : ["builder-cap"];
    const messageThreads = Array.isArray(value.messageThreads)
        ? value.messageThreads
            .filter((thread) => thread && typeof thread.id === "string" && thread.id.trim().length > 0)
            .map((thread) => ({
            id: String(thread.id).trim().slice(0, 64),
            name: String(thread.name || "Friend").trim().slice(0, 64),
            status: String(thread.status || "Online").trim().slice(0, 120),
            messages: Array.isArray(thread.messages)
                ? thread.messages
                    .filter((message) => message && typeof message.body === "string")
                    .map((message) => ({
                    from: message.from === "me" ? "me" : "friend",
                    body: String(message.body).trim().slice(0, 320),
                    at: String(message.at || "now").trim().slice(0, 32),
                }))
                    .filter((message) => message.body.length > 0)
                : [],
        }))
            .slice(0, 40)
        : structuredClone(DEFAULT_ACCOUNT_THREADS);
    const fallbackThreadId = messageThreads[0]?.id || "thread-1";
    const selectedThreadId = typeof value.selectedThreadId === "string" && messageThreads.some((thread) => thread.id === value.selectedThreadId)
        ? value.selectedThreadId
        : fallbackThreadId;
    const avatarDraft = {
        skinTone: typeof value.avatarDraft?.skinTone === "string" && value.avatarDraft.skinTone.trim().length > 0
            ? value.avatarDraft.skinTone.trim().slice(0, 32)
            : "#f6c8a2",
        shirtColor: typeof value.avatarDraft?.shirtColor === "string" && value.avatarDraft.shirtColor.trim().length > 0
            ? value.avatarDraft.shirtColor.trim().slice(0, 32)
            : "#f97316",
        pantsColor: typeof value.avatarDraft?.pantsColor === "string" && value.avatarDraft.pantsColor.trim().length > 0
            ? value.avatarDraft.pantsColor.trim().slice(0, 32)
            : "#1d4ed8",
        face: typeof value.avatarDraft?.face === "string" && value.avatarDraft.face.trim().length > 0
            ? value.avatarDraft.face.trim().slice(0, 64)
            : "Classic Smile",
        accessory: typeof value.avatarDraft?.accessory === "string" && value.avatarDraft.accessory.trim().length > 0
            ? value.avatarDraft.accessory.trim().slice(0, 64)
            : "Builder Cap",
    };
    const avatarSlots = Array.isArray(value.avatarSlots)
        ? value.avatarSlots
            .filter((slot) => slot && typeof slot.id === "string" && slot.id.trim().length > 0)
            .map((slot, index) => ({
            id: String(slot.id).trim().slice(0, 32),
            name: String(slot.name || `Slot ${index + 1}`).trim().slice(0, 32),
            draft: {
                skinTone: typeof slot.draft?.skinTone === "string" && slot.draft.skinTone.trim().length > 0
                    ? slot.draft.skinTone.trim().slice(0, 32)
                    : avatarDraft.skinTone,
                shirtColor: typeof slot.draft?.shirtColor === "string" && slot.draft.shirtColor.trim().length > 0
                    ? slot.draft.shirtColor.trim().slice(0, 32)
                    : avatarDraft.shirtColor,
                pantsColor: typeof slot.draft?.pantsColor === "string" && slot.draft.pantsColor.trim().length > 0
                    ? slot.draft.pantsColor.trim().slice(0, 32)
                    : avatarDraft.pantsColor,
                face: typeof slot.draft?.face === "string" && slot.draft.face.trim().length > 0
                    ? slot.draft.face.trim().slice(0, 64)
                    : avatarDraft.face,
                accessory: typeof slot.draft?.accessory === "string" && slot.draft.accessory.trim().length > 0
                    ? slot.draft.accessory.trim().slice(0, 64)
                    : avatarDraft.accessory,
            },
        }))
            .slice(0, 8)
        : createDefaultAvatarSlots();
    const safeAvatarSlots = avatarSlots.length > 0 ? avatarSlots : createDefaultAvatarSlots();
    const activeAvatarSlotId = typeof value.activeAvatarSlotId === "string" && safeAvatarSlots.some((slot) => slot.id === value.activeAvatarSlotId)
        ? value.activeAvatarSlotId
        : safeAvatarSlots[0].id;
    const activeSlot = safeAvatarSlots.find((slot) => slot.id === activeAvatarSlotId) ?? safeAvatarSlots[0];
    return {
        walletCoins,
        ownedItemIds: ownedItemIds.length > 0 ? ownedItemIds : ["builder-cap"],
        selectedThreadId,
        avatarDraft: { ...activeSlot.draft, ...avatarDraft },
        activeAvatarSlotId,
        avatarSlots: safeAvatarSlots,
        messageThreads,
    };
}
function toPublicStats(seed, versionCount) {
    const charSum = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const visits = 150 + charSum * 7 + versionCount * 93;
    const likes = Math.max(12, Math.floor(visits * 0.22));
    return { visits, likes };
}
function hashPassword(password) {
    return createHash("sha256").update(password).digest("hex");
}
function slugify(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
}
function normalizeIdempotencyKey(value) {
    if (typeof value !== "string") {
        return null;
    }
    const key = value.trim();
    if (!key) {
        return null;
    }
    if (!/^[a-zA-Z0-9._:-]{8,80}$/.test(key)) {
        throw new Error("Invalid idempotency key format.");
    }
    return key;
}
function normalizeCurrencyPurchaseInput(input) {
    const coins = Math.max(1, Math.floor(Number(input.coins || 0)));
    const usdCents = Math.max(50, Math.floor(Number(input.usdCents || 0)));
    if (coins > 250_000) {
        throw new Error("Currency purchase exceeds allowed coin limit.");
    }
    if (coins > usdCents * 20) {
        throw new Error("Currency purchase validation failed.");
    }
    return {
        coins,
        usdCents,
        requestId: normalizeIdempotencyKey(input.requestId),
    };
}
function toProfileSummary(user) {
    return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        avatarPreset: user.avatarPreset,
        coins: user.coins,
        role: user.role,
    };
}
class InMemoryStore {
    users = new Map();
    sessions = new Map();
    games = new Map();
    versions = new Map();
    liveSessions = new Map();
    visitCounts = new Map();
    accountStates = new Map();
    marketplaceItems = new Map();
    currencyPurchaseOrders = new Map();
    creatorEconomy = new Map();
    idempotencyCache = new Map();
    likeCounts = new Map();
    favoriteCounts = new Map();
    favoritesByUser = new Map();
    followsByCreator = new Map();
    constructor() {
        for (const item of OFFICIAL_MARKETPLACE_ITEMS) {
            this.marketplaceItems.set(item.id, { ...item });
        }
        void this.signup({
            email: "creator@fairblox.dev",
            username: "plutobuilds",
            password: "demo123",
            displayName: "PlutoBuilds",
        });
    }
    async signup(input) {
        const username = input.username.trim().toLowerCase();
        const email = input.email.trim().toLowerCase();
        const displayName = input.displayName.trim();
        if (!username || !email || !displayName || !input.password.trim()) {
            throw new Error("All signup fields are required.");
        }
        if (this.users.has(username)) {
            throw new Error("Username is already taken.");
        }
        for (const user of this.users.values()) {
            if (user.email === email) {
                throw new Error("Email is already in use.");
            }
        }
        const user = {
            id: randomUUID(),
            email,
            username,
            passwordHash: hashPassword(input.password),
            displayName,
            bio: "New Fairblox creator.",
            avatarPreset: "starter",
            coins: 250,
            role: "creator",
        };
        this.users.set(username, user);
        this.accountStates.set(user.id, createDefaultAccountState(user.coins));
        return this.issueAuthResponse(user);
    }
    async login(input) {
        const username = input.username.trim().toLowerCase();
        const user = this.users.get(username);
        if (!user || user.passwordHash !== hashPassword(input.password)) {
            throw new Error("Invalid username or password.");
        }
        return this.issueAuthResponse(user);
    }
    async getProfileByUsername(username) {
        const user = this.users.get(username.trim().toLowerCase());
        return user ? toProfileSummary(user) : null;
    }
    async getProfileFromToken(token) {
        if (!token) {
            return null;
        }
        const userId = this.sessions.get(token);
        if (!userId) {
            return null;
        }
        for (const user of this.users.values()) {
            if (user.id === userId) {
                return toProfileSummary(user);
            }
        }
        return null;
    }
    async createGameDraft(token, input) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const title = input.title.trim();
        if (!title) {
            throw new Error("Game title is required.");
        }
        const slugBase = slugify(title) || "untitled-game";
        const slug = this.uniqueSlug(slugBase);
        const now = new Date().toISOString();
        const draft = {
            id: randomUUID(),
            title,
            slug,
            description: input.description.trim(),
            genre: input.genre,
            unityWebglUrl: undefined,
            visibility: "draft",
            creatorId: profile.id,
            creatorName: profile.displayName,
            createdAt: now,
            updatedAt: now,
            mapData: structuredClone(DEFAULT_MAP_DATA),
            versionCount: 0,
            publishedVersionNumber: null,
        };
        this.games.set(draft.id, draft);
        return draft;
    }
    async listGamesForToken(token) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        return [...this.games.values()]
            .filter((game) => game.creatorId === profile.id)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    }
    async getGameDraft(token, gameId) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const draft = this.games.get(gameId);
        if (!draft || draft.creatorId !== profile.id) {
            throw new Error("Draft not found.");
        }
        return draft;
    }
    async saveGameMap(token, gameId, input) {
        const draft = await this.getGameDraft(token, gameId);
        const mapData = normalizeMapData(input.mapData);
        const unityWebglUrl = normalizeUnityWebglUrl(input.unityWebglUrl);
        const updated = {
            ...draft,
            mapData,
            unityWebglUrl,
            updatedAt: new Date().toISOString(),
        };
        this.games.set(gameId, updated);
        return updated;
    }
    async publishGame(token, gameId, input) {
        const draft = await this.getGameDraft(token, gameId);
        const versions = this.versions.get(gameId) || [];
        const versionNumber = versions.length + 1;
        versions.push({
            id: randomUUID(),
            gameId,
            versionNumber,
            mapData: structuredClone(draft.mapData),
            changelog: input.changelog.trim(),
            createdAt: new Date().toISOString(),
        });
        this.versions.set(gameId, versions);
        const updated = {
            ...draft,
            visibility: "published",
            versionCount: versionNumber,
            publishedVersionNumber: versionNumber,
            updatedAt: new Date().toISOString(),
        };
        this.games.set(gameId, updated);
        return updated;
    }
    async unpublishGame(token, gameId) {
        const draft = await this.getGameDraft(token, gameId);
        const updated = {
            ...draft,
            visibility: "draft",
            updatedAt: new Date().toISOString(),
        };
        this.games.set(gameId, updated);
        return updated;
    }
    async listPublishedGames() {
        return [...this.games.values()]
            .filter((game) => game.visibility === "published" && game.publishedVersionNumber)
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
            .map((game) => {
            const stats = toPublicStats(game.slug, game.versionCount);
            const visits = stats.visits + (this.visitCounts.get(game.id) || 0);
            const likes = (this.likeCounts.get(game.id) ?? stats.likes);
            return {
                id: game.id,
                title: game.title,
                slug: game.slug,
                description: game.description,
                genre: game.genre,
                creatorName: game.creatorName,
                unityWebglUrl: game.unityWebglUrl,
                visits,
                likes,
            };
        });
    }
    async listPublishedGamesByCreator(username) {
        const creator = this.users.get(username.trim().toLowerCase());
        if (!creator) {
            return [];
        }
        const allPublished = await this.listPublishedGames();
        return allPublished.filter((game) => {
            const source = this.games.get(game.id);
            return source?.creatorId === creator.id;
        });
    }
    async getPublishedGameBySlug(slug) {
        const game = [...this.games.values()].find((candidate) => candidate.slug === slug && candidate.visibility === "published" && candidate.publishedVersionNumber);
        if (!game || !game.publishedVersionNumber) {
            return null;
        }
        const stats = toPublicStats(game.slug, game.versionCount);
        const visits = stats.visits + (this.visitCounts.get(game.id) || 0);
        const likes = (this.likeCounts.get(game.id) ?? stats.likes);
        return {
            id: game.id,
            title: game.title,
            slug: game.slug,
            description: game.description,
            genre: game.genre,
            creatorId: game.creatorId,
            creatorName: game.creatorName,
            unityWebglUrl: game.unityWebglUrl,
            createdAt: game.createdAt,
            updatedAt: game.updatedAt,
            publishedVersionNumber: game.publishedVersionNumber,
            mapData: game.mapData,
            visits,
            likes,
        };
    }
    async joinPublishedGame(slug) {
        const game = [...this.games.values()].find((candidate) => candidate.slug === slug && candidate.visibility === "published" && candidate.publishedVersionNumber);
        if (!game) {
            throw new Error("Game not found.");
        }
        const sessions = this.liveSessions.get(game.id) || [];
        let session = sessions.find((candidate) => candidate.status === "open" && candidate.playerCount < candidate.maxPlayers);
        if (!session) {
            session = {
                id: randomUUID(),
                gameId: game.id,
                region: "us-east",
                status: "open",
                playerCount: 0,
                maxPlayers: 12,
                createdAt: new Date().toISOString(),
            };
            sessions.unshift(session);
        }
        session.playerCount += 1;
        if (session.playerCount >= session.maxPlayers) {
            session.status = "full";
        }
        this.liveSessions.set(game.id, sessions);
        this.visitCounts.set(game.id, (this.visitCounts.get(game.id) || 0) + 1);
        return {
            id: session.id,
            gameId: game.id,
            gameSlug: game.slug,
            gameTitle: game.title,
            region: session.region,
            status: session.status,
            playerCount: session.playerCount,
            maxPlayers: session.maxPlayers,
            joinedAt: new Date().toISOString(),
            spawn: structuredClone(game.mapData.spawn),
        };
    }
    async likeGame(slug) {
        const game = [...this.games.values()].find((candidate) => candidate.slug === slug && candidate.visibility === "published" && candidate.publishedVersionNumber);
        if (!game) {
            throw new Error("Game not found.");
        }
        const current = this.likeCounts.get(game.id) ?? toPublicStats(game.slug, game.versionCount).likes;
        const likes = current + 1;
        this.likeCounts.set(game.id, likes);
        return { likes };
    }
    async favoriteGame(token, slug) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const game = [...this.games.values()].find((candidate) => candidate.slug === slug && candidate.visibility === "published" && candidate.publishedVersionNumber);
        if (!game) {
            throw new Error("Game not found.");
        }
        const favorites = this.favoritesByUser.get(profile.id) ?? new Set();
        const currentlyFavorited = favorites.has(game.id);
        if (currentlyFavorited) {
            favorites.delete(game.id);
            const nextCount = Math.max(0, (this.favoriteCounts.get(game.id) ?? 0) - 1);
            this.favoriteCounts.set(game.id, nextCount);
            this.favoritesByUser.set(profile.id, favorites);
            return { favorites: nextCount, favorited: false };
        }
        favorites.add(game.id);
        const nextCount = (this.favoriteCounts.get(game.id) ?? 0) + 1;
        this.favoriteCounts.set(game.id, nextCount);
        this.favoritesByUser.set(profile.id, favorites);
        return { favorites: nextCount, favorited: true };
    }
    async followCreator(token, username) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const creator = this.users.get(username.trim().toLowerCase());
        if (!creator) {
            throw new Error("Creator not found.");
        }
        if (creator.id === profile.id) {
            throw new Error("You cannot follow yourself.");
        }
        const followers = this.followsByCreator.get(creator.id) ?? new Set();
        const following = !followers.has(profile.id);
        if (following) {
            followers.add(profile.id);
        }
        else {
            followers.delete(profile.id);
        }
        this.followsByCreator.set(creator.id, followers);
        return { followers: followers.size, following };
    }
    async getAccountState(token) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const existing = this.accountStates.get(profile.id);
        if (existing) {
            return normalizeAccountState(existing, profile.coins);
        }
        const seeded = createDefaultAccountState(profile.coins);
        this.accountStates.set(profile.id, seeded);
        return seeded;
    }
    async saveAccountState(token, input) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const normalized = normalizeAccountState(input.state, profile.coins);
        this.accountStates.set(profile.id, normalized);
        for (const user of this.users.values()) {
            if (user.id === profile.id) {
                user.coins = normalized.walletCoins;
                user.avatarPreset = normalized.avatarDraft.accessory;
                break;
            }
        }
        return normalized;
    }
    async listMarketplaceItems() {
        return [...this.marketplaceItems.values()]
            .sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0))
            .map(({ creatorUserId: _creatorUserId, ...item }) => ({ ...item }));
    }
    async createMarketplaceItem(token, input) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const normalized = normalizeMarketplaceCreateInput(input);
        const id = `ugc-${slugify(normalized.name)}-${Date.now()}`;
        const created = {
            id,
            ...normalized,
            creator: profile.username,
            createdAt: Date.now(),
            source: "ugc",
            creatorUserId: profile.id,
        };
        this.marketplaceItems.set(created.id, created);
        const { creatorUserId: _creatorUserId, ...response } = created;
        return response;
    }
    async tradeMarketplaceLimited(token, input) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const target = this.marketplaceItems.get(String(input.targetItemId || ""));
        const offer = this.marketplaceItems.get(String(input.offerItemId || ""));
        const offerCoins = Math.max(0, Math.floor(Number(input.offerCoins || 0)));
        if (target?.id === offer?.id) {
            throw new Error("Cannot trade an item for itself.");
        }
        const requestId = normalizeIdempotencyKey(input.requestId);
        const idempotencyCacheKey = requestId ? `${profile.id}:trade:${requestId}` : null;
        if (idempotencyCacheKey && this.idempotencyCache.has(idempotencyCacheKey)) {
            return structuredClone(this.idempotencyCache.get(idempotencyCacheKey));
        }
        if (!target || !offer) {
            throw new Error("Trade items were not found.");
        }
        if (!target.limited || !offer.limited) {
            throw new Error("Only Limited items can be traded.");
        }
        const current = await this.getAccountState(token);
        if (!current.ownedItemIds.includes(offer.id)) {
            throw new Error(`You do not own ${offer.name}.`);
        }
        if (current.ownedItemIds.includes(target.id)) {
            throw new Error(`You already own ${target.name}.`);
        }
        if (offerCoins > current.walletCoins) {
            throw new Error("Coin offer is higher than wallet balance.");
        }
        const next = {
            ...current,
            walletCoins: current.walletCoins - offerCoins,
            ownedItemIds: current.ownedItemIds.filter((id) => id !== offer.id).concat(target.id),
        };
        this.accountStates.set(profile.id, next);
        for (const user of this.users.values()) {
            if (user.id === profile.id) {
                user.coins = next.walletCoins;
                break;
            }
        }
        if (idempotencyCacheKey) {
            this.idempotencyCache.set(idempotencyCacheKey, structuredClone(next));
        }
        return next;
    }
    async createCurrencyPurchaseOrder(token, input) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const normalized = normalizeCurrencyPurchaseInput(input);
        const existing = normalized.requestId
            ? [...this.currencyPurchaseOrders.values()].find((order) => order.userId === profile.id && order.requestId === normalized.requestId)
            : null;
        if (existing) {
            return { ...existing };
        }
        const now = new Date().toISOString();
        const order = {
            id: randomUUID(),
            userId: profile.id,
            provider: "stripe",
            status: "pending",
            coins: normalized.coins,
            usdCents: normalized.usdCents,
            requestId: normalized.requestId ?? undefined,
            createdAt: now,
            updatedAt: now,
        };
        this.currencyPurchaseOrders.set(order.id, order);
        return { ...order };
    }
    async attachCurrencyPurchaseOrderCheckout(orderId, providerSessionId, checkoutUrl) {
        const existing = this.currencyPurchaseOrders.get(orderId);
        if (!existing) {
            throw new Error("Purchase order not found.");
        }
        const updated = {
            ...existing,
            status: "checkout_created",
            providerSessionId,
            checkoutUrl,
            updatedAt: new Date().toISOString(),
        };
        this.currencyPurchaseOrders.set(orderId, updated);
        return { ...updated };
    }
    async getCurrencyPurchaseOrder(token, orderId) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const order = this.currencyPurchaseOrders.get(orderId);
        if (!order || order.userId !== profile.id) {
            throw new Error("Purchase order not found.");
        }
        return { ...order };
    }
    async fulfillCurrencyPurchaseOrder(orderId, providerSessionId) {
        const order = this.currencyPurchaseOrders.get(orderId);
        if (!order) {
            throw new Error("Purchase order not found.");
        }
        if (order.providerSessionId && order.providerSessionId !== providerSessionId) {
            throw new Error("Provider session mismatch.");
        }
        if (order.status === "fulfilled") {
            return { ...order };
        }
        const currentState = this.accountStates.get(order.userId) ?? createDefaultAccountState(0);
        const nextState = {
            ...currentState,
            walletCoins: currentState.walletCoins + order.coins,
        };
        this.accountStates.set(order.userId, nextState);
        const user = this.findUserById(order.userId);
        if (user) {
            user.coins = nextState.walletCoins;
        }
        const now = new Date().toISOString();
        const updated = {
            ...order,
            status: "fulfilled",
            providerSessionId,
            fulfilledAt: now,
            updatedAt: now,
            fulfilledState: nextState,
        };
        this.currencyPurchaseOrders.set(orderId, updated);
        return { ...updated };
    }
    async purchaseMarketplaceItem(token, input) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const item = this.marketplaceItems.get(String(input.itemId || ""));
        const requestId = normalizeIdempotencyKey(input.requestId);
        const idempotencyCacheKey = requestId ? `${profile.id}:market_purchase:${requestId}` : null;
        if (idempotencyCacheKey && this.idempotencyCache.has(idempotencyCacheKey)) {
            return structuredClone(this.idempotencyCache.get(idempotencyCacheKey));
        }
        if (!item) {
            throw new Error("Marketplace item not found.");
        }
        const buyerState = await this.getAccountState(token);
        if (buyerState.ownedItemIds.includes(item.id)) {
            throw new Error(`${item.name} is already in your inventory.`);
        }
        if (buyerState.walletCoins < item.price) {
            throw new Error(`You need ${item.price - buyerState.walletCoins} more coins.`);
        }
        const nextBuyerState = {
            ...buyerState,
            walletCoins: buyerState.walletCoins - item.price,
            ownedItemIds: [...buyerState.ownedItemIds, item.id],
        };
        this.accountStates.set(profile.id, nextBuyerState);
        const buyerUser = this.findUserById(profile.id);
        if (buyerUser) {
            buyerUser.coins = nextBuyerState.walletCoins;
        }
        if (item.creatorUserId && item.creatorUserId !== profile.id) {
            const fee = Math.max(1, Math.floor(item.price * 0.1));
            const creatorNet = Math.max(0, item.price - fee);
            const creatorUser = this.findUserById(item.creatorUserId);
            if (creatorUser) {
                creatorUser.coins += creatorNet;
            }
            const creatorState = this.accountStates.get(item.creatorUserId);
            if (creatorState) {
                this.accountStates.set(item.creatorUserId, {
                    ...creatorState,
                    walletCoins: creatorState.walletCoins + creatorNet,
                });
            }
            const currentSummary = this.creatorEconomy.get(item.creatorUserId) ?? {
                creatorGrossCoins: 0,
                creatorNetCoins: 0,
                platformFeeCoins: 0,
                salesCount: 0,
                purchasesCount: 0,
            };
            this.creatorEconomy.set(item.creatorUserId, {
                creatorGrossCoins: currentSummary.creatorGrossCoins + item.price,
                creatorNetCoins: currentSummary.creatorNetCoins + creatorNet,
                platformFeeCoins: currentSummary.platformFeeCoins + fee,
                salesCount: currentSummary.salesCount + 1,
                purchasesCount: currentSummary.purchasesCount,
            });
        }
        const buyerSummary = this.creatorEconomy.get(profile.id) ?? {
            creatorGrossCoins: 0,
            creatorNetCoins: 0,
            platformFeeCoins: 0,
            salesCount: 0,
            purchasesCount: 0,
        };
        this.creatorEconomy.set(profile.id, {
            ...buyerSummary,
            purchasesCount: buyerSummary.purchasesCount + 1,
        });
        if (idempotencyCacheKey) {
            this.idempotencyCache.set(idempotencyCacheKey, structuredClone(nextBuyerState));
        }
        return nextBuyerState;
    }
    async purchaseCurrency(token, input) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const normalized = normalizeCurrencyPurchaseInput(input);
        const coins = normalized.coins;
        const requestId = normalized.requestId;
        const idempotencyCacheKey = requestId ? `${profile.id}:currency_purchase:${requestId}` : null;
        if (idempotencyCacheKey && this.idempotencyCache.has(idempotencyCacheKey)) {
            return structuredClone(this.idempotencyCache.get(idempotencyCacheKey));
        }
        const next = await this.getAccountState(token);
        const updated = {
            ...next,
            walletCoins: next.walletCoins + coins,
        };
        this.accountStates.set(profile.id, updated);
        const user = this.findUserById(profile.id);
        if (user) {
            user.coins = updated.walletCoins;
        }
        if (idempotencyCacheKey) {
            this.idempotencyCache.set(idempotencyCacheKey, structuredClone(updated));
        }
        return updated;
    }
    async getEconomySummary(token) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        return this.creatorEconomy.get(profile.id) ?? {
            creatorGrossCoins: 0,
            creatorNetCoins: 0,
            platformFeeCoins: 0,
            salesCount: 0,
            purchasesCount: 0,
        };
    }
    findUserById(userId) {
        for (const user of this.users.values()) {
            if (user.id === userId) {
                return user;
            }
        }
        return null;
    }
    issueAuthResponse(user) {
        const token = randomUUID();
        this.sessions.set(token, user.id);
        return {
            token,
            profile: toProfileSummary(user),
        };
    }
    uniqueSlug(base) {
        let candidate = base;
        let index = 2;
        while ([...this.games.values()].some((game) => game.slug === candidate)) {
            candidate = `${base}-${index}`;
            index += 1;
        }
        return candidate;
    }
}
class PostgresStore {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async signup(input) {
        const username = input.username.trim().toLowerCase();
        const email = input.email.trim().toLowerCase();
        const displayName = input.displayName.trim();
        if (!username || !email || !displayName || !input.password.trim()) {
            throw new Error("All signup fields are required.");
        }
        const existing = await this.pool.query("SELECT 1 FROM users WHERE username = $1 OR email = $2 LIMIT 1", [username, email]);
        if (existing.rowCount) {
            throw new Error("Username or email is already in use.");
        }
        const id = randomUUID();
        await this.pool.query("INSERT INTO users (id, email, username, password_hash, role) VALUES ($1, $2, $3, $4, $5)", [id, email, username, hashPassword(input.password), "creator"]);
        await this.pool.query("INSERT INTO profiles (user_id, display_name, bio, avatar_preset, coins) VALUES ($1, $2, $3, $4, $5)", [id, displayName, "New Fairblox creator.", "starter", 250]);
        const profile = await this.getProfileByUsername(username);
        if (!profile) {
            throw new Error("Failed to load profile after signup.");
        }
        return this.issueAuthResponse(profile.id, profile);
    }
    async login(input) {
        const username = input.username.trim().toLowerCase();
        const result = await this.pool.query(`
      SELECT u.id, u.password_hash, u.role, u.username, p.display_name, p.bio, p.avatar_preset, p.coins
      FROM users u
      JOIN profiles p ON p.user_id = u.id
      WHERE u.username = $1
      LIMIT 1
      `, [username]);
        if (!result.rowCount) {
            throw new Error("Invalid username or password.");
        }
        const row = result.rows[0];
        if (row.password_hash !== hashPassword(input.password)) {
            throw new Error("Invalid username or password.");
        }
        const profile = {
            id: row.id,
            username: row.username,
            displayName: row.display_name,
            bio: row.bio,
            avatarPreset: row.avatar_preset,
            coins: row.coins,
            role: row.role,
        };
        return this.issueAuthResponse(profile.id, profile);
    }
    async getProfileByUsername(username) {
        const result = await this.pool.query(`
      SELECT u.id, u.username, u.role, p.display_name, p.bio, p.avatar_preset, p.coins
      FROM users u
      JOIN profiles p ON p.user_id = u.id
      WHERE u.username = $1
      LIMIT 1
      `, [username.trim().toLowerCase()]);
        if (!result.rowCount) {
            return null;
        }
        const row = result.rows[0];
        return {
            id: row.id,
            username: row.username,
            displayName: row.display_name,
            bio: row.bio,
            avatarPreset: row.avatar_preset,
            coins: row.coins,
            role: row.role,
        };
    }
    async getProfileFromToken(token) {
        if (!token) {
            return null;
        }
        const result = await this.pool.query(`
      SELECT u.id, u.username, u.role, p.display_name, p.bio, p.avatar_preset, p.coins
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      JOIN profiles p ON p.user_id = u.id
      WHERE s.token = $1
      LIMIT 1
      `, [token]);
        if (!result.rowCount) {
            return null;
        }
        const row = result.rows[0];
        return {
            id: row.id,
            username: row.username,
            displayName: row.display_name,
            bio: row.bio,
            avatarPreset: row.avatar_preset,
            coins: row.coins,
            role: row.role,
        };
    }
    async createGameDraft(token, input) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const title = input.title.trim();
        if (!title) {
            throw new Error("Game title is required.");
        }
        const slug = await this.uniqueSlug(slugify(title) || "untitled-game");
        const id = randomUUID();
        const result = await this.pool.query(`
      INSERT INTO games (id, creator_id, title, slug, description, genre, unity_webgl_url, visibility)
      VALUES ($1, $2, $3, $4, $5, $6, NULL, 'draft')
      RETURNING id, title, slug, description, genre, unity_webgl_url, visibility, draft_map_json, created_at, updated_at
      `, [id, profile.id, title, slug, input.description.trim(), input.genre]);
        const row = result.rows[0];
        return {
            id: row.id,
            title: row.title,
            slug: row.slug,
            description: row.description,
            genre: row.genre,
            unityWebglUrl: row.unity_webgl_url ?? undefined,
            visibility: row.visibility,
            creatorId: profile.id,
            creatorName: profile.displayName,
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString(),
            versionCount: 0,
            publishedVersionNumber: null,
        };
    }
    async listGamesForToken(token) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const result = await this.pool.query(`
      SELECT
        g.id,
        g.title,
        g.slug,
        g.description,
        g.genre,
        g.unity_webgl_url,
        g.visibility,
        g.created_at,
        g.updated_at,
        gv.version_number AS published_version_number,
        (
          SELECT COUNT(*)
          FROM game_versions version_rows
          WHERE version_rows.game_id = g.id
        ) AS version_count
      FROM games g
      LEFT JOIN game_versions gv ON gv.id = g.published_version_id
      WHERE g.creator_id = $1
      ORDER BY g.created_at DESC
      `, [profile.id]);
        return result.rows.map((row) => ({
            id: row.id,
            title: row.title,
            slug: row.slug,
            description: row.description,
            genre: row.genre,
            unityWebglUrl: row.unity_webgl_url ?? undefined,
            visibility: row.visibility,
            creatorId: profile.id,
            creatorName: profile.displayName,
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString(),
            versionCount: Number(row.version_count || 0),
            publishedVersionNumber: row.published_version_number ?? null,
        }));
    }
    async getGameDraft(token, gameId) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const result = await this.pool.query(`
      SELECT
        g.id,
        g.title,
        g.slug,
        g.description,
        g.genre,
        g.unity_webgl_url,
        g.visibility,
        g.draft_map_json,
        g.created_at,
        g.updated_at,
        gv.version_number AS published_version_number,
        (
          SELECT COUNT(*)
          FROM game_versions version_rows
          WHERE version_rows.game_id = g.id
        ) AS version_count
      FROM games g
      LEFT JOIN game_versions gv ON gv.id = g.published_version_id
      WHERE g.id = $1 AND g.creator_id = $2
      LIMIT 1
      `, [gameId, profile.id]);
        if (!result.rowCount) {
            throw new Error("Draft not found.");
        }
        const row = result.rows[0];
        return {
            id: row.id,
            title: row.title,
            slug: row.slug,
            description: row.description,
            genre: row.genre,
            unityWebglUrl: row.unity_webgl_url ?? undefined,
            visibility: row.visibility,
            creatorId: profile.id,
            creatorName: profile.displayName,
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString(),
            mapData: normalizeMapData(row.draft_map_json),
            versionCount: Number(row.version_count || 0),
            publishedVersionNumber: row.published_version_number ?? null,
        };
    }
    async saveGameMap(token, gameId, input) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const mapData = normalizeMapData(input.mapData);
        const unityWebglUrl = normalizeUnityWebglUrl(input.unityWebglUrl);
        const result = await this.pool.query(`
      UPDATE games
      SET draft_map_json = $1, unity_webgl_url = $2, updated_at = NOW()
      WHERE id = $3 AND creator_id = $4
      RETURNING id, title, slug, description, genre, unity_webgl_url, visibility, draft_map_json, created_at, updated_at
      `, [JSON.stringify(mapData), unityWebglUrl ?? null, gameId, profile.id]);
        if (!result.rowCount) {
            throw new Error("Draft not found.");
        }
        return this.getGameDraft(token, gameId);
    }
    async publishGame(token, gameId, input) {
        const draft = await this.getGameDraft(token, gameId);
        const versionResult = await this.pool.query("SELECT COALESCE(MAX(version_number), 0) AS max_version FROM game_versions WHERE game_id = $1", [gameId]);
        const nextVersion = Number(versionResult.rows[0].max_version || 0) + 1;
        const versionId = randomUUID();
        await this.pool.query(`
      INSERT INTO game_versions (id, game_id, version_number, map_data_json, changelog)
      VALUES ($1, $2, $3, $4, $5)
      `, [versionId, gameId, nextVersion, JSON.stringify(draft.mapData), input.changelog.trim()]);
        await this.pool.query(`
      UPDATE games
      SET visibility = 'published',
          published_version_id = $1,
          updated_at = NOW()
      WHERE id = $2
      `, [versionId, gameId]);
        return this.getGameDraft(token, gameId);
    }
    async unpublishGame(token, gameId) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const result = await this.pool.query(`
      UPDATE games
      SET visibility = 'draft',
          updated_at = NOW()
      WHERE id = $1 AND creator_id = $2
      RETURNING id
      `, [gameId, profile.id]);
        if (!result.rowCount) {
            throw new Error("Draft not found.");
        }
        return this.getGameDraft(token, gameId);
    }
    async listPublishedGames() {
        const result = await this.pool.query(`
      SELECT
        g.id,
        g.title,
        g.slug,
        g.description,
        g.genre,
        g.unity_webgl_url,
        g.visits,
        g.likes,
        p.display_name AS creator_name,
        (
          SELECT COUNT(*)
          FROM game_versions version_rows
          WHERE version_rows.game_id = g.id
        ) AS version_count
      FROM games g
      JOIN profiles p ON p.user_id = g.creator_id
      WHERE g.visibility = 'published' AND g.published_version_id IS NOT NULL
      ORDER BY g.updated_at DESC
      `);
        return result.rows.map((row) => {
            const stats = toPublicStats(row.slug, Number(row.version_count || 0));
            return {
                id: row.id,
                title: row.title,
                slug: row.slug,
                description: row.description,
                genre: row.genre,
                creatorName: row.creator_name,
                unityWebglUrl: row.unity_webgl_url ?? undefined,
                visits: Number(row.visits ?? 0) || stats.visits,
                likes: Number(row.likes ?? 0) || stats.likes,
            };
        });
    }
    async listPublishedGamesByCreator(username) {
        const result = await this.pool.query(`
      SELECT
        g.id,
        g.title,
        g.slug,
        g.description,
        g.genre,
        g.unity_webgl_url,
        g.visits,
        g.likes,
        p.display_name AS creator_name,
        (
          SELECT COUNT(*)
          FROM game_versions version_rows
          WHERE version_rows.game_id = g.id
        ) AS version_count
      FROM games g
      JOIN users u ON u.id = g.creator_id
      JOIN profiles p ON p.user_id = g.creator_id
      WHERE u.username = $1 AND g.visibility = 'published' AND g.published_version_id IS NOT NULL
      ORDER BY g.updated_at DESC
      `, [username.trim().toLowerCase()]);
        return result.rows.map((row) => {
            const stats = toPublicStats(row.slug, Number(row.version_count || 0));
            return {
                id: row.id,
                title: row.title,
                slug: row.slug,
                description: row.description,
                genre: row.genre,
                creatorName: row.creator_name,
                unityWebglUrl: row.unity_webgl_url ?? undefined,
                visits: Number(row.visits ?? 0) || stats.visits,
                likes: Number(row.likes ?? 0) || stats.likes,
            };
        });
    }
    async getPublishedGameBySlug(slug) {
        const result = await this.pool.query(`
      SELECT
        g.id,
        g.title,
        g.slug,
        g.description,
        g.genre,
        g.unity_webgl_url,
        g.creator_id,
        g.created_at,
        g.updated_at,
        gv.version_number AS published_version_number,
        gv.map_data_json,
        p.display_name AS creator_name,
        (
          SELECT COUNT(*)
          FROM game_versions version_rows
          WHERE version_rows.game_id = g.id
        ) AS version_count
      FROM games g
      JOIN profiles p ON p.user_id = g.creator_id
      JOIN game_versions gv ON gv.id = g.published_version_id
      WHERE g.slug = $1 AND g.visibility = 'published'
      LIMIT 1
      `, [slug]);
        if (!result.rowCount) {
            return null;
        }
        const row = result.rows[0];
        const versionCount = Number(row.version_count || 0);
        const baseStats = toPublicStats(row.slug, versionCount);
        return {
            id: row.id,
            title: row.title,
            slug: row.slug,
            description: row.description,
            genre: row.genre,
            creatorId: row.creator_id,
            creatorName: row.creator_name,
            unityWebglUrl: row.unity_webgl_url ?? undefined,
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString(),
            publishedVersionNumber: Number(row.published_version_number),
            mapData: normalizeMapData(row.map_data_json),
            visits: Number(row.visits ?? 0) || baseStats.visits,
            likes: Number(row.likes ?? 0) || baseStats.likes,
        };
    }
    async joinPublishedGame(slug) {
        const game = await this.getPublishedGameBySlug(slug);
        if (!game) {
            throw new Error("Game not found.");
        }
        const reusable = await this.pool.query(`
      SELECT id, game_id, region, status, player_count, max_players, created_at
      FROM game_sessions
      WHERE game_id = $1 AND status = 'open' AND player_count < max_players
      ORDER BY created_at ASC
      LIMIT 1
      `, [game.id]);
        let row = reusable.rows[0];
        if (!row) {
            const created = await this.pool.query(`
        INSERT INTO game_sessions (id, game_id, region, status, player_count, max_players)
        VALUES ($1, $2, 'us-east', 'open', 0, 12)
        RETURNING id, game_id, region, status, player_count, max_players, created_at
        `, [randomUUID(), game.id]);
            row = created.rows[0];
        }
        const nextCount = Number(row.player_count) + 1;
        const nextStatus = nextCount >= Number(row.max_players) ? "full" : "open";
        await this.pool.query(`
      UPDATE game_sessions
      SET player_count = $1, status = $2
      WHERE id = $3
      `, [nextCount, nextStatus, row.id]);
        await this.pool.query("UPDATE games SET visits = visits + 1 WHERE id = $1", [game.id]);
        return {
            id: row.id,
            gameId: game.id,
            gameSlug: game.slug,
            gameTitle: game.title,
            region: row.region,
            status: nextStatus,
            playerCount: nextCount,
            maxPlayers: Number(row.max_players),
            joinedAt: new Date().toISOString(),
            spawn: structuredClone(game.mapData.spawn),
        };
    }
    async likeGame(slug) {
        const result = await this.pool.query(`
      UPDATE games
      SET likes = likes + 1, updated_at = NOW()
      WHERE slug = $1 AND visibility = 'published' AND published_version_id IS NOT NULL
      RETURNING likes
      `, [slug]);
        if (!result.rowCount) {
            throw new Error("Game not found.");
        }
        return { likes: Number(result.rows[0].likes || 0) };
    }
    async favoriteGame(token, slug) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const userId = await this.getUserIdFromToken(token);
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            const gameResult = await client.query(`
        SELECT id
        FROM games
        WHERE slug = $1 AND visibility = 'published' AND published_version_id IS NOT NULL
        LIMIT 1
        FOR UPDATE
        `, [slug]);
            if (!gameResult.rowCount) {
                throw new Error("Game not found.");
            }
            const gameId = String(gameResult.rows[0].id);
            const inserted = await client.query(`
        INSERT INTO favorites (user_id, game_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, game_id) DO NOTHING
        RETURNING game_id
        `, [userId, gameId]);
            if (inserted.rowCount) {
                const updated = await client.query(`
          UPDATE games
          SET favorites = favorites + 1,
              updated_at = NOW()
          WHERE id = $1
          RETURNING favorites
          `, [gameId]);
                await client.query("COMMIT");
                return { favorites: Number(updated.rows[0].favorites || 0), favorited: true };
            }
            await client.query("DELETE FROM favorites WHERE user_id = $1 AND game_id = $2", [userId, gameId]);
            const updated = await client.query(`
        UPDATE games
        SET favorites = GREATEST(favorites - 1, 0),
            updated_at = NOW()
        WHERE id = $1
        RETURNING favorites
        `, [gameId]);
            await client.query("COMMIT");
            return { favorites: Number(updated.rows[0].favorites || 0), favorited: false };
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    }
    async followCreator(token, username) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const followerId = await this.getUserIdFromToken(token);
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            const creatorResult = await client.query("SELECT id FROM users WHERE username = $1 LIMIT 1 FOR UPDATE", [username.trim().toLowerCase()]);
            if (!creatorResult.rowCount) {
                throw new Error("Creator not found.");
            }
            const creatorId = String(creatorResult.rows[0].id);
            if (creatorId === followerId) {
                throw new Error("You cannot follow yourself.");
            }
            const inserted = await client.query(`
        INSERT INTO follows (follower_user_id, creator_user_id)
        VALUES ($1, $2)
        ON CONFLICT (follower_user_id, creator_user_id) DO NOTHING
        RETURNING creator_user_id
        `, [followerId, creatorId]);
            let following = true;
            if (!inserted.rowCount) {
                await client.query("DELETE FROM follows WHERE follower_user_id = $1 AND creator_user_id = $2", [followerId, creatorId]);
                following = false;
            }
            const countResult = await client.query("SELECT COUNT(*) AS follower_count FROM follows WHERE creator_user_id = $1", [creatorId]);
            await client.query("COMMIT");
            return {
                followers: Number(countResult.rows[0].follower_count || 0),
                following,
            };
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    }
    async getAccountState(token) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const userId = await this.getUserIdFromToken(token);
        const result = await this.pool.query("SELECT state_json FROM user_account_state WHERE user_id = $1 LIMIT 1", [userId]);
        if (!result.rowCount) {
            const seeded = createDefaultAccountState(profile.coins);
            await this.pool.query("INSERT INTO user_account_state (user_id, state_json) VALUES ($1, $2)", [userId, JSON.stringify(seeded)]);
            return seeded;
        }
        return normalizeAccountState(result.rows[0].state_json, profile.coins);
    }
    async saveAccountState(token, input) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const userId = await this.getUserIdFromToken(token);
        const normalized = normalizeAccountState(input.state, profile.coins);
        await this.pool.query(`
      INSERT INTO user_account_state (user_id, state_json)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = NOW()
      `, [userId, JSON.stringify(normalized)]);
        await this.pool.query("UPDATE profiles SET coins = $1, avatar_preset = $2, updated_at = NOW() WHERE user_id = $3", [normalized.walletCoins, normalized.avatarDraft.accessory, userId]);
        return normalized;
    }
    async listMarketplaceItems() {
        const result = await this.pool.query(`
      SELECT id, creator_name, name, category, price, accent, model_kind, emoji, description, limited, sale, supply, created_at, source
      FROM marketplace_items
      ORDER BY created_at DESC
      `);
        return result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            category: row.category,
            price: Number(row.price),
            accent: row.accent,
            modelKind: row.model_kind,
            emoji: row.emoji,
            description: row.description,
            creator: row.creator_name,
            limited: Boolean(row.limited),
            sale: Boolean(row.sale),
            supply: row.supply === null ? undefined : Number(row.supply),
            createdAt: row.created_at instanceof Date ? row.created_at.getTime() : Date.now(),
            source: row.source === "ugc" ? "ugc" : "official",
        }));
    }
    async createMarketplaceItem(token, input) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const userId = await this.getUserIdFromToken(token);
        const normalized = normalizeMarketplaceCreateInput(input);
        const id = `ugc-${slugify(normalized.name)}-${Date.now()}`;
        const result = await this.pool.query(`
      INSERT INTO marketplace_items (
        id, creator_user_id, creator_name, name, category, price, accent, model_kind, emoji, description, limited, sale, supply, source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, $12, 'ugc')
      RETURNING id, creator_name, name, category, price, accent, model_kind, emoji, description, limited, sale, supply, created_at, source
      `, [
            id,
            userId,
            profile.username,
            normalized.name,
            normalized.category,
            normalized.price,
            normalized.accent,
            normalized.modelKind,
            normalized.emoji,
            normalized.description,
            normalized.limited,
            normalized.supply ?? null,
        ]);
        const row = result.rows[0];
        return {
            id: row.id,
            name: row.name,
            category: row.category,
            price: Number(row.price),
            accent: row.accent,
            modelKind: row.model_kind,
            emoji: row.emoji,
            description: row.description,
            creator: row.creator_name,
            limited: Boolean(row.limited),
            sale: Boolean(row.sale),
            supply: row.supply === null ? undefined : Number(row.supply),
            createdAt: row.created_at instanceof Date ? row.created_at.getTime() : Date.now(),
            source: "ugc",
        };
    }
    async tradeMarketplaceLimited(token, input) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const userId = await this.getUserIdFromToken(token);
        const targetId = String(input.targetItemId || "").trim();
        const offerId = String(input.offerItemId || "").trim();
        const offerCoins = Math.max(0, Math.floor(Number(input.offerCoins || 0)));
        const requestId = normalizeIdempotencyKey(input.requestId);
        if (!targetId || !offerId) {
            throw new Error("Trade item ids are required.");
        }
        if (targetId === offerId) {
            throw new Error("Cannot trade an item for itself.");
        }
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            if (requestId) {
                const existing = await this.getIdempotentAccountState(client, userId, "trade", requestId);
                if (existing) {
                    await client.query("COMMIT");
                    return existing;
                }
            }
            const itemResult = await client.query(`
        SELECT id, name, limited
        FROM marketplace_items
        WHERE id = ANY($1)
        `, [[targetId, offerId]]);
            const rows = itemResult.rows;
            const target = rows.find((row) => row.id === targetId);
            const offer = rows.find((row) => row.id === offerId);
            if (!target || !offer) {
                throw new Error("Trade items were not found.");
            }
            if (!Boolean(target.limited) || !Boolean(offer.limited)) {
                throw new Error("Only Limited items can be traded.");
            }
            const current = await this.getOrCreateAccountStateForUser(client, userId);
            if (!current.ownedItemIds.includes(offerId)) {
                throw new Error(`You do not own ${offer.name}.`);
            }
            if (current.ownedItemIds.includes(targetId)) {
                throw new Error(`You already own ${target.name}.`);
            }
            if (offerCoins > current.walletCoins) {
                throw new Error("Coin offer is higher than wallet balance.");
            }
            const next = {
                ...current,
                walletCoins: current.walletCoins - offerCoins,
                ownedItemIds: current.ownedItemIds.filter((id) => id !== offerId).concat(targetId),
            };
            await this.saveAccountStateForUser(client, userId, next);
            await client.query(`
        INSERT INTO economy_transactions (id, user_id, kind, amount_coins, usd_cents, meta_json)
        VALUES ($1, $2, 'limited_trade', $3, NULL, $4)
        `, [randomUUID(), userId, -offerCoins, JSON.stringify({ targetItemId: targetId, offerItemId: offerId })]);
            if (requestId) {
                await this.saveIdempotentAccountState(client, userId, "trade", requestId, next);
            }
            await client.query("COMMIT");
            return next;
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    }
    async createCurrencyPurchaseOrder(token, input) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const normalized = normalizeCurrencyPurchaseInput(input);
        if (normalized.requestId) {
            const existing = await this.pool.query(`
        SELECT *
        FROM currency_purchase_orders
        WHERE user_id = $1 AND request_id = $2
        LIMIT 1
        `, [profile.id, normalized.requestId]);
            if (existing.rowCount) {
                return this.mapCurrencyPurchaseOrderRow(existing.rows[0]);
            }
        }
        const result = await this.pool.query(`
      INSERT INTO currency_purchase_orders (
        id, user_id, provider, status, coins, usd_cents, request_id
      )
      VALUES ($1, $2, 'stripe', 'pending', $3, $4, $5)
      RETURNING *
      `, [randomUUID(), profile.id, normalized.coins, normalized.usdCents, normalized.requestId ?? null]);
        return this.mapCurrencyPurchaseOrderRow(result.rows[0]);
    }
    async attachCurrencyPurchaseOrderCheckout(orderId, providerSessionId, checkoutUrl) {
        const result = await this.pool.query(`
      UPDATE currency_purchase_orders
      SET
        status = 'checkout_created',
        provider_session_id = $2,
        checkout_url = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `, [orderId, providerSessionId, checkoutUrl]);
        if (!result.rowCount) {
            throw new Error("Purchase order not found.");
        }
        return this.mapCurrencyPurchaseOrderRow(result.rows[0]);
    }
    async getCurrencyPurchaseOrder(token, orderId) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const result = await this.pool.query(`
      SELECT *
      FROM currency_purchase_orders
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `, [orderId, profile.id]);
        if (!result.rowCount) {
            throw new Error("Purchase order not found.");
        }
        return this.mapCurrencyPurchaseOrderRow(result.rows[0]);
    }
    async fulfillCurrencyPurchaseOrder(orderId, providerSessionId) {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            const orderResult = await client.query(`
        SELECT *
        FROM currency_purchase_orders
        WHERE id = $1
        FOR UPDATE
        `, [orderId]);
            if (!orderResult.rowCount) {
                throw new Error("Purchase order not found.");
            }
            const order = this.mapCurrencyPurchaseOrderRow(orderResult.rows[0]);
            if (order.providerSessionId && order.providerSessionId !== providerSessionId) {
                throw new Error("Provider session mismatch.");
            }
            if (order.status === "fulfilled") {
                await client.query("COMMIT");
                return order;
            }
            const current = await this.getOrCreateAccountStateForUser(client, order.userId);
            const next = {
                ...current,
                walletCoins: current.walletCoins + order.coins,
            };
            await this.saveAccountStateForUser(client, order.userId, next);
            await client.query(`
        INSERT INTO economy_transactions (id, user_id, kind, amount_coins, usd_cents, meta_json)
        VALUES ($1, $2, 'currency_purchase', $3, $4, $5)
        `, [
                randomUUID(),
                order.userId,
                order.coins,
                order.usdCents,
                JSON.stringify({ provider: "stripe", orderId: order.id, providerSessionId }),
            ]);
            const result = await client.query(`
        UPDATE currency_purchase_orders
        SET
          status = 'fulfilled',
          provider_session_id = COALESCE(provider_session_id, $2),
          fulfilled_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `, [orderId, providerSessionId]);
            await client.query("COMMIT");
            return this.mapCurrencyPurchaseOrderRow(result.rows[0]);
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    }
    async purchaseMarketplaceItem(token, input) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const buyerUserId = await this.getUserIdFromToken(token);
        const itemId = String(input.itemId || "").trim();
        const requestId = normalizeIdempotencyKey(input.requestId);
        if (!itemId) {
            throw new Error("Item id is required.");
        }
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            if (requestId) {
                const existing = await this.getIdempotentAccountState(client, buyerUserId, "market_purchase", requestId);
                if (existing) {
                    await client.query("COMMIT");
                    return existing;
                }
            }
            const itemResult = await client.query(`
        SELECT id, name, price, creator_user_id
        FROM marketplace_items
        WHERE id = $1
        LIMIT 1
        `, [itemId]);
            if (!itemResult.rowCount) {
                throw new Error("Marketplace item not found.");
            }
            const item = itemResult.rows[0];
            const current = await this.getOrCreateAccountStateForUser(client, buyerUserId);
            if (current.ownedItemIds.includes(item.id)) {
                throw new Error(`${item.name} is already in your inventory.`);
            }
            if (current.walletCoins < Number(item.price)) {
                throw new Error(`You need ${Number(item.price) - current.walletCoins} more coins.`);
            }
            const price = Number(item.price);
            const next = {
                ...current,
                walletCoins: current.walletCoins - price,
                ownedItemIds: [...current.ownedItemIds, item.id],
            };
            await this.saveAccountStateForUser(client, buyerUserId, next);
            const platformFeeCoins = Math.max(1, Math.floor(price * 0.1));
            const creatorNetCoins = Math.max(0, price - platformFeeCoins);
            if (item.creator_user_id && item.creator_user_id !== buyerUserId) {
                const creatorState = await this.getOrCreateAccountStateForUser(client, item.creator_user_id);
                const nextCreatorState = {
                    ...creatorState,
                    walletCoins: creatorState.walletCoins + creatorNetCoins,
                };
                await this.saveAccountStateForUser(client, item.creator_user_id, nextCreatorState);
                await client.query(`
          INSERT INTO creator_earnings (
            id, creator_user_id, buyer_user_id, item_id, gross_coins, platform_fee_coins, creator_net_coins
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [randomUUID(), item.creator_user_id, buyerUserId, item.id, price, platformFeeCoins, creatorNetCoins]);
            }
            await client.query(`
        INSERT INTO economy_transactions (id, user_id, kind, amount_coins, usd_cents, meta_json)
        VALUES ($1, $2, 'market_purchase', $3, NULL, $4)
        `, [randomUUID(), buyerUserId, -price, JSON.stringify({ itemId: item.id, itemName: item.name })]);
            if (requestId) {
                await this.saveIdempotentAccountState(client, buyerUserId, "market_purchase", requestId, next);
            }
            await client.query("COMMIT");
            return next;
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    }
    async purchaseCurrency(token, input) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const userId = await this.getUserIdFromToken(token);
        const normalized = normalizeCurrencyPurchaseInput(input);
        const coins = normalized.coins;
        const usdCents = normalized.usdCents;
        const requestId = normalized.requestId;
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            if (requestId) {
                const existing = await this.getIdempotentAccountState(client, userId, "currency_purchase", requestId);
                if (existing) {
                    await client.query("COMMIT");
                    return existing;
                }
            }
            const current = await this.getOrCreateAccountStateForUser(client, userId);
            const next = {
                ...current,
                walletCoins: current.walletCoins + coins,
            };
            await this.saveAccountStateForUser(client, userId, next);
            await client.query(`
        INSERT INTO economy_transactions (id, user_id, kind, amount_coins, usd_cents, meta_json)
        VALUES ($1, $2, 'currency_purchase', $3, $4, $5)
        `, [randomUUID(), userId, coins, usdCents, JSON.stringify({ provider: input.provider || "simulated" })]);
            if (requestId) {
                await this.saveIdempotentAccountState(client, userId, "currency_purchase", requestId, next);
            }
            await client.query("COMMIT");
            return next;
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    }
    async getEconomySummary(token) {
        const profile = await this.getProfileFromToken(token);
        if (!profile) {
            throw new Error("Invalid session.");
        }
        const userId = await this.getUserIdFromToken(token);
        const salesResult = await this.pool.query(`
      SELECT
        COALESCE(SUM(gross_coins), 0) AS gross,
        COALESCE(SUM(creator_net_coins), 0) AS net,
        COALESCE(SUM(platform_fee_coins), 0) AS fee,
        COUNT(*) AS sales_count
      FROM creator_earnings
      WHERE creator_user_id = $1
      `, [userId]);
        const purchasesResult = await this.pool.query(`
      SELECT COUNT(*) AS purchase_count
      FROM economy_transactions
      WHERE user_id = $1 AND kind IN ('market_purchase', 'currency_purchase')
      `, [userId]);
        const salesRow = salesResult.rows[0];
        const purchasesRow = purchasesResult.rows[0];
        return {
            creatorGrossCoins: Number(salesRow.gross || 0),
            creatorNetCoins: Number(salesRow.net || 0),
            platformFeeCoins: Number(salesRow.fee || 0),
            salesCount: Number(salesRow.sales_count || 0),
            purchasesCount: Number(purchasesRow.purchase_count || 0),
        };
    }
    mapCurrencyPurchaseOrderRow(row) {
        return {
            id: row.id,
            userId: row.user_id,
            provider: row.provider,
            status: row.status,
            coins: Number(row.coins),
            usdCents: Number(row.usd_cents),
            requestId: row.request_id ?? undefined,
            checkoutUrl: row.checkout_url ?? undefined,
            providerSessionId: row.provider_session_id ?? undefined,
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString(),
            fulfilledAt: row.fulfilled_at ? row.fulfilled_at.toISOString() : undefined,
        };
    }
    async getOrCreateAccountStateForUser(client, userId) {
        const profileResult = await client.query("SELECT coins FROM profiles WHERE user_id = $1 FOR UPDATE", [userId]);
        if (!profileResult.rowCount) {
            throw new Error("Profile not found.");
        }
        const profileCoins = Number(profileResult.rows[0].coins || 0);
        const stateResult = await client.query("SELECT state_json FROM user_account_state WHERE user_id = $1 FOR UPDATE", [userId]);
        if (!stateResult.rowCount) {
            const seeded = createDefaultAccountState(profileCoins);
            await client.query(`
        INSERT INTO user_account_state (user_id, state_json)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = NOW()
        `, [userId, JSON.stringify(seeded)]);
            return seeded;
        }
        return normalizeAccountState(stateResult.rows[0].state_json, profileCoins);
    }
    async saveAccountStateForUser(client, userId, state) {
        const normalized = normalizeAccountState(state, state.walletCoins);
        await client.query(`
      INSERT INTO user_account_state (user_id, state_json)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = NOW()
      `, [userId, JSON.stringify(normalized)]);
        await client.query("UPDATE profiles SET coins = $1, avatar_preset = $2, updated_at = NOW() WHERE user_id = $3", [normalized.walletCoins, normalized.avatarDraft.accessory, userId]);
        return normalized;
    }
    async getIdempotentAccountState(client, userId, action, requestId) {
        const result = await client.query(`
      SELECT account_state_json
      FROM economy_idempotency_keys
      WHERE user_id = $1 AND action = $2 AND request_id = $3
      LIMIT 1
      `, [userId, action, requestId]);
        if (!result.rowCount) {
            return null;
        }
        return normalizeAccountState(result.rows[0].account_state_json, 0);
    }
    async saveIdempotentAccountState(client, userId, action, requestId, state) {
        await client.query(`
      INSERT INTO economy_idempotency_keys (user_id, action, request_id, account_state_json)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, action, request_id) DO NOTHING
      `, [userId, action, requestId, JSON.stringify(state)]);
    }
    async issueAuthResponse(userId, profile) {
        const token = randomUUID();
        await this.pool.query("INSERT INTO auth_sessions (token, user_id) VALUES ($1, $2)", [token, userId]);
        return { token, profile };
    }
    async uniqueSlug(base) {
        let candidate = base;
        let index = 2;
        while (true) {
            const existing = await this.pool.query("SELECT 1 FROM games WHERE slug = $1 LIMIT 1", [candidate]);
            if (!existing.rowCount) {
                return candidate;
            }
            candidate = `${base}-${index}`;
            index += 1;
        }
    }
    async getUserIdFromToken(token) {
        if (!token) {
            throw new Error("Invalid session.");
        }
        const result = await this.pool.query("SELECT user_id FROM auth_sessions WHERE token = $1 LIMIT 1", [token]);
        if (!result.rowCount) {
            throw new Error("Invalid session.");
        }
        return result.rows[0].user_id;
    }
}
export async function createStore() {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
        return new InMemoryStore();
    }
    const pool = new Pool({ connectionString: databaseUrl });
    await pool.query("SELECT 1");
    await pool.query(`
    CREATE TABLE IF NOT EXISTS user_account_state (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      state_json JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `);
    await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_items (
      id TEXT PRIMARY KEY,
      creator_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      creator_name TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      accent TEXT NOT NULL,
      model_kind TEXT NOT NULL,
      emoji TEXT NOT NULL,
      description TEXT NOT NULL,
      limited BOOLEAN NOT NULL DEFAULT false,
      sale BOOLEAN NOT NULL DEFAULT false,
      supply INTEGER,
      source TEXT NOT NULL DEFAULT 'official',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `);
    await pool.query(`
    CREATE TABLE IF NOT EXISTS economy_transactions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      amount_coins INTEGER NOT NULL,
      usd_cents INTEGER,
      meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `);
    await pool.query(`
    CREATE TABLE IF NOT EXISTS creator_earnings (
      id UUID PRIMARY KEY,
      creator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL,
      gross_coins INTEGER NOT NULL,
      platform_fee_coins INTEGER NOT NULL,
      creator_net_coins INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `);
    await pool.query(`
    CREATE TABLE IF NOT EXISTS economy_idempotency_keys (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      request_id TEXT NOT NULL,
      account_state_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, action, request_id)
    )
    `);
    await pool.query(`
    CREATE TABLE IF NOT EXISTS currency_purchase_orders (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      coins INTEGER NOT NULL,
      usd_cents INTEGER NOT NULL,
      request_id TEXT,
      checkout_url TEXT,
      provider_session_id TEXT,
      fulfilled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, request_id)
    )
    `);
    await pool.query(`
    CREATE TABLE IF NOT EXISTS follows (
      follower_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      creator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_user_id, creator_user_id)
    )
    `);
    for (const item of OFFICIAL_MARKETPLACE_ITEMS) {
        await pool.query(`
      INSERT INTO marketplace_items (
        id, creator_user_id, creator_name, name, category, price, accent, model_kind, emoji, description, limited, sale, supply, source, created_at
      ) VALUES (
        $1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'official', to_timestamp($13 / 1000.0)
      )
      ON CONFLICT (id) DO NOTHING
      `, [
            item.id,
            item.creator,
            item.name,
            item.category,
            item.price,
            item.accent,
            item.modelKind,
            item.emoji,
            item.description,
            Boolean(item.limited),
            Boolean(item.sale),
            item.supply ?? null,
            item.createdAt ?? Date.now(),
        ]);
    }
    return new PostgresStore(pool);
}
