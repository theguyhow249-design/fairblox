# Unity Avatar Runtime Spec

This document defines how a future Unity runtime should consume Fairblox avatar and wearable data.

## Goal

Unity should render:

- a real humanoid rig
- body proportion changes
- equipped wearables by slot
- animation style
- aura and identity metadata

The web shell is already passing an `avatar` query parameter into the Unity runtime URL. Unity should treat that payload as the source of truth for the local player avatar.

## Query Payload

The Fairblox shell now passes:

- `session`
- `game`
- `username`
- `displayName`
- `coins`
- `shell`
- `avatar`

The `avatar` parameter is URL-encoded JSON.

Example shape:

```json
{
  "displayName": "Star Builder",
  "motto": "Design worlds. Own the economy.",
  "aura": "None",
  "skinTone": "#f6c8a2",
  "shirtColor": "#f97316",
  "pantsColor": "#1d4ed8",
  "face": "Classic Smile",
  "bodyType": 12,
  "heightScale": 62,
  "headScale": 58,
  "animationStyle": "Default",
  "wearables": [
    {
      "slot": "hat",
      "itemId": "builder-cap",
      "itemName": "Builder Cap",
      "modelKind": "cap",
      "category": "Hat",
      "emoji": "🧢",
      "assetBundleUrl": "https://cdn.fairblox.dev/ugc/builder-cap.bundle",
      "assetPrefab": "BuilderCap",
      "assetScale": 1
    }
  ]
}
```

## Unity Systems

Create these systems first:

- `ShellBootstrap`
- `ShellQueryParser`
- `AvatarRuntimeController`
- `AvatarRigController`
- `WearableAttachmentController`
- `AuraController`
- `AnimationStyleController`

## Unity Scene Structure

Use a runtime scene with:

- `Bootstrap`
- `PlayerRoot`
- `AvatarRig`
- `CameraRig`
- `WorldRoot`
- `UIRoot`

`AvatarRig` should be a humanoid prefab with named attachment transforms.

## Required Attachment Points

The rig should expose transforms for:

- `HatAttach`
- `FaceAttach`
- `NeckAttach`
- `ShoulderAttach`
- `BackAttach`
- `WaistAttach`
- `GearAttach`

These names do not need to be exact, but the mapping must be explicit in code.

## Slot Mapping

Fairblox slot to Unity attach point:

- `hat` -> head top attach
- `face` -> face/front attach
- `neck` -> neck/chest attach
- `shoulder` -> shoulder attach
- `back` -> spine/back attach
- `waist` -> pelvis attach
- `gear` -> hand or hip attach

## C# DTOs

Use DTOs similar to:

```csharp
[Serializable]
public class AvatarPayloadDto {
    public string displayName;
    public string motto;
    public string aura;
    public string skinTone;
    public string shirtColor;
    public string pantsColor;
    public string face;
    public int bodyType;
    public int heightScale;
    public int headScale;
    public string animationStyle;
    public WearablePayloadDto[] wearables;
}

[Serializable]
public class WearablePayloadDto {
    public string slot;
    public string itemId;
    public string itemName;
    public string modelKind;
    public string category;
    public string emoji;
    public string assetBundleUrl;
    public string assetPrefab;
    public float assetScale;
}
```

## Shell Query Parsing

Bootstrap flow:

1. read `Application.absoluteURL`
2. parse query string
3. decode `avatar`
4. deserialize JSON into `AvatarPayloadDto`
5. spawn local player avatar

Basic parser direction:

```csharp
var uri = new Uri(Application.absoluteURL);
var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
var encodedAvatar = query.Get("avatar");
var avatarJson = Uri.UnescapeDataString(encodedAvatar ?? "");
var avatar = JsonUtility.FromJson<AvatarPayloadDto>(avatarJson);
```

If `System.Web` is not available in your target setup, use a lightweight custom query parser.

## Avatar Spawn Flow

At runtime:

1. instantiate the base humanoid rig
2. apply body colors
3. apply face selection
4. apply body proportions
5. apply animation style
6. load and attach wearables
7. apply aura
8. show display name/nametag

## Body Proportion Rules

The incoming values are percentage-style numbers from `0` to `100`.

Recommended mapping:

- `bodyType`
  - affects torso width, arm width, leg width
- `heightScale`
  - affects full rig Y scale
- `headScale`
  - affects head bone or head mesh local scale

Suggested first mapping:

```csharp
float bodyWidth = Mathf.Lerp(0.9f, 1.22f, bodyType / 100f);
float height = Mathf.Lerp(0.9f, 1.4f, heightScale / 100f);
float head = Mathf.Lerp(0.9f, 1.2f, headScale / 100f);
```

Do not use physics-breaking extreme scales in v1.

## Wearable Loading Strategy

Use 2 stages.

### Stage 1

Support local prefab lookup by `itemId` or `assetPrefab`.

This is the fastest path.

Example:

```csharp
Dictionary<string, GameObject> wearablePrefabMap;
```

If the item exists in the local catalog, instantiate it directly.

### Stage 2

Support remote asset bundles via `assetBundleUrl`.

Flow:

1. download asset bundle
2. load prefab named `assetPrefab`
3. instantiate it
4. parent it to the attach point
5. apply `assetScale`

If bundle loading fails, fall back to:

- local placeholder by `modelKind`
- or no visible wearable

## Attachment Rules

When attaching a wearable:

1. destroy existing wearable in that slot
2. instantiate new wearable
3. parent to attach transform
4. set local position to zero
5. set local rotation to identity
6. apply local scale
7. later apply `assetOffset` when used

Example:

```csharp
instance.transform.SetParent(attachPoint, false);
instance.transform.localPosition = Vector3.zero;
instance.transform.localRotation = Quaternion.identity;
instance.transform.localScale = Vector3.one * wearable.assetScale;
```

## Face Rendering

V1 options:

- swap face texture/material
- toggle mesh decals
- use simple face sprite/UV variants

Keep the mapping data-driven:

- `Classic Smile`
- `Wink`
- `Focused`
- `Builder`

## Color Application

Apply:

- `skinTone` to skin materials
- `shirtColor` to torso/arm clothing materials
- `pantsColor` to leg clothing materials

Parse the incoming hex strings in Unity and fall back safely if parsing fails.

## Animation Style

Map:

- `Default`
- `Swagger`
- `Ninja`
- `Dance`

V1 approach:

- use one Animator Controller
- switch blend tree or override controller by style name

## Aura

Map `aura` to optional VFX:

- `None`
- `Neon`
- `Flame`
- `Frost`

V1 can use small particle prefabs parented to the player root.

## Runtime UI

Use the payload to render:

- display name
- optional motto
- aura icon if desired

Do not make Unity the source of truth for profile data. It only mirrors shell state.

## Failure Handling

If the avatar payload is missing or broken:

1. spawn default rig
2. log warning
3. continue runtime

If a wearable fails:

1. log warning with item id
2. skip that slot
3. do not fail the full avatar spawn

## Recommended Folder Structure

For a Unity runtime project:

```text
Assets/
  Scripts/
    Shell/
      ShellBootstrap.cs
      ShellQueryParser.cs
    Avatar/
      AvatarRuntimeController.cs
      AvatarRigController.cs
      WearableAttachmentController.cs
      AuraController.cs
      AnimationStyleController.cs
      AvatarPayloadDto.cs
  Prefabs/
    Avatar/
      PlayerAvatar.prefab
    Wearables/
      BuilderCap.prefab
      NeonBlade.prefab
      CloudWings.prefab
```

## V1 Build Order

1. query parser
2. base humanoid rig prefab
3. body proportion application
4. wearable slot attachment system
5. local prefab wearable catalog
6. face + color application
7. animation style switching
8. aura VFX
9. asset bundle loading

## Immediate Expectation

After this spec is implemented in Unity:

- Fairblox web will pass real avatar data
- Unity will render a real rig instead of a web-only mockup
- marketplace items can become real 3D wearable assets

That is the point where the platform stops feeling like a shell-only prototype.
