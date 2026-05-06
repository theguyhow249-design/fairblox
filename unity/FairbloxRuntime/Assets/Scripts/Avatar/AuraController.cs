using UnityEngine;

namespace Fairblox.Runtime.Avatar
{
    public class AuraController : MonoBehaviour
    {
        [SerializeField] private GameObject neonAura;
        [SerializeField] private GameObject flameAura;
        [SerializeField] private GameObject frostAura;

        public void ApplyAura(AvatarPayloadDto avatar)
        {
            SetActive(neonAura, avatar != null && avatar.aura == "Neon");
            SetActive(flameAura, avatar != null && avatar.aura == "Flame");
            SetActive(frostAura, avatar != null && avatar.aura == "Frost");
        }

        private void SetActive(GameObject target, bool active)
        {
            if (target != null)
            {
                target.SetActive(active);
            }
        }
    }
}
