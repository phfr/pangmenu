/*
 * Sample HUD menu tree: a generic app Settings screen.
 * type: "submenu" (children[]) | "dropdown" (options[] + selected) |
 *       "slider" (min/max/step/value[, labels[]]) | "toggle" (value: bool) | "action" (leaf)
 * 8 top-level categories, even count, per marking-menu HCI guidance (Kurtenbach).
 *
 * `icon` on a category is a key into the SVG icon sprite in index.html (see
 * #icon-<key> symbols). Leaf items (depth 1+) omit `icon` on purpose — the
 * renderer falls back to a generic icon per item type (slider/dropdown/toggle/
 * action), keeping the icon set small, consistent and easy to tint, per the
 * "simpler, tinted" icon request. The label text is what distinguishes them.
 */
const RING_MENU_DATA = {
  id: "root",
  label: "Settings",
  children: [
    {
      id: "display", label: "Display", icon: "display", color: "#35e6ff", type: "submenu",
      children: [
        {
          id: "resolution", label: "Resolution", type: "dropdown",
          selected: "1080p",
          options: [
            { id: "1080p", label: "1920×1080" },
            { id: "1440p", label: "2560×1440" },
            { id: "4k", label: "3840×2160" }
          ]
        },
        { id: "brightness", label: "Brightness", type: "slider", min: 0, max: 100, step: 1, value: 70, unit: "%" },
        { id: "fullscreen", label: "Fullscreen", type: "toggle", value: true },
        {
          id: "frame_rate", label: "Frame Rate Limit", type: "dropdown",
          selected: "60",
          options: [
            { id: "60", label: "60 fps" },
            { id: "120", label: "120 fps" },
            { id: "144", label: "144 fps" },
            { id: "unlimited", label: "Unlimited" }
          ]
        }
      ]
    },
    {
      id: "graphics", label: "Graphics", icon: "graphics", color: "#b478ff", type: "submenu",
      children: [
        {
          id: "quality_preset", label: "Quality Preset", type: "dropdown",
          selected: "high",
          options: [
            { id: "low", label: "Low" },
            { id: "medium", label: "Medium" },
            { id: "high", label: "High" },
            { id: "ultra", label: "Ultra" }
          ]
        },
        { id: "vsync", label: "V-Sync", type: "toggle", value: true },
        { id: "render_scale", label: "Render Scale", type: "slider", min: 50, max: 200, step: 10, value: 100, unit: "%" },
        {
          id: "advanced", label: "Advanced", icon: "system", type: "submenu",
          children: [
            {
              id: "anti_aliasing", label: "Anti-Aliasing", type: "dropdown",
              selected: "taa",
              options: [
                { id: "off", label: "Off" },
                { id: "fxaa", label: "FXAA" },
                { id: "taa", label: "TAA" },
                { id: "msaa4", label: "MSAA 4x" }
              ]
            },
            {
              id: "texture_quality", label: "Texture Quality", type: "dropdown",
              selected: "high",
              options: [
                { id: "low", label: "Low" },
                { id: "medium", label: "Medium" },
                { id: "high", label: "High" },
                { id: "ultra", label: "Ultra" }
              ]
            },
            {
              id: "shadow_quality", label: "Shadow Quality", type: "dropdown",
              selected: "medium",
              options: [
                { id: "low", label: "Low" },
                { id: "medium", label: "Medium" },
                { id: "high", label: "High" }
              ]
            }
          ]
        }
      ]
    },
    {
      // Demonstrates a 4th menu type: "list" — a long, alphabetically sorted
      // set of words too big to fan out all at once. Only a 12-item window
      // is shown; hovering the top/bottom slot auto-scrolls, with an angular
      // scrollbar arc along the outer edge showing position in the full list.
      id: "open_tool", label: "Open Tool", icon: "list", color: "#7fe0c9", type: "list",
      words: [
        "Amber", "Anchor", "Basalt", "Beacon", "Cactus", "Cobalt", "Delta", "Driftwood",
        "Ember", "Falcon", "Glacier", "Granite", "Harbor", "Indigo", "Juniper", "Kernel",
        "Lumen", "Marble", "Meadow", "Nebula", "Onyx", "Prism", "Quartz", "Raven",
        "Solstice", "Talon", "Umbra", "Velvet", "Willow", "Xenon", "Yonder", "Zephyr"
      ]
    },
    {
      id: "controls", label: "Controls", icon: "controls", color: "#ff8f65", type: "submenu",
      children: [
        { id: "mouse_sensitivity", label: "Mouse Sensitivity", type: "slider", min: 1, max: 10, step: 1, value: 5, unit: "x" },
        { id: "invert_y", label: "Invert Y-Axis", type: "toggle", value: false },
        { id: "vibration", label: "Vibration", type: "toggle", value: true },
        {
          id: "input_device", label: "Input Device", type: "dropdown",
          selected: "kbm",
          options: [
            { id: "kbm", label: "Keyboard & Mouse" },
            { id: "gamepad", label: "Gamepad" },
            { id: "touch", label: "Touch" }
          ]
        }
      ]
    },
    {
      id: "accessibility", label: "Accessibility", icon: "accessibility", color: "#6ab4ff", type: "submenu",
      children: [
        { id: "subtitles", label: "Subtitles", type: "toggle", value: true },
        {
          id: "text_size", label: "Text Size", type: "slider",
          min: 1, max: 4, step: 1, value: 2, unit: "",
          labels: ["Small", "Medium", "Large", "X-Large"]
        },
        {
          id: "colorblind_mode", label: "Colorblind Mode", type: "dropdown",
          selected: "off",
          options: [
            { id: "off", label: "Off" },
            { id: "protanopia", label: "Protanopia" },
            { id: "deuteranopia", label: "Deuteranopia" },
            { id: "tritanopia", label: "Tritanopia" }
          ]
        },
        { id: "high_contrast", label: "High Contrast", type: "toggle", value: false }
      ]
    },
    {
      id: "network", label: "Network", icon: "network", color: "#35c2ff", type: "submenu",
      children: [
        { id: "auto_update", label: "Auto-Update", type: "toggle", value: true },
        { id: "bandwidth_limit", label: "Bandwidth Limit", type: "slider", min: 0, max: 200, step: 10, value: 0, unit: " Mbps" },
        { id: "data_saver", label: "Data Saver", type: "toggle", value: false }
      ]
    },
    {
      id: "privacy", label: "Privacy", icon: "privacy", color: "#ff7bc4", type: "submenu",
      children: [
        { id: "share_analytics", label: "Share Analytics", type: "toggle", value: true },
        { id: "crash_reports", label: "Crash Reports", type: "toggle", value: true },
        { id: "personalized_ads", label: "Personalized Ads", type: "toggle", value: false }
      ]
    },
    {
      id: "system", label: "System", icon: "system", color: "#a8b0ff", type: "submenu",
      children: [
        {
          id: "language", label: "Language", type: "dropdown",
          selected: "en",
          options: [
            { id: "en", label: "English" },
            { id: "de", label: "Deutsch" },
            { id: "es", label: "Español" },
            { id: "fr", label: "Français" }
          ]
        },
        { id: "reset_defaults", label: "Reset to Defaults", type: "action" },
        { id: "about", label: "About", type: "action" }
      ]
    },
    {
      id: "sound", label: "Sound", icon: "sound", color: "#ffd166", type: "submenu",
      children: [
        { id: "master_volume", label: "Master Volume", type: "slider", min: 0, max: 100, step: 1, value: 75, unit: "%" },
        { id: "music_volume", label: "Music Volume", type: "slider", min: 0, max: 100, step: 1, value: 60, unit: "%" },
        { id: "voice_volume", label: "Voice Volume", type: "slider", min: 0, max: 100, step: 1, value: 80, unit: "%" },
        { id: "mute_all", label: "Mute All", type: "toggle", value: false }
      ]
    }
  ]
};
