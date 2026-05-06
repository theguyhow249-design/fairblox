using Fairblox.Runtime.Avatar;
using UnityEngine;

namespace Fairblox.Runtime.Shell
{
    public class ShellBootstrap : MonoBehaviour
    {
        [SerializeField] private GameObject playerAvatarPrefab;
        [SerializeField] private Transform playerSpawnPoint;

        private GameObject spawnedAvatar;

        private void Start()
        {
            var session = ShellQueryParser.Parse(Application.absoluteURL);
            SpawnPlayer(session.avatar);
        }

        private void SpawnPlayer(AvatarPayloadDto avatar)
        {
            if (playerAvatarPrefab == null)
            {
                Debug.LogWarning("[Fairblox] Missing player avatar prefab on ShellBootstrap.");
                return;
            }

            var spawnPosition = playerSpawnPoint != null ? playerSpawnPoint.position : Vector3.zero;
            var spawnRotation = playerSpawnPoint != null ? playerSpawnPoint.rotation : Quaternion.identity;
            spawnedAvatar = Instantiate(playerAvatarPrefab, spawnPosition, spawnRotation);

            var controller = spawnedAvatar.GetComponent<AvatarRuntimeController>();
            if (controller == null)
            {
                Debug.LogWarning("[Fairblox] Spawned player avatar is missing AvatarRuntimeController.");
                return;
            }

            controller.ApplyAvatar(avatar);
        }
    }
}
