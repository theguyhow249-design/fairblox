using TMPro;
using UnityEngine;

namespace Fairblox.Runtime.Avatar
{
    public class AvatarRuntimeController : MonoBehaviour
    {
        [SerializeField] private AvatarRigController rigController;
        [SerializeField] private WearableAttachmentController wearableAttachmentController;
        [SerializeField] private AnimationStyleController animationStyleController;
        [SerializeField] private AuraController auraController;
        [SerializeField] private TMP_Text displayNameLabel;
        [SerializeField] private TMP_Text mottoLabel;

        public void ApplyAvatar(AvatarPayloadDto avatar)
        {
            if (avatar == null)
            {
                avatar = new AvatarPayloadDto();
            }

            if (rigController != null)
            {
                rigController.ApplyAvatar(avatar);
            }

            if (wearableAttachmentController != null)
            {
                wearableAttachmentController.ApplyWearables(avatar);
            }

            if (animationStyleController != null)
            {
                animationStyleController.ApplyStyle(avatar);
            }

            if (auraController != null)
            {
                auraController.ApplyAura(avatar);
            }

            if (displayNameLabel != null)
            {
                displayNameLabel.text = string.IsNullOrWhiteSpace(avatar.displayName) ? "Player" : avatar.displayName;
            }

            if (mottoLabel != null)
            {
                mottoLabel.text = avatar.motto ?? string.Empty;
            }
        }
    }
}
