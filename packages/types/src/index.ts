export type UserRole = "player" | "creator" | "admin";

export type GameGenre = "obby" | "minigame" | "collectathon";

export type GameVisibility = "draft" | "published" | "hidden";

export interface GameCard {
  id: string;
  title: string;
  slug: string;
  description: string;
  genre: GameGenre;
  creatorName: string;
  unityWebglUrl?: string;
  thumbnailUrl?: string;
  visits: number;
  likes: number;
}

export interface PublishedGameDetail extends GameCard {
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  publishedVersionNumber: number;
  mapData: GameMapData;
}

export interface GameSessionSummary {
  id: string;
  gameId: string;
  gameSlug: string;
  gameTitle: string;
  region: string;
  status: "open" | "full";
  playerCount: number;
  maxPlayers: number;
  joinedAt: string;
  spawn: {
    x: number;
    y: number;
    z: number;
  };
}

export interface ApiHealthResponse {
  ok: true;
  service: "fairblox-api";
}

export interface ProfileSummary {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarPreset: string;
  coins: number;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  profile: ProfileSummary;
}

export interface SignupRequest {
  email: string;
  username: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  // Use identifier for new clients; username/email remain for backward compatibility.
  identifier?: string;
  username?: string;
  email?: string;
  password: string;
}

export interface GameDraft {
  id: string;
  title: string;
  slug: string;
  description: string;
  genre: GameGenre;
  unityWebglUrl?: string;
  visibility: GameVisibility;
  creatorId: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
  versionCount: number;
  publishedVersionNumber: number | null;
}

export interface CreateGameRequest {
  title: string;
  description: string;
  genre: GameGenre;
}

export interface GameVector3 {
  x: number;
  y: number;
  z: number;
}

export interface GameRotation3 {
  x: number;
  y: number;
  z: number;
}

export interface GameCheckpoint {
  id: string;
  position: GameVector3;
  radius?: number;
  label?: string;
}

export type GameWorldObjectType =
  | "platform"
  | "start-pad"
  | "goal"
  | "hazard"
  | "pickup"
  | "wall"
  | "arena"
  | "cover"
  | "hub"
  | "tower"
  | "coin"
  | "spawn"
  | "teleport"
  | "npc"
  | "custom";

export type GameWorldMaterial = "plastic" | "metal" | "neon" | "stone" | "wood" | "glass";

export interface GameWorldObject {
  id: string;
  type: GameWorldObjectType | string;
  position: GameVector3;
  rotation: GameRotation3;
  size: GameVector3;
  color: string;
  material?: GameWorldMaterial;
  tags?: string[];
  config?: Record<string, string | number | boolean>;
}

export interface GameMapData {
  spawn: GameVector3;
  checkpoints: GameCheckpoint[];
  objects: GameWorldObject[];
}

export interface GameDraftDetail extends GameDraft {
  mapData: GameMapData;
}

export interface SaveMapRequest {
  mapData: GameMapData;
  unityWebglUrl?: string;
}

export interface PublishGameRequest {
  changelog: string;
}

export type WorldProjectTemplate = "blank" | "social-hub" | "adventure" | "open-world";

export type WorldProjectVisibility = "draft" | "published" | "hidden";

export type WorldTerrainMaterial = "grass" | "dirt" | "rock" | "sand" | "path" | "snow";

export type WorldZoneType =
  | "portal"
  | "shop"
  | "safe"
  | "quest"
  | "spawn"
  | "checkpoint"
  | "pvp"
  | "music"
  | "custom";

export type WorldZoneShape = "box" | "sphere";

export interface WorldEnvironmentSettings {
  skyColor: string;
  fogColor?: string;
  waterLevel?: number;
  ambientLight?: number;
  sunHeading?: number;
}

export interface WorldMetadata {
  title: string;
  slug: string;
  description: string;
  template: WorldProjectTemplate;
  maxPlayers: number;
  spawn: GameVector3;
  environment: WorldEnvironmentSettings;
}

export interface WorldTerrainData {
  heightSeed: number;
  paintSeed: number;
  materials: WorldTerrainMaterial[];
}

export interface WorldObjectData {
  id: string;
  prefabId: string;
  position: GameVector3;
  rotation: GameRotation3;
  scale: GameVector3;
  tags?: string[];
  config?: Record<string, string | number | boolean>;
}

export interface WorldZoneData {
  id: string;
  type: WorldZoneType | string;
  shape: WorldZoneShape;
  position: GameVector3;
  size: GameVector3;
  config?: Record<string, string | number | boolean>;
}

export interface WorldChunkData {
  id: string;
  cx: number;
  cz: number;
  terrain: WorldTerrainData;
  objects: WorldObjectData[];
  zones: WorldZoneData[];
  checkpoints: GameCheckpoint[];
  updatedAt: string;
}

export interface WorldRegionSummary {
  id: string;
  name: string;
  minChunkX: number;
  maxChunkX: number;
  minChunkZ: number;
  maxChunkZ: number;
}

export interface WorldProjectSummary {
  id: string;
  title: string;
  slug: string;
  description: string;
  template: WorldProjectTemplate;
  visibility: WorldProjectVisibility;
  creatorId: string;
  creatorName: string;
  unityWebglUrl?: string;
  publishedVersionNumber: number | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorldProject extends WorldProjectSummary {
  metadata: WorldMetadata;
  regions: WorldRegionSummary[];
  chunks: WorldChunkData[];
}

export interface CreateWorldProjectRequest {
  title: string;
  description: string;
  template?: WorldProjectTemplate;
}

export interface UpdateWorldProjectRequest {
  metadata: WorldMetadata;
  regions: WorldRegionSummary[];
  unityWebglUrl?: string;
}

export interface SaveWorldChunkRequest {
  chunk: WorldChunkData;
}

export interface PublishWorldProjectRequest {
  changelog: string;
}

export interface WorldProjectResponse {
  project: WorldProject;
}

export interface WorldProjectsResponse {
  projects: WorldProjectSummary[];
}

export interface AccountMessage {
  from: "me" | "friend";
  body: string;
  at: string;
}

export interface AccountMessageThread {
  id: string;
  name: string;
  status: string;
  messages: AccountMessage[];
}

export interface AvatarDraft {
  skinTone: string;
  shirtColor: string;
  pantsColor: string;
  face: string;
  accessory: string;
}

export interface AvatarSlot {
  id: string;
  name: string;
  draft: AvatarDraft;
}

export interface AccountState {
  walletCoins: number;
  ownedItemIds: string[];
  selectedThreadId: string;
  avatarDraft: AvatarDraft;
  activeAvatarSlotId: string;
  avatarSlots: AvatarSlot[];
  messageThreads: AccountMessageThread[];
}

export interface AccountStateResponse {
  state: AccountState;
}

export interface SaveAccountStateRequest {
  state: AccountState;
}

export type MarketplaceModelKind =
  | "cap"
  | "blade"
  | "wings"
  | "boombox"
  | "crown"
  | "glasses"
  | "helmet"
  | "halo"
  | "chain"
  | "dino"
  | "custom";

export interface MarketplaceItemRecord {
  id: string;
  name: string;
  category: string;
  price: number;
  accent: string;
  modelKind: MarketplaceModelKind;
  emoji: string;
  description: string;
  creator: string;
  limited?: boolean;
  sale?: boolean;
  supply?: number;
  createdAt?: number;
  source?: "official" | "ugc";
}

export interface MarketplaceItemsResponse {
  items: MarketplaceItemRecord[];
}

export interface CreateMarketplaceItemRequest {
  name: string;
  category: "Hat" | "Gear" | "Back" | "Accessory" | "Face";
  price: number;
  accent: string;
  modelKind: MarketplaceModelKind;
  emoji: string;
  description: string;
  limited: boolean;
  supply?: number;
}

export interface CreateMarketplaceItemResponse {
  item: MarketplaceItemRecord;
}

export interface CreateMarketplaceTradeRequest {
  targetItemId: string;
  offerItemId: string;
  offerCoins: number;
  requestId?: string;
}

export interface PurchaseMarketplaceItemRequest {
  itemId: string;
  requestId?: string;
}

export interface PurchaseCurrencyRequest {
  coins: number;
  usdCents: number;
  provider?: "stripe" | "simulated";
  requestId?: string;
}

export type PaymentProvider = "stripe";

export type CurrencyPurchaseOrderStatus =
  | "pending"
  | "checkout_created"
  | "paid"
  | "fulfilled"
  | "failed";

export interface CurrencyPurchaseCheckoutRequest {
  coins: number;
  usdCents: number;
  provider: PaymentProvider;
  requestId?: string;
}

export interface CurrencyPurchaseOrder {
  id: string;
  userId: string;
  provider: PaymentProvider;
  status: CurrencyPurchaseOrderStatus;
  coins: number;
  usdCents: number;
  checkoutUrl?: string;
  providerSessionId?: string;
  requestId?: string;
  createdAt: string;
  updatedAt: string;
  fulfilledAt?: string;
}

export interface CurrencyPurchaseCheckoutResponse {
  order: CurrencyPurchaseOrder;
}

export interface CurrencyPurchaseOrderResponse {
  order: CurrencyPurchaseOrder;
}

export interface EconomySummary {
  creatorGrossCoins: number;
  creatorNetCoins: number;
  platformFeeCoins: number;
  salesCount: number;
  purchasesCount: number;
}

export interface EconomySummaryResponse {
  summary: EconomySummary;
}
