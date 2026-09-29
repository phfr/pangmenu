/*
 * Ring HUD menu tree for asdf10k (graph explorer, webgpuxr branch).
 *
 * Every entry mirrors a real control of the app: the lil-gui folders (data, viz setup, Edge
 * Visualization, Render, Diagnostics, relayout, Presets, nav), the Settings window (Highlight nodes,
 * Edge highlighting), the "+" window menu (21 windows), the "f" functions menu (5 subset operations),
 * the icon bar (interaction modes, isolate, subset layout, focus) and the keyboard commands.
 * The mapping item -> source control is documented in asdf10k/docs/menu-tree.md.
 *
 * Structure rules: at most 10 items per ring (root has exactly 10), most branches 2 levels deep,
 * 3 levels only where a group is a genuine sub-topic (Windows, Edges > Advanced, Render > Experiments,
 * Highlight > Edges/Bloom, Layout > Custom, Select > Relayout). Categories are ordered so related
 * things are neighbours on the wheel: Subset / Select / Windows (working with the graph) on one
 * side, Nodes / Edges / Layout / Highlight / Render (appearance) on the other, Navigation and Data
 * closing the circle.
 *
 * type: "submenu" (children[]) | "dropdown" (options[] + selected) |
 *       "slider" (min/max/step/value[, unit, labels[]]) | "toggle" (value: bool) | "action" (leaf) |
 *       "list" (words[]: long alphabetical list with windowed scrolling)
 * Dropdowns whose options depend on the loaded dataset (attribute columns, layouts, presets) carry
 * representative placeholder options; the app fills them at runtime.
 *
 * `icon` on a category is a key into the SVG sprite in index.html (#icon-<key>). Leaves omit it and
 * get the generic per-type icon.
 */
const SCALING_METHODS = [
  { id: "linear", label: "Linear" },
  { id: "log", label: "Log" },
  { id: "symlog", label: "Symlog" },
  { id: "quantile", label: "Quantile" }
];
const NODE_ATTRIBUTES = [
  { id: "size", label: "size" },
  { id: "degree_n", label: "degree_n" },
  { id: "score_n", label: "score_n" },
  { id: "cluster_c", label: "cluster_c" },
  { id: "type_a", label: "type_a" }
];
const EDGE_ATTRIBUTES = [
  { id: "width", label: "width" },
  { id: "weight_n", label: "weight_n" },
  { id: "edge_type_c", label: "edge_type_c" }
];

const RING_MENU_DATA = {
  id: "root",
  label: "asdf10k",
  children: [
    // ------------------------------------------------------------------ 1. Subset (functions menu, icon bar, keys)
    {
      id: "subset", label: "Subset", icon: "subset", color: "#35e6ff", type: "submenu",
      children: [
        { id: "subset_expand_hop", label: "Expand by 1 hop", type: "action" },
        { id: "subset_expand_edge", label: "Expand by edge type…", type: "action" },
        { id: "subset_connect", label: "Connect subset", type: "action" },
        { id: "subset_common_neighbors", label: "Common neighbors", type: "action" },
        { id: "subset_prune_leaves", label: "Prune leaf nodes", type: "action" },
        { id: "subset_isolate", label: "Isolate mode (i)", type: "toggle", value: false },
        { id: "subset_layout", label: "Subset layout (s)", type: "toggle", value: false },
        { id: "subset_focus", label: "Fly to subset", type: "action" },
        { id: "subset_search", label: "Search nodes (/)", type: "action" },
        { id: "subset_clear", label: "Clear subset (Esc)", type: "action" }
      ]
    },
    // ------------------------------------------------------------------ 2. Select (interaction modes + graph commands)
    {
      id: "select", label: "Select", icon: "select", color: "#7fe0c9", type: "submenu",
      children: [
        {
          id: "interaction_mode", label: "Mode (m)", type: "dropdown", selected: "interact",
          options: [
            { id: "interact", label: "Interact (tooltip)" },
            { id: "selection", label: "Selection (click, shift+click)" },
            { id: "freehand", label: "Freehand (draw area)" }
          ]
        },
        { id: "explode_x", label: "Explode X (x)", type: "action" },
        { id: "explode_y", label: "Explode Y (y)", type: "action" },
        { id: "relayout_c", label: "Local relayout (c)", type: "action" },
        { id: "multi_explode_small", label: "Multi-explode S (q)", type: "action" },
        { id: "multi_explode_medium", label: "Multi-explode M (w)", type: "action" },
        { id: "multi_explode_large", label: "Multi-explode L (e)", type: "action" },
        { id: "reset_explosions", label: "Reset explosions (t)", type: "action" },
        { id: "focus_mode", label: "Focus mode (f)", type: "toggle", value: false },
        {
          id: "relayout_settings", label: "Relayout settings", icon: "select", type: "submenu",
          children: [
            { id: "c_radius", label: "C radius", type: "slider", min: 0.6, max: 60, step: 0.6, value: 6, unit: "" },
            { id: "c_movement_scale", label: "C movement scale", type: "slider", min: 0.06, max: 6, step: 0.06, value: 0.6, unit: "" },
            { id: "c_increment", label: "C increment factor", type: "slider", min: 1, max: 3, step: 0.1, value: 1.5, unit: "x" }
          ]
        }
      ]
    },
    // ------------------------------------------------------------------ 3. Windows (the "+" menu, grouped)
    {
      id: "windows", label: "Windows", icon: "windows", color: "#b478ff", type: "submenu",
      children: [
        {
          id: "win_subset", label: "Subset & tables", icon: "windows", type: "submenu",
          children: [
            { id: "win_subset_builder", label: "Subset Query", type: "action" },
            { id: "win_subset_list", label: "Subset List", type: "action" },
            { id: "win_subset_table", label: "Subset Table", type: "action" },
            { id: "win_edge_table", label: "Edge Table", type: "action" },
            { id: "win_kv_table", label: "KV calc table", type: "action" }
          ]
        },
        {
          id: "win_charts", label: "Charts & statistics", icon: "windows", type: "submenu",
          children: [
            { id: "win_distribution", label: "Distributions", type: "action" },
            { id: "win_upset", label: "UpSet", type: "action" },
            { id: "win_heatmap", label: "Heatmap", type: "action" },
            { id: "win_scatter", label: "Scatter chart", type: "action" },
            { id: "win_enrichment", label: "Enrichment", type: "action" },
            { id: "win_lcc", label: "LCC / k-core analysis", type: "action" }
          ]
        },
        {
          id: "win_networks", label: "Network views", icon: "windows", type: "submenu",
          children: [
            { id: "win_subset_network", label: "Subset Network", type: "action" },
            { id: "win_network_meta", label: "Network Meta", type: "action" },
            { id: "win_multi_meta", label: "Multi Meta Network", type: "action" },
            { id: "win_aggregated", label: "Aggregated Network", type: "action" }
          ]
        },
        {
          id: "win_compute", label: "Compute", icon: "windows", type: "submenu",
          children: [
            { id: "win_rwr", label: "RWR", type: "action" },
            { id: "win_layoutcalc", label: "Layout calc", type: "action" },
            { id: "win_clustering", label: "Clustering", type: "action" },
            { id: "win_llm", label: "LLM query", type: "action" }
          ]
        },
        {
          id: "win_info", label: "Info & tools", icon: "windows", type: "submenu",
          children: [
            { id: "win_dataset_info", label: "Dataset info", type: "action" },
            { id: "win_structure3d", label: "Molecular Structure", type: "action" },
            { id: "win_temp_columns", label: "Temporary TSV columns (a)", type: "action" },
            { id: "win_settings", label: "Settings window", type: "action" },
            { id: "win_lilgui", label: "lil-gui window", type: "action" },
            { id: "win_help", label: "Keyboard shortcuts (h)", type: "action" }
          ]
        }
      ]
    },
    // ------------------------------------------------------------------ 4. Nodes (viz setup)
    {
      id: "nodes", label: "Nodes", icon: "nodes", color: "#ffd166", type: "submenu",
      children: [
        { id: "node_size_attr", label: "Size attribute", type: "dropdown", selected: "size", options: NODE_ATTRIBUTES },
        { id: "node_color_attr", label: "Color attribute", type: "dropdown", selected: "cluster_c", options: NODE_ATTRIBUTES },
        { id: "node_mesh_attr", label: "Mesh attribute", type: "dropdown", selected: "type_a", options: NODE_ATTRIBUTES },
        { id: "node_size_scaling", label: "Size scaling", type: "slider", min: 0.001, max: 5, step: 0.0005, value: 1, unit: "x" },
        { id: "node_min_size", label: "Min size", type: "slider", min: 0.001, max: 0.3, step: 0.0001, value: 0.005, unit: "" },
        { id: "node_size_method", label: "Size scaling method", type: "dropdown", selected: "linear", options: SCALING_METHODS },
        { id: "node_color_method", label: "Color scaling method", type: "dropdown", selected: "linear", options: SCALING_METHODS },
        { id: "node_mesh_method", label: "Mesh scaling method", type: "dropdown", selected: "linear", options: SCALING_METHODS }
      ]
    },
    // ------------------------------------------------------------------ 5. Edges (viz setup + Edge Visualization)
    {
      id: "edges", label: "Edges", icon: "edges", color: "#ff8f65", type: "submenu",
      children: [
        { id: "edge_width_attr", label: "Width attribute", type: "dropdown", selected: "width", options: EDGE_ATTRIBUTES },
        { id: "edge_color_attr", label: "Color attribute", type: "dropdown", selected: "edge_type_c", options: EDGE_ATTRIBUTES },
        { id: "edge_width_scaling", label: "Width scaling", type: "slider", min: 0.01, max: 15, step: 0.01, value: 2.5, unit: "x" },
        { id: "edge_min_width", label: "Min width", type: "slider", min: 0.01, max: 20, step: 0.01, value: 2, unit: "" },
        { id: "edge_cutoff", label: "Edge cutoff", type: "slider", min: 0, max: 1, step: 0.01, value: 1, unit: "" },
        { id: "edge_opacity", label: "Opacity", type: "slider", min: 0.01, max: 1, step: 0.01, value: 0.06, unit: "" },
        {
          id: "edge_blending", label: "Blending", type: "dropdown", selected: "additive",
          options: [
            { id: "normal", label: "Normal" },
            { id: "additive", label: "Additive" },
            { id: "multiply", label: "Multiply" }
          ]
        },
        { id: "edge_alpha_by_weight", label: "Alpha by weight", type: "toggle", value: false },
        {
          id: "edge_advanced", label: "Advanced", icon: "edges", type: "submenu",
          children: [
            { id: "edge_alpha_min", label: "Min alpha", type: "slider", min: 0.01, max: 1, step: 0.01, value: 0.1, unit: "" },
            { id: "edge_alpha_max", label: "Max alpha", type: "slider", min: 0.01, max: 1, step: 0.01, value: 1, unit: "" },
            { id: "edge_fade_distance", label: "Fade distance", type: "slider", min: 0.1, max: 1, step: 0.01, value: 0.6, unit: "" },
            { id: "edge_density_mode", label: "Density mode", type: "toggle", value: false },
            { id: "edge_density_scale", label: "Density scale", type: "slider", min: 0.5, max: 5, step: 0.1, value: 1, unit: "x" },
            { id: "edge_width_method", label: "Width scaling method", type: "dropdown", selected: "linear", options: SCALING_METHODS },
            { id: "edge_color_method", label: "Color scaling method", type: "dropdown", selected: "linear", options: SCALING_METHODS }
          ]
        }
      ]
    },
    // ------------------------------------------------------------------ 6. Layout (node layout dropdown, keys, custom columns)
    {
      id: "layout", label: "Layout", icon: "layout", color: "#a8b0ff", type: "submenu",
      children: [
        {
          id: "node_layout", label: "Node layout", type: "dropdown", selected: "default",
          options: [
            { id: "default", label: "default (x, y, z)" },
            { id: "pca", label: "PCA" },
            { id: "cumap", label: "UMAP (cumap)" },
            { id: "cpacmap", label: "PaCMAP (cpacmap)" },
            { id: "custom", label: "custom columns" }
          ]
        },
        { id: "layout_next", label: "Next layout (l)", type: "action" },
        { id: "layout_prev", label: "Previous layout (Shift+L)", type: "action" },
        {
          id: "layout_custom", label: "Custom layout", icon: "layout", type: "submenu",
          children: [
            { id: "custom_x", label: "X column", type: "dropdown", selected: "x", options: [{ id: "x", label: "x" }, { id: "score_n", label: "score_n" }, { id: "degree_n", label: "degree_n" }] },
            { id: "custom_y", label: "Y column", type: "dropdown", selected: "y", options: [{ id: "y", label: "y" }, { id: "score_n", label: "score_n" }, { id: "degree_n", label: "degree_n" }] },
            { id: "custom_z", label: "Z column", type: "dropdown", selected: "z", options: [{ id: "z", label: "z" }, { id: "score_n", label: "score_n" }, { id: "degree_n", label: "degree_n" }] },
            { id: "custom_apply", label: "Apply custom layout", type: "action" }
          ]
        },
        { id: "layout_calc", label: "Compute layout…", type: "action" },
        { id: "layout_clustering", label: "Clustering…", type: "action" }
      ]
    },
    // ------------------------------------------------------------------ 7. Highlight (Settings window)
    {
      id: "highlight", label: "Highlight", icon: "highlight", color: "#ff7bc4", type: "submenu",
      children: [
        { id: "hl_nodes", label: "Highlight nodes", type: "toggle", value: true },
        { id: "hl_fade_others", label: "Fade others", type: "toggle", value: true },
        { id: "hl_fade_opacity", label: "Fade opacity", type: "slider", min: 0, max: 1, step: 0.01, value: 0.45, unit: "" },
        { id: "hl_node_size", label: "Highlight node size", type: "slider", min: 0, max: 4, step: 0.1, value: 1, unit: "x" },
        { id: "hl_glow", label: "Glow opacity", type: "slider", min: 0.2, max: 20, step: 0.1, value: 3.2, unit: "" },
        {
          id: "hl_edges", label: "Edges", icon: "highlight", type: "submenu",
          children: [
            { id: "hl_edges_on", label: "Highlight edges", type: "toggle", value: false },
            { id: "hl_edge_width", label: "Edge width", type: "slider", min: 1, max: 5, step: 0.1, value: 1, unit: "x" },
            { id: "hl_edge_opacity", label: "Highlight edge opacity", type: "slider", min: 0, max: 1, step: 0.01, value: 1, unit: "" },
            { id: "hl_fade_edges", label: "Fade other edges", type: "toggle", value: false },
            { id: "hl_fade_edges_opacity", label: "Fade edges opacity", type: "slider", min: 0, max: 1, step: 0.01, value: 0.3, unit: "" },
            { id: "hl_subset_edges_only", label: "Subset edges only", type: "toggle", value: true },
            {
              id: "hl_edge_subset_mode", label: "Edge subset mode", type: "dropdown", selected: "induced",
              options: [
                { id: "induced", label: "Induced (both nodes)" },
                { id: "incident", label: "Incident (one node)" }
              ]
            }
          ]
        },
        {
          id: "hl_bloom", label: "Bloom", icon: "highlight", type: "submenu",
          children: [
            {
              id: "bloom_mode", label: "Bloom", type: "dropdown", selected: "selection",
              options: [
                { id: "always", label: "Always" },
                { id: "selection", label: "With selection" },
                { id: "off", label: "Off" }
              ]
            },
            { id: "bloom_strength", label: "Strength", type: "slider", min: 0, max: 3, step: 0.05, value: 0.95, unit: "" },
            { id: "bloom_radius", label: "Radius", type: "slider", min: 0, max: 1, step: 0.01, value: 0.15, unit: "" },
            { id: "bloom_threshold", label: "Threshold", type: "slider", min: 0, max: 1, step: 0.01, value: 0.54, unit: "" }
          ]
        }
      ]
    },
    // ------------------------------------------------------------------ 8. Render (Render + Diagnostics folders)
    {
      id: "render", label: "Render", icon: "display", color: "#35c2ff", type: "submenu",
      children: [
        { id: "distance_culling", label: "Distance culling", type: "toggle", value: true },
        { id: "cull_distance", label: "Cull distance", type: "slider", min: 100, max: 1200, step: 20, value: 1200, unit: "" },
        { id: "auto_resolution", label: "Auto resolution", type: "toggle", value: false },
        { id: "target_fps", label: "Target FPS", type: "slider", min: 30, max: 90, step: 1, value: 60, unit: " fps" },
        { id: "resolution_scale", label: "Resolution scale", type: "slider", min: 0.5, max: 4, step: 0.01, value: 1, unit: "x" },
        { id: "show_stats", label: "Show stats", type: "toggle", value: false },
        {
          id: "render_experiments", label: "Experiments (slow)", icon: "display", type: "submenu",
          children: [
            { id: "frustum_cull_instances", label: "Frustum cull instances", type: "toggle", value: false },
            { id: "depth_sort", label: "Depth sort", type: "toggle", value: false },
            { id: "capture_duration", label: "Capture duration", type: "slider", min: 1000, max: 20000, step: 500, value: 5000, unit: " ms" },
            { id: "capture_profile", label: "Capture profile", type: "action" }
          ]
        }
      ]
    },
    // ------------------------------------------------------------------ 9. Navigation (nav folder + camera)
    {
      id: "navigation", label: "Navigation", icon: "navigation", color: "#6ab4ff", type: "submenu",
      children: [
        {
          id: "nav_mode", label: "Mode", type: "dropdown", selected: "trackball",
          options: [
            { id: "trackball", label: "Trackball" },
            { id: "orbit", label: "Orbit" },
            { id: "map", label: "Map" }
          ]
        },
        { id: "nav_speed", label: "Speed", type: "slider", min: 0.1, max: 5, step: 0.1, value: 1, unit: "x" },
        { id: "fog_distance", label: "Fog distance", type: "slider", min: 5, max: 400, step: 1, value: 200, unit: "" },
        { id: "nav_fly_subset", label: "Fly to subset", type: "action" },
        { id: "nav_reset_view", label: "Reset view", type: "action" }
      ]
    },
    // ------------------------------------------------------------------ 10. Data (data + Presets folders)
    {
      id: "data", label: "Data", icon: "data", color: "#c8d36a", type: "submenu",
      children: [
        {
          id: "dataset", label: "Dataset", type: "dropdown", selected: "data",
          options: [
            { id: "data", label: "data (ppicml)" },
            { id: "bench", label: "bench (5k / 100k)" },
            { id: "benchmini", label: "benchmini" }
          ]
        },
        {
          id: "load_preset", label: "Load preset", type: "dropdown", selected: "none",
          options: [
            { id: "none", label: "Select preset…" },
            { id: "default", label: "default" }
          ]
        },
        { id: "save_preset", label: "Save preset", type: "action" },
        { id: "delete_preset", label: "Delete preset", type: "action" },
        { id: "delete_all_presets", label: "Delete all presets", type: "action" },
        { id: "export_nodes_tsv", label: "Export nodes.tsv", type: "action" },
        { id: "export_storage", label: "Export local storage", type: "action" },
        { id: "import_storage", label: "Import local storage", type: "action" },
        { id: "delete_storage", label: "Delete local storage", type: "action" }
      ]
    }
  ]
};
