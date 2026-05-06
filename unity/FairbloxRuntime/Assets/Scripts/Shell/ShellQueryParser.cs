using System;
using System.Collections.Generic;
using Fairblox.Runtime.Avatar;
using UnityEngine;

namespace Fairblox.Runtime.Shell
{
    public static class ShellQueryParser
    {
        public static SessionPayloadDto Parse(string absoluteUrl)
        {
            var payload = new SessionPayloadDto();
            if (string.IsNullOrWhiteSpace(absoluteUrl))
            {
                return payload;
            }

            try
            {
                var uri = new Uri(absoluteUrl);
                var query = ParseQuery(uri.Query);

                payload.session = GetValue(query, "session");
                payload.game = GetValue(query, "game");
                payload.username = GetValue(query, "username");
                payload.displayName = GetValue(query, "displayName");
                payload.coins = GetValue(query, "coins");
                payload.shell = GetValue(query, "shell", "fairblox");

                var avatarRaw = GetValue(query, "avatar");
                if (!string.IsNullOrWhiteSpace(avatarRaw))
                {
                    payload.avatar = JsonUtility.FromJson<AvatarPayloadDto>(avatarRaw) ?? new AvatarPayloadDto();
                }
            }
            catch (Exception exception)
            {
                Debug.LogWarning($"[Fairblox] Failed to parse shell query: {exception.Message}");
            }

            return payload;
        }

        private static Dictionary<string, string> ParseQuery(string query)
        {
            var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(query))
            {
                return values;
            }

            var trimmed = query.StartsWith("?") ? query.Substring(1) : query;
            var pairs = trimmed.Split('&', StringSplitOptions.RemoveEmptyEntries);
            foreach (var pair in pairs)
            {
                var index = pair.IndexOf('=');
                if (index < 0)
                {
                    values[Uri.UnescapeDataString(pair)] = "";
                    continue;
                }

                var key = Uri.UnescapeDataString(pair.Substring(0, index));
                var value = Uri.UnescapeDataString(pair.Substring(index + 1));
                values[key] = value;
            }

            return values;
        }

        private static string GetValue(Dictionary<string, string> values, string key, string fallback = "")
        {
            return values.TryGetValue(key, out var value) ? value : fallback;
        }
    }
}
