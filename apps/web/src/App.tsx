import { FormEvent, MouseEvent, Suspense, lazy, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type {
  AccountMessageThread,
  AccountState,
  AccountStateResponse,
  AuthResponse,
  AvatarDraft,
  AvatarSlot,
  CreateGameRequest,
  GameDraft,
  GameDraftDetail,
  GameCard,
  GameMapData,
  GameSessionSummary,
  LoginRequest,
  MarketplaceItemRecord,
  MarketplaceItemsResponse,
  EconomySummaryResponse,
  EconomySummary,
  PublishedGameDetail,
  PublishGameRequest,
  SaveAccountStateRequest,
  CreateMarketplaceItemResponse,
  CurrencyPurchaseCheckoutRequest,
  CurrencyPurchaseCheckoutResponse,
  CurrencyPurchaseOrderResponse,
  PurchaseMarketplaceItemRequest,
  SaveMapRequest,
  ProfileSummary,
  CreateMarketplaceTradeRequest,
  SignupRequest,
} from "@fairblox/types";
const RuntimePlaza = lazy(() =>
  import("./RuntimePlaza").then((module) => ({ default: module.RuntimePlaza })),
);

type GamesResponse = {
  games: GameCard[];
};

type ProfileResponse = {
  profile: ProfileSummary;
};

type MyGamesResponse = {
  games: GameDraft[];
};

type GameDraftResponse = {
  game: GameDraftDetail;
};

type PublicGameResponse = {
  game: GameCard | PublishedGameDetail;
};

type SessionResponse = {
  session: GameSessionSummary;
};

type LikeResponse = {
  likes: number;
};

type FavoriteResponse = {
  favorites: number;
  favorited: boolean;
};

type FollowResponse = {
  followers: number;
  following: boolean;
};

type CreatorGamesResponse = {
  games: GameCard[];
};

type ApiError = {
  error: string;
};

type AppView =
  | "home"
  | "discover"
  | "creator"
  | "profile"
  | "messages"
  | "friends"
  | "avatar"
  | "inventory"
  | "giftcards"
  | "currency"
  | "game-page"
  | "creator-page";

type MarketplaceItem = MarketplaceItemRecord;

type PlatformBrush = {
  count: number;
  spacing: number;
  rise: number;
  width: number;
  depth: number;
  direction: "x" | "z";
  color: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000").trim().replace(/\/+$/, "");
const SESSION_TOKEN_STORAGE_KEY = "fairblox.sessionToken";
const ECONOMY_SETTINGS_STORAGE_KEY = "fairblox.economy.settings";
const PENDING_CURRENCY_ORDER_STORAGE_KEY = "fairblox.pendingCurrencyOrderId";
const UNITY_WEBGL_URL = (import.meta.env.VITE_UNITY_WEBGL_URL ?? "").trim();
const WORLD_VIEW_WIDTH = 520;
const WORLD_VIEW_HEIGHT = 320;
const EDITOR_STAGE_WIDTH = 520;
const EDITOR_STAGE_HEIGHT = 320;

type RuntimeEngine = "fairblox-3d" | "unity-webgl";
type EditorSelection = { kind: "object" | "checkpoint"; id: string };
type EditorPlacementMode = "object" | "checkpoint" | null;
type EditorDragTarget = EditorSelection | null;
type UnityRuntimeLoadState = "idle" | "loading" | "ready" | "error";

const WORLD_OBJECT_TYPES: Array<GameMapData["objects"][number]["type"]> = [
  "platform",
  "start-pad",
  "goal",
  "hazard",
  "pickup",
  "wall",
  "arena",
  "cover",
  "hub",
  "tower",
  "coin",
  "spawn",
  "teleport",
  "npc",
  "custom",
];

const WORLD_MATERIALS: NonNullable<GameMapData["objects"][number]["material"]>[] = [
  "plastic",
  "metal",
  "neon",
  "stone",
  "wood",
  "glass",
];

function createCheckpoint(id: string, x: number, y: number, z: number, label?: string): GameMapData["checkpoints"][number] {
  return {
    id,
    position: { x, y, z },
    label,
  };
}

function createEditorEntityId(prefix: "object" | "checkpoint") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function getEditorWorldBounds(mapData: GameMapData) {
  const xs = [
    mapData.spawn.x,
    ...mapData.checkpoints.map((checkpoint) => checkpoint.position.x),
    ...mapData.objects.flatMap((object) => [
      object.position.x - object.size.x / 2,
      object.position.x + object.size.x / 2,
    ]),
  ];
  const zs = [
    mapData.spawn.z,
    ...mapData.checkpoints.map((checkpoint) => checkpoint.position.z),
    ...mapData.objects.flatMap((object) => [
      object.position.z - object.size.z / 2,
      object.position.z + object.size.z / 2,
    ]),
  ];
  const minX = Math.min(...xs, -20);
  const maxX = Math.max(...xs, 20);
  const minZ = Math.min(...zs, -20);
  const maxZ = Math.max(...zs, 20);
  const padding = 8;
  return {
    minX: minX - padding,
    maxX: maxX + padding,
    minZ: minZ - padding,
    maxZ: maxZ + padding,
  };
}

function worldToEditorStage(
  x: number,
  z: number,
  bounds: ReturnType<typeof getEditorWorldBounds>,
) {
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const depth = Math.max(bounds.maxZ - bounds.minZ, 1);
  return {
    x: ((x - bounds.minX) / width) * EDITOR_STAGE_WIDTH,
    y: ((z - bounds.minZ) / depth) * EDITOR_STAGE_HEIGHT,
  };
}

function editorStageToWorld(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  bounds: ReturnType<typeof getEditorWorldBounds>,
) {
  const localX = clampSize(clientX - rect.left, 0, rect.width);
  const localY = clampSize(clientY - rect.top, 0, rect.height);
  const normalizedX = rect.width === 0 ? 0 : localX / rect.width;
  const normalizedY = rect.height === 0 ? 0 : localY / rect.height;
  return {
    x: bounds.minX + normalizedX * (bounds.maxX - bounds.minX),
    z: bounds.minZ + normalizedY * (bounds.maxZ - bounds.minZ),
  };
}

function createWorldObject(
  id: string,
  type: GameMapData["objects"][number]["type"],
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  color: string,
  options?: Partial<Omit<GameMapData["objects"][number], "id" | "type" | "position" | "size" | "color">>,
): GameMapData["objects"][number] {
  return {
    id,
    type,
    position: { x, y, z },
    rotation: options?.rotation ?? { x: 0, y: 0, z: 0 },
    size: { x: sx, y: sy, z: sz },
    color,
    material: options?.material,
    tags: options?.tags,
    config: options?.config,
  };
}

const MAP_TEMPLATES: Record<CreateGameRequest["genre"], GameMapData> = {
  obby: {
    spawn: { x: 0, y: 2, z: 0 },
    checkpoints: [
      createCheckpoint("checkpoint-1", 0, 2, 10, "Stage 1"),
      createCheckpoint("checkpoint-2", 0, 2, 22, "Stage 2"),
      createCheckpoint("checkpoint-3", 0, 2, 34, "Stage 3"),
    ],
    objects: [
      createWorldObject("object-1", "start-pad", 0, 0, 0, 10, 1, 10, "#4fd1c5", { material: "neon", tags: ["spawn"] }),
      createWorldObject("object-2", "platform", 0, 2, 10, 8, 1, 8, "#5eead4", { material: "plastic" }),
      createWorldObject("object-3", "platform", 4, 4, 22, 6, 1, 6, "#f2b84b", { material: "plastic", rotation: { x: 0, y: 18, z: 0 } }),
      createWorldObject("object-4", "goal", 0, 6, 36, 10, 1, 10, "#fb7185", { material: "neon", tags: ["finish"] }),
    ],
  },
  minigame: {
    spawn: { x: 0, y: 2, z: 0 },
    checkpoints: [
      createCheckpoint("checkpoint-1", -8, 2, 0, "Left lane"),
      createCheckpoint("checkpoint-2", 8, 2, 0, "Right lane"),
    ],
    objects: [
      createWorldObject("object-1", "arena", 0, 0, 0, 28, 1, 20, "#60a5fa", { material: "stone" }),
      createWorldObject("object-2", "pickup", -8, 2, 0, 2, 2, 2, "#f59e0b", { material: "neon", tags: ["collectible"], config: { reward: 1 } }),
      createWorldObject("object-3", "pickup", 8, 2, 0, 2, 2, 2, "#34d399", { material: "neon", tags: ["collectible"], config: { reward: 1 } }),
      createWorldObject("object-4", "cover", 0, 2, -6, 4, 3, 2, "#94a3b8", { material: "metal" }),
    ],
  },
  collectathon: {
    spawn: { x: 0, y: 2, z: 0 },
    checkpoints: [
      createCheckpoint("checkpoint-1", 0, 2, 0, "Hub"),
      createCheckpoint("checkpoint-2", 14, 2, 12, "Cliff"),
      createCheckpoint("checkpoint-3", -14, 2, 16, "Forest"),
    ],
    objects: [
      createWorldObject("object-1", "hub", 0, 0, 0, 16, 1, 16, "#22c55e", { material: "wood" }),
      createWorldObject("object-2", "coin", 10, 2, 8, 2, 2, 2, "#facc15", { material: "neon", tags: ["collectible"], config: { reward: 1 } }),
      createWorldObject("object-3", "coin", -12, 2, 12, 2, 2, 2, "#facc15", { material: "neon", tags: ["collectible"], config: { reward: 1 } }),
      createWorldObject("object-4", "tower", 0, 4, 20, 6, 8, 6, "#818cf8", { material: "stone" }),
    ],
  },
};

const QUICK_OBJECTS = [
  { label: "Add platform", type: "platform", color: "#5eead4", size: { sx: 8, sy: 1, sz: 8 } },
  { label: "Add hazard", type: "hazard", color: "#fb7185", size: { sx: 6, sy: 1, sz: 6 } },
  { label: "Add pickup", type: "pickup", color: "#facc15", size: { sx: 2, sy: 2, sz: 2 } },
  { label: "Add wall", type: "wall", color: "#94a3b8", size: { sx: 2, sy: 4, sz: 10 } },
] as const;

const MARKETPLACE_ITEMS: MarketplaceItem[] = [
  {
    id: "builder-cap",
    name: "Builder Cap",
    category: "Hat",
    price: 120,
    accent: "linear-gradient(135deg, #f59e0b, #f97316)",
    modelKind: "cap",
    emoji: "🧢",
    creator: "FairbloxStudio",
    description: "Classic creator cap for Fairblox studio builders.",
    createdAt: 1,
  },
  {
    id: "neon-blade",
    name: "Neon Blade",
    category: "Gear",
    price: 280,
    accent: "linear-gradient(135deg, #0ea5e9, #6366f1)",
    modelKind: "blade",
    emoji: "⚔️",
    creator: "NorthStarDev",
    description: "Glowing showcase item for profile and action games.",
    limited: true,
    supply: 320,
    createdAt: 2,
  },
  {
    id: "cloud-wings",
    name: "Cloud Wings",
    category: "Back",
    price: 340,
    accent: "linear-gradient(135deg, #818cf8, #c4b5fd)",
    modelKind: "wings",
    emoji: "🪽",
    creator: "SkyForge",
    description: "Soft floating wings for fantasy and obby avatars.",
    limited: true,
    supply: 150,
    createdAt: 3,
  },
  {
    id: "pixel-boombox",
    name: "Pixel Boombox",
    category: "Accessory",
    price: 180,
    accent: "linear-gradient(135deg, #ec4899, #f59e0b)",
    modelKind: "boombox",
    emoji: "📻",
    creator: "PlutoBuilds",
    description: "Retro shoulder gear for hangout spaces and music worlds.",
    createdAt: 4,
  },
  {
    id: "frost-crown",
    name: "Frost Crown",
    category: "Hat",
    price: 450,
    accent: "linear-gradient(135deg, #22d3ee, #a5f3fc)",
    modelKind: "crown",
    emoji: "👑",
    creator: "IceCastleUGC",
    description: "Shimmering crown worn by legendary frost wizards.",
    limited: true,
    supply: 90,
    createdAt: 5,
  },
  {
    id: "shades-cool",
    name: "Galaxy Shades",
    category: "Face",
    price: 95,
    accent: "linear-gradient(135deg, #1e1b4b, #4f46e5)",
    modelKind: "glasses",
    emoji: "🕶️",
    creator: "StyleDrops",
    description: "Deep space lenses. Very cool.",
    createdAt: 6,
  },
  {
    id: "fire-wings",
    name: "Blaze Wings",
    category: "Back",
    price: 390,
    accent: "linear-gradient(135deg, #dc2626, #f97316)",
    modelKind: "wings",
    emoji: "🔥",
    creator: "InfernoUGC",
    description: "Flames that trail behind you in every world.",
    limited: true,
    supply: 75,
    createdAt: 7,
  },
  {
    id: "pixel-sword",
    name: "Pixel Sword",
    category: "Gear",
    price: 85,
    accent: "linear-gradient(135deg, #64748b, #94a3b8)",
    modelKind: "blade",
    emoji: "🗡️",
    creator: "RetroForge",
    description: "Classic 8-bit styled blade for retro world builders.",
    sale: true,
    createdAt: 8,
  },
  {
    id: "space-helmet",
    name: "Space Helmet",
    category: "Hat",
    price: 220,
    accent: "linear-gradient(135deg, #1d4ed8, #06b6d4)",
    modelKind: "helmet",
    emoji: "🪐",
    creator: "CosmicUGC",
    description: "Pressurized helmet for galaxy explorers.",
    createdAt: 9,
  },
  {
    id: "rainbow-halo",
    name: "Rainbow Halo",
    category: "Hat",
    price: 500,
    accent: "linear-gradient(135deg, #f43f5e, #a855f7, #3b82f6)",
    modelKind: "halo",
    emoji: "✨",
    creator: "FairbloxStudio",
    description: "Prismatic halo that cycles through every color.",
    limited: true,
    supply: 60,
    createdAt: 10,
  },
  {
    id: "golden-chain",
    name: "Golden Chain",
    category: "Accessory",
    price: 140,
    accent: "linear-gradient(135deg, #ca8a04, #fbbf24)",
    modelKind: "chain",
    emoji: "⛓️",
    creator: "SwaggerDrops",
    description: "Heavy-link chain worn by the boldest builders.",
    sale: true,
    createdAt: 11,
  },
  {
    id: "dino-hat",
    name: "Dino Top",
    category: "Hat",
    price: 65,
    accent: "linear-gradient(135deg, #16a34a, #84cc16)",
    modelKind: "dino",
    emoji: "🦕",
    creator: "JungleUGC",
    description: "Iconic dinosaur hat that never goes out of style.",
    createdAt: 12,
  },
];

const MESSAGE_THREADS: AccountMessageThread[] = [
  {
    id: "thread-nova",
    name: "Nova",
    status: "Playing Test Tower",
    messages: [
      { from: "friend", body: "You should publish that obby update tonight.", at: "7:12 PM" },
      { from: "me", body: "I just pushed a new world preview for it.", at: "7:14 PM" },
      { from: "friend", body: "Open Friends after this, I want to party up.", at: "7:15 PM" },
    ],
  },
  {
    id: "thread-bytefox",
    name: "ByteFox",
    status: "In Studio",
    messages: [
      { from: "friend", body: "Avatar page should let you swap colors and accessories.", at: "6:44 PM" },
      { from: "me", body: "Working on that next. Inventory and marketplace too.", at: "6:46 PM" },
    ],
  },
  {
    id: "thread-sora",
    name: "Sora",
    status: "Browsing Marketplace",
    messages: [
      { from: "friend", body: "Gift cards should feed into currency like Roblox does.", at: "5:33 PM" },
      { from: "me", body: "Yep, redeem flow is going in the sidebar destination.", at: "5:35 PM" },
    ],
  },
];

const GIFT_CARD_OPTIONS = [
  { id: "gift-10", title: "$10 Creator Card", subtitle: "Adds 800 coins and an exclusive badge.", coins: 800 },
  { id: "gift-25", title: "$25 World Pass", subtitle: "Adds 2200 coins plus a launch crate.", coins: 2200 },
  { id: "gift-50", title: "$50 Studio Pack", subtitle: "Adds 5000 coins and featured creator flair.", coins: 5000 },
];

const COIN_BUNDLES = [
  { id: "coins-400", title: "Starter Pack", priceLabel: "$4.99", coins: 400 },
  { id: "coins-1000", title: "Builder Pack", priceLabel: "$9.99", coins: 1000 },
  { id: "coins-2500", title: "Creator Pack", priceLabel: "$19.99", coins: 2500 },
  { id: "coins-7000", title: "Studio Pack", priceLabel: "$49.99", coins: 7000 },
];

const AVATAR_COLOR_SWATCHES = ["#f97316", "#60a5fa", "#34d399", "#fb7185", "#a78bfa", "#f2b84b"];
const SKIN_TONES = ["#f6c8a2", "#e5b48d", "#c68c68", "#8f5f43"];
const GENRE_EMOJIS: Record<string, string> = {
  obby: "🏗️",
  minigame: "🎮",
  collectathon: "💎",
  platformer: "⛰️",
  default: "🌍",
};
const AVATAR_FACES = ["Classic Smile", "Wink", "Focused", "Builder"];
const AVATAR_ACCESSORIES = ["Builder Cap", "Cloud Wings", "Neon Blade", "Pixel Boombox"];
const AVATAR_AURAS = ["None", "Neon", "Flame", "Frost"] as const;

type AvatarEditorTab = "Recent" | "Avatars" | "Body" | "Makeup" | "Clothing" | "Accessories" | "Animations";
const AVATAR_EDITOR_TABS: readonly AvatarEditorTab[] = ["Recent", "Avatars", "Body", "Makeup", "Clothing", "Accessories", "Animations"];

type AvatarCatalogDef = {
  id: string; name: string; emoji: string; bg: string;
  cat: "Avatars" | "Body" | "Makeup" | "Clothing" | "Accessories" | "Animations";
  kind: "skin" | "face" | "shirt" | "pants" | "accessory" | "preset" | "animation";
  val: string; price?: number; limited?: boolean;
};

const AVATAR_CATALOG_DEFS: AvatarCatalogDef[] = [
  { id: "skin-pale",     name: "Pale",          emoji: "👤", bg: "#f6c8a2", cat: "Body",        kind: "skin",      val: "#f6c8a2" },
  { id: "skin-light",    name: "Light",         emoji: "👤", bg: "#e5b48d", cat: "Body",        kind: "skin",      val: "#e5b48d" },
  { id: "skin-medium",   name: "Medium",        emoji: "👤", bg: "#c68c68", cat: "Body",        kind: "skin",      val: "#c68c68" },
  { id: "skin-dark",     name: "Deep",          emoji: "👤", bg: "#8f5f43", cat: "Body",        kind: "skin",      val: "#8f5f43" },
  { id: "face-smile",    name: "Classic Smile", emoji: "😊", bg: "#fbbf24", cat: "Makeup",      kind: "face",      val: "Classic Smile" },
  { id: "face-wink",     name: "Wink",          emoji: "😉", bg: "#34d399", cat: "Makeup",      kind: "face",      val: "Wink" },
  { id: "face-focused",  name: "Focused",       emoji: "😤", bg: "#60a5fa", cat: "Makeup",      kind: "face",      val: "Focused" },
  { id: "face-builder",  name: "Builder",       emoji: "😐", bg: "#a78bfa", cat: "Makeup",      kind: "face",      val: "Builder" },
  { id: "shirt-orange",  name: "Orange Tee",    emoji: "👕", bg: "#f97316", cat: "Clothing",    kind: "shirt",     val: "#f97316" },
  { id: "shirt-blue",    name: "Blue Tee",      emoji: "👕", bg: "#60a5fa", cat: "Clothing",    kind: "shirt",     val: "#60a5fa" },
  { id: "shirt-green",   name: "Mint Tee",      emoji: "👕", bg: "#34d399", cat: "Clothing",    kind: "shirt",     val: "#34d399" },
  { id: "shirt-pink",    name: "Pink Tee",      emoji: "👕", bg: "#fb7185", cat: "Clothing",    kind: "shirt",     val: "#fb7185" },
  { id: "shirt-purple",  name: "Violet Tee",    emoji: "👕", bg: "#a78bfa", cat: "Clothing",    kind: "shirt",     val: "#a78bfa" },
  { id: "shirt-yellow",  name: "Gold Tee",      emoji: "👕", bg: "#f2b84b", cat: "Clothing",    kind: "shirt",     val: "#f2b84b" },
  { id: "pants-navy",    name: "Navy Jeans",    emoji: "👖", bg: "#1d4ed8", cat: "Clothing",    kind: "pants",     val: "#1d4ed8" },
  { id: "pants-orange",  name: "Orange Pants",  emoji: "👖", bg: "#f97316", cat: "Clothing",    kind: "pants",     val: "#f97316" },
  { id: "pants-green",   name: "Mint Pants",    emoji: "👖", bg: "#34d399", cat: "Clothing",    kind: "pants",     val: "#34d399" },
  { id: "pants-pink",    name: "Pink Pants",    emoji: "👖", bg: "#fb7185", cat: "Clothing",    kind: "pants",     val: "#fb7185" },
  { id: "pants-purple",  name: "Violet Pants",  emoji: "👖", bg: "#a78bfa", cat: "Clothing",    kind: "pants",     val: "#a78bfa" },
  { id: "pants-black",   name: "Black Pants",   emoji: "👖", bg: "#334155", cat: "Clothing",    kind: "pants",     val: "#334155" },
  { id: "builder-cap",   name: "Builder Cap",   emoji: "🧢", bg: "#f59e0b", cat: "Accessories", kind: "accessory", val: "Builder Cap",   price: 120 },
  { id: "neon-blade",    name: "Neon Blade",    emoji: "⚔️", bg: "#0ea5e9", cat: "Accessories", kind: "accessory", val: "Neon Blade",    price: 280, limited: true },
  { id: "cloud-wings",   name: "Cloud Wings",   emoji: "🪽", bg: "#818cf8", cat: "Accessories", kind: "accessory", val: "Cloud Wings",   price: 340, limited: true },
  { id: "pixel-boombox", name: "Pixel Boombox", emoji: "📻", bg: "#ec4899", cat: "Accessories", kind: "accessory", val: "Pixel Boombox", price: 180 },
  { id: "frost-crown",   name: "Frost Crown",   emoji: "👑", bg: "#22d3ee", cat: "Accessories", kind: "accessory", val: "Frost Crown",   price: 450, limited: true },
  { id: "galaxy-shades", name: "Galaxy Shades", emoji: "🕶️", bg: "#4f46e5", cat: "Accessories", kind: "accessory", val: "Galaxy Shades", price: 95 },
  { id: "blaze-wings",   name: "Blaze Wings",   emoji: "🔥", bg: "#dc2626", cat: "Accessories", kind: "accessory", val: "Blaze Wings",   price: 390, limited: true },
  { id: "pixel-sword",   name: "Pixel Sword",   emoji: "🗡️", bg: "#64748b", cat: "Accessories", kind: "accessory", val: "Pixel Sword",   price: 85 },
  { id: "space-helmet",  name: "Space Helmet",  emoji: "🪐", bg: "#1d4ed8", cat: "Accessories", kind: "accessory", val: "Space Helmet",  price: 220 },
  { id: "rainbow-halo",  name: "Rainbow Halo",  emoji: "✨", bg: "#f43f5e", cat: "Accessories", kind: "accessory", val: "Rainbow Halo",  price: 500, limited: true },
  { id: "preset-builder",name: "Builder",       emoji: "🏗️", bg: "#f97316", cat: "Avatars",     kind: "preset",    val: "Builder" },
  { id: "preset-neon",   name: "Neon",          emoji: "🌈", bg: "#fb7185", cat: "Avatars",     kind: "preset",    val: "Neon" },
  { id: "preset-sky",    name: "Sky",           emoji: "☁️", bg: "#60a5fa", cat: "Avatars",     kind: "preset",    val: "Sky" },
  { id: "anim-default",  name: "Default Walk",  emoji: "🚶", bg: "#4fd1c5", cat: "Animations",  kind: "animation", val: "Default" },
  { id: "anim-swagger",  name: "Swagger",       emoji: "😎", bg: "#f0b840", cat: "Animations",  kind: "animation", val: "Swagger" },
  { id: "anim-ninja",    name: "Ninja Run",     emoji: "🥷", bg: "#818cf8", cat: "Animations",  kind: "animation", val: "Ninja" },
  { id: "anim-dance",    name: "Dance",         emoji: "💃", bg: "#fb7185", cat: "Animations",  kind: "animation", val: "Dance" },
];

const DEFAULT_AVATAR_DRAFT: AvatarDraft = {
  skinTone: SKIN_TONES[0],
  shirtColor: AVATAR_COLOR_SWATCHES[0],
  pantsColor: "#1d4ed8",
  face: AVATAR_FACES[0],
  accessory: AVATAR_ACCESSORIES[0],
};

const AVATAR_PRESETS: Array<{ label: string; draft: AvatarDraft }> = [
  {
    label: "Builder",
    draft: { ...DEFAULT_AVATAR_DRAFT },
  },
  {
    label: "Neon",
    draft: {
      skinTone: SKIN_TONES[1],
      shirtColor: "#fb7185",
      pantsColor: "#a78bfa",
      face: "Focused",
      accessory: "Neon Blade",
    },
  },
  {
    label: "Sky",
    draft: {
      skinTone: SKIN_TONES[0],
      shirtColor: "#60a5fa",
      pantsColor: "#1d4ed8",
      face: "Wink",
      accessory: "Cloud Wings",
    },
  },
];

const ACCESSORY_CATALOG_ITEMS = AVATAR_CATALOG_DEFS.filter(
  (item): item is AvatarCatalogDef & { kind: "accessory" } => item.kind === "accessory",
);

function createDefaultAvatarSlots(): AvatarSlot[] {
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
        skinTone: SKIN_TONES[1],
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
        skinTone: SKIN_TONES[0],
        shirtColor: "#60a5fa",
        pantsColor: "#1d4ed8",
        face: "Wink",
        accessory: "Cloud Wings",
      },
    },
  ];
}

function createDefaultAccountState(coins: number): AccountState {
  const avatarSlots = createDefaultAvatarSlots();
  return {
    walletCoins: coins,
    ownedItemIds: ["builder-cap"],
    selectedThreadId: MESSAGE_THREADS[0].id,
    avatarDraft: { ...avatarSlots[0].draft },
    activeAvatarSlotId: avatarSlots[0].id,
    avatarSlots,
    messageThreads: structuredClone(MESSAGE_THREADS),
  };
}

function clampSize(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function blendColor(hex: string, ratio: number) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return hex;
  }
  const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
  const nextChannel = (channel: number) => {
    const target = ratio >= 0 ? 255 : 0;
    const amount = Math.abs(ratio);
    return Math.round(channel + (target - channel) * amount)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${nextChannel(red)}${nextChannel(green)}${nextChannel(blue)}`;
}

function projectWorldPoint(
  x: number,
  y: number,
  z: number,
  origin: { x: number; y: number; z: number },
) {
  const relativeX = x - origin.x;
  const relativeY = y - origin.y;
  const relativeZ = z - origin.z + 26;
  const depth = clampSize(relativeZ, 6, 80);
  const perspective = 220 / depth;
  return {
    x: WORLD_VIEW_WIDTH / 2 + relativeX * perspective,
    y: WORLD_VIEW_HEIGHT * 0.68 - relativeY * perspective - depth * 1.7,
    scale: perspective,
    depth,
  };
}

function buildWorldBox(
  object: GameMapData["objects"][number],
  origin: { x: number; y: number; z: number },
) {
  const center = projectWorldPoint(object.position.x, object.position.y, object.position.z, origin);
  const width = clampSize(object.size.x * center.scale, 20, 180);
  const depthWidth = clampSize(object.size.z * center.scale * 0.72, 16, 140);
  const height = clampSize(object.size.y * center.scale * 1.6, 18, 180);
  const left = center.x - width / 2;
  const right = center.x + width / 2;
  const frontTop = center.y - height;
  const frontBottom = center.y;
  const depthOffsetX = depthWidth * 0.36;
  const depthOffsetY = depthWidth * 0.22;

  return {
    depth: center.depth,
    front: `${left},${frontTop} ${right},${frontTop} ${right},${frontBottom} ${left},${frontBottom}`,
    side: `${right},${frontTop} ${right + depthOffsetX},${frontTop - depthOffsetY} ${right + depthOffsetX},${frontBottom - depthOffsetY} ${right},${frontBottom}`,
    top: `${left},${frontTop} ${right},${frontTop} ${right + depthOffsetX},${frontTop - depthOffsetY} ${left + depthOffsetX},${frontTop - depthOffsetY}`,
    labelX: center.x,
    labelY: frontTop - 8,
    baseY: frontBottom,
  };
}

function cloneMapData(mapData: GameMapData): GameMapData {
  return JSON.parse(JSON.stringify(mapData)) as GameMapData;
}

function createTemplateMap(genre: CreateGameRequest["genre"]): GameMapData {
  return cloneMapData(MAP_TEMPLATES[genre]);
}

function normalizeEditorMapData(value: unknown): GameMapData {
  const hasVector = (vector: { x?: unknown; y?: unknown; z?: unknown } | undefined) =>
    Boolean(
      vector &&
        Number.isFinite(vector.x) &&
        Number.isFinite(vector.y) &&
        Number.isFinite(vector.z),
    );

  if (!value || typeof value !== "object") {
    throw new Error("Map JSON must be an object.");
  }

  const mapData = value as {
    spawn?: unknown;
    checkpoints?: unknown;
    objects?: unknown;
  };

  if (!hasVector(mapData.spawn as { x?: unknown; y?: unknown; z?: unknown })) {
    throw new Error("Spawn must include numeric x, y, z values.");
  }
  if (!Array.isArray(mapData.checkpoints) || !Array.isArray(mapData.objects)) {
    throw new Error("Map JSON must include checkpoints and objects arrays.");
  }

  const checkpoints = mapData.checkpoints.map((checkpoint, index) => {
    if (!checkpoint || typeof checkpoint !== "object") {
      throw new Error("Each checkpoint must be an object.");
    }
    const item = checkpoint as {
      id?: unknown;
      position?: unknown;
      x?: unknown;
      y?: unknown;
      z?: unknown;
      radius?: unknown;
      label?: unknown;
    };
    const position = hasVector(item.position as { x?: unknown; y?: unknown; z?: unknown })
      ? (item.position as { x: number; y: number; z: number })
      : hasVector(item as { x?: unknown; y?: unknown; z?: unknown })
        ? { x: item.x as number, y: item.y as number, z: item.z as number }
        : null;
    if (!position) {
      throw new Error("Each checkpoint must include numeric x, y, z values.");
    }
    return {
      id: typeof item.id === "string" && item.id.trim().length > 0 ? item.id.trim() : `checkpoint-${index + 1}`,
      position,
      radius: Number.isFinite(item.radius) && Number(item.radius) > 0 ? Number(item.radius) : undefined,
      label: typeof item.label === "string" && item.label.trim().length > 0 ? item.label.trim() : undefined,
    };
  });

  const objects = mapData.objects.map((object, index) => {
    if (!object || typeof object !== "object") {
      throw new Error("Each object must be an object.");
    }
    const item = object as {
      id?: unknown;
      type?: unknown;
      position?: unknown;
      rotation?: unknown;
      size?: unknown;
      x?: unknown;
      y?: unknown;
      z?: unknown;
      sx?: unknown;
      sy?: unknown;
      sz?: unknown;
      color?: unknown;
      material?: unknown;
      tags?: unknown;
      config?: unknown;
    };
    if (typeof item.type !== "string" || item.type.trim().length === 0) {
      throw new Error("Each object needs a type.");
    }
    const position = hasVector(item.position as { x?: unknown; y?: unknown; z?: unknown })
      ? (item.position as { x: number; y: number; z: number })
      : hasVector(item as { x?: unknown; y?: unknown; z?: unknown })
        ? { x: item.x as number, y: item.y as number, z: item.z as number }
        : null;
    const size = hasVector(item.size as { x?: unknown; y?: unknown; z?: unknown })
      ? (item.size as { x: number; y: number; z: number })
      : hasVector({ x: item.sx, y: item.sy, z: item.sz })
        ? { x: item.sx as number, y: item.sy as number, z: item.sz as number }
        : null;
    if (!position || !size || size.x <= 0 || size.y <= 0 || size.z <= 0) {
      throw new Error("Each object needs numeric position and positive size values.");
    }
    if (typeof item.color !== "string" || item.color.trim().length === 0) {
      throw new Error("Each object needs a color.");
    }
    const rotation = hasVector(item.rotation as { x?: unknown; y?: unknown; z?: unknown })
      ? (item.rotation as { x: number; y: number; z: number })
      : { x: 0, y: 0, z: 0 };
    return {
      id: typeof item.id === "string" && item.id.trim().length > 0 ? item.id.trim() : `object-${index + 1}`,
      type: item.type.trim(),
      position,
      rotation,
      size,
      color: item.color.trim(),
      material:
        typeof item.material === "string" && item.material.trim().length > 0
          ? item.material.trim().slice(0, 16) as GameMapData["objects"][number]["material"]
          : undefined,
      tags: Array.isArray(item.tags)
        ? item.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0).map((tag) => tag.trim())
        : undefined,
      config:
        item.config && typeof item.config === "object" && !Array.isArray(item.config)
          ? Object.fromEntries(
              Object.entries(item.config).filter(
                ([key, entry]) =>
                  key.trim().length > 0 &&
                  (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean"),
              ),
            )
          : undefined,
    };
  });

  return {
    spawn: mapData.spawn as { x: number; y: number; z: number },
    checkpoints,
    objects,
  };
}

function parseMapJson(value: string): GameMapData {
  return normalizeEditorMapData(JSON.parse(value));
}

function validateMapData(value: GameMapData): string | null {
  try {
    normalizeEditorMapData(value);
    return null;
  } catch (error: unknown) {
    return error instanceof Error ? error.message : "Map JSON is invalid.";
  }
}

function getParsedMapData(mapJson: string) {
  const parsed = parseMapJson(mapJson);
  const validationError = validateMapData(parsed);
  if (validationError) {
    throw new Error(validationError);
  }
  return parsed;
}

function validateUnityWebglUrl(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Unity URL must use http:// or https://";
    }
  } catch {
    return "Unity URL must be a valid absolute URL.";
  }
  return null;
}

function getEditorMessageTone(message: string): "success" | "info" | "error" {
  const normalized = message.trim().toLowerCase();
  if (normalized === "map saved." || normalized === "game published." || normalized === "game moved back to draft.") {
    return "success";
  }
  if (normalized.includes("could not") || normalized.includes("invalid") || normalized.includes("must")) {
    return "error";
  }
  return "info";
}

function createQuickObject(
  type: string,
  color: string,
  size: { sx: number; sy: number; sz: number },
  index: number,
) {
  return createWorldObject(
    `object-${index + 1}`,
    type,
    (index % 3) * 8 - 8,
    Math.max(1, Math.floor(index / 3) * 2),
    index * 8 + 8,
    size.sx,
    size.sy,
    size.sz,
    color,
    { material: type === "hazard" ? "neon" : "plastic" },
  );
}

function uniqueGames(items: Array<GameCard | PublishedGameDetail | null | undefined>) {
  const seen = new Set<string>();
  return items.filter((item): item is GameCard | PublishedGameDetail => {
    if (!item || seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

function MarketplaceModel({ kind, emoji }: { kind: MarketplaceItem["modelKind"]; emoji: string }) {
  return (
    <div className={`market-model market-model-${kind}`}>
      <div className="market-model-shadow" />
      <div className="market-model-core">
        <span className="market-model-face" />
        <span className="market-model-top" />
        <span className="market-model-side" />
      </div>
      <div className="market-model-emoji" aria-hidden="true">{emoji}</div>
    </div>
  );
}

export function App() {
  const [games, setGames] = useState<GameCard[]>([]);
  const [sessionToken, setSessionToken] = useState<string>(() => {
    try {
      return localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [activeView, setActiveView] = useState<AppView>("home");
  const [myGames, setMyGames] = useState<GameDraft[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameDraftDetail | null>(null);
  const [selectedPublicGame, setSelectedPublicGame] = useState<PublishedGameDetail | GameCard | null>(null);
  const [activeSession, setActiveSession] = useState<GameSessionSummary | null>(null);
  const [runtimePosition, setRuntimePosition] = useState<{ x: number; y: number; z: number } | null>(null);
  const [runtimeFacing, setRuntimeFacing] = useState<number>(0);
  const [runtimeSessionCoins, setRuntimeSessionCoins] = useState<number>(0);
  const [runtimeCheckpointLabel, setRuntimeCheckpointLabel] = useState<string | null>(null);
  const [runtimeCollectedObjectIds, setRuntimeCollectedObjectIds] = useState<string[]>([]);
  const [runtimeZone, setRuntimeZone] = useState<"spawn" | "fountain" | "shop" | "portal-obby" | "portal-minigame" | null>(null);
  const [runtimePrompt, setRuntimePrompt] = useState<string | null>(null);
  const [runtimeChatDraft, setRuntimeChatDraft] = useState<string>("");
  const [runtimeChatMessages, setRuntimeChatMessages] = useState<Array<{ id: string; name: string; body: string; tone: "me" | "system" | "player" }>>([]);
  const [runtimeEngine, setRuntimeEngine] = useState<RuntimeEngine>("fairblox-3d");
  const [unityRuntimeLoadState, setUnityRuntimeLoadState] = useState<UnityRuntimeLoadState>("idle");
  const [unityRuntimeFrameKey, setUnityRuntimeFrameKey] = useState<number>(0);
  const [authError, setAuthError] = useState<string>("");
  const [sessionRestoreMessage, setSessionRestoreMessage] = useState<string>("");
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(Boolean(sessionToken));
  const [gameError, setGameError] = useState<string>("");
  const [editorMessage, setEditorMessage] = useState<string>("");
  const [storeMessage, setStoreMessage] = useState<string>("");
  const [avatarMessage, setAvatarMessage] = useState<string>("");

  type ToastKind = "success" | "error" | "info";
  type Toast = { id: string; message: string; kind: ToastKind };
  const [toasts, setToasts] = useState<Toast[]>([]);

  type TxEntry = { id: string; label: string; delta: number; at: string };
  const [txHistory, setTxHistory] = useState<TxEntry[]>([]);

  const [buyingItemId, setBuyingItemId] = useState<string | null>(null);
  const [isBuyingCurrency, setIsBuyingCurrency] = useState<boolean>(false);
  const [isTrading, setIsTrading] = useState<boolean>(false);
  const runtimeInputRef = useRef({ forward: false, back: false, left: false, right: false });
  const runtimeJumpVelocityRef = useRef(0);
  const runtimeOnGroundRef = useRef(true);

  function pushToast(message: string, kind: ToastKind = "success") {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-4), { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  function pushTx(label: string, delta: number) {
    const at = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const id = Math.random().toString(36).slice(2);
    setTxHistory((prev) => [{ id, label, delta, at }, ...prev].slice(0, 50));
  }
  const [publishForm, setPublishForm] = useState<PublishGameRequest>({
    changelog: "",
  });
  const [signupForm, setSignupForm] = useState<SignupRequest>({
    email: "",
    username: "",
    password: "",
    displayName: "",
  });
  const [loginForm, setLoginForm] = useState<LoginRequest>({
    username: "",
    password: "",
  });
  const [gameForm, setGameForm] = useState<CreateGameRequest>({
    title: "",
    description: "",
    genre: "obby",
  });
  const [platformBrush, setPlatformBrush] = useState<PlatformBrush>({
    count: 6,
    spacing: 8,
    rise: 0,
    width: 8,
    depth: 8,
    direction: "z",
    color: "#5eead4",
  });
  const [mapJson, setMapJson] = useState<string>("");
  const [editorSelection, setEditorSelection] = useState<EditorSelection | null>(null);
  const [editorPlacementMode, setEditorPlacementMode] = useState<EditorPlacementMode>(null);
  const [editorDragTarget, setEditorDragTarget] = useState<EditorDragTarget>(null);
  const [pendingCurrencyOrderId, setPendingCurrencyOrderId] = useState<string | null>(() => {
    try {
      const orderFromUrl = new URLSearchParams(window.location.search).get("order");
      if (orderFromUrl) {
        return orderFromUrl;
      }
      return localStorage.getItem(PENDING_CURRENCY_ORDER_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [walletCoins, setWalletCoins] = useState<number>(0);
  const [ownedItemIds, setOwnedItemIds] = useState<string[]>(["builder-cap"]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>(MESSAGE_THREADS[0].id);
  const [messageThreads, setMessageThreads] = useState<AccountMessageThread[]>(structuredClone(MESSAGE_THREADS));
  const [avatarDraft, setAvatarDraft] = useState<AvatarDraft>({ ...DEFAULT_AVATAR_DRAFT });
  const [activeAvatarSlotId, setActiveAvatarSlotId] = useState<string>("slot-1");
  const [avatarSlots, setAvatarSlots] = useState<AvatarSlot[]>(createDefaultAvatarSlots());
  const [avatarEditorTab, setAvatarEditorTab] = useState<AvatarEditorTab>("Recent");
  const [viewingGame, setViewingGame] = useState<GameCard | null>(null);
  const [viewingCreatorName, setViewingCreatorName] = useState<string>("");
  const [creatorPageGames, setCreatorPageGames] = useState<GameCard[]>([]);
  const [likedGameIds, setLikedGameIds] = useState<Set<string>>(new Set());
  const [favoritedGameIds, setFavoritedGameIds] = useState<Set<string>>(new Set());
  const [followedCreatorUsernames, setFollowedCreatorUsernames] = useState<Set<string>>(new Set());
  const [viewingCreatorFollowers, setViewingCreatorFollowers] = useState<number>(0);
  const [discoverCategoryTab, setDiscoverCategoryTab] = useState<"featured" | "trending" | "new" | "multiplayer" | "all">("featured");
  const [discoverQuery, setDiscoverQuery] = useState<string>("");
  const [discoverGenreFilter, setDiscoverGenreFilter] = useState<"all" | CreateGameRequest["genre"]>("all");
  const [discoverSort, setDiscoverSort] = useState<"visits" | "likes" | "title">("visits");
  const [marketSearch, setMarketSearch] = useState<string>("");
  const [marketCategory, setMarketCategory] = useState<string>("All");
  const [marketSort, setMarketSort] = useState<"relevance" | "price-asc" | "price-desc" | "newest">("relevance");
  const [marketTab, setMarketTab] = useState<"shop" | "create" | "trade">("shop");
  const [marketItems, setMarketItems] = useState<MarketplaceItem[]>(MARKETPLACE_ITEMS);
  const [creatorForm, setCreatorForm] = useState<{
    name: string;
    category: "Hat" | "Gear" | "Back" | "Accessory" | "Face";
    price: number;
    emoji: string;
    modelKind: MarketplaceItem["modelKind"];
    description: string;
    limited: boolean;
    supply: number;
    accent: string;
  }>({
    name: "",
    category: "Accessory",
    price: 100,
    emoji: "🎒",
    modelKind: "custom",
    description: "",
    limited: false,
    supply: 100,
    accent: "linear-gradient(135deg, #22d3ee, #6366f1)",
  });
  const [tradeTargetItemId, setTradeTargetItemId] = useState<string>("");
  const [tradeOfferItemId, setTradeOfferItemId] = useState<string>("");
  const [tradeOfferCoins, setTradeOfferCoins] = useState<number>(0);
  const [economySummary, setEconomySummary] = useState<EconomySummary>({
    creatorGrossCoins: 0,
    creatorNetCoins: 0,
    platformFeeCoins: 0,
    salesCount: 0,
    purchasesCount: 0,
  });
  const [coinName, setCoinName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`${ECONOMY_SETTINGS_STORAGE_KEY}.coinName`);
      if (!saved || saved.trim().toLowerCase() === "flux") {
        return "FariBucks";
      }
      return saved;
    } catch {
      return "FariBucks";
    }
  });
  const [coinSymbol, setCoinSymbol] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`${ECONOMY_SETTINGS_STORAGE_KEY}.coinSymbol`);
      if (!saved || saved.trim() === "◈") {
        return "FB";
      }
      return saved;
    } catch {
      return "FB";
    }
  });
  const [marketFeePercent, setMarketFeePercent] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(`${ECONOMY_SETTINGS_STORAGE_KEY}.marketFeePercent`);
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? Math.min(30, Math.max(2, parsed)) : 10;
    } catch {
      return 10;
    }
  });
  const [premiumPrice, setPremiumPrice] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(`${ECONOMY_SETTINGS_STORAGE_KEY}.premiumPrice`);
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? Math.min(25, Math.max(1, parsed)) : 7.99;
    } catch {
      return 7.99;
    }
  });

  const selectedGameUnityWebglUrl =
    selectedPublicGame && "unityWebglUrl" in selectedPublicGame && typeof selectedPublicGame.unityWebglUrl === "string"
      ? selectedPublicGame.unityWebglUrl.trim()
      : "";
  const runtimeUnityWebglUrl = selectedGameUnityWebglUrl || UNITY_WEBGL_URL;
  const canUseUnityRuntime = runtimeUnityWebglUrl.length > 0;
  const usingUnityRuntime = runtimeEngine === "unity-webgl" && canUseUnityRuntime;
  const unityRuntimeSrc = usingUnityRuntime && activeSession && selectedPublicGame
    ? `${runtimeUnityWebglUrl}${runtimeUnityWebglUrl.includes("?") ? "&" : "?"}session=${encodeURIComponent(activeSession.id)}&game=${encodeURIComponent(selectedPublicGame.slug)}&username=${encodeURIComponent(profile?.username ?? "guest")}&displayName=${encodeURIComponent(profile?.displayName ?? "Guest")}&coins=${encodeURIComponent(String(walletCoins))}&shell=fairblox`
    : "";
  const [avatarAlias, setAvatarAlias] = useState<string>(() => {
    try {
      return localStorage.getItem(`${ECONOMY_SETTINGS_STORAGE_KEY}.avatarAlias`) ?? "Star Builder";
    } catch {
      return "Star Builder";
    }
  });
  const [avatarMotto, setAvatarMotto] = useState<string>(() => {
    try {
      return localStorage.getItem(`${ECONOMY_SETTINGS_STORAGE_KEY}.avatarMotto`) ?? "Design worlds. Own the economy.";
    } catch {
      return "Design worlds. Own the economy.";
    }
  });
  const [avatarAura, setAvatarAura] = useState<(typeof AVATAR_AURAS)[number]>(() => {
    try {
      const saved = localStorage.getItem(`${ECONOMY_SETTINGS_STORAGE_KEY}.avatarAura`);
      if (saved && AVATAR_AURAS.includes(saved as (typeof AVATAR_AURAS)[number])) {
        return saved as (typeof AVATAR_AURAS)[number];
      }
      return "None";
    } catch {
      return "None";
    }
  });

  const editorParsedMap = (() => {
    if (!selectedGame) {
      return null;
    }
    try {
      return getParsedMapData(mapJson);
    } catch {
      return null;
    }
  })();

  const editorMapStats = (() => {
    if (!selectedGame) {
      return null;
    }
    try {
      const parsed = editorParsedMap ?? getParsedMapData(mapJson);
      return {
        checkpoints: parsed.checkpoints.length,
        objects: parsed.objects.length,
        error: "",
      };
    } catch (error: unknown) {
      return {
        checkpoints: selectedGame.mapData.checkpoints.length,
        objects: selectedGame.mapData.objects.length,
        error: error instanceof Error ? error.message : "Map JSON is invalid.",
      };
    }
  })();
  const unityRuntimeUrlError = selectedGame ? validateUnityWebglUrl(selectedGame.unityWebglUrl) : null;
  const editorMessageTone = editorMessage ? getEditorMessageTone(editorMessage) : null;
  const selectedEditorObject =
    editorParsedMap && editorSelection?.kind === "object"
      ? editorParsedMap.objects.find((object) => object.id === editorSelection.id) ?? null
      : null;
  const selectedEditorCheckpoint =
    editorParsedMap && editorSelection?.kind === "checkpoint"
      ? editorParsedMap.checkpoints.find((checkpoint) => checkpoint.id === editorSelection.id) ?? null
      : null;
  const runtimeMapData =
    selectedPublicGame && "mapData" in selectedPublicGame
      ? selectedPublicGame.mapData
      : null;

  useEffect(() => {
    if (!selectedGame || !editorParsedMap) {
      setEditorSelection(null);
      return;
    }
    if (
      editorSelection &&
      ((editorSelection.kind === "object" && editorParsedMap.objects.some((object) => object.id === editorSelection.id)) ||
        (editorSelection.kind === "checkpoint" &&
          editorParsedMap.checkpoints.some((checkpoint) => checkpoint.id === editorSelection.id)))
    ) {
      return;
    }
    if (editorParsedMap.objects[0]) {
      setEditorSelection({ kind: "object", id: editorParsedMap.objects[0].id });
      return;
    }
    if (editorParsedMap.checkpoints[0]) {
      setEditorSelection({ kind: "checkpoint", id: editorParsedMap.checkpoints[0].id });
      return;
    }
    setEditorSelection(null);
  }, [editorParsedMap, editorSelection, selectedGame]);

  function loadPublicGames() {
    void fetch(`${API_BASE}/games`)
      .then((response) => response.json() as Promise<GamesResponse>)
      .then((data) => setGames(data.games))
      .catch(() => setGames([]));
  }

  function loadMarketplaceItems() {
    void fetch(`${API_BASE}/marketplace/items`)
      .then((response) => response.json() as Promise<MarketplaceItemsResponse | ApiError>)
      .then((data) => {
        if ("error" in data) {
          throw new Error(data.error);
        }
        if (Array.isArray(data.items) && data.items.length > 0) {
          setMarketItems(data.items);
        }
      })
      .catch(() => {
        setMarketItems(MARKETPLACE_ITEMS);
      });
  }

  function loadEconomySummary(activeToken: string) {
    if (!activeToken) {
      setEconomySummary({
        creatorGrossCoins: 0,
        creatorNetCoins: 0,
        platformFeeCoins: 0,
        salesCount: 0,
        purchasesCount: 0,
      });
      return;
    }
    void fetch(`${API_BASE}/economy/summary`, {
      headers: {
        "x-session-token": activeToken,
      },
    })
      .then((response) => response.json() as Promise<EconomySummaryResponse | ApiError>)
      .then((data) => {
        if ("error" in data) {
          throw new Error(data.error);
        }
        setEconomySummary(data.summary);
      })
      .catch(() => {
        // Keep current summary if fetch fails.
      });
  }

  async function refreshAccountState(activeToken: string) {
    const response = await fetch(`${API_BASE}/me/account-state`, {
      headers: {
        "x-session-token": activeToken,
      },
    });
    if (!response.ok) {
      const error = (await response.json()) as ApiError;
      throw new Error(error.error || "Could not load account state");
    }
    const data = (await response.json()) as AccountStateResponse;
    const nextSlots = data.state.avatarSlots.length > 0 ? data.state.avatarSlots : createDefaultAvatarSlots();
    const nextActiveSlotId = nextSlots.some((slot) => slot.id === data.state.activeAvatarSlotId)
      ? data.state.activeAvatarSlotId
      : nextSlots[0].id;
    const activeSlot = nextSlots.find((slot) => slot.id === nextActiveSlotId) ?? nextSlots[0];
    setWalletCoins(data.state.walletCoins);
    setOwnedItemIds(data.state.ownedItemIds);
    setSelectedThreadId(data.state.selectedThreadId);
    setMessageThreads(data.state.messageThreads);
    setAvatarDraft(data.state.avatarDraft ?? activeSlot.draft);
    setActiveAvatarSlotId(nextActiveSlotId);
    setAvatarSlots(nextSlots);
    setProfile((current) => (current ? { ...current, coins: data.state.walletCoins } : current));
    loadEconomySummary(activeToken);
  }

  useEffect(() => {
    loadPublicGames();
    loadMarketplaceItems();
  }, []);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const purchaseState = url.searchParams.get("purchase");
      if (purchaseState === "cancelled") {
        setIsBuyingCurrency(false);
        setStoreMessage("Checkout was cancelled before payment completed.");
        setPendingCurrencyOrderId(null);
        localStorage.removeItem(PENDING_CURRENCY_ORDER_STORAGE_KEY);
        url.searchParams.delete("purchase");
        url.searchParams.delete("order");
        window.history.replaceState({}, "", url.toString());
      }
    } catch {
      // Ignore URL parsing failures.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(`${ECONOMY_SETTINGS_STORAGE_KEY}.coinName`, coinName);
      localStorage.setItem(`${ECONOMY_SETTINGS_STORAGE_KEY}.coinSymbol`, coinSymbol);
      localStorage.setItem(`${ECONOMY_SETTINGS_STORAGE_KEY}.marketFeePercent`, String(marketFeePercent));
      localStorage.setItem(`${ECONOMY_SETTINGS_STORAGE_KEY}.premiumPrice`, String(premiumPrice));
      localStorage.setItem(`${ECONOMY_SETTINGS_STORAGE_KEY}.avatarAlias`, avatarAlias);
      localStorage.setItem(`${ECONOMY_SETTINGS_STORAGE_KEY}.avatarMotto`, avatarMotto);
      localStorage.setItem(`${ECONOMY_SETTINGS_STORAGE_KEY}.avatarAura`, avatarAura);
    } catch {
      // Economy presentation settings stay in-memory if storage fails.
    }
  }, [coinName, coinSymbol, marketFeePercent, premiumPrice, avatarAlias, avatarMotto, avatarAura]);

  useEffect(() => {
    try {
      if (sessionToken) {
        localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, sessionToken);
      } else {
        localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures and keep in-memory auth behavior.
    }
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken) {
      setIsRestoringSession(false);
      setSessionRestoreMessage("");
      return;
    }
    let cancelled = false;
    setIsRestoringSession(true);
    setSessionRestoreMessage("");
    const restoreSession = async (attempt: number) => {
      try {
        const response = await fetch(`${API_BASE}/me`, {
          headers: {
            "x-session-token": sessionToken,
          },
        });
        if (!response.ok) {
          const error = (await response.json()) as ApiError;
          throw new Error(error.error || "Could not restore session.");
        }
        const data = await response.json() as ProfileResponse;
        if (cancelled) {
          return;
        }
        setProfile(data.profile);
        setIsRestoringSession(false);
        setSessionRestoreMessage("");
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "Could not restore session.";
        if (/invalid session/i.test(message)) {
          signOut();
          setIsRestoringSession(false);
          setSessionRestoreMessage("");
          return;
        }
        if (attempt < 2) {
          setSessionRestoreMessage("Reconnecting to your saved account...");
          window.setTimeout(() => {
            if (!cancelled) {
              void restoreSession(attempt + 1);
            }
          }, 1200 * (attempt + 1));
          return;
        }
        setIsRestoringSession(false);
        setSessionRestoreMessage("Saved session found, but the server is still waking up. Refresh again in a moment.");
      }
    };
    void restoreSession(0);
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  useEffect(() => {
    if (!pendingCurrencyOrderId) {
      return;
    }
    try {
      localStorage.setItem(PENDING_CURRENCY_ORDER_STORAGE_KEY, pendingCurrencyOrderId);
    } catch {
      // Ignore storage failures.
    }
  }, [pendingCurrencyOrderId]);

  useEffect(() => {
    if (!pendingCurrencyOrderId || !sessionToken) {
      return;
    }
    let cancelled = false;
    const pollOrder = async () => {
      try {
        const response = await fetch(`${API_BASE}/payments/currency/orders/${pendingCurrencyOrderId}`, {
          headers: {
            "x-session-token": sessionToken,
          },
        });
        const data = (await response.json()) as CurrencyPurchaseOrderResponse | ApiError;
        if (!response.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Could not load purchase order");
        }
        if (cancelled) {
          return;
        }
        if (data.order.status === "fulfilled") {
          await refreshAccountState(sessionToken);
          pushTx(`Stripe purchase`, +data.order.coins);
          pushToast(`${data.order.coins.toLocaleString()} ${coinMark} added to your wallet!`, "success");
          setStoreMessage(`Purchase complete. ${data.order.coins} ${coinLabel} added.`);
          setActiveView("currency");
          setIsBuyingCurrency(false);
          setPendingCurrencyOrderId(null);
          try {
            localStorage.removeItem(PENDING_CURRENCY_ORDER_STORAGE_KEY);
            const url = new URL(window.location.href);
            url.searchParams.delete("purchase");
            url.searchParams.delete("order");
            window.history.replaceState({}, "", url.toString());
          } catch {
            // Ignore history/storage failures.
          }
          return;
        }
        if (data.order.status === "failed") {
          throw new Error("Payment failed before wallet fulfillment.");
        }
        window.setTimeout(() => {
          if (!cancelled) {
            void pollOrder();
          }
        }, 2000);
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }
        setIsBuyingCurrency(false);
        setStoreMessage(error instanceof Error ? error.message : "Could not confirm purchase.");
      }
    };
    void pollOrder();
    return () => {
      cancelled = true;
    };
  }, [pendingCurrencyOrderId, sessionToken]);

  useEffect(() => {
    if (!activeSession) {
      runtimeInputRef.current = { forward: false, back: false, left: false, right: false };
      runtimeJumpVelocityRef.current = 0;
      runtimeOnGroundRef.current = true;
      setRuntimeSessionCoins(0);
      setRuntimeCheckpointLabel(null);
      setRuntimeCollectedObjectIds([]);
      setRuntimeZone(null);
      setRuntimePrompt(null);
      setRuntimeChatDraft("");
      setRuntimeChatMessages([]);
      return;
    }
    setRuntimeFacing(0);
    setRuntimeSessionCoins(0);
    setRuntimeCheckpointLabel(null);
    setRuntimeCollectedObjectIds([]);
    setRuntimeZone(null);
    setRuntimePrompt("Walk to the fountain, upgrade booths, or collectible pickups.");
    setRuntimeChatDraft("");
    setRuntimeChatMessages([
      { id: `rt-${activeSession.id}-1`, name: "System", body: "Connected to live hub session.", tone: "system" },
      { id: `rt-${activeSession.id}-2`, name: "Nova", body: "Shop is glowing tonight.", tone: "player" },
      { id: `rt-${activeSession.id}-3`, name: "Jax", body: "Grab the pickups around spawn first.", tone: "player" },
    ]);
    runtimeJumpVelocityRef.current = 0;
    runtimeOnGroundRef.current = true;
  }, [activeSession?.id]);

  useEffect(() => {
    if (!activeSession) {
      setUnityRuntimeLoadState("idle");
      return;
    }
    if (canUseUnityRuntime) {
      setRuntimeEngine("unity-webgl");
      setUnityRuntimeLoadState("loading");
      return;
    }
    setRuntimeEngine("fairblox-3d");
    setUnityRuntimeLoadState("idle");
  }, [activeSession?.id, canUseUnityRuntime]);

  useEffect(() => {
    if (!usingUnityRuntime) {
      setUnityRuntimeLoadState(canUseUnityRuntime ? "idle" : "error");
      return;
    }
    setUnityRuntimeLoadState("loading");
  }, [canUseUnityRuntime, unityRuntimeFrameKey, usingUnityRuntime, unityRuntimeSrc]);

  useEffect(() => {
    if (!activeSession) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target
        && (target.tagName === "INPUT"
          || target.tagName === "TEXTAREA"
          || target.tagName === "SELECT"
          || target.isContentEditable)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (event.key === "ArrowUp" || key === "w") {
        event.preventDefault();
        runtimeInputRef.current.forward = true;
      } else if (event.key === "ArrowDown" || key === "s") {
        event.preventDefault();
        runtimeInputRef.current.back = true;
      } else if (event.key === "ArrowLeft" || key === "a") {
        event.preventDefault();
        runtimeInputRef.current.left = true;
      } else if (event.key === "ArrowRight" || key === "d") {
        event.preventDefault();
        runtimeInputRef.current.right = true;
      } else if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        if (runtimeOnGroundRef.current) {
          runtimeJumpVelocityRef.current = 6.5;
          runtimeOnGroundRef.current = false;
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.key === "ArrowUp" || key === "w") {
        runtimeInputRef.current.forward = false;
      } else if (event.key === "ArrowDown" || key === "s") {
        runtimeInputRef.current.back = false;
      } else if (event.key === "ArrowLeft" || key === "a") {
        runtimeInputRef.current.left = false;
      } else if (event.key === "ArrowRight" || key === "d") {
        runtimeInputRef.current.right = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [activeSession]);

  useEffect(() => {
    if (!activeSession || !runtimeMapData) {
      return;
    }
    let frameId = 0;
    let lastFrame = performance.now();
    const bounds = getEditorWorldBounds(runtimeMapData);
    const groundY = runtimeMapData.spawn.y;

    const tick = (now: number) => {
      const delta = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;
      let nextFacing: number | null = null;

      setRuntimePosition((current) => {
        if (!current) {
          return current;
        }
        const input = runtimeInputRef.current;
        let moveX = 0;
        let moveZ = 0;
        if (input.forward) moveZ += 1;
        if (input.back) moveZ -= 1;
        if (input.left) moveX -= 1;
        if (input.right) moveX += 1;
        const magnitude = Math.hypot(moveX, moveZ) || 1;
        moveX /= magnitude;
        moveZ /= magnitude;
        const moveSpeed = 6.2;
        const nextX = clampSize(current.x + moveX * moveSpeed * delta, bounds.minX + 1.2, bounds.maxX - 1.2);
        const nextZ = clampSize(current.z + moveZ * moveSpeed * delta, bounds.minZ + 1.2, bounds.maxZ - 1.2);
        let nextY = current.y;
        runtimeJumpVelocityRef.current -= 13.5 * delta;
        nextY += runtimeJumpVelocityRef.current * delta;
        if (nextY <= groundY) {
          nextY = groundY;
          runtimeJumpVelocityRef.current = 0;
          runtimeOnGroundRef.current = true;
        }
        if (Math.abs(moveX) > 0.01 || Math.abs(moveZ) > 0.01) {
          nextFacing = Math.atan2(moveX, moveZ);
        }
        return {
          x: Number(nextX.toFixed(3)),
          y: Number(nextY.toFixed(3)),
          z: Number(nextZ.toFixed(3)),
        };
      });

      if (nextFacing !== null) {
        setRuntimeFacing(nextFacing);
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [activeSession, runtimeMapData]);

  useEffect(() => {
    if (!runtimeMapData || !runtimePosition) {
      return;
    }
    const nearSpawn = Math.hypot(runtimeMapData.spawn.x - runtimePosition.x, runtimeMapData.spawn.z - runtimePosition.z) <= 3;
    const nearCenter = Math.hypot(runtimePosition.x, runtimePosition.z) <= 4.5;
    const nearShop = Math.hypot(runtimePosition.x - 15.5, runtimePosition.z) <= 5.5
      || Math.hypot(runtimePosition.x + 15.5, runtimePosition.z) <= 5.5;
    const nearObbyPortal = Math.hypot(runtimePosition.x + 10.5, runtimePosition.z - 10.5) <= 3.2;
    const nearMinigamePortal = Math.hypot(runtimePosition.x - 10.5, runtimePosition.z - 10.5) <= 3.2;
    const collectible = runtimeMapData.objects.find((object) => {
      if (runtimeCollectedObjectIds.includes(object.id)) {
        return false;
      }
      const collectibleType = object.type === "coin" || object.type === "pickup" || object.tags?.includes("collectible");
      if (!collectibleType) {
        return false;
      }
      const dx = object.position.x - runtimePosition.x;
      const dz = object.position.z - runtimePosition.z;
      return Math.hypot(dx, dz) <= Math.max(1.8, Math.max(object.size.x, object.size.z) * 0.65);
    });
    if (collectible) {
      const reward = typeof collectible.config?.reward === "number" ? collectible.config.reward : 1;
      setRuntimeCollectedObjectIds((current) => [...current, collectible.id]);
      setRuntimeSessionCoins((current) => current + reward);
      pushToast(`Collected ${reward} coin${reward === 1 ? "" : "s"}`, "success");
      setRuntimePrompt(`Pickup collected. Wallet in session: ${runtimeSessionCoins + reward}.`);
    }

      const checkpoint = runtimeMapData.checkpoints.find((entry, index) => {
      const radius = entry.radius ?? 2.4;
      const dx = entry.position.x - runtimePosition.x;
      const dz = entry.position.z - runtimePosition.z;
      if (Math.hypot(dx, dz) > radius) {
        return false;
      }
      const label = entry.label || `Checkpoint ${index + 1}`;
      if (runtimeCheckpointLabel === label) {
        return false;
      }
      setRuntimeCheckpointLabel(label);
      setStoreMessage(`Checkpoint reached: ${label}`);
      setRuntimePrompt(`Checkpoint reached: ${label}`);
      return true;
    });
      if (!checkpoint) {
      const nearby = runtimeMapData.checkpoints.some((entry) => {
        const radius = entry.radius ?? 2.4;
        const dx = entry.position.x - runtimePosition.x;
        const dz = entry.position.z - runtimePosition.z;
        return Math.hypot(dx, dz) <= radius;
      });
      if (!nearby) {
        setRuntimeCheckpointLabel(null);
      }
    }
    if (!checkpoint && !collectible) {
      if (nearObbyPortal) {
        setRuntimeZone("portal-obby");
        setRuntimePrompt("Obby portal ready. Jump into a checkpoint-heavy course.");
      } else if (nearMinigamePortal) {
        setRuntimeZone("portal-minigame");
        setRuntimePrompt("Minigame portal ready. Queue into a fast social session.");
      } else if (nearCenter) {
        setRuntimeZone("fountain");
        setRuntimePrompt("Fountain plaza: social zone and session meetup point.");
      } else if (nearShop) {
        setRuntimeZone("shop");
        setRuntimePrompt("Upgrade booth nearby. This is where shop and portal prompts should appear.");
      } else if (nearSpawn) {
        setRuntimeZone("spawn");
        setRuntimePrompt("Spawn zone: good place to regroup after reset.");
      } else {
        setRuntimeZone(null);
        setRuntimePrompt("Explore the hub, collect pickups, and look for active portals.");
      }
    }
  }, [runtimeCheckpointLabel, runtimeCollectedObjectIds, runtimeMapData, runtimePosition]);

  useEffect(() => {
    if (!activeSession) {
      return;
    }
    const chatter = [
      "Anyone heading to the shop?",
      "This hub needs more portals.",
      "Checkpoint route is clear.",
      "Collectibles respawn fast here.",
      "Queue up at the plaza fountain.",
    ];
    const speakers = ["Nova", "Jax", "Lumi", "Pixel", "Mira"];
    const timer = window.setInterval(() => {
      const name = speakers[Math.floor(Math.random() * speakers.length)] ?? "Player";
      const body = chatter[Math.floor(Math.random() * chatter.length)] ?? "Nice hub.";
      setRuntimeChatMessages((current) => [...current.slice(-7), { id: `${Date.now()}-${Math.random()}`, name, body, tone: "player" }]);
    }, 9000);
    return () => window.clearInterval(timer);
  }, [activeSession?.id]);

  useEffect(() => {
    if (!sessionToken) {
      return;
    }
    void fetch(`${API_BASE}/me/games`, {
      headers: {
        "x-session-token": sessionToken,
      },
    })
      .then((response) => response.json() as Promise<MyGamesResponse | ApiError>)
      .then((data) => {
        if ("error" in data) {
          throw new Error(data.error);
        }
        setMyGames(data.games);
      })
      .catch(() => setMyGames([]));
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken) {
      const defaultSlots = createDefaultAvatarSlots();
      setWalletCoins(0);
      setOwnedItemIds(["builder-cap"]);
      setSelectedThreadId(MESSAGE_THREADS[0].id);
      setMessageThreads(structuredClone(MESSAGE_THREADS));
      setAvatarDraft({ ...defaultSlots[0].draft });
      setActiveAvatarSlotId(defaultSlots[0].id);
      setAvatarSlots(defaultSlots);
      setEconomySummary({
        creatorGrossCoins: 0,
        creatorNetCoins: 0,
        platformFeeCoins: 0,
        salesCount: 0,
        purchasesCount: 0,
      });
      return;
    }
    void refreshAccountState(sessionToken)
      .catch(() => {
        const fallback = createDefaultAccountState(profile?.coins ?? 0);
        setWalletCoins(fallback.walletCoins);
        setOwnedItemIds(fallback.ownedItemIds);
        setSelectedThreadId(fallback.selectedThreadId);
        setMessageThreads(fallback.messageThreads);
        setAvatarDraft(fallback.avatarDraft);
        setActiveAvatarSlotId(fallback.activeAvatarSlotId);
        setAvatarSlots(fallback.avatarSlots);
        setProfile((current) => (current ? { ...current, coins: fallback.walletCoins } : current));
        loadEconomySummary(sessionToken);
      });
  }, [sessionToken]);

  async function persistAccountState(overrides: Partial<AccountState>) {
    if (!sessionToken) {
      return;
    }
    const payload: SaveAccountStateRequest = {
      state: {
        walletCoins: overrides.walletCoins ?? walletCoins,
        ownedItemIds: overrides.ownedItemIds ?? ownedItemIds,
        selectedThreadId: overrides.selectedThreadId ?? selectedThreadId,
        avatarDraft: overrides.avatarDraft ?? avatarDraft,
        activeAvatarSlotId: overrides.activeAvatarSlotId ?? activeAvatarSlotId,
        avatarSlots: overrides.avatarSlots ?? avatarSlots,
        messageThreads: overrides.messageThreads ?? messageThreads,
      },
    };
    const response = await fetch(`${API_BASE}/me/account-state`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = (await response.json()) as ApiError;
      throw new Error(error.error || "Could not save account state");
    }
  }

  async function submitAuth<TPayload extends SignupRequest | LoginRequest>(
    path: string,
    payload: TPayload,
  ) {
    setAuthError("");
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as AuthResponse | ApiError;
    if (!response.ok) {
      setAuthError((data as ApiError).error || "Request failed.");
      return;
    }
    const auth = data as AuthResponse;
    setSessionToken(auth.token);
    setProfile(auth.profile);
    setSessionRestoreMessage("");
    setIsRestoringSession(false);
    setActiveView("home");
  }

  function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitAuth("/auth/signup", signupForm);
  }

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitAuth("/auth/login", loginForm);
  }

  function handleCreateGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken) {
      setGameError("You must be logged in.");
      return;
    }
    setGameError("");
    void fetch(`${API_BASE}/games`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify(gameForm),
    })
      .then(async (response) => {
        const data = (await response.json()) as { game: GameDraft } | ApiError;
        if (!response.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Could not create game");
        }
        setMyGames((current) => [data.game, ...current]);
        setSelectedGame({
          ...data.game,
          unityWebglUrl: data.game.unityWebglUrl ?? "",
          mapData: {
            spawn: { x: 0, y: 2, z: 0 },
            checkpoints: [],
            objects: [],
          },
        });
        setMapJson(
          JSON.stringify(
            {
              spawn: { x: 0, y: 2, z: 0 },
              checkpoints: [],
              objects: [],
            },
            null,
            2,
          ),
        );
        setGameForm({
          title: "",
          description: "",
          genre: "obby",
        });
        setActiveView("creator");
      })
      .catch((error: unknown) => {
        setGameError(error instanceof Error ? error.message : "Could not create game");
      });
  }

  function openDraft(gameId: string) {
    if (!sessionToken) {
      return;
    }
    setEditorMessage("");
    void fetch(`${API_BASE}/me/games/${gameId}`, {
      headers: {
        "x-session-token": sessionToken,
      },
    })
      .then((response) => response.json() as Promise<GameDraftResponse | ApiError>)
      .then((data) => {
        if ("error" in data) {
          throw new Error(data.error);
        }
        setActiveView("creator");
        setSelectedGame(data.game);
        setMapJson(JSON.stringify(data.game.mapData, null, 2));
      })
      .catch((error: unknown) => {
        setEditorMessage(error instanceof Error ? error.message : "Could not open draft");
      });
  }

  function saveDraftMap() {
    if (!sessionToken || !selectedGame) {
      setEditorMessage("Open a draft first.");
      return;
    }
    const unityUrlError = validateUnityWebglUrl(selectedGame.unityWebglUrl);
    if (unityUrlError) {
      setEditorMessage(unityUrlError);
      return;
    }
    try {
      const parsed = getParsedMapData(mapJson);
      setEditorMessage("");
      void fetch(`${API_BASE}/me/games/${selectedGame.id}/map`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": sessionToken,
        },
        body: JSON.stringify({
          mapData: parsed,
          unityWebglUrl: selectedGame.unityWebglUrl?.trim() || undefined,
        } satisfies SaveMapRequest),
      })
        .then((response) => response.json() as Promise<GameDraftResponse | ApiError>)
        .then((data) => {
          if ("error" in data) {
            throw new Error(data.error);
          }
          setSelectedGame(data.game);
          setMapJson(JSON.stringify(data.game.mapData, null, 2));
          setMyGames((current) =>
            current.map((game) =>
              game.id === data.game.id
                ? {
                    ...game,
                    unityWebglUrl: data.game.unityWebglUrl,
                    updatedAt: data.game.updatedAt,
                  }
                : game,
            ),
          );
          setEditorMessage("Map saved.");
        })
        .catch((error: unknown) => {
          setEditorMessage(error instanceof Error ? error.message : "Could not save map");
        });
    } catch (error: unknown) {
      setEditorMessage(error instanceof Error ? error.message : "Map JSON is invalid.");
      return;
    }
  }

  function applyTemplate(genre: CreateGameRequest["genre"]) {
    if (!selectedGame) {
      setEditorMessage("Open a draft first.");
      return;
    }
    setMapJson(JSON.stringify(createTemplateMap(genre), null, 2));
    setEditorMessage(`${genre} starter template loaded. Save map to keep it.`);
  }

  function updateEditorMap(mutator: (mapData: GameMapData) => GameMapData, options?: { silent?: boolean }) {
    if (!selectedGame) {
      setEditorMessage("Open a draft first.");
      return;
    }
    try {
      const nextMap = mutator(getParsedMapData(mapJson));
      setMapJson(JSON.stringify(nextMap, null, 2));
      if (!options?.silent) {
        setEditorMessage("Editor updated. Save map to keep it.");
      }
    } catch (error: unknown) {
      setEditorMessage(error instanceof Error ? error.message : "Map JSON is invalid.");
    }
  }

  function addCheckpoint() {
    const nextId = `checkpoint-${mapDataCounter()}`;
    updateEditorMap((mapData) => ({
      ...mapData,
      checkpoints: [
        ...mapData.checkpoints,
        createCheckpoint(
          nextId,
          mapData.spawn.x + (mapData.checkpoints.length % 2 === 0 ? 0 : 6),
          mapData.spawn.y,
          mapData.spawn.z + mapData.checkpoints.length * 10 + 10,
          `Checkpoint ${mapData.checkpoints.length + 1}`,
        ),
      ],
    }));
    setEditorSelection({ kind: "checkpoint", id: nextId });
  }

  function addQuickObject(type: string, color: string, size: { sx: number; sy: number; sz: number }) {
    const nextId = createEditorEntityId("object");
    updateEditorMap((mapData) => ({
      ...mapData,
      objects: [...mapData.objects, { ...createQuickObject(type, color, size, mapData.objects.length), id: nextId }],
    }));
    setEditorSelection({ kind: "object", id: nextId });
  }

  function addPlatformBatch(randomSpread = false) {
    const count = clampSize(Math.floor(platformBrush.count), 1, 40);
    const spacing = clampSize(platformBrush.spacing, 2, 40);
    const rise = clampSize(platformBrush.rise, -3, 6);
    const width = clampSize(platformBrush.width, 2, 30);
    const depth = clampSize(platformBrush.depth, 2, 30);
    const color = /^#[0-9a-fA-F]{6}$/.test(platformBrush.color) ? platformBrush.color : "#5eead4";

    updateEditorMap((mapData) => {
      const lastObject = mapData.objects[mapData.objects.length - 1];
      const baseX = lastObject ? lastObject.position.x : mapData.spawn.x;
      const baseY = lastObject ? lastObject.position.y : Math.max(0, mapData.spawn.y - 1);
      const baseZ = lastObject ? lastObject.position.z : mapData.spawn.z;

      const objects = Array.from({ length: count }, (_, index) => {
        const step = index + 1;
        const directionOffset = spacing * step;
        const scatterX = randomSpread ? (Math.random() * 6 - 3) : 0;
        const scatterZ = randomSpread ? (Math.random() * 6 - 3) : 0;
        const x = baseX + (platformBrush.direction === "x" ? directionOffset : 0) + scatterX;
        const z = baseZ + (platformBrush.direction === "z" ? directionOffset : 0) + scatterZ;
        return createWorldObject(
          createEditorEntityId("object"),
          randomSpread ? "platform" : "platform",
          x,
          baseY + rise * step,
          z,
          width,
          1,
          depth,
          color,
          {
            material: randomSpread ? "neon" : "plastic",
            tags: randomSpread ? ["floating"] : undefined,
          },
        );
      });

      return {
        ...mapData,
        objects: [...mapData.objects, ...objects],
      };
    });

    setEditorMessage(
      randomSpread
        ? `${count} random platforms placed. Save map to keep it.`
        : `${count} platforms placed in a ${platformBrush.direction.toUpperCase()} run. Save map to keep it.`,
    );
  }

  function mapDataCounter() {
    return Date.now();
  }

  function addVisualObject() {
    const nextId = createEditorEntityId("object");
    updateEditorMap((mapData) => ({
      ...mapData,
      objects: [
        ...mapData.objects,
        createWorldObject(
          nextId,
          "platform",
          mapData.spawn.x,
          Math.max(0, mapData.spawn.y - 1),
          mapData.spawn.z + mapData.objects.length * 6 + 6,
          8,
          1,
          8,
          "#5eead4",
          { material: "plastic" },
        ),
      ],
    }));
    setEditorSelection({ kind: "object", id: nextId });
  }

  function addVisualCheckpoint() {
    const nextId = createEditorEntityId("checkpoint");
    updateEditorMap((mapData) => ({
      ...mapData,
      checkpoints: [
        ...mapData.checkpoints,
        createCheckpoint(
          nextId,
          mapData.spawn.x,
          mapData.spawn.y,
          mapData.spawn.z + mapData.checkpoints.length * 10 + 10,
          `Checkpoint ${mapData.checkpoints.length + 1}`,
        ),
      ],
    }));
    setEditorSelection({ kind: "checkpoint", id: nextId });
  }

  function removeSelectedEditorEntry() {
    if (!editorSelection) {
      setEditorMessage("Select a world item first.");
      return;
    }
    updateEditorMap((mapData) =>
      editorSelection.kind === "object"
        ? {
            ...mapData,
            objects: mapData.objects.filter((object) => object.id !== editorSelection.id),
          }
        : {
            ...mapData,
            checkpoints: mapData.checkpoints.filter((checkpoint) => checkpoint.id !== editorSelection.id),
          },
    );
    setEditorMessage("World item removed. Save map to keep it.");
  }

  function updateSelectedObject(
    mutator: (object: NonNullable<typeof selectedEditorObject>) => NonNullable<typeof selectedEditorObject>,
  ) {
    if (!selectedEditorObject) {
      setEditorMessage("Select an object first.");
      return;
    }
    updateEditorMap((mapData) => ({
      ...mapData,
      objects: mapData.objects.map((object) => (object.id === selectedEditorObject.id ? mutator(object) : object)),
    }));
  }

  function updateSelectedCheckpoint(
    mutator: (checkpoint: NonNullable<typeof selectedEditorCheckpoint>) => NonNullable<typeof selectedEditorCheckpoint>,
  ) {
    if (!selectedEditorCheckpoint) {
      setEditorMessage("Select a checkpoint first.");
      return;
    }
    updateEditorMap((mapData) => ({
      ...mapData,
      checkpoints: mapData.checkpoints.map((checkpoint) =>
        checkpoint.id === selectedEditorCheckpoint.id ? mutator(checkpoint) : checkpoint,
      ),
    }));
  }

  function placeEditorEntityAt(clientX: number, clientY: number, rect: DOMRect) {
    if (!editorParsedMap || !editorPlacementMode) {
      return;
    }
    const bounds = getEditorWorldBounds(editorParsedMap);
    const point = editorStageToWorld(clientX, clientY, rect, bounds);
    if (editorPlacementMode === "object") {
      const nextId = createEditorEntityId("object");
      updateEditorMap((mapData) => ({
        ...mapData,
        objects: [
          ...mapData.objects,
          createWorldObject(
            nextId,
            "platform",
            Math.round(point.x),
            Math.max(0, mapData.spawn.y - 1),
            Math.round(point.z),
            8,
            1,
            8,
            "#5eead4",
            { material: "plastic" },
          ),
        ],
      }));
      setEditorSelection({ kind: "object", id: nextId });
    } else {
      const nextId = createEditorEntityId("checkpoint");
      updateEditorMap((mapData) => ({
        ...mapData,
        checkpoints: [
          ...mapData.checkpoints,
          createCheckpoint(
            nextId,
            Math.round(point.x),
            mapData.spawn.y,
            Math.round(point.z),
            `Checkpoint ${mapData.checkpoints.length + 1}`,
          ),
        ],
      }));
      setEditorSelection({ kind: "checkpoint", id: nextId });
    }
    setEditorPlacementMode(null);
  }

  function handleEditorStagePointerDown(event: MouseEvent<SVGSVGElement>) {
    if (!editorParsedMap || !editorPlacementMode) {
      return;
    }
    placeEditorEntityAt(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
  }

  function handleEditorStagePointerMove(event: MouseEvent<SVGSVGElement>) {
    if (!editorParsedMap || !editorDragTarget) {
      return;
    }
    const bounds = getEditorWorldBounds(editorParsedMap);
    const point = editorStageToWorld(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect(),
      bounds,
    );
    updateEditorMap(
      (mapData) =>
        editorDragTarget.kind === "object"
          ? {
              ...mapData,
              objects: mapData.objects.map((object) =>
                object.id === editorDragTarget.id
                  ? {
                      ...object,
                      position: {
                        ...object.position,
                        x: Math.round(point.x),
                        z: Math.round(point.z),
                      },
                    }
                  : object,
              ),
            }
          : {
              ...mapData,
              checkpoints: mapData.checkpoints.map((checkpoint) =>
                checkpoint.id === editorDragTarget.id
                  ? {
                      ...checkpoint,
                      position: {
                        ...checkpoint.position,
                        x: Math.round(point.x),
                        z: Math.round(point.z),
                      },
                    }
                  : checkpoint,
              ),
            },
      { silent: true },
    );
  }

  function renderEditorStage(mapData: GameMapData) {
    const bounds = getEditorWorldBounds(mapData);
    const gridLines = Array.from({ length: 9 }, (_, index) => index);
    const spawnPoint = worldToEditorStage(mapData.spawn.x, mapData.spawn.z, bounds);

    return (
      <svg
        className={editorPlacementMode ? "editor-stage editor-stage-placing" : "editor-stage"}
        viewBox={`0 0 ${EDITOR_STAGE_WIDTH} ${EDITOR_STAGE_HEIGHT}`}
        role="img"
        aria-label="Top-down world editor stage"
        onMouseDown={handleEditorStagePointerDown}
        onMouseMove={handleEditorStagePointerMove}
        onMouseUp={() => setEditorDragTarget(null)}
        onMouseLeave={() => setEditorDragTarget(null)}
      >
        <rect width={EDITOR_STAGE_WIDTH} height={EDITOR_STAGE_HEIGHT} className="editor-stage-bg" />
        {gridLines.map((index) => {
          const x = (index / (gridLines.length - 1)) * EDITOR_STAGE_WIDTH;
          const y = (index / (gridLines.length - 1)) * EDITOR_STAGE_HEIGHT;
          return (
            <g key={`grid-${index}`}>
              <line x1={x} y1="0" x2={x} y2={EDITOR_STAGE_HEIGHT} className="editor-stage-grid" />
              <line x1="0" y1={y} x2={EDITOR_STAGE_WIDTH} y2={y} className="editor-stage-grid" />
            </g>
          );
        })}
        {mapData.objects.map((object) => {
          const center = worldToEditorStage(object.position.x, object.position.z, bounds);
          const farCorner = worldToEditorStage(
            object.position.x + object.size.x / 2,
            object.position.z + object.size.z / 2,
            bounds,
          );
          const nearCorner = worldToEditorStage(
            object.position.x - object.size.x / 2,
            object.position.z - object.size.z / 2,
            bounds,
          );
          const width = Math.max(14, farCorner.x - nearCorner.x);
          const height = Math.max(14, farCorner.y - nearCorner.y);
          const selected = editorSelection?.kind === "object" && editorSelection.id === object.id;
          return (
            <g key={object.id} transform={`translate(${center.x}, ${center.y})`}>
              <rect
                x={-width / 2}
                y={-height / 2}
                width={width}
                height={height}
                rx="6"
                fill={object.color}
                className={selected ? "editor-stage-object editor-stage-object-selected" : "editor-stage-object"}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  setEditorSelection({ kind: "object", id: object.id });
                  setEditorDragTarget({ kind: "object", id: object.id });
                }}
              />
              <text x="0" y="4" textAnchor="middle" className="editor-stage-label">
                {object.type.slice(0, 8)}
              </text>
            </g>
          );
        })}
        {mapData.checkpoints.map((checkpoint) => {
          const point = worldToEditorStage(checkpoint.position.x, checkpoint.position.z, bounds);
          const selected = editorSelection?.kind === "checkpoint" && editorSelection.id === checkpoint.id;
          return (
            <g key={checkpoint.id} transform={`translate(${point.x}, ${point.y})`}>
              <circle
                r={selected ? 12 : 10}
                className={selected ? "editor-stage-checkpoint editor-stage-checkpoint-selected" : "editor-stage-checkpoint"}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  setEditorSelection({ kind: "checkpoint", id: checkpoint.id });
                  setEditorDragTarget({ kind: "checkpoint", id: checkpoint.id });
                }}
              />
              <text x="0" y="4" textAnchor="middle" className="editor-stage-checkpoint-text">
                {checkpoint.label?.slice(0, 1) ?? "C"}
              </text>
            </g>
          );
        })}
        <g transform={`translate(${spawnPoint.x}, ${spawnPoint.y})`}>
          <circle r="9" className="editor-stage-spawn" />
          <text x="0" y="4" textAnchor="middle" className="editor-stage-checkpoint-text">
            S
          </text>
        </g>
      </svg>
    );
  }

  function resetToEmptyMap() {
    if (!selectedGame) {
      setEditorMessage("Open a draft first.");
      return;
    }
    setMapJson(
      JSON.stringify(
        {
          spawn: { x: 0, y: 2, z: 0 },
          checkpoints: [],
          objects: [],
        },
        null,
        2,
      ),
    );
    setEditorMessage("Map cleared. Save map to keep it.");
  }

  function updateGameCollection(updatedGame: GameDraftDetail) {
    setSelectedGame(updatedGame);
    setMyGames((current) =>
      current.map((game) =>
        game.id === updatedGame.id
          ? {
              ...game,
              unityWebglUrl: updatedGame.unityWebglUrl,
              visibility: updatedGame.visibility,
              updatedAt: updatedGame.updatedAt,
              versionCount: updatedGame.versionCount,
              publishedVersionNumber: updatedGame.publishedVersionNumber,
            }
          : game,
      ),
    );
  }

  function openPublicGame(slug: string, nextView: AppView = "discover") {
    setGameError("");
    void fetch(`${API_BASE}/games/${slug}`)
      .then((response) => response.json() as Promise<PublicGameResponse | ApiError>)
      .then((data) => {
        if ("error" in data) {
          throw new Error(data.error);
        }
        setActiveView(nextView);
        setSelectedPublicGame(data.game);
        setActiveSession(null);
        setRuntimePosition(null);
      })
      .catch((error: unknown) => {
        setGameError(error instanceof Error ? error.message : "Could not open game");
      });
  }

  function joinPublicGameBySlug(slug: string) {
    setGameError("");
    void fetch(`${API_BASE}/games/${slug}/join`, {
      method: "POST",
    })
      .then((response) => response.json() as Promise<SessionResponse | ApiError>)
      .then((data) => {
        if ("error" in data) {
          throw new Error(data.error);
        }
        setActiveSession(data.session);
        setRuntimePosition(data.session.spawn);
        setGames((current) =>
          current.map((game) =>
            game.slug === slug
              ? {
                  ...game,
                  visits: game.visits + 1,
                }
              : game,
          ),
        );
        setSelectedPublicGame((current) =>
          current && current.slug === slug
            ? {
                ...current,
                visits: current.visits + 1,
              }
            : current,
        );
      })
      .catch((error: unknown) => {
        setGameError(error instanceof Error ? error.message : "Could not join game");
      });
  }

  function joinSelectedPublicGame() {
    if (!selectedPublicGame) {
      setGameError("Pick a game first.");
      return;
    }
    joinPublicGameBySlug(selectedPublicGame.slug);
  }

  function moveRuntime(dx: number, dy: number, dz: number) {
    if (dy > 0 && runtimeOnGroundRef.current) {
      runtimeJumpVelocityRef.current = 6.5;
      runtimeOnGroundRef.current = false;
    }
    if (dx !== 0 || dz !== 0) {
      setRuntimeFacing(Math.atan2(dx, dz));
    }
    setRuntimePosition((current) =>
      current
        ? {
            x: current.x + dx,
            y: current.y,
            z: current.z + dz,
          }
        : current,
    );
  }

  function publishSelectedGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken || !selectedGame) {
      setEditorMessage("Open a draft first.");
      return;
    }
    setEditorMessage("");
    void fetch(`${API_BASE}/me/games/${selectedGame.id}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify(publishForm),
    })
      .then((response) => response.json() as Promise<GameDraftResponse | ApiError>)
      .then((data) => {
        if ("error" in data) {
          throw new Error(data.error);
        }
        updateGameCollection(data.game);
        setPublishForm({ changelog: "" });
        setEditorMessage("Game published.");
        loadPublicGames();
        void openPublicGame(data.game.slug);
      })
      .catch((error: unknown) => {
        setEditorMessage(error instanceof Error ? error.message : "Could not publish game");
      });
  }

  function unpublishSelectedGame() {
    if (!sessionToken || !selectedGame) {
      setEditorMessage("Open a draft first.");
      return;
    }
    setEditorMessage("");
    void fetch(`${API_BASE}/me/games/${selectedGame.id}/unpublish`, {
      method: "POST",
      headers: {
        "x-session-token": sessionToken,
      },
    })
      .then((response) => response.json() as Promise<GameDraftResponse | ApiError>)
      .then((data) => {
        if ("error" in data) {
          throw new Error(data.error);
        }
        updateGameCollection(data.game);
        setEditorMessage("Game moved back to draft.");
        loadPublicGames();
        if (selectedPublicGame?.id === data.game.id) {
          setSelectedPublicGame(null);
        }
      })
      .catch((error: unknown) => {
        setEditorMessage(error instanceof Error ? error.message : "Could not unpublish game");
      });
  }

  function renderRuntimeWorld(game: PublishedGameDetail, position: { x: number; y: number; z: number }) {
    const worldObjects = game.mapData.objects
      .map((object, index) => ({ object, index, box: buildWorldBox(object, position) }))
      .sort((left, right) => right.box.depth - left.box.depth);
    const spawnMarker = projectWorldPoint(game.mapData.spawn.x, game.mapData.spawn.y, game.mapData.spawn.z, position);
    const checkpointMarkers = game.mapData.checkpoints
      .map((checkpoint, index) => ({
        checkpoint,
        index,
        point: projectWorldPoint(
          checkpoint.position.x,
          checkpoint.position.y,
          checkpoint.position.z,
          position,
        ),
      }))
      .sort((left, right) => right.point.depth - left.point.depth);
    const visibleObjects = worldObjects.filter((entry) => entry.box.depth > 4 && entry.box.depth < 80);
    const visibleCheckpoints = checkpointMarkers.filter((entry) => entry.point.depth > 4 && entry.point.depth < 80);

    return (
      <svg className="runtime-world" viewBox={`0 0 ${WORLD_VIEW_WIDTH} ${WORLD_VIEW_HEIGHT}`} role="img" aria-label={`${game.title} 3D world preview`}>
        <defs>
          <linearGradient id="world-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="62%" stopColor="#22c1c3" />
            <stop offset="100%" stopColor="#8fd6ff" />
          </linearGradient>
          <linearGradient id="world-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2c7a56" />
            <stop offset="100%" stopColor="#174032" />
          </linearGradient>
        </defs>
        <rect width={WORLD_VIEW_WIDTH} height={WORLD_VIEW_HEIGHT * 0.63} fill="url(#world-sky)" />
        <rect y={WORLD_VIEW_HEIGHT * 0.63} width={WORLD_VIEW_WIDTH} height={WORLD_VIEW_HEIGHT * 0.37} fill="url(#world-ground)" />
        <ellipse className="runtime-shadow-band" cx={WORLD_VIEW_WIDTH / 2} cy={WORLD_VIEW_HEIGHT * 0.77} rx="210" ry="36" />
        {visibleObjects.map(({ object, index, box }) => {
          const topColor = blendColor(object.color, 0.22);
          const sideColor = blendColor(object.color, -0.22);
          return (
            <g key={object.id || `${object.type}-${index}`}>
              <polygon points={box.top} fill={topColor} className="runtime-block-top" />
              <polygon points={box.side} fill={sideColor} className="runtime-block-side" />
              <polygon points={box.front} fill={object.color} className="runtime-block-front" />
              <text x={box.labelX} y={box.labelY} textAnchor="middle" className="runtime-label">
                {object.tags?.[0] ?? object.type}
              </text>
            </g>
          );
        })}
        {visibleCheckpoints.map(({ checkpoint, point, index }) => {
          const markerRadius = clampSize(point.scale * 0.72, 7, 16);
          return (
            <g key={checkpoint.id ?? `checkpoint-${index}`}>
              <circle cx={point.x} cy={point.y} r={markerRadius} className="runtime-checkpoint" />
              <text x={point.x} y={point.y + 4} textAnchor="middle" className="runtime-label">
                {checkpoint.label?.slice(0, 1) ?? "C"}
              </text>
            </g>
          );
        })}
        <circle cx={spawnMarker.x} cy={spawnMarker.y} r={clampSize(spawnMarker.scale * 0.7, 7, 14)} className="runtime-spawn-marker" />
        <text x={spawnMarker.x} y={spawnMarker.y - 14} textAnchor="middle" className="runtime-badge">
          Spawn
        </text>
        <g transform={`translate(${WORLD_VIEW_WIDTH / 2}, ${WORLD_VIEW_HEIGHT * 0.73})`}>
          <ellipse cx="0" cy="42" rx="36" ry="12" className="runtime-player-shadow" />
          <rect x="-18" y="-4" width="36" height="42" rx="10" className="runtime-avatar-body" />
          <rect x="-11" y="-26" width="22" height="22" rx="8" className="runtime-avatar-head" />
          <rect x="-28" y="4" width="10" height="30" rx="5" className="runtime-avatar-limb" />
          <rect x="18" y="4" width="10" height="30" rx="5" className="runtime-avatar-limb" />
          <rect x="-15" y="38" width="10" height="28" rx="5" className="runtime-avatar-limb" />
          <rect x="5" y="38" width="10" height="28" rx="5" className="runtime-avatar-limb" />
          <text x="0" y="84" textAnchor="middle" className="runtime-label runtime-label-strong">
            You
          </text>
        </g>
      </svg>
    );
  }

  function signOut() {
    setSessionToken("");
    setProfile(null);
    setSessionRestoreMessage("");
    setIsRestoringSession(false);
    setActiveView("discover");
    setMyGames([]);
    setSelectedGame(null);
    setSelectedPublicGame(null);
    setActiveSession(null);
    setRuntimePosition(null);
    setAuthError("");
    setGameError("");
    setEditorMessage("");
    setStoreMessage("");
    setAvatarMessage("");
  }

  async function buyMarketplaceItem(item: MarketplaceItem) {
    if (!sessionToken) {
      setStoreMessage("Sign in to buy marketplace items.");
      return;
    }
    if (ownedItemIds.includes(item.id)) {
      setStoreMessage(`${item.name} is already in your inventory.`);
      return;
    }
    setBuyingItemId(item.id);
    try {
      const payload: PurchaseMarketplaceItemRequest = {
        itemId: item.id,
      };
      const response = await fetch(`${API_BASE}/marketplace/purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": sessionToken,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as AccountStateResponse | ApiError;
      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Could not purchase item");
      }
      setWalletCoins(data.state.walletCoins);
      setOwnedItemIds(data.state.ownedItemIds);
      setProfile((current) => (current ? { ...current, coins: data.state.walletCoins } : current));
      pushTx(`Bought ${item.name}`, -item.price);
      pushToast(`${item.name} added to your inventory!`, "success");
      loadEconomySummary(sessionToken);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Could not process purchase right now.";
      setStoreMessage(msg);
      pushToast(msg, "error");
      setBuyingItemId(null);
      return;
    }
    setBuyingItemId(null);
    setStoreMessage(`${item.name} added to your inventory.`);
  }

  async function createMarketplaceListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken) {
      setStoreMessage("Sign in to create marketplace listings.");
      return;
    }
    const name = creatorForm.name.trim();
    const description = creatorForm.description.trim();
    if (name.length < 3) {
      setStoreMessage("Item name must be at least 3 characters.");
      return;
    }
    if (!Number.isFinite(creatorForm.price) || creatorForm.price < 1) {
      setStoreMessage(`Price must be at least 1 ${coinLabel}.`);
      return;
    }
    if (creatorForm.limited && (!Number.isFinite(creatorForm.supply) || creatorForm.supply < 1)) {
      setStoreMessage("Limited items need a supply greater than zero.");
      return;
    }
    const payload = {
      name,
      category: creatorForm.category,
      price: Math.round(creatorForm.price),
      accent: creatorForm.accent,
      modelKind: creatorForm.modelKind,
      emoji: creatorForm.emoji || "🎁",
      description: description || "Community-created item.",
      limited: creatorForm.limited,
      supply: creatorForm.limited ? Math.round(creatorForm.supply) : undefined,
    };
    try {
      const response = await fetch(`${API_BASE}/marketplace/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": sessionToken,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as CreateMarketplaceItemResponse | ApiError;
      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Could not create marketplace item");
      }
      setMarketItems((current) => [data.item, ...current.filter((item) => item.id !== data.item.id)]);
    } catch (error: unknown) {
      setStoreMessage(error instanceof Error ? error.message : "Could not create marketplace item right now.");
      return;
    }
    setCreatorForm((current) => ({ ...current, name: "", description: "", price: 100, emoji: "🎒", limited: false, supply: 100 }));
    setStoreMessage(`${name} listed in the marketplace.`);
    setMarketTab("shop");
  }

  async function createLimitedTrade() {
    if (!sessionToken) {
      setStoreMessage("Sign in to trade Limited items.");
      return;
    }
    const allItems = marketItems;
    const target = allItems.find((item) => item.id === tradeTargetItemId);
    const offer = allItems.find((item) => item.id === tradeOfferItemId);
    if (!target || !offer) {
      setStoreMessage("Pick both target and offered Limited items first.");
      return;
    }
    if (!target.limited || !offer.limited) {
      setStoreMessage("Only Limited items can be traded.");
      return;
    }
    if (!ownedItemIds.includes(offer.id)) {
      setStoreMessage(`You do not own ${offer.name}.`);
      return;
    }
    if (ownedItemIds.includes(target.id)) {
      setStoreMessage(`You already own ${target.name}.`);
      return;
    }
    if (tradeOfferCoins < 0 || tradeOfferCoins > walletCoins) {
      setStoreMessage(`${coinLabel} offer is higher than your wallet.`);
      return;
    }
    setIsTrading(true);
    try {
      const payload: CreateMarketplaceTradeRequest = {
        targetItemId: target.id,
        offerItemId: offer.id,
        offerCoins: tradeOfferCoins,
      };
      const response = await fetch(`${API_BASE}/marketplace/trades`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": sessionToken,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as AccountStateResponse | ApiError;
      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Could not create trade");
      }
      setWalletCoins(data.state.walletCoins);
      setOwnedItemIds(data.state.ownedItemIds);
      setProfile((current) => (current ? { ...current, coins: data.state.walletCoins } : current));
      setTradeOfferCoins(0);
      setTradeOfferItemId("");
      setTradeTargetItemId("");
      if (tradeOfferCoins > 0) pushTx(`Trade coin top-up for ${target.name}`, -tradeOfferCoins);
      pushToast(`Trade complete — you got ${target.name}!`, "success");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Could not process trade right now.";
      setStoreMessage(msg);
      pushToast(msg, "error");
      setIsTrading(false);
      return;
    }
    setIsTrading(false);
    setStoreMessage(`Trade complete. You sent ${offer.name} and received ${target.name}.`);
  }

  async function redeemGiftCard(coins: number, title: string) {
    const nextCoins = walletCoins + coins;
    setWalletCoins(nextCoins);
    setProfile((current) => (current ? { ...current, coins: nextCoins } : current));
    try {
      await persistAccountState({ walletCoins: nextCoins });
    } catch {
      setStoreMessage(`Could not save gift card balance yet, but ${coinLabel} were added locally.`);
      return;
    }
    setStoreMessage(`${title} redeemed. ${coins} ${coinLabel} added to your wallet.`);
    setActiveView("giftcards");
  }

  async function buyCurrencyBundle(coins: number, title: string) {
    if (!sessionToken) {
      setStoreMessage("Sign in to buy currency bundles.");
      return;
    }
    setIsBuyingCurrency(true);
    try {
      const priceUsd = COIN_BUNDLES.find((bundle) => bundle.coins === coins)?.priceLabel ?? "$0.00";
      const usdCents = Math.max(50, Math.round(Number(priceUsd.replace("$", "")) * 100));
      const payload: CurrencyPurchaseCheckoutRequest = {
        coins,
        usdCents,
        provider: "stripe",
        requestId: crypto.randomUUID(),
      };
      const response = await fetch(`${API_BASE}/payments/currency/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": sessionToken,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as CurrencyPurchaseCheckoutResponse | ApiError;
      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Could not create checkout");
      }
      setPendingCurrencyOrderId(data.order.id);
      try {
        localStorage.setItem(PENDING_CURRENCY_ORDER_STORAGE_KEY, data.order.id);
      } catch {
        // Ignore storage failures.
      }
      window.location.href = data.order.checkoutUrl ?? "";
      return;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : `Could not save ${coinLabel} purchase right now.`;
      setStoreMessage(msg);
      pushToast(msg, "error");
      setIsBuyingCurrency(false);
      return;
    }
    setStoreMessage(`Redirecting to checkout for ${title}.`);
  }

  function handleThreadSelect(threadId: string) {
    setSelectedThreadId(threadId);
    void persistAccountState({ selectedThreadId: threadId });
  }

  function updateAvatarDraft(patch: Partial<AvatarDraft>, notice: string) {
    const nextDraft: AvatarDraft = {
      ...avatarDraft,
      ...patch,
    };
    const nextSlots = avatarSlots.map((slot) =>
      slot.id === activeAvatarSlotId
        ? {
            ...slot,
            draft: nextDraft,
          }
        : slot,
    );
    setAvatarDraft(nextDraft);
    setAvatarSlots(nextSlots);
    setAvatarMessage(notice);
    void persistAccountState({ avatarDraft: nextDraft, avatarSlots: nextSlots, activeAvatarSlotId });
  }

  function applyAvatarPreset(label: string, draft: AvatarDraft) {
    updateAvatarDraft({ ...draft }, `${label} preset applied.`);
  }

  function randomizeAvatarDraft() {
    const availableAccessories = AVATAR_ACCESSORIES.filter(
      (item) => ownedItems.some((owned) => owned.name === item) || item === "Builder Cap",
    );
    const randomPick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)] ?? items[0];
    updateAvatarDraft(
      {
        skinTone: randomPick(SKIN_TONES),
        shirtColor: randomPick(AVATAR_COLOR_SWATCHES),
        pantsColor: randomPick(AVATAR_COLOR_SWATCHES),
        face: randomPick(AVATAR_FACES),
        accessory: randomPick(availableAccessories),
      },
      "Avatar randomized.",
    );
  }

  function equipOwnedAccessory(itemId: string) {
    const accessory = ACCESSORY_CATALOG_ITEMS.find((item) => item.id === itemId);
    if (!accessory) {
      pushToast("Accessory not found.", "error");
      return;
    }
    if (!ownedItemIds.includes(itemId)) {
      pushToast(`You do not own ${accessory.name} yet.`, "error");
      return;
    }
    updateAvatarDraft({ accessory: accessory.val }, `${accessory.name} equipped.`);
    setActiveView("avatar");
  }

  function openAvatarShopForItem(item: AvatarCatalogDef) {
    setMarketTab("shop");
    setMarketCategory("All");
    setMarketSearch(item.name);
    setActiveView("inventory");
    pushToast(`${item.name} is not in your inventory yet.`, "info");
  }

  
  function openGamePage(game: GameCard) {
    setViewingGame(game);
    setActiveView("game-page");
  }

  async function openCreatorPage(name: string) {
    setViewingCreatorName(name);
    setActiveView("creator-page");
    const fallbackGames = games.filter((g) => g.creatorName === name);
    setCreatorPageGames(fallbackGames);
    try {
      const profile = await fetch(`${API_BASE}/profiles/${encodeURIComponent(name.toLowerCase())}`).then((response) => {
        if (!response.ok) {
          throw new Error("Could not load profile");
        }
        return response.json() as Promise<ProfileResponse>;
      });
      const creatorGamesResponse = await fetch(`${API_BASE}/profiles/${encodeURIComponent(profile.profile.username)}/games`).then((response) => {
        if (!response.ok) {
          throw new Error("Could not load creator games");
        }
        return response.json() as Promise<CreatorGamesResponse>;
      });
      setCreatorPageGames(creatorGamesResponse.games);
      const totalFollowers = profile.profile.coins > 0
        ? Math.max(12, Math.floor(profile.profile.coins / 8))
        : 0;
      setViewingCreatorFollowers(totalFollowers);
    } catch {
      setViewingCreatorFollowers(Math.max(12, Math.floor(fallbackGames.reduce((sum, game) => sum + game.likes, 0) / 4)));
    }
  }

  async function toggleLike(gameId: string) {
    const game = games.find((entry) => entry.id === gameId) ?? creatorPageGames.find((entry) => entry.id === gameId) ?? null;
    if (!game) {
      return;
    }
    setLikedGameIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
    try {
      const liked = await fetch(`${API_BASE}/games/${game.slug}/like`, { method: "POST" }).then((response) => {
        if (!response.ok) {
          throw new Error("Could not like game");
        }
        return response.json() as Promise<LikeResponse>;
      });
      setGames((prev) => prev.map((entry) => (entry.id === gameId ? { ...entry, likes: liked.likes } : entry)));
      setCreatorPageGames((prev) => prev.map((entry) => (entry.id === gameId ? { ...entry, likes: liked.likes } : entry)));
      if (viewingGame?.id === gameId) {
        setViewingGame((prev) => (prev ? { ...prev, likes: liked.likes } : prev));
      }
    } catch {
      setLikedGameIds((prev) => {
        const next = new Set(prev);
        if (next.has(gameId)) {
          next.delete(gameId);
        } else {
          next.add(gameId);
        }
        return next;
      });
      pushToast("Like failed. Try again.", "error");
    }
  }

  async function toggleFavorite(gameId: string) {
    if (!sessionToken) {
      pushToast("Sign in to favorite games.", "error");
      return;
    }
    const game = games.find((entry) => entry.id === gameId) ?? creatorPageGames.find((entry) => entry.id === gameId) ?? null;
    if (!game) {
      return;
    }
    const wasFavorited = favoritedGameIds.has(gameId);
    setFavoritedGameIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
    try {
      const result = await fetch(`${API_BASE}/games/${game.slug}/favorite`, {
        method: "POST",
        headers: {
          "x-session-token": sessionToken,
        },
      }).then((response) => {
        if (!response.ok) {
          throw new Error("Could not favorite game");
        }
        return response.json() as Promise<FavoriteResponse>;
      });
      if (result.favorited !== !wasFavorited) {
        setFavoritedGameIds((prev) => {
          const next = new Set(prev);
          if (result.favorited) {
            next.add(gameId);
          } else {
            next.delete(gameId);
          }
          return next;
        });
      }
      pushToast(result.favorited ? "Game saved to favorites." : "Game removed from favorites.");
    } catch {
      setFavoritedGameIds((prev) => {
        const next = new Set(prev);
        if (next.has(gameId)) {
          next.delete(gameId);
        } else {
          next.add(gameId);
        }
        return next;
      });
      pushToast("Favorite failed. Try again.", "error");
    }
  }

  async function toggleFollowCreator(name: string) {
    if (!sessionToken) {
      pushToast("Sign in to follow creators.", "error");
      return;
    }
    const username = name.trim().toLowerCase();
    const wasFollowing = followedCreatorUsernames.has(username);
    setFollowedCreatorUsernames((prev) => {
      const next = new Set(prev);
      if (next.has(username)) {
        next.delete(username);
      } else {
        next.add(username);
      }
      return next;
    });
    try {
      const result = await fetch(`${API_BASE}/profiles/${encodeURIComponent(username)}/follow`, {
        method: "POST",
        headers: {
          "x-session-token": sessionToken,
        },
      }).then((response) => {
        if (!response.ok) {
          throw new Error("Could not follow creator");
        }
        return response.json() as Promise<FollowResponse>;
      });
      setViewingCreatorFollowers(result.followers);
      setFollowedCreatorUsernames((prev) => {
        const next = new Set(prev);
        if (result.following) {
          next.add(username);
        } else {
          next.delete(username);
        }
        return next;
      });
      pushToast(result.following ? `Following ${name}.` : `Unfollowed ${name}.`);
    } catch {
      setFollowedCreatorUsernames((prev) => {
        const next = new Set(prev);
        if (next.has(username)) {
          next.delete(username);
        } else {
          next.add(username);
        }
        return next;
      });
      pushToast("Follow failed. Try again.", "error");
      if (wasFollowing) {
        setViewingCreatorFollowers((prev) => Math.max(0, prev + 1));
      }
    }
  }

  function resetAvatarDraft() {
    updateAvatarDraft({ ...DEFAULT_AVATAR_DRAFT }, "Avatar reset to default.");
  }

  function loadAvatarSlot(slotId: string) {
    const slot = avatarSlots.find((entry) => entry.id === slotId);
    if (!slot) {
      return;
    }
    setActiveAvatarSlotId(slotId);
    setAvatarDraft(slot.draft);
    setAvatarMessage(`${slot.name} loaded.`);
    void persistAccountState({ avatarDraft: slot.draft, activeAvatarSlotId: slotId, avatarSlots });
  }

  function saveAvatarToSlot(slotId: string) {
    const slot = avatarSlots.find((entry) => entry.id === slotId);
    if (!slot) {
      return;
    }
    const nextSlots = avatarSlots.map((entry) =>
      entry.id === slotId
        ? {
            ...entry,
            draft: { ...avatarDraft },
          }
        : entry,
    );
    setAvatarSlots(nextSlots);
    setActiveAvatarSlotId(slotId);
    setAvatarMessage(`Saved to ${slot.name}.`);
    void persistAccountState({ avatarDraft: { ...avatarDraft }, activeAvatarSlotId: slotId, avatarSlots: nextSlots });
  }

  const selectedThread = messageThreads.find((thread) => thread.id === selectedThreadId) ?? messageThreads[0] ?? MESSAGE_THREADS[0];
  const visibleThreads = messageThreads.length > 0 ? messageThreads : MESSAGE_THREADS;
  const allMarketItems = marketItems;
  const accessoryCatalogByValue = new Map(ACCESSORY_CATALOG_ITEMS.map((item) => [item.val, item]));
  const ownedItems = allMarketItems.filter((item) => ownedItemIds.includes(item.id));
  const ownedAccessoryCatalogItems = ACCESSORY_CATALOG_ITEMS.filter((item) => ownedItemIds.includes(item.id));
  const equippedAccessoryItem = accessoryCatalogByValue.get(avatarDraft.accessory) ?? null;
  const equippedMarketplaceItem = equippedAccessoryItem ? allMarketItems.find((item) => item.id === equippedAccessoryItem.id) ?? null : null;
  const normalizedDiscoverQuery = discoverQuery.trim().toLowerCase();
  const discoverGames = [...games]
    .filter((game) => {
      const matchesQuery =
        normalizedDiscoverQuery.length === 0
        || game.title.toLowerCase().includes(normalizedDiscoverQuery)
        || game.description.toLowerCase().includes(normalizedDiscoverQuery)
        || game.creatorName.toLowerCase().includes(normalizedDiscoverQuery)
        || game.genre.toLowerCase().includes(normalizedDiscoverQuery);
      const matchesGenre = discoverGenreFilter === "all" || game.genre === discoverGenreFilter;
      const matchesCategory = (() => {
        if (discoverCategoryTab === "all") {
          return true;
        }
        if (discoverCategoryTab === "featured") {
          return game.likes >= 40;
        }
        if (discoverCategoryTab === "trending") {
          return game.visits >= 800;
        }
        if (discoverCategoryTab === "new") {
          return game.visits <= 1200;
        }
        return game.genre === "minigame" || game.genre === "collectathon";
      })();
      return matchesQuery && matchesGenre && matchesCategory;
    })
    .sort((left, right) => {
      if (discoverSort === "title") {
        return left.title.localeCompare(right.title);
      }
      if (discoverSort === "likes") {
        return right.likes - left.likes;
      }
      return right.visits - left.visits;
    });

  const heroGame = selectedPublicGame ?? games[0] ?? null;
  const homeRows = games.slice(0, 4);
  const trendingRows = discoverGames.slice(0, 3);
  const recentDraft = selectedGame ?? null;
  const publishedDrafts = myGames.filter((game) => game.visibility === "published").length;
  const continueRows = uniqueGames([selectedPublicGame, heroGame, ...games]).slice(0, 5);
  const popularRows = [...games].sort((left, right) => right.visits - left.visits).slice(0, 5);
  const recommendedRows = [...games].sort((left, right) => right.likes - left.likes).slice(0, 5);
  const creatorRows = myGames.slice(0, 4);

  const MARKET_CATEGORIES = ["All", "Hat", "Gear", "Back", "Accessory", "Face", "UGC"];
  const filteredMarketItems = [...allMarketItems]
    .filter((item) => {
      const isUgc = item.source === "ugc" || item.id.startsWith("ugc-");
      const matchCat = marketCategory === "All" || item.category === marketCategory || (marketCategory === "UGC" && isUgc);
      const q = marketSearch.trim().toLowerCase();
      const matchSearch = q.length === 0
        || item.name.toLowerCase().includes(q)
        || item.creator.toLowerCase().includes(q)
        || item.category.toLowerCase().includes(q)
        || item.description.toLowerCase().includes(q);
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (marketSort === "price-asc") return a.price - b.price;
      if (marketSort === "price-desc") return b.price - a.price;
      if (marketSort === "newest") return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      return 0;
    });
  const limitedOwnedItems = ownedItems.filter((item) => item.limited);
  const limitedMarketTargets = allMarketItems.filter((item) => item.limited && !ownedItemIds.includes(item.id));
  const coinLabel = coinName.trim() || "FariBucks";
  const coinMark = coinSymbol.trim() || "FB";
  const formatCoins = (value: number) => `${coinMark} ${value.toLocaleString()}`;
  const creatorShare = Math.max(10, 100 - marketFeePercent);
  const projectedMonthlyRevenue = Math.round(economySummary.creatorNetCoins * 1.35 + premiumPrice * 40);
  const runtimeRoster = activeSession
    ? [
        { name: profile?.displayName ?? "You", score: 1200 + runtimeSessionCoins * 25, accent: "linear-gradient(135deg, #ef4444, #f97316)" },
        { name: "Nova", score: 1080, accent: "linear-gradient(135deg, #06b6d4, #3b82f6)" },
        { name: "Jax", score: 1015, accent: "linear-gradient(135deg, #84cc16, #22c55e)" },
        { name: "Lumi", score: 940, accent: "linear-gradient(135deg, #f59e0b, #facc15)" },
        { name: "Pixel", score: 880, accent: "linear-gradient(135deg, #a855f7, #ec4899)" },
      ].slice(0, Math.max(3, Math.min(activeSession.playerCount, 5)))
    : [];
  const homeSidebarLinks = [
    { label: "Home", view: "home", note: "" },
    { label: "Profile", view: "profile", note: "@me" },
    { label: "Messages", view: "messages", note: `${messageThreads.length}` },
    { label: "Friends", view: "friends", note: "258" },
    { label: "Avatar", view: "avatar", note: "Edit" },
    { label: "Inventory", view: "inventory", note: "Browse" },
    { label: "Gift Cards", view: "giftcards", note: "Redeem" },
    { label: "Currency", view: "currency", note: "Buy" },
  ] as const;
  const homeFriends = [
    { name: "Nova", status: heroGame ? `Playing ${heroGame.title}` : "Online", tone: "mint" },
    { name: "ByteFox", status: recentDraft ? `Editing ${recentDraft.title}` : "In Studio", tone: "sun" },
    { name: "Cloudy", status: "Browsing obbies", tone: "sky" },
    { name: "Echo", status: "In a party", tone: "rose" },
    { name: "Sora", status: "In anime world", tone: "violet" },
    { name: "Mika", status: "Grinding tycoons", tone: "mint" },
  ];
  const activeHomeTitle = heroGame?.title ?? "your next world";

  function sendRuntimeChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = runtimeChatDraft.trim();
    if (!body) {
      return;
    }
    setRuntimeChatMessages((current) => [
      ...current.slice(-7),
      { id: `${Date.now()}-${Math.random()}`, name: profile?.displayName ?? "You", body, tone: "me" },
    ]);
    setRuntimeChatDraft("");
  }

  function handleRuntimeZoneAction(action: "shop" | "reset" | "obby" | "minigame") {
    if (action === "shop") {
      setActiveView("currency");
      pushToast("Opening wallet and shop flow.", "info");
      return;
    }
    if (action === "reset" && activeSession) {
      setRuntimePosition(activeSession.spawn);
      setRuntimePrompt("Reset to spawn.");
      return;
    }
    if (action === "obby") {
      setRuntimePosition({ x: -6, y: runtimeMapData?.spawn.y ?? 2, z: 18 });
      setRuntimePrompt("Entered obby portal lane.");
      pushToast("Queued into obby portal preview.", "success");
      return;
    }
    if (action === "minigame") {
      setRuntimePosition({ x: 6, y: runtimeMapData?.spawn.y ?? 2, z: 18 });
      setRuntimePrompt("Entered minigame portal lane.");
      pushToast("Queued into minigame portal preview.", "success");
    }
  }

  function reloadUnityRuntime() {
    setUnityRuntimeFrameKey((current) => current + 1);
    setUnityRuntimeLoadState("loading");
  }

  function openUnityRuntimeInWindow() {
    if (!unityRuntimeSrc) {
      return;
    }
    window.open(unityRuntimeSrc, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="page">
      {/* ── Toast notification stack ── */}
      {toasts.length > 0 ? (
        <div className="toast-stack" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`}>
              <span className="toast-icon">{t.kind === "success" ? "✓" : t.kind === "error" ? "✕" : "ℹ"}</span>
              <span className="toast-msg">{t.message}</span>
              <button
                type="button"
                className="toast-close"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              >×</button>
            </div>
          ))}
        </div>
      ) : null}
      {profile ? (
        <section className="shell-bar">
          <div className="shell-brand-block">
            <div className="shell-logo-icon">F</div>
            <div className="shell-brand-text">
              <strong className="shell-brand">Fairblox</strong>
              <span className="shell-subbrand">Platform</span>
            </div>
          </div>
          <div className="shell-nav">
            <button
              type="button"
              className={activeView === "home" ? "nav-pill nav-pill-active" : "nav-pill"}
              onClick={() => setActiveView("home")}
            >
              🏠 Home
            </button>
            <button
              type="button"
              className={activeView === "discover" ? "nav-pill nav-pill-active" : "nav-pill"}
              onClick={() => setActiveView("discover")}
            >
              🔍 Discover
            </button>
            <button
              type="button"
              className={activeView === "creator" ? "nav-pill nav-pill-active" : "nav-pill"}
              onClick={() => setActiveView("creator")}
            >
              ✏️ Create
            </button>
          </div>
          {profile ? (
            <label className="shell-search">
              <span className="visually-hidden">Search games</span>
              <input
                value={discoverQuery}
                onChange={(event) => setDiscoverQuery(event.target.value)}
                onFocus={() => setActiveView("discover")}
                placeholder="Search games, creators, genres"
                aria-label="Search games"
              />
            </label>
          ) : null}
          <div className="shell-user">
            <button type="button" className="wallet-chip" onClick={() => setActiveView("currency")}>
              {coinMark} {walletCoins.toLocaleString()} {coinLabel}
            </button>
            <div className="shell-avatar">{profile.displayName.slice(0, 1).toUpperCase()}</div>
            <span>@{profile.username}</span>
            <button type="button" className="secondary" onClick={signOut}>
              Sign out
            </button>
          </div>
        </section>
      ) : null}

      {!profile || activeView !== "home" ? (
      <section className="hero">
        <div className="hero-copy">
          {profile ? (
            <>
              <p className="eyebrow">Home</p>
              <h1>Welcome back, {profile.displayName}.</h1>
              <p className="lede">
                Jump into trending worlds, keep shipping drafts, and switch between play and creation fast.
              </p>
              <div className="hero-actions">
                <button type="button" onClick={() => setActiveView("home")}>
                  Open home feed
                </button>
                <button type="button" className="secondary" onClick={() => setActiveView("creator")}>
                  Open creator studio
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="eyebrow">{sessionToken ? "Restoring session" : "Welcome to Fairblox"}</p>
              <h1>{sessionToken ? "Getting your account back in place." : "Play. Build. Publish. Repeat."}</h1>
              <p className="lede">
                {sessionToken
                  ? (sessionRestoreMessage || "We found a saved sign-in and are reconnecting you now.")
                  : "The browser-first game platform where anyone can ship an obby, minigame, or world — in minutes. Fairer economics. Instant publishing."}
              </p>
              {!sessionToken ? (
                <div className="hero-actions">
                  <button type="button" onClick={() => setActiveView("discover")}>Create account</button>
                  <button type="button" className="secondary" onClick={() => setActiveView("discover")}>
                    Browse games
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="hero-panel">
          {profile ? (
            <>
              <p className="panel-label">Your Snapshot</p>
              <h2 className="profile-title">{profile.displayName}</h2>
              <p className="profile-line">@{profile.username}</p>
              <p className="profile-line">{profile.bio}</p>
              <div className="profile-stats">
                <span>{profile.role}</span>
                <span>{profile.coins} {coinLabel}</span>
                <span>{profile.avatarPreset} avatar</span>
                <span>{myGames.length} draft(s)</span>
                <span>{publishedDrafts} published</span>
              </div>
            </>
          ) : sessionToken ? (
            <>
              <p className="panel-label">Saved Sign-In</p>
              <h2>{isRestoringSession ? "Restoring your account" : "Session saved locally"}</h2>
              <p className="profile-line">
                {sessionRestoreMessage || "Your sign-in is stored on this device. If the backend was asleep, it can take a moment to reconnect."}
              </p>
              <div className="profile-stats">
                <span>Saved session token</span>
                <span>{isRestoringSession ? "Connecting..." : "Waiting for retry"}</span>
              </div>
              <div className="hero-actions compact-actions">
                <button type="button" onClick={() => window.location.reload()}>Retry restore</button>
                <button type="button" className="secondary" onClick={signOut}>Sign out instead</button>
              </div>
            </>
          ) : (
            <>
              <p className="panel-label">Auth</p>
              <div className="auth-grid">
                <form onSubmit={handleSignup}>
                  <h2>Sign up</h2>
                  <input
                    placeholder="Display name"
                    value={signupForm.displayName}
                    onChange={(event) => setSignupForm((current) => ({ ...current, displayName: event.target.value }))}
                  />
                  <input
                    placeholder="Email"
                    type="email"
                    value={signupForm.email}
                    onChange={(event) => setSignupForm((current) => ({ ...current, email: event.target.value }))}
                  />
                  <input
                    placeholder="Username"
                    value={signupForm.username}
                    onChange={(event) => setSignupForm((current) => ({ ...current, username: event.target.value }))}
                  />
                  <input
                    placeholder="Password"
                    type="password"
                    value={signupForm.password}
                    onChange={(event) => setSignupForm((current) => ({ ...current, password: event.target.value }))}
                  />
                  <button type="submit">Create creator account</button>
                </form>
                <form onSubmit={handleLogin}>
                  <h2>Log in</h2>
                  <input
                    placeholder="Username"
                    value={loginForm.username}
                    onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))}
                  />
                  <input
                    placeholder="Password"
                    type="password"
                    value={loginForm.password}
                    onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  />
                  <button type="submit">Login</button>
                  <p className="hint">Demo account: `plutobuilds` / `demo123`</p>
                </form>
              </div>
              {authError ? <p className="error">{authError}</p> : null}
            </>
          )}
        </div>
      </section>
      ) : null}

      {!profile && !sessionToken && activeView === "home" ? (
        <section className="section public-home fade-in">
          <section className="home-hero-strip public-home-strip">
            <div className="public-home-copy">
              <p className="eyebrow">Browser-first worlds</p>
              <h2>Launch games, avatars, and a creator economy from one place.</h2>
              <p className="lede">
                Fairblox is the browser-first platform for playable worlds, UGC avatars, marketplace items, and creator publishing.
                Play instantly, build in Studio, and ship updates without a desktop client.
              </p>
              <div className="public-home-kicker">
                <span>Instant web play</span>
                <span>Creator-first tools</span>
                <span>Installable PWA</span>
              </div>
              <div className="home-hero-actions">
                <button type="button" onClick={() => setActiveView("discover")}>Explore worlds</button>
                <button type="button" className="secondary" onClick={() => setActiveView("creator")}>Open Studio preview</button>
              </div>
              <div className="presentation-pills">
                <span className="presentation-pill">Playable worlds</span>
                <span className="presentation-pill">Creator studio</span>
                <span className="presentation-pill">Avatar economy</span>
                <span className="presentation-pill">Stripe checkout</span>
              </div>
            </div>
            <div className="home-metrics public-home-metrics">
              <div>
                <strong>{games.length || 3}</strong>
                <span>Featured launch worlds</span>
              </div>
              <div>
                <strong>{creatorShare}%</strong>
                <span>Creator payout after fees</span>
              </div>
              <div>
                <strong>{COIN_BUNDLES.length}</strong>
                <span>Live currency bundles</span>
              </div>
            </div>
          </section>

          <section className="home-spotlight-grid public-spotlight-grid">
            <article className="feature-box home-preview public-spotlight-card">
              <div className="section-head">
                <h2>Featured world</h2>
                <button type="button" className="see-all-btn" onClick={() => setActiveView("discover")}>Open discover</button>
              </div>
              {heroGame ? (
                <>
                  <div className={`public-spotlight-thumb thumb-${heroGame.genre}`}>
                    <span className="thumb-deco" aria-hidden="true">{GENRE_EMOJIS[heroGame.genre] ?? GENRE_EMOJIS.default}</span>
                    <span className="thumb-badge">{heroGame.genre}</span>
                    <span className="thumb-online">👥 {Math.max(1, Math.floor(heroGame.visits / 80)).toLocaleString()} online</span>
                  </div>
                  <div className="public-spotlight-body">
                    <strong>{heroGame.title}</strong>
                    <span>by {heroGame.creatorName}</span>
                    <p>{heroGame.description || "A featured world showing the current Fairblox gameplay style."}</p>
                    <div className="spotlight-stat-row">
                      <span className="spotlight-stat">{heroGame.visits.toLocaleString()} visits</span>
                      <span className="spotlight-stat">{heroGame.likes.toLocaleString()} likes</span>
                      <span className="spotlight-stat">{heroGame.genre}</span>
                    </div>
                    <div className="home-banner-actions">
                      <button type="button" onClick={() => openPublicGame(heroGame.slug, "home")}>View game</button>
                      <button type="button" className="secondary" onClick={() => void joinPublicGameBySlug(heroGame.slug)}>Play now</button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="hint">Featured worlds will appear here once games load.</p>
              )}
            </article>

            <article className="feature-box home-preview public-spotlight-card">
              <div className="section-head">
                <h2>What ships with it</h2>
                <span>Core platform pillars</span>
              </div>
              <div className="stack-list">
                <div className="stack-item">
                  <strong>Play and publish</strong>
                  <span>World pages, session joining, likes, favorites, and public publishing.</span>
                </div>
                <div className="stack-item">
                  <strong>Avatar and inventory</strong>
                  <span>Custom avatar presets, owned-item state, and installable marketplace cosmetics.</span>
                </div>
                <div className="stack-item">
                  <strong>Payments and economy</strong>
                  <span>Stripe Checkout for coin bundles, wallet balances, and creator-facing marketplace pricing.</span>
                </div>
              </div>
            </article>
          </section>

          <section className="home-row-block">
            <div className="section-head">
              <h2>Trending right now</h2>
              <button type="button" className="see-all-btn" onClick={() => setActiveView("discover")}>Browse all</button>
            </div>
            <div className="home-rail">
              {trendingRows.map((game) => (
                <article className="home-tile clickable" key={`public-trending-${game.id}`} onClick={() => openPublicGame(game.slug, "home")}>
                  <div className={`home-tile-thumb thumb-${game.genre}`}>
                    <span className="thumb-deco" aria-hidden="true">{GENRE_EMOJIS[game.genre] ?? GENRE_EMOJIS.default}</span>
                    <span className="home-tile-badge">Trending</span>
                    <span className="thumb-online">● {Math.max(3, Math.floor(game.visits / 80)).toLocaleString()}</span>
                  </div>
                  <div className="home-tile-body">
                    <strong>{game.title}</strong>
                    <span>by {game.creatorName}</span>
                    <small>{game.visits.toLocaleString()} visits</small>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="home-flow-grid">
            <article className="feature-box home-flow-card">
              <span className="home-flow-step">01</span>
              <strong>Jump into a world</strong>
              <p className="hint">Discover pages, featured cards, and one-click play keep the first session fast.</p>
            </article>
            <article className="feature-box home-flow-card">
              <span className="home-flow-step">02</span>
              <strong>Customize your identity</strong>
              <p className="hint">Wallet, inventory, and avatar items all feed the same account state.</p>
            </article>
            <article className="feature-box home-flow-card">
              <span className="home-flow-step">03</span>
              <strong>Open Studio and publish</strong>
              <p className="hint">Move from playing to building without switching platforms or installing heavy tools.</p>
            </article>
          </section>

          <section className="split-rails public-summary-grid">
            <article className="feature-box rail-panel">
              <div className="section-head">
                <h2>Creator hooks</h2>
                <span>Build faster</span>
              </div>
              <div className="stack-list compact-stack">
                <div className="stack-item">
                  <strong>Visual world editor</strong>
                  <span>Place objects, checkpoints, and structured world data directly in Studio.</span>
                </div>
                <div className="stack-item">
                  <strong>Genre templates</strong>
                  <span>Start with obby, minigame, or collectathon layouts instead of a blank map.</span>
                </div>
                <div className="stack-item">
                  <strong>PWA app shell</strong>
                  <span>Install Fairblox on mobile and desktop once the site is deployed over HTTPS.</span>
                </div>
              </div>
            </article>

            <article className="feature-box rail-panel">
              <div className="section-head">
                <h2>Economy hooks</h2>
                <span>Monetize cleanly</span>
              </div>
              <div className="stack-list compact-stack">
                <div className="stack-item">
                  <strong>Coin bundles</strong>
                  <span>{COIN_BUNDLES[0]?.priceLabel ?? "$4.99"} to {COIN_BUNDLES[COIN_BUNDLES.length - 1]?.priceLabel ?? "$49.99"} checkout tiers.</span>
                </div>
                <div className="stack-item">
                  <strong>Marketplace inventory</strong>
                  <span>Owned items sync into avatar customization and inventory state.</span>
                </div>
                <div className="stack-item">
                  <strong>Stripe-backed fulfillment</strong>
                  <span>Wallet credit happens after verified checkout completion instead of client-only simulation.</span>
                </div>
              </div>
            </article>
          </section>

          <section className="presentation-strip">
            <div className="presentation-strip-card">
              <span className="presentation-strip-label">Built for launch</span>
              <strong>Public web, mobile install, creator tools, and wallet flow in one stack.</strong>
            </div>
            <div className="presentation-strip-card">
              <span className="presentation-strip-label">Best first demo</span>
              <strong>Open a world, buy currency, equip an item, then jump into Studio.</strong>
            </div>
            <div className="presentation-strip-card">
              <span className="presentation-strip-label">Current feel</span>
              <strong>Roblox-inspired product direction with a faster browser-first loop.</strong>
            </div>
          </section>

          <section className="feature-box home-banner public-home-cta">
            <div>
              <p className="panel-label">Start here</p>
              <h2>Play first, then build your own world.</h2>
              <p className="hint">Browse public games, test the marketplace flow, then move into Studio when you want to create.</p>
            </div>
            <div className="home-banner-actions">
              <button type="button" onClick={() => setActiveView("discover")}>Browse games</button>
              <button type="button" className="secondary" onClick={() => setActiveView("creator")}>See creator tools</button>
            </div>
          </section>

          <footer className="presentation-footer">
            <strong>Fairblox</strong>
            <span>Playable worlds, creator tooling, avatar inventory, and monetization in one browser-first stack.</span>
          </footer>
        </section>
      ) : null}

      {profile && activeView === "home" ? (
        <>
          <section className="section home-layout">
            <aside className="home-sidebar">
              <div className="home-profile-card home-profile-card-compact">
                <div className="home-profile-avatar">{profile.displayName.slice(0, 1).toUpperCase()}</div>
                <div>
                  <strong>{profile.displayName}</strong>
                  <p className="profile-line">@{profile.username}</p>
                </div>
              </div>
              <nav className="home-sidebar-card home-nav-list" aria-label="Home navigation">
                {homeSidebarLinks.map((link) => (
                  <button
                    key={link.label}
                    type="button"
                    className={link.label === "Home" ? "home-nav-item home-nav-item-active" : "home-nav-item"}
                    onClick={() => setActiveView(link.view)}
                  >
                    <span className="home-nav-icon">{({Home:'🏠',Profile:'👤',Messages:'💬',Friends:'👥',Avatar:'👗',Inventory:'🎒','Gift Cards':'🎁',Currency:'💰'} as Record<string,string>)[link.label] ?? link.label.slice(0,1)}</span>
                    <span className="home-nav-text">{link.label}</span>
                    {link.note ? <span className="home-nav-note">{link.note}</span> : null}
                  </button>
                ))}
              </nav>
              <div className="home-sidebar-card home-quick-stats">
                <p className="panel-label">Quick Stats</p>
                <div className="home-metrics home-metrics-vertical">
                  <div>
                    <strong>{profile.coins}</strong>
                    <span>{coinLabel}</span>
                  </div>
                  <div>
                    <strong>{myGames.length}</strong>
                    <span>drafts</span>
                  </div>
                  <div>
                    <strong>{publishedDrafts}</strong>
                    <span>published</span>
                  </div>
                </div>
              </div>
              <div className="home-sidebar-card">
                <p className="panel-label">Continue Creating</p>
                {recentDraft ? (
                  <button type="button" className="draft-item" onClick={() => openDraft(recentDraft.id)}>
                    <strong>{recentDraft.title}</strong>
                    <span>{recentDraft.visibility}</span>
                    <span>{recentDraft.versionCount} version(s)</span>
                  </button>
                ) : (
                  <p className="hint">Create your first draft to pin studio work here.</p>
                )}
              </div>
            </aside>

            <div className="home-main">
              <section className="home-hero-strip">
                <div className="home-hero-copy">
                  <p className="eyebrow">Home</p>
                  <h1>Welcome back, {profile.displayName}.</h1>
                  <p className="lede">
                    Play what your friends are playing, jump into a new world, or open Studio and keep building.
                  </p>
                  <div className="home-hero-kicker">
                    <span>{walletCoins} {coinLabel}</span>
                    <span>{ownedItems.length} owned items</span>
                    <span>{publishedDrafts} published worlds</span>
                  </div>
                </div>
                {heroGame ? (
                  <div className="home-hero-actions">
                    <button type="button" onClick={() => openPublicGame(heroGame.slug, "home")}>
                      Open {heroGame.title}
                    </button>
                    <button type="button" className="secondary" onClick={() => setActiveView("creator")}>
                      Open studio
                    </button>
                  </div>
                ) : null}
              </section>

              <section className="home-dashboard-grid">
                <article className="feature-box dashboard-card dashboard-card-primary">
                  <span className="dashboard-card-label">Continue building</span>
                  <strong>{recentDraft ? recentDraft.title : "Start your first draft"}</strong>
                  <p className="hint">
                    {recentDraft
                      ? `Last pinned studio project with ${recentDraft.versionCount} version(s) and ${recentDraft.visibility} visibility.`
                      : "Open Studio, choose a template, and publish your first playable world."}
                  </p>
                  <div className="home-banner-actions">
                    <button type="button" onClick={() => recentDraft ? openDraft(recentDraft.id) : setActiveView("creator")}>
                      {recentDraft ? "Open draft" : "Open Studio"}
                    </button>
                    <button type="button" className="secondary" onClick={() => setActiveView("creator")}>Studio tools</button>
                  </div>
                </article>

                <article className="feature-box dashboard-card">
                  <span className="dashboard-card-label">Wallet</span>
                  <strong>{walletCoins} {coinLabel}</strong>
                  <p className="hint">Use currency for avatar drops, marketplace items, and creator economy tests.</p>
                  <div className="dashboard-card-meta">
                    <span>{COIN_BUNDLES.length} bundles</span>
                    <span>{ownedItems.length} owned items</span>
                  </div>
                </article>

                <article className="feature-box dashboard-card">
                  <span className="dashboard-card-label">Next move</span>
                  <strong>{heroGame ? `Play ${heroGame.title}` : "Browse fresh worlds"}</strong>
                  <p className="hint">Stay in the player loop, or jump back into discover to find another world to test.</p>
                  <div className="dashboard-card-meta">
                    <span>{games.length} live worlds</span>
                    <span>{homeFriends.length} friends online</span>
                  </div>
                </article>
              </section>

              <section className="home-row-block">
                <div className="section-head">
                  <h2>Friends ({homeFriends.length})</h2>
                  <button type="button" className="see-all-btn" onClick={() => setActiveView("friends")}>See all</button>
                </div>
                <div className="friend-row">
                  <article className="friend-card friend-card-add clickable" role="button" tabIndex={0} onClick={() => setActiveView("friends")} onKeyDown={(e) => e.key === "Enter" && setActiveView("friends")}>
                    <div className="friend-avatar friend-avatar-add">+</div>
                    <strong>Add</strong>
                    <span>Find friends</span>
                  </article>
                  {homeFriends.map((friend) => (
                    <article key={friend.name} className={`friend-card friend-card-${friend.tone}`}>
                      <div className="friend-avatar-wrap">
                        <div className="friend-avatar">{friend.name.slice(0, 1)}</div>
                        <i className="friend-status-dot" />
                      </div>
                      <strong>{friend.name}</strong>
                      <span>{friend.status}</span>
                    </article>
                  ))}
                </div>
              </section>

              <section className="home-banner hero-promo-banner">
                <div className="hero-promo-copy">
                  <span className="hero-promo-tag">Featured</span>
                  <h2>{activeHomeTitle}</h2>
                  <p>A featured world hand-picked by the Fairblox team. Drop in and see what's possible.</p>
                  <div className="home-banner-actions">
                    {heroGame ? (
                      <button type="button" onClick={() => openPublicGame(heroGame.slug, "home")}>Join</button>
                    ) : null}
                    <button type="button" className="secondary" onClick={() => setActiveView("discover")}>See details</button>
                  </div>
                </div>
                <div className="hero-promo-meta">
                  <span>{heroGame?.genre ?? "obby"}</span>
                  <span>{heroGame?.visits ?? 0} visits</span>
                  <span>{heroGame?.likes ?? 0} likes</span>
                </div>
              </section>

              <section className="home-row-block">
                <div className="section-head">
                  <h2>Continue</h2>
                  <button type="button" className="see-all-btn" onClick={() => setActiveView("discover")}>See all</button>
                </div>
                <div className="home-rail">
                  {continueRows.map((game) => (
                    <article className="home-tile clickable" key={`continue-${game.id}`} onClick={() => openPublicGame(game.slug, "home")}>
                      <div className={`home-tile-thumb thumb-${game.genre}`}>
                        <span className="thumb-deco" aria-hidden="true">{GENRE_EMOJIS[game.genre] ?? GENRE_EMOJIS.default}</span>
                        <span className="home-tile-badge">Continue</span>
                        <span className="thumb-online">● {Math.max(3, Math.floor(game.visits / 80)).toLocaleString()}</span>
                      </div>
                      <div className="home-tile-body">
                        <strong>{game.title}</strong>
                        <span>by {game.creatorName}</span>
                        <small>{game.visits} visits</small>
                        <div className="home-progress">
                          <div className="home-progress-fill" style={{ width: `${Math.min(92, 24 + game.likes / 24)}%` }} />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="home-row-block">
                <div className="section-head">
                  <h2>Recommended For You</h2>
                  <button type="button" className="see-all-btn" onClick={() => setActiveView("discover")}>See all</button>
                </div>
                <div className="home-rail">
                  {recommendedRows.map((game) => (
                    <article className="home-tile clickable" key={`recommended-${game.id}`} onClick={() => openPublicGame(game.slug, "home")}>
                      <div className={`home-tile-thumb thumb-${game.genre}`}>
                        <span className="thumb-deco" aria-hidden="true">{GENRE_EMOJIS[game.genre] ?? GENRE_EMOJIS.default}</span>
                        <span className="home-tile-badge">Recommended</span>
                        <span className="thumb-online">● {Math.max(3, Math.floor(game.visits / 80)).toLocaleString()}</span>
                      </div>
                      <div className="home-tile-body">
                        <strong>{game.title}</strong>
                        <span>{game.likes} likes</span>
                        <small>{game.description}</small>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="home-row-block split-rails">
                <div className="feature-box rail-panel">
                  <div className="section-head">
                    <h2>Popular</h2>
                    <button type="button" className="see-all-btn" onClick={() => setActiveView("discover")}>See all</button>
                  </div>
                  <div className="stack-list compact-stack">
                    {popularRows.map((game) => (
                      <button key={`popular-${game.id}`} type="button" className="draft-item" onClick={() => openPublicGame(game.slug, "home")}>
                        <strong>{game.title}</strong>
                        <span>{game.genre}</span>
                        <span>{game.visits} visits</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="feature-box rail-panel">
                  <div className="section-head">
                    <h2>Studio Picks</h2>
                    <button type="button" className="see-all-btn" onClick={() => setActiveView("creator")}>Open Studio</button>
                  </div>
                  {creatorRows.length > 0 ? (
                    <div className="stack-list compact-stack">
                      {creatorRows.map((game) => (
                        <button key={`creator-${game.id}`} type="button" className="draft-item" onClick={() => openDraft(game.id)}>
                          <strong>{game.title}</strong>
                          <span>{game.visibility}</span>
                          <span>{game.publishedVersionNumber ? `v${game.publishedVersionNumber}` : "unpublished"}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="hint">No drafts yet. Open Create to start building.</p>
                  )}
                </div>
              </section>

              <section className="feature-box home-banner">
                <div>
                  <p className="panel-label">Ready for more?</p>
                  <h2>Discover new worlds</h2>
                  <p className="hint">Browse the full catalog or jump into Studio and start building your own.</p>
                </div>
                <div className="home-banner-actions">
                  <button type="button" onClick={() => setActiveView("discover")}>Browse games</button>
                  <button type="button" className="secondary" onClick={() => setActiveView("creator")}>Open Studio</button>
                </div>
              </section>
            </div>
          </section>
        </>
      ) : null}

      {profile && ["profile", "messages", "friends", "avatar", "inventory", "giftcards", "currency"].includes(activeView) ? (
        <section className="section home-layout account-layout">
          <aside className="home-sidebar">
            <div className="home-profile-card home-profile-card-compact">
              <div className="home-profile-avatar">{profile.displayName.slice(0, 1).toUpperCase()}</div>
              <div>
                <strong>{profile.displayName}</strong>
                <p className="profile-line">@{profile.username}</p>
              </div>
            </div>
            <nav className="home-sidebar-card home-nav-list" aria-label="Home navigation">
              {homeSidebarLinks.map((link) => (
                <button
                  key={`account-${link.label}`}
                  type="button"
                  className={activeView === link.view ? "home-nav-item home-nav-item-active" : "home-nav-item"}
                  onClick={() => setActiveView(link.view)}
                >
                  <span className="home-nav-icon">{({Home:'🏠',Profile:'👤',Messages:'💬',Friends:'👥',Avatar:'👗',Inventory:'🎒','Gift Cards':'🎁',Currency:'💰'} as Record<string,string>)[link.label] ?? link.label.slice(0,1)}</span>
                  <span className="home-nav-text">{link.label}</span>
                  {link.note ? <span className="home-nav-note">{link.note}</span> : null}
                </button>
              ))}
            </nav>
            <div className="home-sidebar-card home-quick-stats">
              <p className="panel-label">Wallet</p>
              <div className="home-metrics home-metrics-vertical">
                <div>
                  <strong>{walletCoins}</strong>
                  <span>{coinLabel}</span>
                </div>
                <div>
                  <strong>{ownedItems.length}</strong>
                  <span>owned items</span>
                </div>
                <div>
                  <strong>{publishedDrafts}</strong>
                  <span>published</span>
                </div>
              </div>
            </div>
          </aside>

          <div className="home-main">
            {activeView === "profile" ? (
              <section className="account-page">
                <div className="account-header">
                  <div>
                    <p className="eyebrow">Profile</p>
                    <h2>{profile.displayName}</h2>
                    <p className="hint">Profile, stats, and progress at a glance.</p>
                  </div>
                </div>
                <div className="account-grid-two">
                  <div className="feature-box account-card">
                    <h3>Overview</h3>
                    <div className="stack-list compact-stack">
                      <div className="stack-item"><strong>Role</strong><span>{profile.role}</span></div>
                      <div className="stack-item"><strong>Bio</strong><span>{profile.bio}</span></div>
                      <div className="stack-item"><strong>Avatar preset</strong><span>{avatarDraft.accessory}</span></div>
                    </div>
                  </div>
                  <div className="feature-box account-card">
                    <h3>Activity</h3>
                    <div className="stack-list compact-stack">
                      <div className="stack-item"><strong>Wallet</strong><span>{walletCoins} {coinLabel} available</span></div>
                      <div className="stack-item"><strong>Drafts</strong><span>{myGames.length} projects in studio</span></div>
                      <div className="stack-item"><strong>Featured world</strong><span>{activeHomeTitle}</span></div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {activeView === "messages" ? (
              <section className="account-page">
                <div className="account-header">
                  <div>
                    <p className="eyebrow">Messages</p>
                    <h2>Inbox</h2>
                    <p className="hint">Creator and player DMs.</p>
                  </div>
                </div>
                <div className="messages-layout">
                  <div className="feature-box message-list-panel">
                    {visibleThreads.map((thread) => (
                      <button
                        key={thread.id}
                        type="button"
                        className={selectedThreadId === thread.id ? "message-thread message-thread-active" : "message-thread"}
                        onClick={() => handleThreadSelect(thread.id)}
                      >
                        <strong>{thread.name}</strong>
                        <span>{thread.status}</span>
                      </button>
                    ))}
                  </div>
                  <div className="feature-box message-body-panel">
                    <div className="section-head">
                      <h3>{selectedThread.name}</h3>
                      <span>{selectedThread.status}</span>
                    </div>
                    <div className="message-bubbles">
                      {selectedThread.messages.map((message, index) => (
                        <div key={`${selectedThread.id}-${index}`} className={message.from === "me" ? "message-bubble message-bubble-me" : "message-bubble"}>
                          <p>{message.body}</p>
                          <span>{message.at}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {activeView === "friends" ? (
              <section className="account-page">
                <div className="account-header">
                  <div>
                    <p className="eyebrow">Friends</p>
                    <h2>Friends List</h2>
                    <p className="hint">Online friends and quick joins.</p>
                  </div>
                </div>
                <div className="friends-grid">
                  {homeFriends.map((friend) => (
                    <article key={`friends-${friend.name}`} className={`friend-card friend-card-${friend.tone} friend-card-panel`}>
                      <div className="friend-avatar-wrap">
                        <div className="friend-avatar">{friend.name.slice(0, 1)}</div>
                        <i className="friend-status-dot" />
                      </div>
                      <strong>{friend.name}</strong>
                      <span>{friend.status}</span>
                      <div className="friend-actions">
                        <button type="button" onClick={() => setActiveView("messages")}>Message</button>
                        <button type="button" className="secondary" onClick={() => setActiveView("home")}>Join</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {activeView === "avatar" ? (
              <section className="av-editor-page">
                <div className="av-editor-top">
                  <div>
                    <p className="eyebrow">Avatar</p>
                    <h2 style={{margin:0}}>Avatar Editor</h2>
                  </div>
                  <button type="button" className="secondary" onClick={() => setActiveView("inventory" as AppView)}>
                    Open inventory →
                  </button>
                </div>
                <div className="av-editor-layout">
                  <div className="av-editor-left">
                    <div className="av-stage-card">
                      <div className="avatar-stage">
                        <div
                          className="avatar-figure"
                          style={{"--av-skin": avatarDraft.skinTone, "--av-shirt": avatarDraft.shirtColor, "--av-pants": avatarDraft.pantsColor} as React.CSSProperties}
                        >
                          <div className="av-head">
                            <div className={`av-eyes av-eyes-${avatarDraft.face.toLowerCase().replace(/\s+/g, "-")}`} />
                          </div>
                          <div className="av-torso">
                            <div className="av-arm" />
                            <div className="av-body" />
                            <div className="av-arm" />
                          </div>
                          <div className="av-legs">
                            <div className="av-leg" />
                            <div className="av-leg" />
                          </div>
                        </div>
                        <div className="av-accessory-tag">{avatarDraft.accessory}</div>
                        <div className="avatar-stage-identity">
                          <strong>{avatarAlias.trim() || "Player"}</strong>
                        </div>
                      </div>
                      <div className="av-stage-controls">
                        <div className="av-body-type-row">
                          <span className="tool-title">Body Type</span>
                          <input type="range" min={0} max={100} defaultValue={0} className="av-body-slider" />
                          <span className="tool-title">0%</span>
                        </div>
                        <label className="av-stage-label">
                          <span className="tool-title">Display Name</span>
                          <input value={avatarAlias} maxLength={28} onChange={(evt) => setAvatarAlias(evt.target.value)} placeholder="Player" />
                        </label>
                        <label className="av-stage-label">
                          <span className="tool-title">Aura</span>
                          <select value={avatarAura} onChange={(evt) => setAvatarAura(evt.target.value as (typeof AVATAR_AURAS)[number])}>
                            {AVATAR_AURAS.map((aura) => <option key={aura} value={aura}>{aura}</option>)}
                          </select>
                        </label>
                      </div>
                    </div>
                    <div className="av-outfits-card">
                      <div className="av-outfits-header">
                        <span className="tool-title">Saved Outfits</span>
                        <button type="button" className="secondary" style={{fontSize:"0.76rem",padding:"0.3rem 0.65rem"}} onClick={randomizeAvatarDraft}>Randomize</button>
                      </div>
                      {avatarSlots.map((slot) => (
                        <article
                          key={slot.id}
                          className={slot.id === activeAvatarSlotId ? "av-outfit-row av-outfit-active" : "av-outfit-row"}
                          onClick={() => loadAvatarSlot(slot.id)}
                        >
                          <div className="av-outfit-thumb" style={{background: slot.draft.shirtColor}} />
                          <div className="av-outfit-info">
                            <strong>{slot.name}</strong>
                            <span>{slot.draft.face} · {slot.draft.accessory}</span>
                          </div>
                          <button
                            type="button"
                            className="secondary"
                            style={{fontSize:"0.76rem",padding:"0.28rem 0.6rem",flexShrink:0}}
                            onClick={(evt) => { evt.stopPropagation(); saveAvatarToSlot(slot.id); }}
                          >
                            Save
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
                  <div className="av-editor-right">
                    <div className="av-catalog-tabs">
                      {AVATAR_EDITOR_TABS.map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          className={avatarEditorTab === tab ? "av-tab av-tab-active" : "av-tab"}
                          onClick={() => setAvatarEditorTab(tab)}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    <div className="av-catalog-crumb">
                      {avatarEditorTab} <span>›</span> Recently Added
                    </div>
                    <div className="av-catalog-grid">
                      {(() => {
                        const RECENT_CATS = new Set<AvatarCatalogDef["cat"]>(["Accessories", "Avatars", "Makeup", "Body"]);
                        return AVATAR_CATALOG_DEFS
                          .filter((item) => avatarEditorTab === "Recent" ? RECENT_CATS.has(item.cat) : item.cat === avatarEditorTab)
                          .map((item) => {
                            const isOwned = item.kind === "skin" || item.kind === "face" || item.kind === "shirt" || item.kind === "pants" || item.kind === "preset" || item.kind === "animation" || ownedItemIds.includes(item.id);
                            const isEquipped =
                              (item.kind === "skin" && avatarDraft.skinTone === item.val) ||
                              (item.kind === "face" && avatarDraft.face === item.val) ||
                              (item.kind === "shirt" && avatarDraft.shirtColor === item.val) ||
                              (item.kind === "pants" && avatarDraft.pantsColor === item.val) ||
                              (item.kind === "accessory" && avatarDraft.accessory === item.val);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={isEquipped ? "av-item av-item-equipped" : "av-item"}
                                onClick={() => {
                                  if (item.kind === "skin") updateAvatarDraft({ skinTone: item.val }, `${item.name} equipped.`);
                                  else if (item.kind === "face") updateAvatarDraft({ face: item.val }, `${item.name} equipped.`);
                                  else if (item.kind === "shirt") updateAvatarDraft({ shirtColor: item.val }, `${item.name} equipped.`);
                                  else if (item.kind === "pants") updateAvatarDraft({ pantsColor: item.val }, `${item.name} equipped.`);
                                  else if (item.kind === "accessory" && isOwned) updateAvatarDraft({ accessory: item.val }, `${item.name} equipped.`);
                                  else if (item.kind === "accessory") openAvatarShopForItem(item);
                                  else if (item.kind === "preset") {
                                    const p = AVATAR_PRESETS.find((pr) => pr.label === item.val);
                                    if (p) applyAvatarPreset(p.label, p.draft);
                                  }
                                }}
                              >
                                <div className="av-item-thumb" style={{background: item.bg}}>
                                  <span className="av-item-emoji">{item.emoji}</span>
                                  {item.limited && <span className="av-item-badge-lim">U</span>}
                                  {isEquipped && <div className="av-item-check">✓</div>}
                                </div>
                                <span className="av-item-name">{item.name}</span>
                                {isOwned ? (
                                  <span className="av-item-owned">{isEquipped ? "Equipped" : "Owned"}</span>
                                ) : item.price ? (
                                  <span className="av-item-price">{coinMark} {item.price}</span>
                                ) : null}
                              </button>
                            );
                          });
                      })()}
                    </div>
                    {avatarMessage ? <p className="hint" style={{margin:"0 1rem 1rem"}}>{avatarMessage}</p> : null}
                  </div>
                </div>
              </section>
            ) : null}
                                    {activeView === "game-page" && viewingGame ? (
              <section className="game-detail-page fade-in">
                <button type="button" className="back-btn secondary" onClick={() => setActiveView("discover")}>← Back to Discover</button>
                <div className="game-detail-hero">
                  <div className="game-detail-thumb">
                    {viewingGame.thumbnailUrl ? (
                      <img src={viewingGame.thumbnailUrl} alt={viewingGame.title} className="game-detail-img" />
                    ) : (
                      <div className="game-detail-thumb-placeholder">
                        <span className="game-detail-emoji">{GENRE_EMOJIS[viewingGame.genre] ?? GENRE_EMOJIS.default}</span>
                      </div>
                    )}
                  </div>
                  <div className="game-detail-info">
                    <span className="eyebrow">{viewingGame.genre}</span>
                    <h1 className="game-detail-title">{viewingGame.title}</h1>
                    <p className="game-detail-desc">{viewingGame.description || "No description provided."}</p>
                    <div className="game-detail-meta">
                      <span>👁 {viewingGame.visits.toLocaleString()} visits</span>
                      <span>👍 {viewingGame.likes.toLocaleString()} likes</span>
                      <button
                        type="button"
                        className="game-detail-creator-btn"
                        onClick={() => openCreatorPage(viewingGame.creatorName)}
                      >
                        by {viewingGame.creatorName}
                      </button>
                    </div>
                    <div className="game-detail-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPublicGame(viewingGame);
                          void fetch(`${API_BASE}/games/${viewingGame.slug}/join`, { method: "POST" })
                            .then((r) => r.json() as Promise<SessionResponse>)
                            .then((data) => { setActiveSession(data.session); setActiveView("home"); })
                            .catch(() => { setActiveSession(null); setActiveView("home"); });
                        }}
                      >
                        ▶ Play
                      </button>
                      <button
                        type="button"
                        className={likedGameIds.has(viewingGame.id) ? "game-action-btn liked" : "game-action-btn secondary"}
                        onClick={() => toggleLike(viewingGame.id)}
                      >
                        {likedGameIds.has(viewingGame.id) ? "👍 Liked" : "👍 Like"}
                      </button>
                      <button
                        type="button"
                        className={favoritedGameIds.has(viewingGame.id) ? "game-action-btn favorited" : "game-action-btn secondary"}
                        onClick={() => toggleFavorite(viewingGame.id)}
                      >
                        {favoritedGameIds.has(viewingGame.id) ? "⭐ Saved" : "⭐ Save"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="game-detail-body">
                  <div className="game-detail-main">
                    <h2>About This Game</h2>
                    <p className="muted-text">{viewingGame.description || "The creator hasn't added a description yet."}</p>
                    <div className="game-detail-tags">
                      <span className="detail-tag">{viewingGame.genre}</span>
                      <span className="detail-tag">Multiplayer</span>
                      <span className="detail-tag">Up to 12 players</span>
                    </div>
                  </div>
                  <div className="game-detail-sidebar">
                    <div className="game-sidebar-card">
                      <p className="tool-title">Creator</p>
                      <button type="button" className="creator-profile-btn" onClick={() => openCreatorPage(viewingGame.creatorName)}>
                        <div className="creator-profile-av">{viewingGame.creatorName.slice(0,1).toUpperCase()}</div>
                        <div>
                          <strong>{viewingGame.creatorName}</strong>
                          <span className="hint">View Profile</span>
                        </div>
                      </button>
                    </div>
                    <div className="game-sidebar-card">
                      <p className="tool-title">Stats</p>
                      <div className="game-stat-row"><span>Visits</span><strong>{viewingGame.visits.toLocaleString()}</strong></div>
                      <div className="game-stat-row"><span>Likes</span><strong>{viewingGame.likes.toLocaleString()}</strong></div>
                      <div className="game-stat-row"><span>Genre</span><strong style={{textTransform:"capitalize"}}>{viewingGame.genre}</strong></div>
                    </div>
                    <div className="game-sidebar-card">
                      <p className="tool-title">More Games You May Like</p>
                      {games.filter((g) => g.genre === viewingGame.genre && g.id !== viewingGame.id).slice(0,3).map((g) => (
                        <button key={g.id} type="button" className="related-game-btn" onClick={() => openGamePage(g)}>
                          <span className="related-game-emoji">{GENRE_EMOJIS[g.genre] ?? GENRE_EMOJIS.default}</span>
                          <span>{g.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {activeView === "creator-page" ? (
              <section className="creator-page fade-in">
                <button type="button" className="back-btn secondary" onClick={() => setActiveView("discover")}>← Back</button>
                <div className="creator-page-header">
                  <div className="creator-page-av">{viewingCreatorName.slice(0,1).toUpperCase()}</div>
                  <div className="creator-page-info">
                    <h1 className="creator-page-name">{viewingCreatorName}</h1>
                    <p className="hint">Game Creator</p>
                    <div className="creator-page-stats">
                      <span><strong>{creatorPageGames.length}</strong> Games</span>
                      <span><strong>{viewingCreatorFollowers.toLocaleString()}</strong> Followers</span>
                      <span><strong>{creatorPageGames.reduce((s,g)=>s+g.visits,0).toLocaleString()}</strong> Total Visits</span>
                      <span><strong>{creatorPageGames.reduce((s,g)=>s+g.likes,0).toLocaleString()}</strong> Total Likes</span>
                    </div>
                  </div>
                  <button type="button" className="follow-btn" onClick={() => void toggleFollowCreator(viewingCreatorName)}>
                    {followedCreatorUsernames.has(viewingCreatorName.toLowerCase()) ? "Following" : "+ Follow"}
                  </button>
                </div>
                <h2 style={{marginTop:"1.5rem",marginBottom:"0.75rem"}}>Games by {viewingCreatorName}</h2>
                {creatorPageGames.length === 0 ? (
                  <p className="hint">This creator hasn't published any games yet.</p>
                ) : (
                  <div className="grid">
                    {creatorPageGames.map((game) => (
                      <article key={game.id} className="card clickable" onClick={() => openGamePage(game)}>
                        <div className="card-thumb">
                          {game.thumbnailUrl ? (
                            <img src={game.thumbnailUrl} alt={game.title} className="card-thumb-img" />
                          ) : (
                            <span className="thumb-deco">{GENRE_EMOJIS[game.genre] ?? GENRE_EMOJIS.default}</span>
                          )}
                          <span className="thumb-badge">{game.genre}</span>
                          <span className="thumb-online">👥 {(game.visits % 12) + 1}</span>
                        </div>
                        <div className="card-body">
                          <h3 className="card-title">{game.title}</h3>
                          <p className="card-sub">{game.visits.toLocaleString()} visits · {game.likes.toLocaleString()} likes</p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : null}
{activeView === "inventory" ? (
              <section className="marketplace-page fade-in">
                <div className="marketplace-header">
                  <div>
                    <h1 className="marketplace-title">Inventory & Marketplace</h1>
                    <p className="hint">Own it, equip it, then shop for the next item.</p>
                  </div>
                  <div className="marketplace-header-right">
                    <div className="wallet-chip">{formatCoins(walletCoins)} {coinLabel}</div>
                  </div>
                </div>

                <section className="inventory-summary">
                  <div className="inventory-summary-card">
                    <span className="tool-title">Owned items</span>
                    <strong>{ownedItems.length}</strong>
                    <span className="hint">Marketplace items in your locker</span>
                  </div>
                  <div className="inventory-summary-card">
                    <span className="tool-title">Equipped accessory</span>
                    <strong>{equippedMarketplaceItem?.name ?? avatarDraft.accessory}</strong>
                    <span className="hint">{ownedAccessoryCatalogItems.length} owned accessories ready to equip</span>
                  </div>
                  <div className="inventory-summary-card inventory-summary-card-actions">
                    <span className="tool-title">Avatar</span>
                    <button type="button" onClick={() => setActiveView("avatar")}>Open avatar editor</button>
                  </div>
                </section>

                <section className="inventory-owned-panel">
                  <div className="section-head">
                    <h2>Your Items</h2>
                    <span>{ownedItems.length} owned</span>
                  </div>
                  {ownedItems.length > 0 ? (
                    <div className="inventory-owned-grid">
                      {ownedItems.map((item) => {
                        const accessory = ACCESSORY_CATALOG_ITEMS.find((entry) => entry.id === item.id) ?? null;
                        const isEquipped = equippedAccessoryItem?.id === item.id;
                        return (
                          <article key={`owned-${item.id}`} className={isEquipped ? "inventory-owned-card inventory-owned-card-equipped" : "inventory-owned-card"}>
                            <div className="market-card-art inventory-owned-art" style={{ background: item.accent }}>
                              <MarketplaceModel kind={item.modelKind} emoji={item.emoji} />
                              {isEquipped ? <span className="market-badge market-badge-owned">EQUIPPED</span> : null}
                            </div>
                            <div className="inventory-owned-body">
                              <strong>{item.name}</strong>
                              <span>By {item.creator}</span>
                              <small>{item.category}</small>
                              <div className="inventory-owned-actions">
                                {accessory ? (
                                  <button
                                    type="button"
                                    className={isEquipped ? "secondary" : ""}
                                    onClick={() => equipOwnedAccessory(item.id)}
                                  >
                                    {isEquipped ? "Equipped" : "Equip"}
                                  </button>
                                ) : (
                                  <button type="button" className="secondary" onClick={() => setActiveView("avatar")}>
                                    View avatar
                                  </button>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="hint">You do not own any marketplace items yet. Buy one below and it will appear here immediately.</p>
                  )}
                </section>

                <div className="marketplace-mode-tabs" role="tablist" aria-label="Marketplace mode">
                  <button type="button" className={marketTab === "shop" ? "market-mode-tab market-mode-tab-active" : "market-mode-tab"} onClick={() => setMarketTab("shop")}>Shop</button>
                  <button type="button" className={marketTab === "create" ? "market-mode-tab market-mode-tab-active" : "market-mode-tab"} onClick={() => setMarketTab("create")}>Create & Sell</button>
                  <button type="button" className={marketTab === "trade" ? "market-mode-tab market-mode-tab-active" : "market-mode-tab"} onClick={() => setMarketTab("trade")}>Limited Trading</button>
                </div>

                {storeMessage ? <p className="hint" style={{marginBottom: "0.75rem"}}>{storeMessage}</p> : null}

                {marketTab === "create" ? (
                  <form className="market-creator-panel" onSubmit={createMarketplaceListing}>
                    <div className="market-creator-head">
                      <h3>Create 3D Item Listing</h3>
                      <p className="hint">Publish UGC items. Toggle Limited to enable trading.</p>
                    </div>
                    <div className="market-creator-grid">
                      <label>
                        Item name
                        <input value={creatorForm.name} onChange={(event) => setCreatorForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nebula Crown" required />
                      </label>
                      <label>
                        Category
                        <select value={creatorForm.category} onChange={(event) => setCreatorForm((current) => ({ ...current, category: event.target.value as typeof creatorForm.category }))}>
                          <option value="Hat">Hat</option>
                          <option value="Gear">Gear</option>
                          <option value="Back">Back</option>
                          <option value="Accessory">Accessory</option>
                          <option value="Face">Face</option>
                        </select>
                      </label>
                      <label>
                        Price (coins)
                        <input type="number" min={1} value={creatorForm.price} onChange={(event) => setCreatorForm((current) => ({ ...current, price: Number(event.target.value) }))} />
                      </label>
                      <label>
                        Emoji marker
                        <input value={creatorForm.emoji} onChange={(event) => setCreatorForm((current) => ({ ...current, emoji: event.target.value }))} placeholder="✨" maxLength={3} />
                      </label>
                      <label>
                        3D shape
                        <select value={creatorForm.modelKind} onChange={(event) => setCreatorForm((current) => ({ ...current, modelKind: event.target.value as MarketplaceItem["modelKind"] }))}>
                          <option value="custom">Custom</option>
                          <option value="cap">Cap</option>
                          <option value="blade">Blade</option>
                          <option value="wings">Wings</option>
                          <option value="boombox">Boombox</option>
                          <option value="crown">Crown</option>
                          <option value="glasses">Glasses</option>
                          <option value="helmet">Helmet</option>
                          <option value="halo">Halo</option>
                          <option value="chain">Chain</option>
                          <option value="dino">Dino</option>
                        </select>
                      </label>
                      <label>
                        Card gradient
                        <input value={creatorForm.accent} onChange={(event) => setCreatorForm((current) => ({ ...current, accent: event.target.value }))} placeholder="linear-gradient(135deg, #22d3ee, #6366f1)" />
                      </label>
                      <label className="market-creator-wide">
                        Description
                        <input value={creatorForm.description} onChange={(event) => setCreatorForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the style, vibe, and rarity." />
                      </label>
                      <label className="market-creator-check">
                        <input type="checkbox" checked={creatorForm.limited} onChange={(event) => setCreatorForm((current) => ({ ...current, limited: event.target.checked }))} />
                        Limited item (tradable)
                      </label>
                      <label>
                        Limited supply
                        <input type="number" min={1} disabled={!creatorForm.limited} value={creatorForm.supply} onChange={(event) => setCreatorForm((current) => ({ ...current, supply: Number(event.target.value) }))} />
                      </label>
                    </div>
                    <div className="market-creator-actions">
                      <button type="submit">Publish Listing</button>
                    </div>
                  </form>
                ) : null}

                {marketTab === "trade" ? (
                  <section className="market-trade-panel">
                    <div className="market-creator-head">
                      <h3>Limited Trading Desk</h3>
                      <p className="hint">Trade your Limited item for another, with optional {coinLabel} add-on.</p>
                    </div>
                    <div className="market-trade-grid">
                      <label>
                        You offer (your Limited)
                        <select value={tradeOfferItemId} onChange={(event) => setTradeOfferItemId(event.target.value)}>
                          <option value="">Select your Limited</option>
                          {limitedOwnedItems.map((item) => (
                            <option key={`offer-${item.id}`} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        You want (market Limited)
                        <select value={tradeTargetItemId} onChange={(event) => setTradeTargetItemId(event.target.value)}>
                          <option value="">Select target Limited</option>
                          {limitedMarketTargets.map((item) => (
                            <option key={`target-${item.id}`} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {coinLabel} add-on
                        <input type="number" min={0} max={walletCoins} value={tradeOfferCoins} onChange={(event) => setTradeOfferCoins(Number(event.target.value))} />
                      </label>
                    </div>
                    <div className="market-creator-actions">
                      <button type="button" onClick={() => void createLimitedTrade()} disabled={isTrading || limitedOwnedItems.length === 0 || limitedMarketTargets.length === 0}>{isTrading ? "Sending…" : "Send Trade Offer"}</button>
                    </div>
                    {limitedOwnedItems.length === 0 ? <p className="hint">You need to own at least one Limited item first.</p> : null}
                  </section>
                ) : null}

                {marketTab === "shop" ? (
                  <>

                <div className="marketplace-filter-row">
                  <div className="marketplace-search-wrap">
                    <span className="marketplace-search-icon">🔍</span>
                    <input
                      className="marketplace-search-input"
                      placeholder="Search items, creators…"
                      value={marketSearch}
                      onChange={(e) => setMarketSearch(e.target.value)}
                      aria-label="Search marketplace"
                    />
                  </div>
                  <select
                    value={marketSort}
                    onChange={(e) => setMarketSort(e.target.value as typeof marketSort)}
                    aria-label="Sort marketplace"
                  >
                    <option value="relevance">Sort: Relevance</option>
                    <option value="price-asc">Sort: Price ↑</option>
                    <option value="price-desc">Sort: Price ↓</option>
                    <option value="newest">Sort: Newest</option>
                  </select>
                </div>

                <div className="marketplace-tags">
                  {MARKET_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={marketCategory === cat ? "market-tag market-tag-active" : "market-tag"}
                      onClick={() => setMarketCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                  {["limited", "sale", "hats", "gear", "accessories"].map((tag) => (
                    <button key={tag} type="button" className="market-tag secondary">
                      {tag}
                    </button>
                  ))}
                </div>

                {storeMessage ? <p className="hint" style={{marginBottom: "0.75rem"}}>{storeMessage}</p> : null}

                <div className="market-grid">
                  {filteredMarketItems.map((item) => {
                    const owned = ownedItemIds.includes(item.id);
                    return (
                      <article key={item.id} className={owned ? "market-card market-card-owned" : "market-card"}>
                        <div className="market-card-art" style={{ background: item.accent }}>
                          <MarketplaceModel kind={item.modelKind} emoji={item.emoji} />
                          {item.limited ? <span className="market-badge market-badge-limited">LIMITED</span> : null}
                          {item.sale && !item.limited ? <span className="market-badge market-badge-sale">SALE</span> : null}
                          {owned ? <span className="market-badge market-badge-owned">OWNED</span> : null}
                        </div>
                        <div className="market-card-body">
                          <strong className="market-card-name">{item.name}</strong>
                          <span className="market-card-creator">By {item.creator}</span>
                          {item.limited && item.supply ? <span className="market-card-creator">Supply: {item.supply}</span> : null}
                          <div className="market-card-footer">
                            <span className="market-card-price">{formatCoins(item.price)}</span>
                            <button
                              type="button"
                              className={owned ? "market-buy-btn market-buy-btn-owned" : "market-buy-btn"}
                              disabled={owned || buyingItemId === item.id}
                              onClick={() => void buyMarketplaceItem(item)}
                            >
                              {buyingItemId === item.id ? "Buying…" : owned ? "Owned" : "Buy"}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  {filteredMarketItems.length === 0 ? (
                    <p className="hint discover-empty">No items match your search.</p>
                  ) : null}
                </div>
                  </>
                ) : null}
              </section>
            ) : null}

            {activeView === "giftcards" ? (
              <section className="account-page">
                <div className="account-header">
                  <div>
                    <p className="eyebrow">Gift Cards</p>
                    <h2>Redeem Gift Cards</h2>
                    <p className="hint">Redeem cards to add {coinLabel} to your wallet.</p>
                  </div>
                </div>
                <div className="shop-grid gift-grid">
                  {GIFT_CARD_OPTIONS.map((option) => (
                    <article key={option.id} className="shop-card gift-card-option">
                      <strong>{option.title}</strong>
                      <p>{option.subtitle.replaceAll("coins", coinLabel)}</p>
                      <div className="shop-card-footer">
                        <span>+{option.coins} {coinLabel}</span>
                        <button type="button" onClick={() => redeemGiftCard(option.coins, option.title)}>Redeem</button>
                      </div>
                    </article>
                  ))}
                </div>
                {storeMessage ? <p className="hint">{storeMessage}</p> : null}
              </section>
            ) : null}

            {activeView === "currency" ? (
              <section className="account-page">
                <div className="account-header">
                  <div>
                    <p className="eyebrow">Economy</p>
                    <h2>{coinLabel} Monetization Lab</h2>
                    <p className="hint">Tune coin branding, fees, and premium strategy.</p>
                  </div>
                  <div className="wallet-summary">Wallet: {formatCoins(walletCoins)} {coinLabel}</div>
                </div>
                <div className="feature-box economy-workbench">
                  <div className="economy-settings-grid">
                    <label>
                      Coin name
                      <input value={coinName} maxLength={16} onChange={(event) => setCoinName(event.target.value)} placeholder="FariBucks" />
                    </label>
                    <label>
                      Coin symbol
                      <input value={coinSymbol} maxLength={3} onChange={(event) => setCoinSymbol(event.target.value)} placeholder="FB" />
                    </label>
                    <label>
                      Marketplace fee (%)
                      <input type="number" min={2} max={30} value={marketFeePercent} onChange={(event) => setMarketFeePercent(Math.min(30, Math.max(2, Number(event.target.value) || 2)))} />
                    </label>
                    <label>
                      Premium subscription ($/month)
                      <input type="number" min={1} max={25} step="0.5" value={premiumPrice} onChange={(event) => setPremiumPrice(Math.min(25, Math.max(1, Number(event.target.value) || 1)))} />
                    </label>
                  </div>
                  <div className="economy-kpi-grid">
                    <article>
                      <strong>{formatCoins(economySummary.creatorNetCoins)}</strong>
                      <span>Total creator net earnings</span>
                    </article>
                    <article>
                      <strong>{economySummary.salesCount}</strong>
                      <span>Marketplace sales completed</span>
                    </article>
                    <article>
                      <strong>${projectedMonthlyRevenue.toLocaleString()}</strong>
                      <span>Projected monthly creator revenue</span>
                    </article>
                  </div>
                </div>
                <div className="shop-grid bundle-grid">
                  {COIN_BUNDLES.map((bundle) => (
                    <article key={bundle.id} className="shop-card bundle-card">
                      <strong>{bundle.coins.toLocaleString()} {coinLabel}</strong>
                      <p>{bundle.priceLabel}</p>
                      <div className="shop-card-footer">
                        <span>+{bundle.coins.toLocaleString()} {coinLabel}</span>
                        <button type="button" disabled={isBuyingCurrency} onClick={() => buyCurrencyBundle(bundle.coins, bundle.title)}>{isBuyingCurrency ? "Processing…" : "Buy"}</button>
                      </div>
                    </article>
                  ))}
                </div>
                {storeMessage ? <p className="hint">{storeMessage}</p> : null}
                {txHistory.length > 0 ? (
                  <div className="tx-history">
                    <h3 className="tx-history-title">Recent Transactions</h3>
                    <ul className="tx-list">
                      {txHistory.map((tx) => (
                        <li key={tx.id} className={`tx-row ${tx.delta >= 0 ? "tx-positive" : "tx-negative"}`}>
                          <span className="tx-label">{tx.label}</span>
                          <span className="tx-amount">{tx.delta >= 0 ? "+" : ""}{coinMark} {Math.abs(tx.delta).toLocaleString()}</span>
                          <span className="tx-time">{tx.at}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="hint tx-empty">No transactions yet this session. Buy some {coinLabel} or grab an item to see history here.</p>
                )}
              </section>
            ) : null}
          </div>
        </section>
      ) : null}
      {activeView === "discover" ? (
      <>
      <section className="section">
        <div className="section-head">
          <h2>{profile ? "Discover Worlds" : "Featured Worlds"}</h2>
          <span>{profile ? "Browse like a separate discovery page" : "Published games and starter data"}</span>
        </div>
        <div className="discover-toolbar">
          <div className="discover-cat-tabs">
            <button type="button" className={discoverCategoryTab === "featured" ? "discover-cat-tab discover-cat-tab-active" : "discover-cat-tab"} onClick={() => setDiscoverCategoryTab("featured")}>Featured</button>
            <button type="button" className={discoverCategoryTab === "trending" ? "discover-cat-tab discover-cat-tab-active" : "discover-cat-tab"} onClick={() => setDiscoverCategoryTab("trending")}>Trending</button>
            <button type="button" className={discoverCategoryTab === "new" ? "discover-cat-tab discover-cat-tab-active" : "discover-cat-tab"} onClick={() => setDiscoverCategoryTab("new")}>New</button>
            <button type="button" className={discoverCategoryTab === "multiplayer" ? "discover-cat-tab discover-cat-tab-active" : "discover-cat-tab"} onClick={() => setDiscoverCategoryTab("multiplayer")}>Multiplayer</button>
            <button type="button" className={discoverCategoryTab === "all" ? "discover-cat-tab discover-cat-tab-active" : "discover-cat-tab"} onClick={() => setDiscoverCategoryTab("all")}>All</button>
          </div>
          <input
            aria-label="Filter discover games"
            placeholder="Filter by title, creator, or genre"
            value={discoverQuery}
            onChange={(event) => setDiscoverQuery(event.target.value)}
          />
          <select
            aria-label="Filter discover by genre"
            value={discoverGenreFilter}
            onChange={(event) => setDiscoverGenreFilter(event.target.value as "all" | CreateGameRequest["genre"])}
          >
            <option value="all">All genres</option>
            <option value="obby">Obby</option>
            <option value="minigame">Minigame</option>
            <option value="collectathon">Collectathon</option>
          </select>
          <select
            aria-label="Sort discover games"
            value={discoverSort}
            onChange={(event) => setDiscoverSort(event.target.value as "visits" | "likes" | "title")}
          >
            <option value="visits">Sort: Most visited</option>
            <option value="likes">Sort: Most liked</option>
            <option value="title">Sort: Title A-Z</option>
          </select>
        </div>
        <div className="grid">
          {discoverGames.map((game) => (
            <article className="card clickable" key={game.id} onClick={() => openGamePage(game)}>
              <div className={`card-thumb${game.thumbnailUrl ? " card-thumb-img-wrap" : ` card-thumb thumb-${game.genre}`}`}>
                {game.thumbnailUrl ? (
                  <img src={game.thumbnailUrl} alt={game.title} className="card-thumb-img" />
                ) : (
                  <span className="thumb-deco" aria-hidden="true">{GENRE_EMOJIS[game.genre] ?? GENRE_EMOJIS.default}</span>
                )}
                <span className="thumb-badge">{game.genre}</span>
                <span className="thumb-online">👥 {Math.max(1, Math.floor(game.visits / 80)).toLocaleString()} online</span>
              </div>
              <div className="card-body">
                <h3 className="card-title">{game.title}</h3>
                <button type="button" className="card-creator-btn" onClick={(event) => { event.stopPropagation(); void openCreatorPage(game.creatorName); }}>
                  by {game.creatorName}
                </button>
                <div className="meta">
                  <span>{game.visits.toLocaleString()} visits</span>
                  <span>👍 {game.likes.toLocaleString()}</span>
                </div>
                <div className="card-actions">
                  <button type="button" onClick={(event) => { event.stopPropagation(); void joinPublicGameBySlug(game.slug); }}>
                    ▶ Play
                  </button>
                  <button
                    type="button"
                    className={likedGameIds.has(game.id) ? "card-like-btn liked" : "card-like-btn secondary"}
                    onClick={(event) => { event.stopPropagation(); void toggleLike(game.id); }}
                    title="Like"
                  >
                    👍
                  </button>
                  <button
                    type="button"
                    className={favoritedGameIds.has(game.id) ? "card-fav-btn favorited" : "card-fav-btn secondary"}
                    onClick={(event) => { event.stopPropagation(); void toggleFavorite(game.id); }}
                    title="Favorite"
                  >
                    {favoritedGameIds.has(game.id) ? "⭐" : "☆"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {discoverGames.length === 0 ? <p className="hint discover-empty">No games match this filter. Try a different search or genre.</p> : null}
      </section>

      <section className="section split">
        <div className="feature-box">
          <h2>Game Detail</h2>
          {selectedPublicGame ? (
            <div className="public-game">
              <p className="hint">/{selectedPublicGame.slug}</p>
              <h3>{selectedPublicGame.title}</h3>
              <p>{selectedPublicGame.description}</p>
              <div className="editor-meta">
                <span>{selectedPublicGame.genre}</span>
                <span>by {selectedPublicGame.creatorName}</span>
                <span>{selectedPublicGame.visits} visits</span>
                <span>{selectedPublicGame.likes} likes</span>
                {"publishedVersionNumber" in selectedPublicGame ? (
                  <span>live v{selectedPublicGame.publishedVersionNumber}</span>
                ) : null}
              </div>
              <div className="play-surface">
                {"mapData" in selectedPublicGame ? (
                  <>
                    <p className="play-title">3D World Preview</p>
                    <p className="hint">
                      Spawn: {selectedPublicGame.mapData.spawn.x}, {selectedPublicGame.mapData.spawn.y}, {selectedPublicGame.mapData.spawn.z}. Objects: {selectedPublicGame.mapData.objects.length}. Checkpoints: {selectedPublicGame.mapData.checkpoints.length}.
                    </p>
                    <div className="play-stats-grid">
                      <div className="play-stat-card">
                        <strong>{selectedPublicGame.mapData.objects.length}</strong>
                        <span>world parts</span>
                      </div>
                      <div className="play-stat-card">
                        <strong>{selectedPublicGame.mapData.checkpoints.length}</strong>
                        <span>checkpoints</span>
                      </div>
                      <div className="play-stat-card">
                        <strong>v{selectedPublicGame.publishedVersionNumber}</strong>
                        <span>live build</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="play-title">Starter Seed</p>
                    <p className="hint">
                      Placeholder content. Publish a draft to replace it with live data.
                    </p>
                  </>
                )}
              </div>
              <button type="button" onClick={joinSelectedPublicGame}>
                Join game session
              </button>
              {gameError ? <p className="error">{gameError}</p> : null}
              {activeSession && runtimePosition ? (
                <div className="runtime-panel">
                  <div className="editor-meta">
                    <span>session {activeSession.id.slice(0, 8)}</span>
                    <span>{activeSession.region}</span>
                    <span>
                      {activeSession.playerCount}/{activeSession.maxPlayers} players
                    </span>
                    <span>{activeSession.status}</span>
                  </div>
                  <div className="runtime-grid">
                    <div className="runtime-stage">
                      <div className="runtime-stage-head">
                        <div>
                          <p className="play-title">Live Runtime</p>
                          <p className="hint">
                            Session hub preview with live movement, social bots, and world props.
                          </p>
                        </div>
                        <div className="runtime-hud-chips">
                          <span className="runtime-hud-chip">{selectedPublicGame.title}</span>
                          <span className="runtime-hud-chip">{activeSession.playerCount} online</span>
                          <span className="runtime-hud-chip">us-east</span>
                          <span className="runtime-hud-chip">{runtimeSessionCoins} session coins</span>
                          {runtimeCheckpointLabel ? <span className="runtime-hud-chip">checkpoint: {runtimeCheckpointLabel}</span> : null}
                        </div>
                      </div>
                      {usingUnityRuntime ? (
                        <>
                          <div className="unity-shell">
                            <div className="unity-shell-bar">
                              <div>
                                <p className="tool-title">Primary Runtime</p>
                                <p className="hint unity-shell-copy">
                                  Unity WebGL is the main live game engine for this world.
                                </p>
                              </div>
                              <div className="unity-shell-actions">
                                <button type="button" className="secondary" onClick={reloadUnityRuntime}>Reload runtime</button>
                                <button type="button" className="secondary" onClick={openUnityRuntimeInWindow}>Open in tab</button>
                              </div>
                            </div>
                            <div className="unity-shell-frame">
                              {unityRuntimeLoadState !== "ready" ? (
                                <div className="unity-shell-overlay">
                                  <strong>{unityRuntimeLoadState === "error" ? "Unity runtime failed to load." : "Loading Unity runtime..."}</strong>
                                  <span>
                                    {unityRuntimeLoadState === "error"
                                      ? "Check the hosted WebGL build URL and confirm it allows embedding."
                                      : "The browser app stays as the shell while the live game boots inside Unity WebGL."}
                                  </span>
                                </div>
                              ) : null}
                              <iframe
                                key={unityRuntimeFrameKey}
                                className="runtime-world runtime-world-unity"
                                title={`${selectedPublicGame.title} Unity runtime`}
                                src={unityRuntimeSrc}
                                allow="fullscreen"
                                onLoad={() => setUnityRuntimeLoadState("ready")}
                                onError={() => setUnityRuntimeLoadState("error")}
                              />
                            </div>
                            <div className="unity-shell-footer">
                              <span>Source: {selectedGameUnityWebglUrl ? "per-game Unity URL" : "global Unity runtime URL"}</span>
                              <span>Shell passes session, game, and player context through query params.</span>
                            </div>
                          </div>
                        </>
                      ) : "mapData" in selectedPublicGame ? (
                        <>
                          <Suspense fallback={<p className="hint">Loading Fairblox 3D runtime...</p>}>
                            <RuntimePlaza
                              collectedObjectIds={runtimeCollectedObjectIds}
                              mapData={selectedPublicGame.mapData}
                              playerFacing={runtimeFacing}
                              playerPosition={runtimePosition}
                              playerCount={activeSession.playerCount}
                            />
                          </Suspense>
                          <div className="runtime-legend">
                            <span><i className="legend-swatch legend-player" />Avatar</span>
                            <span><i className="legend-swatch legend-spawn" />Spawn</span>
                            <span><i className="legend-swatch legend-checkpoint" />Checkpoint</span>
                            <span><i className="legend-swatch legend-object" />3D block</span>
                          </div>
                        </>
                      ) : (
                        <p className="hint">
                          Runtime preview unavailable for this seed. Publish a map or set Unity URL.
                        </p>
                      )}
                    </div>
                    <div className="runtime-controls">
                      <p className="tool-title">Move Avatar</p>
                      <div className="runtime-prompt-card">
                        <span className="runtime-prompt-label">Live prompt</span>
                        <strong>{runtimePrompt ?? "Explore the hub."}</strong>
                        <div className="runtime-action-row">
                          {runtimeZone === "shop" ? (
                            <button type="button" className="secondary" onClick={() => handleRuntimeZoneAction("shop")}>Open shop</button>
                          ) : null}
                          {runtimeZone === "spawn" ? (
                            <button type="button" className="secondary" onClick={() => handleRuntimeZoneAction("reset")}>Reset here</button>
                          ) : null}
                          {runtimeZone === "portal-obby" ? (
                            <button type="button" className="secondary" onClick={() => handleRuntimeZoneAction("obby")}>Enter obby portal</button>
                          ) : null}
                          {runtimeZone === "portal-minigame" ? (
                            <button type="button" className="secondary" onClick={() => handleRuntimeZoneAction("minigame")}>Enter minigame portal</button>
                          ) : null}
                        </div>
                      </div>
                      <div className="runtime-engine-toggle" role="group" aria-label="Runtime engine selection">
                        <button
                          type="button"
                          className={runtimeEngine === "fairblox-3d" ? "secondary runtime-engine-button runtime-engine-button-active" : "secondary runtime-engine-button"}
                          onClick={() => setRuntimeEngine("fairblox-3d")}
                        >
                          3D Preview
                        </button>
                        <button
                          type="button"
                          className={runtimeEngine === "unity-webgl" ? "secondary runtime-engine-button runtime-engine-button-active" : "secondary runtime-engine-button"}
                          onClick={() => setRuntimeEngine("unity-webgl")}
                        >
                          Unity Live
                        </button>
                      </div>
                      <p className="hint runtime-engine-status">
                        Engine: {usingUnityRuntime ? "Unity WebGL live runtime" : "Fairblox 3D preview runtime"}
                        {!canUseUnityRuntime ? " (set draft Unity URL or VITE_UNITY_WEBGL_URL to make Unity primary)" : ""}
                      </p>
                      <p className="hint">Controls: hold WASD or Arrow keys to move, Space to jump, walk through coins and checkpoints to trigger them.</p>
                      <div className="runtime-dpad">
                        <button type="button" className="secondary" onClick={() => moveRuntime(0, 0, 1)} disabled={usingUnityRuntime}>Forward</button>
                        <button type="button" className="secondary" onClick={() => moveRuntime(-1, 0, 0)} disabled={usingUnityRuntime}>Left</button>
                        <button type="button" className="secondary" onClick={() => moveRuntime(0, 1, 0)} disabled={usingUnityRuntime}>Jump</button>
                        <button type="button" className="secondary" onClick={() => moveRuntime(1, 0, 0)} disabled={usingUnityRuntime}>Right</button>
                        <button type="button" className="secondary" onClick={() => moveRuntime(0, 0, -1)} disabled={usingUnityRuntime}>Back</button>
                      </div>
                      <button type="button" className="secondary" onClick={() => setRuntimePosition(activeSession.spawn)} disabled={usingUnityRuntime}>
                        Reset spawn
                      </button>
                      <div className="runtime-sidecard">
                        <div className="section-head">
                          <h2>Players</h2>
                          <span>Live roster</span>
                        </div>
                        <div className="runtime-roster">
                          {runtimeRoster.map((entry, index) => (
                            <div key={`runtime-roster-${entry.name}`} className="runtime-roster-row" style={{ "--runtime-roster-accent": entry.accent } as CSSProperties}>
                              <span className="runtime-roster-rank">#{index + 1}</span>
                              <strong>{entry.name}</strong>
                              <span>{entry.score.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="runtime-sidecard">
                        <div className="section-head">
                          <h2>Session Chat</h2>
                          <span>Hub feed</span>
                        </div>
                        <div className="runtime-chat-feed">
                          {runtimeChatMessages.map((entry) => (
                            <div
                              key={entry.id}
                              className={
                                entry.tone === "me"
                                  ? "runtime-chat-row runtime-chat-row-me"
                                  : entry.tone === "system"
                                    ? "runtime-chat-row runtime-chat-row-system"
                                    : "runtime-chat-row"
                              }
                            >
                              <strong>{entry.name}</strong>
                              <span>{entry.body}</span>
                            </div>
                          ))}
                        </div>
                        <form className="runtime-chat-form" onSubmit={sendRuntimeChatMessage}>
                          <input
                            value={runtimeChatDraft}
                            onChange={(event) => setRuntimeChatDraft(event.target.value)}
                            placeholder="Type to chat in this session"
                          />
                          <button type="submit">Send</button>
                        </form>
                      </div>
                      <p className="hint">
                        {usingUnityRuntime
                          ? "Unity uses in-build controls. The browser app stays around it as the shell for session, social, and economy flow."
                          : "Tip: use this preview for browser-native iteration, then attach a Unity WebGL URL to make Unity the live runtime."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p>Select a published game to open its detail page and play stub.</p>
          )}
        </div>
        <div className="feature-box">
          <h2>{profile ? "Trending Row" : "Player Loop"}</h2>
          {profile ? (
            <div className="stack-list">
              {trendingRows.map((game) => (
                <button key={`trend-${game.id}`} type="button" className="draft-item" onClick={() => openPublicGame(game.slug)}>
                  <strong>{game.title}</strong>
                  <span>{game.genre}</span>
                  <span>{game.visits} visits</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <p>
                Players can already browse a card, open a game page, inspect the live map data, and join a lightweight
                runtime session.
              </p>
              <p>
                The bigger gap now is creator ergonomics, so the editor includes genre templates and quick placement tools
                on top of the raw JSON for faster world building.
              </p>
            </>
          )}
        </div>
      </section>
      </>
      ) : null}

      {!profile || activeView === "creator" ? (
      <section className="section split">
        <div className="feature-box">
          <h2>Creator Dashboard</h2>
          {profile ? (
            <>
              <form className="draft-form" onSubmit={handleCreateGame}>
                <input
                  placeholder="Game title"
                  value={gameForm.title}
                  onChange={(event) => setGameForm((current) => ({ ...current, title: event.target.value }))}
                />
                <input
                  placeholder="Short description"
                  value={gameForm.description}
                  onChange={(event) => setGameForm((current) => ({ ...current, description: event.target.value }))}
                />
                <select
                  value={gameForm.genre}
                  onChange={(event) => setGameForm((current) => ({ ...current, genre: event.target.value as CreateGameRequest["genre"] }))}
                >
                  <option value="obby">Obby</option>
                  <option value="minigame">Minigame</option>
                  <option value="collectathon">Collectathon</option>
                </select>
                <button type="submit">Create draft</button>
              </form>
              {gameError ? <p className="error">{gameError}</p> : null}
              <div className="draft-list">
                {myGames.length === 0 ? (
                  <p className="hint">No drafts yet.</p>
                ) : (
                  myGames.map((game) => (
                    <button className="draft-item" key={game.id} type="button" onClick={() => openDraft(game.id)}>
                      <strong>{game.title}</strong>
                      <span>{game.genre}</span>
                      <span>{game.visibility}</span>
                      <span>{game.publishedVersionNumber ? `v${game.publishedVersionNumber}` : "unpublished"}</span>
                      <span>/{game.slug}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <p>Log in to create draft games and start the creator flow.</p>
          )}
        </div>
        <div className="feature-box">
          <h2>Editor</h2>
          {selectedGame ? (
            <div className="draft-form">
              <p className="hint">
                Editing <strong>{selectedGame.title}</strong> at /{selectedGame.slug}
              </p>
              <div className="editor-meta">
                <span>{selectedGame.visibility}</span>
                <span>{selectedGame.versionCount} version(s)</span>
                <span>{selectedGame.publishedVersionNumber ? `live v${selectedGame.publishedVersionNumber}` : "not published"}</span>
                {editorMapStats ? <span>{editorMapStats.objects} object(s)</span> : null}
                {editorMapStats ? <span>{editorMapStats.checkpoints} checkpoint(s)</span> : null}
              </div>
              <div className="tool-panel">
                <div className="tool-section">
                  <p className="tool-title">Starter Layouts</p>
                  <div className="tool-row">
                    <button type="button" className="secondary" onClick={() => applyTemplate(selectedGame.genre)}>
                      Use {selectedGame.genre} template
                    </button>
                    <button type="button" className="secondary" onClick={resetToEmptyMap}>
                      Clear map
                    </button>
                  </div>
                </div>
                <div className="tool-section">
                  <p className="tool-title">Quick Placement</p>
                  <div className="tool-row">
                    <button type="button" className="secondary" onClick={addCheckpoint}>
                      Add checkpoint
                    </button>
                    {QUICK_OBJECTS.map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        className="secondary"
                        onClick={() => addQuickObject(item.type, item.color, item.size)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="tool-section">
                  <p className="tool-title">Platform Brush</p>
                  <div className="tool-grid">
                    <label>
                      Count
                      <input
                        type="number"
                        min={1}
                        max={40}
                        value={platformBrush.count}
                        onChange={(event) =>
                          setPlatformBrush((current) => ({ ...current, count: Number(event.target.value) || 1 }))
                        }
                      />
                    </label>
                    <label>
                      Spacing
                      <input
                        type="number"
                        min={2}
                        max={40}
                        value={platformBrush.spacing}
                        onChange={(event) =>
                          setPlatformBrush((current) => ({ ...current, spacing: Number(event.target.value) || 2 }))
                        }
                      />
                    </label>
                    <label>
                      Rise/Step
                      <input
                        type="number"
                        min={-3}
                        max={6}
                        value={platformBrush.rise}
                        onChange={(event) =>
                          setPlatformBrush((current) => ({ ...current, rise: Number(event.target.value) || 0 }))
                        }
                      />
                    </label>
                    <label>
                      Width
                      <input
                        type="number"
                        min={2}
                        max={30}
                        value={platformBrush.width}
                        onChange={(event) =>
                          setPlatformBrush((current) => ({ ...current, width: Number(event.target.value) || 2 }))
                        }
                      />
                    </label>
                    <label>
                      Depth
                      <input
                        type="number"
                        min={2}
                        max={30}
                        value={platformBrush.depth}
                        onChange={(event) =>
                          setPlatformBrush((current) => ({ ...current, depth: Number(event.target.value) || 2 }))
                        }
                      />
                    </label>
                    <label>
                      Direction
                      <select
                        value={platformBrush.direction}
                        onChange={(event) =>
                          setPlatformBrush((current) => ({ ...current, direction: event.target.value as "x" | "z" }))
                        }
                      >
                        <option value="z">Forward (Z)</option>
                        <option value="x">Sideways (X)</option>
                      </select>
                    </label>
                    <label>
                      Color
                      <input
                        type="color"
                        value={platformBrush.color}
                        onChange={(event) =>
                          setPlatformBrush((current) => ({ ...current, color: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <div className="tool-row">
                    <button type="button" className="secondary" onClick={() => addPlatformBatch(false)}>
                      Add platform run
                    </button>
                    <button type="button" className="secondary" onClick={() => addPlatformBatch(true)}>
                      Scatter platforms
                    </button>
                  </div>
                </div>
                <div className="tool-section tool-section-compact">
                  <p className="tool-title">Current Map Check</p>
                  <p className={editorMapStats?.error ? "error inline-error" : "hint inline-hint"}>
                    {editorMapStats?.error || "Map JSON is structurally valid."}
                  </p>
                </div>
                <div className="tool-section tool-section-compact">
                  <p className="tool-title">Unity Live Runtime URL</p>
                  <input
                    type="url"
                    placeholder="https://your-unity-host.example/index.html"
                    value={selectedGame.unityWebglUrl ?? ""}
                    onChange={(event) => {
                      const nextUrl = event.target.value;
                      setSelectedGame((current) => (current ? { ...current, unityWebglUrl: nextUrl } : current));
                      setEditorMessage("Unity URL updated. Save map to keep it.");
                    }}
                  />
                  {unityRuntimeUrlError ? <p className="error inline-error">{unityRuntimeUrlError}</p> : null}
                  <p className="hint inline-hint">This URL is stored per game draft and becomes the primary live game runtime inside the Fairblox browser shell.</p>
                </div>
              </div>
              {editorParsedMap ? (
                <div className="tool-section">
                  <div className="world-stage-header">
                    <p className="tool-title">Build Stage</p>
                    <div className="tool-row">
                      <button
                        type="button"
                        className={editorPlacementMode === "object" ? "secondary runtime-engine-button runtime-engine-button-active" : "secondary"}
                        onClick={() => setEditorPlacementMode((current) => (current === "object" ? null : "object"))}
                      >
                        {editorPlacementMode === "object" ? "Cancel object" : "Place object"}
                      </button>
                      <button
                        type="button"
                        className={editorPlacementMode === "checkpoint" ? "secondary runtime-engine-button runtime-engine-button-active" : "secondary"}
                        onClick={() => setEditorPlacementMode((current) => (current === "checkpoint" ? null : "checkpoint"))}
                      >
                        {editorPlacementMode === "checkpoint" ? "Cancel checkpoint" : "Place checkpoint"}
                      </button>
                    </div>
                  </div>
                  <p className="hint inline-hint">
                    Click any part to select it. Drag selected objects or checkpoints in the stage. While placement is active, click the stage to drop a new item.
                  </p>
                  {renderEditorStage(editorParsedMap)}
                </div>
              ) : null}
              {editorParsedMap ? (
                <div className="world-studio">
                  <div className="world-studio-sidebar">
                    <div className="tool-section">
                      <div className="world-studio-header">
                        <p className="tool-title">World Studio</p>
                        <div className="tool-row">
                          <button type="button" className="secondary" onClick={addVisualObject}>
                            Add object
                          </button>
                          <button type="button" className="secondary" onClick={addVisualCheckpoint}>
                            Add checkpoint
                          </button>
                        </div>
                      </div>
                      <div className="world-studio-list">
                        <p className="world-studio-group-label">Objects</p>
                        {editorParsedMap.objects.length === 0 ? (
                          <p className="hint">No objects placed yet.</p>
                        ) : (
                          editorParsedMap.objects.map((object) => (
                            <button
                              key={object.id}
                              type="button"
                              className={editorSelection?.kind === "object" && editorSelection.id === object.id ? "world-item-button world-item-button-active" : "world-item-button"}
                              onClick={() => setEditorSelection({ kind: "object", id: object.id })}
                            >
                              <strong>{object.type}</strong>
                              <span>
                                {object.position.x}, {object.position.y}, {object.position.z}
                              </span>
                            </button>
                          ))
                        )}
                        <p className="world-studio-group-label">Checkpoints</p>
                        {editorParsedMap.checkpoints.length === 0 ? (
                          <p className="hint">No checkpoints yet.</p>
                        ) : (
                          editorParsedMap.checkpoints.map((checkpoint) => (
                            <button
                              key={checkpoint.id}
                              type="button"
                              className={editorSelection?.kind === "checkpoint" && editorSelection.id === checkpoint.id ? "world-item-button world-item-button-active" : "world-item-button"}
                              onClick={() => setEditorSelection({ kind: "checkpoint", id: checkpoint.id })}
                            >
                              <strong>{checkpoint.label || checkpoint.id}</strong>
                              <span>
                                {checkpoint.position.x}, {checkpoint.position.y}, {checkpoint.position.z}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="world-studio-inspector">
                    <div className="world-studio-header">
                      <p className="tool-title">Inspector</p>
                      <button type="button" className="secondary" onClick={removeSelectedEditorEntry} disabled={!editorSelection}>
                        Remove selected
                      </button>
                    </div>
                    {selectedEditorObject ? (
                      <div className="tool-section">
                        <div className="tool-grid">
                          <label>
                            Type
                            <select
                              value={selectedEditorObject.type}
                              onChange={(event) => updateSelectedObject((object) => ({ ...object, type: event.target.value }))}
                            >
                              {WORLD_OBJECT_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Material
                            <select
                              value={selectedEditorObject.material ?? ""}
                              onChange={(event) =>
                                updateSelectedObject((object) => ({
                                  ...object,
                                  material: event.target.value ? (event.target.value as typeof object.material) : undefined,
                                }))
                              }
                            >
                              <option value="">Default</option>
                              {WORLD_MATERIALS.map((material) => (
                                <option key={material} value={material}>
                                  {material}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Color
                            <input
                              type="color"
                              value={selectedEditorObject.color}
                              onChange={(event) => updateSelectedObject((object) => ({ ...object, color: event.target.value }))}
                            />
                          </label>
                          <label>
                            Tags
                            <input
                              value={selectedEditorObject.tags?.join(", ") ?? ""}
                              onChange={(event) =>
                                updateSelectedObject((object) => ({
                                  ...object,
                                  tags: event.target.value
                                    .split(",")
                                    .map((tag) => tag.trim())
                                    .filter(Boolean),
                                }))
                              }
                            />
                          </label>
                        </div>
                        <div className="tool-grid">
                          <label>
                            Pos X
                            <input
                              type="number"
                              value={selectedEditorObject.position.x}
                              onChange={(event) =>
                                updateSelectedObject((object) => ({
                                  ...object,
                                  position: { ...object.position, x: Number(event.target.value) || 0 },
                                }))
                              }
                            />
                          </label>
                          <label>
                            Pos Y
                            <input
                              type="number"
                              value={selectedEditorObject.position.y}
                              onChange={(event) =>
                                updateSelectedObject((object) => ({
                                  ...object,
                                  position: { ...object.position, y: Number(event.target.value) || 0 },
                                }))
                              }
                            />
                          </label>
                          <label>
                            Pos Z
                            <input
                              type="number"
                              value={selectedEditorObject.position.z}
                              onChange={(event) =>
                                updateSelectedObject((object) => ({
                                  ...object,
                                  position: { ...object.position, z: Number(event.target.value) || 0 },
                                }))
                              }
                            />
                          </label>
                        </div>
                        <div className="tool-grid">
                          <label>
                            Size X
                            <input
                              type="number"
                              min={1}
                              value={selectedEditorObject.size.x}
                              onChange={(event) =>
                                updateSelectedObject((object) => ({
                                  ...object,
                                  size: { ...object.size, x: Math.max(1, Number(event.target.value) || 1) },
                                }))
                              }
                            />
                          </label>
                          <label>
                            Size Y
                            <input
                              type="number"
                              min={1}
                              value={selectedEditorObject.size.y}
                              onChange={(event) =>
                                updateSelectedObject((object) => ({
                                  ...object,
                                  size: { ...object.size, y: Math.max(1, Number(event.target.value) || 1) },
                                }))
                              }
                            />
                          </label>
                          <label>
                            Size Z
                            <input
                              type="number"
                              min={1}
                              value={selectedEditorObject.size.z}
                              onChange={(event) =>
                                updateSelectedObject((object) => ({
                                  ...object,
                                  size: { ...object.size, z: Math.max(1, Number(event.target.value) || 1) },
                                }))
                              }
                            />
                          </label>
                        </div>
                        <div className="tool-grid">
                          <label>
                            Rot X
                            <input
                              type="number"
                              value={selectedEditorObject.rotation.x}
                              onChange={(event) =>
                                updateSelectedObject((object) => ({
                                  ...object,
                                  rotation: { ...object.rotation, x: Number(event.target.value) || 0 },
                                }))
                              }
                            />
                          </label>
                          <label>
                            Rot Y
                            <input
                              type="number"
                              value={selectedEditorObject.rotation.y}
                              onChange={(event) =>
                                updateSelectedObject((object) => ({
                                  ...object,
                                  rotation: { ...object.rotation, y: Number(event.target.value) || 0 },
                                }))
                              }
                            />
                          </label>
                          <label>
                            Rot Z
                            <input
                              type="number"
                              value={selectedEditorObject.rotation.z}
                              onChange={(event) =>
                                updateSelectedObject((object) => ({
                                  ...object,
                                  rotation: { ...object.rotation, z: Number(event.target.value) || 0 },
                                }))
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ) : selectedEditorCheckpoint ? (
                      <div className="tool-section">
                        <div className="tool-grid">
                          <label>
                            Label
                            <input
                              value={selectedEditorCheckpoint.label ?? ""}
                              onChange={(event) =>
                                updateSelectedCheckpoint((checkpoint) => ({
                                  ...checkpoint,
                                  label: event.target.value.trim() || undefined,
                                }))
                              }
                            />
                          </label>
                          <label>
                            Radius
                            <input
                              type="number"
                              min={1}
                              value={selectedEditorCheckpoint.radius ?? 4}
                              onChange={(event) =>
                                updateSelectedCheckpoint((checkpoint) => ({
                                  ...checkpoint,
                                  radius: Math.max(1, Number(event.target.value) || 1),
                                }))
                              }
                            />
                          </label>
                        </div>
                        <div className="tool-grid">
                          <label>
                            Pos X
                            <input
                              type="number"
                              value={selectedEditorCheckpoint.position.x}
                              onChange={(event) =>
                                updateSelectedCheckpoint((checkpoint) => ({
                                  ...checkpoint,
                                  position: { ...checkpoint.position, x: Number(event.target.value) || 0 },
                                }))
                              }
                            />
                          </label>
                          <label>
                            Pos Y
                            <input
                              type="number"
                              value={selectedEditorCheckpoint.position.y}
                              onChange={(event) =>
                                updateSelectedCheckpoint((checkpoint) => ({
                                  ...checkpoint,
                                  position: { ...checkpoint.position, y: Number(event.target.value) || 0 },
                                }))
                              }
                            />
                          </label>
                          <label>
                            Pos Z
                            <input
                              type="number"
                              value={selectedEditorCheckpoint.position.z}
                              onChange={(event) =>
                                updateSelectedCheckpoint((checkpoint) => ({
                                  ...checkpoint,
                                  position: { ...checkpoint.position, z: Number(event.target.value) || 0 },
                                }))
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <p className="hint">Select an object or checkpoint to edit its properties.</p>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="tool-section tool-section-compact">
                <p className="tool-title">Raw Map JSON</p>
                <p className="hint inline-hint">Advanced mode for direct schema edits. Structured editor updates this live.</p>
              </div>
              <textarea
                className="map-editor"
                value={mapJson}
                onChange={(event) => setMapJson(event.target.value)}
              />
              <button type="button" onClick={saveDraftMap}>
                Save map JSON
              </button>
              <form className="publish-row" onSubmit={publishSelectedGame}>
                <input
                  placeholder="Changelog for next version"
                  value={publishForm.changelog}
                  onChange={(event) => setPublishForm({ changelog: event.target.value })}
                />
                <button type="submit">Publish version</button>
                <button
                  className="secondary"
                  type="button"
                  onClick={unpublishSelectedGame}
                >
                  Unpublish
                </button>
              </form>
              {editorMessageTone ? <p className={`editor-message editor-message-${editorMessageTone}`}>{editorMessage}</p> : null}
            </div>
          ) : (
            <p>Open a draft from the creator dashboard to edit its JSON map data.</p>
          )}
        </div>
      </section>
      ) : null}
    </main>
  );
}
