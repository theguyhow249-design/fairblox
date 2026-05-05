import { createHash, randomUUID } from "node:crypto";
const users = new Map();
const sessions = new Map();
function hashPassword(password) {
    return createHash("sha256").update(password).digest("hex");
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
function issueAuthResponse(user) {
    const token = randomUUID();
    sessions.set(token, user.id);
    return {
        token,
        profile: toProfileSummary(user),
    };
}
export function signup(input) {
    const username = input.username.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    if (!username || !email || !displayName || !input.password.trim()) {
        throw new Error("All signup fields are required.");
    }
    if (users.has(username)) {
        throw new Error("Username is already taken.");
    }
    for (const user of users.values()) {
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
    users.set(username, user);
    return issueAuthResponse(user);
}
export function login(input) {
    const username = input.username.trim().toLowerCase();
    const user = users.get(username);
    if (!user || user.passwordHash !== hashPassword(input.password)) {
        throw new Error("Invalid username or password.");
    }
    return issueAuthResponse(user);
}
export function getProfileByUsername(username) {
    const user = users.get(username.trim().toLowerCase());
    return user ? toProfileSummary(user) : null;
}
export function getProfileFromToken(token) {
    if (!token) {
        return null;
    }
    const userId = sessions.get(token);
    if (!userId) {
        return null;
    }
    for (const user of users.values()) {
        if (user.id === userId) {
            return toProfileSummary(user);
        }
    }
    return null;
}
const seeded = signup({
    email: "creator@fairblox.dev",
    username: "plutobuilds",
    password: "demo123",
    displayName: "PlutoBuilds",
});
void seeded;
