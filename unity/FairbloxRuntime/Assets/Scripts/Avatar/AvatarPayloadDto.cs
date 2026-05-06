using System;

namespace Fairblox.Runtime.Avatar
{
    [Serializable]
    public class AvatarPayloadDto
    {
        public string displayName = "Player";
        public string motto = "";
        public string aura = "None";
        public string skinTone = "#f6c8a2";
        public string shirtColor = "#f97316";
        public string pantsColor = "#1d4ed8";
        public string face = "Classic Smile";
        public int bodyType = 12;
        public int heightScale = 62;
        public int headScale = 58;
        public string animationStyle = "Default";
        public WearablePayloadDto[] wearables = Array.Empty<WearablePayloadDto>();
    }

    [Serializable]
    public class WearablePayloadDto
    {
        public string slot = "";
        public string itemId = "";
        public string itemName = "";
        public string modelKind = "";
        public string category = "";
        public string emoji = "";
        public string assetBundleUrl = "";
        public string assetPrefab = "";
        public float assetScale = 1f;
        public Vector3Dto assetOffset = new Vector3Dto();
    }

    [Serializable]
    public class Vector3Dto
    {
        public float x;
        public float y;
        public float z;
    }

    [Serializable]
    public class SessionPayloadDto
    {
        public string session = "";
        public string game = "";
        public string username = "";
        public string displayName = "";
        public string coins = "";
        public string shell = "fairblox";
        public AvatarPayloadDto avatar = new AvatarPayloadDto();
    }
}
