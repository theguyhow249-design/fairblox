# Fairblox Runtime

Starter Unity runtime scaffold for Fairblox.

This folder is not a full Unity project yet. It contains the first C# files that a Unity project can import into:

```text
Assets/Scripts/Shell
Assets/Scripts/Avatar
```

## Intended Use

1. Create a Unity project named `FairbloxRuntime`.
2. Copy the `Assets` folder from this scaffold into that project.
3. Create a humanoid player prefab and assign it to `ShellBootstrap`.
4. Add attach-point transforms for:
   - `HatAttach`
   - `FaceAttach`
   - `NeckAttach`
   - `ShoulderAttach`
   - `BackAttach`
   - `WaistAttach`
   - `GearAttach`
5. Add the `ShellBootstrap` component to a boot object in the runtime scene.

## Current Scope

- shell query parsing
- avatar payload DTOs
- player rig spawn
- material color application
- animation style handoff hook
- aura hook
- wearable slot attachment via local prefab catalog

## Next Steps

- create `PlayerAvatar.prefab`
- wire real skinned mesh renderers/materials
- add local wearable prefabs
- add asset bundle loading
- add real face/animation controllers
