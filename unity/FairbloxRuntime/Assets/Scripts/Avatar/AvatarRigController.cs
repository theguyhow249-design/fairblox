using UnityEngine;

namespace Fairblox.Runtime.Avatar
{
    public class AvatarRigController : MonoBehaviour
    {
        [Header("Rig Transforms")]
        [SerializeField] private Transform rootScaleTarget;
        [SerializeField] private Transform headScaleTarget;
        [SerializeField] private Transform torsoScaleTarget;
        [SerializeField] private Transform leftArmScaleTarget;
        [SerializeField] private Transform rightArmScaleTarget;
        [SerializeField] private Transform leftLegScaleTarget;
        [SerializeField] private Transform rightLegScaleTarget;

        [Header("Attachment Points")]
        [SerializeField] private Transform hatAttach;
        [SerializeField] private Transform faceAttach;
        [SerializeField] private Transform neckAttach;
        [SerializeField] private Transform shoulderAttach;
        [SerializeField] private Transform backAttach;
        [SerializeField] private Transform waistAttach;
        [SerializeField] private Transform gearAttach;

        [Header("Materials")]
        [SerializeField] private Renderer[] skinRenderers = new Renderer[0];
        [SerializeField] private Renderer[] shirtRenderers = new Renderer[0];
        [SerializeField] private Renderer[] pantsRenderers = new Renderer[0];

        public Transform GetAttachPoint(string slot)
        {
            return slot switch
            {
                "hat" => hatAttach,
                "face" => faceAttach,
                "neck" => neckAttach,
                "shoulder" => shoulderAttach,
                "back" => backAttach,
                "waist" => waistAttach,
                "gear" => gearAttach,
                _ => null,
            };
        }

        public void ApplyAvatar(AvatarPayloadDto avatar)
        {
            ApplyColors(avatar);
            ApplyProportions(avatar);
        }

        private void ApplyColors(AvatarPayloadDto avatar)
        {
            ApplyColorGroup(skinRenderers, avatar.skinTone, new Color32(246, 200, 162, 255));
            ApplyColorGroup(shirtRenderers, avatar.shirtColor, new Color32(249, 115, 22, 255));
            ApplyColorGroup(pantsRenderers, avatar.pantsColor, new Color32(29, 78, 216, 255));
        }

        private void ApplyColorGroup(Renderer[] renderers, string htmlColor, Color fallback)
        {
            if (!ColorUtility.TryParseHtmlString(htmlColor, out var parsed))
            {
                parsed = fallback;
            }

            foreach (var renderer in renderers)
            {
                if (renderer == null || renderer.material == null)
                {
                    continue;
                }
                renderer.material.color = parsed;
            }
        }

        private void ApplyProportions(AvatarPayloadDto avatar)
        {
            var bodyWidth = Mathf.Lerp(0.9f, 1.22f, Mathf.Clamp01(avatar.bodyType / 100f));
            var heightScale = Mathf.Lerp(0.9f, 1.4f, Mathf.Clamp01(avatar.heightScale / 100f));
            var headScale = Mathf.Lerp(0.9f, 1.2f, Mathf.Clamp01(avatar.headScale / 100f));

            if (rootScaleTarget != null)
            {
                rootScaleTarget.localScale = new Vector3(1f, heightScale, 1f);
            }

            if (headScaleTarget != null)
            {
                headScaleTarget.localScale = new Vector3(headScale, headScale, headScale);
            }

            SetWidthScale(torsoScaleTarget, bodyWidth);
            SetWidthScale(leftArmScaleTarget, Mathf.Lerp(0.95f, 1.16f, Mathf.Clamp01(avatar.bodyType / 100f)));
            SetWidthScale(rightArmScaleTarget, Mathf.Lerp(0.95f, 1.16f, Mathf.Clamp01(avatar.bodyType / 100f)));
            SetWidthScale(leftLegScaleTarget, Mathf.Lerp(0.95f, 1.14f, Mathf.Clamp01(avatar.bodyType / 100f)));
            SetWidthScale(rightLegScaleTarget, Mathf.Lerp(0.95f, 1.14f, Mathf.Clamp01(avatar.bodyType / 100f)));
        }

        private void SetWidthScale(Transform target, float width)
        {
            if (target == null)
            {
                return;
            }

            var scale = target.localScale;
            scale.x = width;
            target.localScale = scale;
        }
    }
}
