using UnityEngine;

namespace Fairblox.Runtime.Avatar
{
    public class AnimationStyleController : MonoBehaviour
    {
        [SerializeField] private Animator animator;

        public void ApplyStyle(AvatarPayloadDto avatar)
        {
            if (animator == null || avatar == null)
            {
                return;
            }

            animator.SetFloat("Style_Default", avatar.animationStyle == "Default" ? 1f : 0f);
            animator.SetFloat("Style_Swagger", avatar.animationStyle == "Swagger" ? 1f : 0f);
            animator.SetFloat("Style_Ninja", avatar.animationStyle == "Ninja" ? 1f : 0f);
            animator.SetFloat("Style_Dance", avatar.animationStyle == "Dance" ? 1f : 0f);
        }
    }
}
