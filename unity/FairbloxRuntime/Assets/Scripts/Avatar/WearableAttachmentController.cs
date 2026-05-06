using System.Collections.Generic;
using UnityEngine;

namespace Fairblox.Runtime.Avatar
{
    public class WearableAttachmentController : MonoBehaviour
    {
        [System.Serializable]
        public class WearablePrefabEntry
        {
            public string itemId = "";
            public string prefabName = "";
            public GameObject prefab;
        }

        [SerializeField] private AvatarRigController rigController;
        [SerializeField] private WearablePrefabEntry[] wearablePrefabs = new WearablePrefabEntry[0];

        private readonly Dictionary<string, GameObject> activeBySlot = new Dictionary<string, GameObject>();

        public void ApplyWearables(AvatarPayloadDto avatar)
        {
            ClearAll();
            if (avatar == null || avatar.wearables == null)
            {
                return;
            }

            foreach (var wearable in avatar.wearables)
            {
                AttachWearable(wearable);
            }
        }

        private void AttachWearable(WearablePayloadDto wearable)
        {
            if (wearable == null || rigController == null)
            {
                return;
            }

            var attachPoint = rigController.GetAttachPoint(wearable.slot);
            if (attachPoint == null)
            {
                Debug.LogWarning($"[Fairblox] Missing attach point for slot '{wearable.slot}'.");
                return;
            }

            var prefab = ResolvePrefab(wearable);
            if (prefab == null)
            {
                Debug.LogWarning($"[Fairblox] No local prefab mapped for wearable '{wearable.itemId}'.");
                return;
            }

            var instance = Instantiate(prefab, attachPoint, false);
            instance.transform.localPosition = new Vector3(
                wearable.assetOffset != null ? wearable.assetOffset.x : 0f,
                wearable.assetOffset != null ? wearable.assetOffset.y : 0f,
                wearable.assetOffset != null ? wearable.assetOffset.z : 0f
            );
            instance.transform.localRotation = Quaternion.identity;
            instance.transform.localScale = Vector3.one * Mathf.Max(0.1f, wearable.assetScale <= 0f ? 1f : wearable.assetScale);
            activeBySlot[wearable.slot] = instance;
        }

        private GameObject ResolvePrefab(WearablePayloadDto wearable)
        {
            foreach (var entry in wearablePrefabs)
            {
                if (entry == null || entry.prefab == null)
                {
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(wearable.itemId) && entry.itemId == wearable.itemId)
                {
                    return entry.prefab;
                }

                if (!string.IsNullOrWhiteSpace(wearable.assetPrefab) && entry.prefabName == wearable.assetPrefab)
                {
                    return entry.prefab;
                }
            }

            return null;
        }

        public void ClearAll()
        {
            foreach (var pair in activeBySlot)
            {
                if (pair.Value != null)
                {
                    Destroy(pair.Value);
                }
            }
            activeBySlot.Clear();
        }
    }
}
